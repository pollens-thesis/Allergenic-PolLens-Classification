// ---------------------------------------------------------------------------
// PDF export for a full report.
//
// jsPDF draws the document directly rather than screenshotting the page, so the
// output is real selectable text at print resolution instead of a bitmap of the
// UI. Layout is a single column on A4 with a manual cursor; every block checks
// the remaining space and starts a new page when it would overflow.
//
// The document mirrors what the report page shows, in the same order: a
// masthead, the figures at a glance, what the researcher recorded, the combined
// reading, then each slide with its image — grain boxes drawn over it as vector
// rectangles, so they stay crisp at any zoom — its table and its note.
// ---------------------------------------------------------------------------

import { jsPDF } from "jspdf";
import {
  aggregateSlideDetections,
  formatCollectedAt,
  formatTime,
  getCollectionDate,
  getCollectionTime,
  getSpecies,
  getTopDetection,
  getTotalGrains,
  getWeightedAvgConfidence,
  type DetectedGrain,
  type Specimen,
  type SpecimenDetection,
} from "@/lib/data";
import type { PlaceStats } from "@/lib/geo";

const PAGE = { width: 210, height: 297 }; // A4, millimetres
const MARGIN = 16;
const CONTENT_WIDTH = PAGE.width - MARGIN * 2;
const FOOTER_SPACE = 14;

const INK = "#23261f";
const MUTED = "#6d7268";
const RULE = "#d9d5c8";
const PANEL = "#f6f1e4";
const PARCHMENT = "#f1ede0";
const FIELD = "#0b1d17";
const ACCENT = "#d9704a";

type Cursor = { doc: jsPDF; y: number };

/**
 * Species colours are design tokens (`var(--grass)`), which jsPDF cannot read.
 * Resolve them against the document once per export; anything already literal
 * passes straight through.
 */
function resolveColor(value: string): string {
  const token = value.match(/^var\((--[\w-]+)\)$/);
  if (!token) return value;
  if (typeof document === "undefined") return MUTED;
  const resolved = getComputedStyle(document.documentElement)
    .getPropertyValue(token[1])
    .trim();
  return resolved || MUTED;
}

function speciesColor(speciesId: SpecimenDetection["speciesId"]): string {
  return resolveColor(getSpecies(speciesId).color);
}

function newPage(cursor: Cursor) {
  cursor.doc.addPage();
  cursor.y = MARGIN;
}

/** Starts a new page when `needed` millimetres would not fit below the cursor. */
function ensureSpace(cursor: Cursor, needed: number) {
  if (cursor.y + needed > PAGE.height - MARGIN - FOOTER_SPACE) newPage(cursor);
}

function rule(cursor: Cursor) {
  cursor.doc.setDrawColor(RULE);
  cursor.doc.setLineWidth(0.2);
  cursor.doc.line(MARGIN, cursor.y, PAGE.width - MARGIN, cursor.y);
  cursor.y += 5;
}

function heading(cursor: Cursor, text: string) {
  ensureSpace(cursor, 16);
  cursor.doc.setFont("helvetica", "bold");
  cursor.doc.setFontSize(10);
  cursor.doc.setTextColor(INK);
  cursor.doc.text(text.toUpperCase(), MARGIN, cursor.y);
  cursor.y += 2;
  rule(cursor);
}

function paragraph(cursor: Cursor, text: string, italic = false) {
  const doc = cursor.doc;
  doc.setFont("helvetica", italic ? "italic" : "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(italic ? MUTED : INK);
  for (const line of doc.splitTextToSize(text, CONTENT_WIDTH)) {
    ensureSpace(cursor, 6);
    doc.text(line, MARGIN, cursor.y);
    cursor.y += 5;
  }
  cursor.y += 2;
}

/**
 * The document's masthead: a dark band carrying the report's identity, so a
 * printed page is recognisable as a PolLens record at a glance.
 */
function masthead(
  cursor: Cursor,
  { title, rightTop, rightBottom }: { title: string; rightTop: string; rightBottom: string },
) {
  const doc = cursor.doc;
  const height = 26;

  doc.setFillColor(FIELD);
  doc.rect(0, 0, PAGE.width, height, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor("#8fa396");
  doc.text("POLLENS  ·  RESEARCH CONSOLE", MARGIN, 10);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(PARCHMENT);
  doc.text(doc.splitTextToSize(title, CONTENT_WIDTH - 55)[0] ?? title, MARGIN, 19);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(rightTop, PAGE.width - MARGIN, 12, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor("#8fa396");
  doc.text(rightBottom, PAGE.width - MARGIN, 18, { align: "right" });

  cursor.y = height + 10;
}

/** A figure with its label, boxed — the print equivalent of the stat tiles. */
function summaryTiles(cursor: Cursor, tiles: { value: string; label: string }[]) {
  const doc = cursor.doc;
  const gap = 4;
  const width = (CONTENT_WIDTH - gap * (tiles.length - 1)) / tiles.length;
  const height = 17;

  ensureSpace(cursor, height + 4);
  tiles.forEach((tile, index) => {
    const x = MARGIN + index * (width + gap);
    doc.setFillColor(PANEL);
    doc.setDrawColor(RULE);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, cursor.y, width, height, 1.5, 1.5, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(INK);
    doc.text(tile.value, x + width / 2, cursor.y + 8, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED);
    doc.text(tile.label.toUpperCase(), x + width / 2, cursor.y + 13, { align: "center" });
  });

  cursor.y += height + 6;
}

/**
 * Composition of the whole reading as one stacked bar, with a legend beneath.
 * A table gives the numbers; this gives the proportions at a glance.
 */
function compositionBar(cursor: Cursor, detections: SpecimenDetection[]) {
  if (detections.length === 0) return;
  const doc = cursor.doc;
  const total = getTotalGrains(detections);
  if (total === 0) return;

  const height = 5;
  ensureSpace(cursor, height + 12);

  let x = MARGIN;
  detections.forEach((detection) => {
    const width = (detection.grainCount / total) * CONTENT_WIDTH;
    doc.setFillColor(speciesColor(detection.speciesId));
    doc.rect(x, cursor.y, width, height, "F");
    x += width;
  });
  cursor.y += height + 5;

  // Legend: swatch, code and share, wrapping onto a second line if needed.
  let legendX = MARGIN;
  doc.setFontSize(7.5);
  detections.forEach((detection) => {
    const species = getSpecies(detection.speciesId);
    const label = `${species.code} ${Math.round((detection.grainCount / total) * 100)}%`;
    doc.setFont("helvetica", "normal");
    const width = doc.getTextWidth(label) + 7;
    if (legendX + width > PAGE.width - MARGIN) {
      legendX = MARGIN;
      cursor.y += 5;
    }
    doc.setFillColor(speciesColor(detection.speciesId));
    doc.rect(legendX, cursor.y - 2.2, 2.5, 2.5, "F");
    doc.setTextColor(MUTED);
    doc.text(label, legendX + 4, cursor.y);
    legendX += width;
  });
  cursor.y += 9;
}

/** Recorded fields in two columns, so the details block stays compact. */
function metaGrid(cursor: Cursor, entries: [string, string][]) {
  const doc = cursor.doc;
  const columnWidth = CONTENT_WIDTH / 2;
  const rows = Math.ceil(entries.length / 2);

  ensureSpace(cursor, rows * 7 + 2);
  entries.forEach(([label, value], index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = MARGIN + column * columnWidth;
    const y = cursor.y + row * 7;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(MUTED);
    doc.text(label.toUpperCase(), x, y);

    doc.setFontSize(9.5);
    doc.setTextColor(INK);
    // One line per field keeps the grid on its rhythm; anything longer is
    // marked as clipped rather than silently cut mid-word.
    const lines = doc.splitTextToSize(value, columnWidth - 34);
    doc.text(lines.length > 1 ? `${String(lines[0]).trimEnd()}…` : (lines[0] ?? value), x + 32, y);
  });

  cursor.y += rows * 7 + 3;
}

/**
 * One row per pollen type: colour swatch, name, code, risk, grains, and the
 * confidence both as a bar and as a number.
 */
function detectionTable(cursor: Cursor, detections: SpecimenDetection[]) {
  const doc = cursor.doc;
  const col = {
    species: MARGIN + 5,
    risk: MARGIN + 96,
    grains: MARGIN + 124,
    confidence: MARGIN + CONTENT_WIDTH,
  };

  ensureSpace(cursor, 14);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(MUTED);
  doc.text("POLLEN TYPE", MARGIN, cursor.y);
  doc.text("RISK", col.risk, cursor.y);
  doc.text("GRAINS", col.grains, cursor.y, { align: "right" });
  doc.text("AVG. CONFIDENCE", col.confidence, cursor.y, { align: "right" });
  cursor.y += 2;
  rule(cursor);

  if (detections.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(MUTED);
    doc.text("No pollen grains detected.", MARGIN, cursor.y);
    cursor.y += 7;
    return;
  }

  detections.forEach((detection, index) => {
    ensureSpace(cursor, 8);
    const species = getSpecies(detection.speciesId);
    const rowHeight = 7;

    // A tint on alternate rows keeps a long table readable across the page.
    if (index % 2 === 1) {
      doc.setFillColor(PANEL);
      doc.rect(MARGIN - 2, cursor.y - 4.5, CONTENT_WIDTH + 4, rowHeight, "F");
    }

    doc.setFillColor(speciesColor(detection.speciesId));
    doc.circle(MARGIN + 1, cursor.y - 1.2, 1.2, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(INK);
    doc.text(`${species.genus} (${species.commonName})`, col.species, cursor.y);

    doc.setFontSize(7.5);
    doc.setTextColor(MUTED);
    doc.text(species.code, col.species + 62, cursor.y);
    doc.text(species.riskLevel, col.risk, cursor.y);

    doc.setFontSize(9.5);
    doc.setTextColor(INK);
    doc.text(String(detection.grainCount), col.grains, cursor.y, { align: "right" });

    // Confidence bar, with the figure right-aligned after it.
    const pct = Math.round(detection.avgConfidence * 100);
    const barWidth = 26;
    const barX = col.confidence - barWidth - 12;
    doc.setFillColor(RULE);
    doc.roundedRect(barX, cursor.y - 2.4, barWidth, 1.8, 0.9, 0.9, "F");
    doc.setFillColor(ACCENT);
    doc.roundedRect(barX, cursor.y - 2.4, (barWidth * pct) / 100, 1.8, 0.9, 0.9, "F");
    doc.setFontSize(9);
    doc.text(`${pct}%`, col.confidence, cursor.y, { align: "right" });

    cursor.y += rowHeight;
  });
  cursor.y += 2;
}

/** The researcher's note, set in a tinted block so it reads as their voice. */
function noteBlock(cursor: Cursor, note: string) {
  const doc = cursor.doc;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const lines = doc.splitTextToSize(note, CONTENT_WIDTH - 10);
  const height = lines.length * 5 + 12;

  ensureSpace(cursor, height);
  doc.setFillColor(PANEL);
  doc.setDrawColor(RULE);
  doc.setLineWidth(0.2);
  doc.roundedRect(MARGIN, cursor.y, CONTENT_WIDTH, height, 1.5, 1.5, "FD");
  doc.setFillColor(ACCENT);
  doc.rect(MARGIN, cursor.y, 1.2, height, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(MUTED);
  doc.text("RESEARCHER'S NOTE", MARGIN + 5, cursor.y + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(INK);
  doc.text(lines, MARGIN + 5, cursor.y + 11);

  cursor.y += height + 4;
}

type PdfImage = { dataUrl: string; width: number; height: number };

/**
 * Re-encode a slide image through a canvas before embedding it.
 *
 * Handing jsPDF the original blob is fragile — its decoders are picky about
 * PNG variants and reject some files the browser renders happily. Drawing to a
 * canvas and exporting JPEG normalises every format the browser can decode,
 * and downscaling caps the file size of a report full of microscope images.
 */
async function toPdfImage(blob: Blob): Promise<PdfImage | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    return null;
  }

  const MAX_EDGE = 1400; // plenty for print at the sizes we lay out
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return null;
  }
  // JPEG has no alpha, so lay the image over white rather than black.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return {
    dataUrl: canvas.toDataURL("image/jpeg", 0.82),
    width: canvas.width,
    height: canvas.height,
  };
}

/**
 * The slide image with every detected grain boxed on top.
 *
 * Boxes are stored as fractions of the image, so they scale onto whatever
 * placement the page has room for. Drawing them as PDF rectangles rather than
 * burning them into the bitmap keeps the edges sharp when the reader zooms in.
 */
function fitImage(image: PdfImage): { width: number; height: number } {
  const maxWidth = Math.min(CONTENT_WIDTH, 120);
  const maxHeight = 95;
  let width = maxWidth;
  let height = (image.height / image.width) * width;
  if (height > maxHeight) {
    height = maxHeight;
    width = (image.width / image.height) * height;
  }
  return { width, height };
}

function placeSlideImage(
  cursor: Cursor,
  image: PdfImage,
  { width, height }: { width: number; height: number },
  grains: DetectedGrain[] | undefined,
) {
  const doc = cursor.doc;
  const x = MARGIN;
  const y = cursor.y;
  doc.addImage(image.dataUrl, "JPEG", x, y, width, height);
  doc.setDrawColor(RULE);
  doc.setLineWidth(0.2);
  doc.rect(x, y, width, height);

  if (grains && grains.length > 0) {
    doc.setLineWidth(0.35);
    for (const grain of grains) {
      doc.setDrawColor(speciesColor(grain.speciesId));
      doc.rect(
        x + grain.box.x * width,
        y + grain.box.y * height,
        grain.box.width * width,
        grain.box.height * height,
      );
    }
  }

  cursor.y += height + 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(MUTED);
  doc.text(
    grains && grains.length > 0
      ? `${grains.length} ${grains.length === 1 ? "grain" : "grains"} boxed, coloured by pollen type`
      : "Grain positions were not recorded for this slide",
    x,
    cursor.y,
  );
  cursor.y += 6;
}

function footer(doc: jsPDF, sampleId: string, generated: string) {
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setDrawColor(RULE);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, PAGE.height - 14, PAGE.width - MARGIN, PAGE.height - 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED);
    doc.text(`PolLens · ${sampleId} · generated ${generated}`, MARGIN, PAGE.height - 9.5);
    doc.text(`Page ${page} of ${pages}`, PAGE.width - MARGIN, PAGE.height - 9.5, {
      align: "right",
    });
  }
}

/**
 * Build and download the full report as a PDF.
 *
 * `images` maps slide id → blob; slides without one (the seed records have no
 * image) simply render without a picture.
 */
export async function downloadReportPdf(
  report: Specimen,
  images: Record<string, Blob>,
): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const cursor: Cursor = { doc, y: MARGIN };
  const generated = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  doc.setProperties({
    title: `PolLens ${report.sampleId} — specimen report`,
    subject: `Pollen analysis for ${report.location || "an unspecified location"}`,
    author: report.researcher,
    creator: "PolLens Research Console",
  });

  const aggregated = aggregateSlideDetections(report.slides);
  const totalGrains = getTotalGrains(aggregated);
  const top = getTopDetection(aggregated);
  const collectionTime = getCollectionTime(report.collectedAt);
  const weather = report.weather;

  masthead(cursor, {
    title: "Specimen report",
    rightTop: report.sampleId,
    rightBottom: report.status,
  });

  // --- At a glance --------------------------------------------------------
  summaryTiles(cursor, [
    { value: String(totalGrains), label: "Total grains" },
    { value: String(aggregated.length), label: "Pollen types" },
    { value: `${Math.round(getWeightedAvgConfidence(aggregated) * 100)}%`, label: "Avg. confidence" },
    { value: String(report.slides.length), label: report.slides.length === 1 ? "Slide" : "Slides" },
  ]);
  compositionBar(cursor, aggregated);

  // --- What the researcher recorded ---------------------------------------
  heading(cursor, "Collection details");
  metaGrid(cursor, [
    ["Date collected", shortDate(report.collectedAt)],
    ["Time collected", collectionTime ? formatTime(collectionTime) : "Not recorded"],
    ["Location", report.location || "Not specified"],
    ["Researcher", report.researcher],
    ["Weather", weather ? weather.condition : "Not recorded"],
    ["Temperature", weather?.temperatureC != null ? `${weather.temperatureC}°C` : "—"],
    ["Humidity", weather?.humidityPct != null ? `${weather.humidityPct}% RH` : "—"],
    ["Wind", weather?.windKph != null ? `${weather.windKph} km/h` : "—"],
    ["Status", report.status],
    [
      "Slides",
      `${report.slides.length} ${report.slides.length === 1 ? "slide" : "slides"} in this report`,
    ],
  ]);

  // --- Combined results ---------------------------------------------------
  heading(cursor, "Results — whole report");
  if (top) {
    const species = getSpecies(top.speciesId);
    paragraph(
      cursor,
      `Most abundant: ${species.genus} (${species.commonName}) — ${top.grainCount} of ${totalGrains} grains, ${species.riskLevel.toLowerCase()} allergenic risk.`,
    );
  }
  detectionTable(cursor, aggregated);

  // --- Per slide ----------------------------------------------------------
  for (const [index, slide] of report.slides.entries()) {
    const blob = images[slide.id];
    const image = blob ? await toPdfImage(blob) : null;
    const layout = image ? fitImage(image) : null;

    // A slide's image, table and note run to most of a page, and breaking
    // between them reads badly — so each slide starts its own page. That also
    // makes the document navigable: slide 2 is the page after slide 1, every
    // time, however long the readings are.
    if (cursor.y > MARGIN) newPage(cursor);
    heading(cursor, `Slide ${index + 1} — ${slide.fileName}`);

    if (image && layout) {
      placeSlideImage(cursor, image, layout, slide.grains);
    } else if (blob) {
      // An unreadable image must not sink the export.
      paragraph(cursor, "(image could not be embedded)", true);
    }

    const slideGrains = getTotalGrains(slide.detections);
    metaGrid(cursor, [
      ["Grains", String(slideGrains)],
      ["Pollen types", String(slide.detections.length)],
    ]);
    detectionTable(cursor, slide.detections);

    if (slide.notes) noteBlock(cursor, slide.notes);
    cursor.y += 2;
  }

  footer(doc, report.sampleId, generated);
  doc.save(`PolLens-${report.sampleId}.pdf`);
}

// ---------------------------------------------------------------------------
// Location report — what the map is showing, as a document.
//
// A specimen report answers "what was on this slide". This answers "what has
// been found at this place", which is the question the map poses: it rolls up
// every report from the selected place (or the filtered set of places) into one
// reading, and lists the records it drew from so the numbers can be traced back.
// ---------------------------------------------------------------------------

export type LocationReportInput = {
  /** The place, or a description of the filter that chose several. */
  title: string;
  /** "Town in Quezon", "Provinces of the Philippines" — what `title` refers to. */
  scopeLabel: string;
  /** A sentence for a selection the two-column scope grid cannot state. */
  selectionNote?: string;
  /** Which taxon the figures are filtered to, already resolved to a label. */
  speciesLabel: string;
  places: PlaceStats[];
  /** Every report behind the figures, newest collection first. */
  reports: Specimen[];
  /** Basename of the saved file, without the extension. */
  fileSlug: string;
  /** What the document calls itself, top right. Defaults to "Location report". */
  documentLabel?: string;
  /** What `title` is, in the scope grid. Defaults to "Place". */
  subjectLabel?: string;
};

/**
 * Group a set of reports by the location written on them.
 *
 * The map hands over places it has already aggregated against a boundary; a
 * selection made in the report list has no boundary behind it, so the location
 * string is the grouping. Free text is exactly as reliable as what was typed —
 * "Lucban, Quezon" and "lucban, quezon" would be two places — which is fine
 * here because both spellings would also appear as written in the table the
 * researcher picked from.
 */
function placesFromReports(reports: Specimen[]): PlaceStats[] {
  const places = new Map<string, PlaceStats>();

  for (const report of reports) {
    const label = report.location.trim() || "Location not specified";
    const place = places.get(label) ?? {
      key: label,
      label,
      reportCount: 0,
      totalGrains: 0,
      detections: [],
      lastCollectedAt: null,
    };

    place.reportCount += 1;
    for (const detection of aggregateSlideDetections(report.slides)) {
      const existing = place.detections.find((d) => d.speciesId === detection.speciesId);
      if (existing) {
        const grains = existing.grainCount + detection.grainCount;
        existing.avgConfidence =
          (existing.avgConfidence * existing.grainCount +
            detection.avgConfidence * detection.grainCount) /
          grains;
        existing.grainCount = grains;
      } else {
        place.detections.push({ ...detection });
      }
      place.totalGrains += detection.grainCount;
    }
    if (!place.lastCollectedAt || report.collectedAt > place.lastCollectedAt) {
      place.lastCollectedAt = report.collectedAt;
    }
    places.set(label, place);
  }

  for (const place of places.values()) {
    place.detections.sort((a, b) => b.grainCount - a.grainCount);
  }
  return [...places.values()].sort((a, b) => b.totalGrains - a.totalGrains);
}

/**
 * A summary of reports chosen by hand in the report list.
 *
 * Same document as a location report — the question is the same shape, "what do
 * these readings add up to" — but the subject is a set the researcher picked
 * rather than a place on the map, so the places are derived from the reports
 * and the scope says how the set was chosen.
 */
export async function downloadSelectionReportPdf({
  reports,
}: {
  reports: Specimen[];
}): Promise<void> {
  const places = placesFromReports(reports);
  const dates = reports.map((r) => r.collectedAt).sort();
  const span =
    dates.length && getCollectionDate(dates[0]) !== getCollectionDate(dates[dates.length - 1])
      ? ` collected between ${shortDate(dates[0])} and ${shortDate(dates[dates.length - 1])}`
      : dates.length
        ? ` collected ${shortDate(dates[0])}`
        : "";

  return downloadLocationReportPdf({
    // One place is a place; several is a selection, and naming it after the
    // first would misrepresent the rest.
    title: places.length === 1 ? places[0].label : "Selected reports",
    scopeLabel: `${reports.length} ${reports.length === 1 ? "report" : "reports"}`,
    selectionNote: `Chosen from the report list${span}. Each report's slides, images and notes are in its own specimen PDF.`,
    speciesLabel: "All pollen",
    places,
    reports,
    fileSlug: "selected-reports",
    documentLabel: "Report summary",
    subjectLabel: places.length === 1 ? "Location" : "Selection",
  });
}

/** "Jul 29, 2026" — the date half of a collection stamp, parsed as local. */
function shortDate(collectedAt: string): string {
  return new Date(`${getCollectionDate(collectedAt)}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Ranked places, for a report covering more than one. */
function placesTable(cursor: Cursor, places: PlaceStats[]) {
  const doc = cursor.doc;
  const cols = { place: MARGIN, top: MARGIN + 58, reports: MARGIN + 150, grains: MARGIN + CONTENT_WIDTH };

  ensureSpace(cursor, 14);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(MUTED);
  doc.text("PLACE", cols.place, cursor.y);
  doc.text("TOP POLLEN", cols.top, cursor.y);
  doc.text("REPORTS", cols.reports, cursor.y, { align: "right" });
  doc.text("GRAINS", cols.grains, cursor.y, { align: "right" });
  cursor.y += 2;
  rule(cursor);

  places.forEach((place, index) => {
    ensureSpace(cursor, 7);
    if (index % 2 === 1) {
      doc.setFillColor(PANEL);
      doc.rect(MARGIN - 2, cursor.y - 4.5, CONTENT_WIDTH + 4, 7, "F");
    }
    const top = getTopDetection(place.detections);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(INK);
    doc.text(doc.splitTextToSize(place.label, 54)[0] ?? place.label, cols.place, cursor.y);

    if (top) {
      const species = getSpecies(top.speciesId);
      doc.setFillColor(speciesColor(top.speciesId));
      doc.circle(cols.top + 1, cursor.y - 1.2, 1.2, "F");
      doc.text(`${species.genus} (${species.commonName})`, cols.top + 5, cursor.y);
    } else {
      doc.setTextColor(MUTED);
      doc.text("None detected", cols.top + 5, cursor.y);
      doc.setTextColor(INK);
    }

    doc.text(String(place.reportCount), cols.reports, cursor.y, { align: "right" });
    doc.text(String(place.totalGrains), cols.grains, cursor.y, { align: "right" });
    cursor.y += 7;
  });
  cursor.y += 2;
}

/** The individual records the figures were rolled up from. */
function sourceReportsTable(cursor: Cursor, reports: Specimen[]) {
  const doc = cursor.doc;
  const cols = {
    id: MARGIN,
    collected: MARGIN + 34,
    location: MARGIN + 72,
    slides: MARGIN + 138,
    grains: MARGIN + CONTENT_WIDTH,
  };

  ensureSpace(cursor, 14);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(MUTED);
  doc.text("SAMPLE ID", cols.id, cursor.y);
  doc.text("COLLECTED", cols.collected, cursor.y);
  doc.text("LOCATION", cols.location, cursor.y);
  doc.text("SLIDES", cols.slides, cursor.y, { align: "right" });
  doc.text("GRAINS", cols.grains, cursor.y, { align: "right" });
  cursor.y += 2;
  rule(cursor);

  reports.forEach((report, index) => {
    ensureSpace(cursor, 7);
    if (index % 2 === 1) {
      doc.setFillColor(PANEL);
      doc.rect(MARGIN - 2, cursor.y - 4.5, CONTENT_WIDTH + 4, 7, "F");
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(INK);
    doc.text(report.sampleId, cols.id, cursor.y);
    doc.setTextColor(MUTED);
    doc.text(shortDate(report.collectedAt), cols.collected, cursor.y);
    doc.setTextColor(INK);
    doc.text(
      doc.splitTextToSize(report.location || "Not specified", 62)[0] ?? report.location,
      cols.location,
      cursor.y,
    );
    doc.text(String(report.slides.length), cols.slides, cursor.y, { align: "right" });
    doc.text(
      String(getTotalGrains(aggregateSlideDetections(report.slides))),
      cols.grains,
      cursor.y,
      { align: "right" },
    );
    cursor.y += 7;
  });
  cursor.y += 2;
}

/** Combine several places' readings into one, weighting confidence by grains. */
function combinePlaces(places: PlaceStats[]): SpecimenDetection[] {
  const bySpecies = new Map<string, SpecimenDetection>();
  for (const place of places) {
    for (const detection of place.detections) {
      const existing = bySpecies.get(detection.speciesId);
      if (!existing) {
        bySpecies.set(detection.speciesId, { ...detection });
        continue;
      }
      const grains = existing.grainCount + detection.grainCount;
      existing.avgConfidence =
        (existing.avgConfidence * existing.grainCount +
          detection.avgConfidence * detection.grainCount) /
        grains;
      existing.grainCount = grains;
    }
  }
  return [...bySpecies.values()].sort((a, b) => b.grainCount - a.grainCount);
}

/** Build and download the location summary as a PDF. */
export async function downloadLocationReportPdf(input: LocationReportInput): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const cursor: Cursor = { doc, y: MARGIN };
  const generated = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const documentLabel = input.documentLabel ?? "Location report";

  doc.setProperties({
    title: `PolLens — ${input.title} (${documentLabel.toLowerCase()})`,
    subject: `Pollen recorded for ${input.title} (${input.speciesLabel})`,
    creator: "PolLens Research Console",
  });

  const detections = combinePlaces(input.places);
  const totalGrains = getTotalGrains(detections);
  const collected = input.reports.map((r) => r.collectedAt).sort();
  const top = getTopDetection(detections);

  masthead(cursor, {
    title: input.title,
    rightTop: documentLabel,
    rightBottom: input.speciesLabel,
  });

  summaryTiles(cursor, [
    { value: String(totalGrains), label: "Total grains" },
    { value: String(detections.length), label: "Pollen types" },
    { value: String(input.reports.length), label: input.reports.length === 1 ? "Report" : "Reports" },
    {
      value: String(input.places.length),
      label: input.places.length === 1 ? "Place" : "Places",
    },
  ]);
  compositionBar(cursor, detections);

  heading(cursor, "Scope");
  metaGrid(cursor, [
    [input.subjectLabel ?? "Place", input.title],
    ["Level", input.scopeLabel],
    ["Pollen filter", input.speciesLabel],
    [
      "Collected",
      // Dates only: a span of months does not need the hour, and the pair has
      // to fit one line of a two-column grid.
      collected.length
        ? getCollectionDate(collected[0]) === getCollectionDate(collected[collected.length - 1])
          ? formatCollectedAt(collected[0])
          : `${shortDate(collected[0])} — ${shortDate(collected[collected.length - 1])}`
        : "No reports",
    ],
  ]);
  if (input.selectionNote) paragraph(cursor, input.selectionNote);

  heading(cursor, "Pollen recorded here");
  if (top) {
    const species = getSpecies(top.speciesId);
    paragraph(
      cursor,
      `Most abundant: ${species.genus} (${species.commonName}) — ${top.grainCount} of ${totalGrains} grains, ${species.riskLevel.toLowerCase()} allergenic risk.`,
    );
  }
  detectionTable(cursor, detections);

  if (input.places.length > 1) {
    heading(cursor, "Places in this selection");
    placesTable(cursor, input.places);
  }

  heading(cursor, "Reports behind these figures");
  if (input.reports.length === 0) {
    paragraph(cursor, "No saved reports match this selection.", true);
  } else {
    sourceReportsTable(cursor, input.reports);
  }

  footer(doc, input.title, generated);
  doc.save(`PolLens-${input.fileSlug}-pollen-report.pdf`);
}

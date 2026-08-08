// ---------------------------------------------------------------------------
// PDF export for a full report.
//
// jsPDF draws the document directly rather than screenshotting the page, so the
// output is real selectable text at print resolution instead of a bitmap of the
// UI. Layout is a single column on A4 with a manual cursor; every block checks
// the remaining space and starts a new page when it would overflow.
// ---------------------------------------------------------------------------

import { jsPDF } from "jspdf";
import {
  aggregateSlideDetections,
  formatCollectedAt,
  formatWeather,
  getSpecies,
  getTotalGrains,
  getWeightedAvgConfidence,
  type Specimen,
  type SpecimenDetection,
} from "@/lib/data";

const PAGE = { width: 210, height: 297 }; // A4, millimetres
const MARGIN = 16;
const CONTENT_WIDTH = PAGE.width - MARGIN * 2;

const INK = "#23261f";
const MUTED = "#6d7268";
const RULE = "#d9d5c8";

type Cursor = { doc: jsPDF; y: number; page: number };

function newPage(cursor: Cursor) {
  cursor.doc.addPage();
  cursor.page += 1;
  cursor.y = MARGIN;
}

/** Starts a new page when `needed` millimetres would not fit below the cursor. */
function ensureSpace(cursor: Cursor, needed: number) {
  if (cursor.y + needed > PAGE.height - MARGIN - 10) newPage(cursor);
}

function rule(cursor: Cursor) {
  cursor.doc.setDrawColor(RULE);
  cursor.doc.setLineWidth(0.2);
  cursor.doc.line(MARGIN, cursor.y, PAGE.width - MARGIN, cursor.y);
  cursor.y += 5;
}

function heading(cursor: Cursor, text: string) {
  ensureSpace(cursor, 14);
  cursor.doc.setFont("helvetica", "bold");
  cursor.doc.setFontSize(10);
  cursor.doc.setTextColor(INK);
  cursor.doc.text(text.toUpperCase(), MARGIN, cursor.y);
  cursor.y += 2;
  rule(cursor);
}

/** Label on the left, value on the right of a fixed gutter. */
function metaRow(cursor: Cursor, label: string, value: string) {
  ensureSpace(cursor, 7);
  const doc = cursor.doc;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED);
  doc.text(label, MARGIN, cursor.y);
  doc.setTextColor(INK);
  const lines = doc.splitTextToSize(value, CONTENT_WIDTH - 36);
  doc.text(lines, MARGIN + 34, cursor.y);
  cursor.y += 5 * lines.length + 1;
}

function detectionTable(cursor: Cursor, detections: SpecimenDetection[]) {
  const doc = cursor.doc;
  const cols = { species: MARGIN, grains: MARGIN + 108, confidence: MARGIN + 140 };

  ensureSpace(cursor, 12);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(MUTED);
  doc.text("POLLEN TYPE", cols.species, cursor.y);
  doc.text("GRAINS", cols.grains, cursor.y, { align: "right" });
  doc.text("AVG. CONFIDENCE", cols.confidence + 34, cursor.y, { align: "right" });
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

  for (const detection of detections) {
    ensureSpace(cursor, 7);
    const species = getSpecies(detection.speciesId);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(INK);
    doc.text(`${species.genus} (${species.commonName})`, cols.species, cursor.y);
    doc.setTextColor(MUTED);
    doc.setFontSize(8);
    doc.text(species.code, cols.species + 78, cursor.y);
    doc.setTextColor(INK);
    doc.setFontSize(9.5);
    doc.text(String(detection.grainCount), cols.grains, cursor.y, { align: "right" });
    doc.text(
      `${Math.round(detection.avgConfidence * 100)}%`,
      cols.confidence + 34,
      cursor.y,
      { align: "right" },
    );
    cursor.y += 6;
  }
  cursor.y += 2;
}

function paragraph(cursor: Cursor, text: string, italic = false) {
  const doc = cursor.doc;
  doc.setFont("helvetica", italic ? "italic" : "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(italic ? MUTED : INK);
  const lines = doc.splitTextToSize(text, CONTENT_WIDTH);
  for (const line of lines) {
    ensureSpace(cursor, 6);
    doc.text(line, MARGIN, cursor.y);
    cursor.y += 5;
  }
  cursor.y += 2;
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

function footer(doc: jsPDF, sampleId: string) {
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(MUTED);
    doc.text(`PolLens · ${sampleId}`, MARGIN, PAGE.height - 10);
    doc.text(`Page ${page} of ${pages}`, PAGE.width - MARGIN, PAGE.height - 10, {
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
  const cursor: Cursor = { doc, y: MARGIN, page: 1 };

  // --- Title -------------------------------------------------------------
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(MUTED);
  doc.text("POLLENS · RESEARCH CONSOLE", MARGIN, cursor.y);
  cursor.y += 7;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(INK);
  doc.text("Specimen Report", MARGIN, cursor.y);
  cursor.y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(MUTED);
  doc.text(report.sampleId, MARGIN, cursor.y);
  cursor.y += 6;
  rule(cursor);

  // --- Metadata ----------------------------------------------------------
  const aggregated = aggregateSlideDetections(report.slides);
  const totalGrains = getTotalGrains(aggregated);

  heading(cursor, "Collection details");
  metaRow(cursor, "Collected", formatCollectedAt(report.collectedAt));
  metaRow(cursor, "Location", report.location || "Not specified");
  metaRow(cursor, "Researcher", report.researcher);
  metaRow(cursor, "Weather", formatWeather(report.weather));
  metaRow(cursor, "Status", report.status);
  metaRow(
    cursor,
    "Slides",
    `${report.slides.length} ${report.slides.length === 1 ? "slide" : "slides"}`,
  );
  cursor.y += 3;

  // --- Combined results --------------------------------------------------
  heading(cursor, "Results - whole report");
  metaRow(cursor, "Total grains", String(totalGrains));
  metaRow(cursor, "Pollen types", String(aggregated.length));
  metaRow(
    cursor,
    "Avg. confidence",
    `${Math.round(getWeightedAvgConfidence(aggregated) * 100)}%`,
  );
  cursor.y += 2;
  detectionTable(cursor, aggregated);

  // --- Per slide ---------------------------------------------------------
  for (const [index, slide] of report.slides.entries()) {
    ensureSpace(cursor, 30);
    heading(cursor, `Slide ${index + 1} - ${slide.fileName}`);

    const blob = images[slide.id];
    if (blob) {
      const image = await toPdfImage(blob);
      if (image) {
        const boxWidth = Math.min(CONTENT_WIDTH, 110);
        const boxHeight = (image.height / image.width) * boxWidth;
        ensureSpace(cursor, boxHeight + 4);
        doc.addImage(image.dataUrl, "JPEG", MARGIN, cursor.y, boxWidth, boxHeight);
        cursor.y += boxHeight + 5;
      } else {
        // An unreadable image must not sink the export.
        paragraph(cursor, "(image could not be embedded)", true);
      }
    }

    const slideGrains = getTotalGrains(slide.detections);
    metaRow(cursor, "Grains", String(slideGrains));
    metaRow(cursor, "Pollen types", String(slide.detections.length));
    cursor.y += 1;
    detectionTable(cursor, slide.detections);

    if (slide.notes) {
      ensureSpace(cursor, 10);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(MUTED);
      doc.text("RESEARCHER'S NOTE", MARGIN, cursor.y);
      cursor.y += 5;
      paragraph(cursor, slide.notes);
    }
    cursor.y += 2;
  }

  footer(doc, report.sampleId);
  doc.save(`${report.sampleId}.pdf`);
}

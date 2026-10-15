// ---------------------------------------------------------------------------
// Bulk export of reports.
//
// Three formats, because they serve different jobs:
//   Excel — a workbook for people: a Reports sheet (one row per report) and a
//           Detections sheet (one row per pollen type per slide)
//   CSV   — the Detections rows alone, the long format stats software (R, SPSS)
//           wants for analysis
//   JSON  — report records for archiving or other tools; collection times and
//           legacy weather fields are omitted, and other researchers' names
//           are withheld
//
// Slide images are deliberately not included: a batch of microscope photos
// would inflate a file into the hundreds of megabytes (and their links expire).
// The per-report PDF is the export that carries the pictures.
// ---------------------------------------------------------------------------

import {
  aggregateSlideDetections,
  getCollectionDate,
  getConfidenceGrainCount,
  getReportGrains,
  getSpecies,
  getTopDetection,
  getTotalGrains,
  getWeightedAvgConfidence,
  speciesLabel,
  type Specimen,
} from "@/lib/data";
import { BRAND_NAME } from "@/lib/brand";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  // Revoked later, not straight away: some browsers start reading the URL only
  // after click() returns, and an early revoke cancels the download.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function stamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
}

export function exportReportsJson(reports: Specimen[]): void {
  const payload = {
    exportedAt: new Date().toISOString(),
    formatVersion: 4,
    note: "Slide images, collection times and weather fields are omitted. Researcher names are withheld on reports owned by other users.",
    reportCount: reports.length,
    // Image links are presigned and expire, and canEdit is about the exporter.
    reports: reports.map((report) => {
      const { canEdit, weather, researcher, ...rest } = report;
      void weather;
      return {
        ...rest,
        collectedAt: getCollectionDate(report.collectedAt),
        ...(canEdit && researcher ? { researcher } : {}),
        slides: report.slides.map((slide) => {
          const { imageUrl, ...slideRest } = slide;
          void imageUrl;
          return slideRest;
        }),
      };
    }),
  };
  downloadBlob(
    new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
    `${BRAND_NAME}-reports-${stamp()}.json`,
  );
}

type Value = string | number | null;

const DETECTION_COLUMNS = [
  "sample_id",
  "report_name",
  "status",
  "sample_detections",
  "collection_date",
  "location",
  "researcher",
  "slide_number",
  "slide_file",
  "slide_total_grains",
  "species_code",
  "scientific_name",
  "common_name",
  "risk_level",
  "grain_count",
  "avg_confidence",
  "slide_notes",
] as const;

/**
 * One row per detected pollen type per slide — the long format analysis tools
 * expect. Report-level fields repeat across a report's rows, which is intended:
 * it keeps every row independently filterable. A slide with nothing on it still
 * gets a row (grain_count 0), because "nothing found" is a result.
 */
function detectionRows(reports: Specimen[]): Value[][] {
  const rows: Value[][] = [];
  for (const report of reports) {
    report.slides.forEach((slide, index) => {
      const shared: Value[] = [
        report.sampleId,
        report.reportName ?? "",
        report.status,
        report.sampleDetections ? "true" : "false",
        getCollectionDate(report.collectedAt),
        report.location,
        report.canEdit && report.researcher ? report.researcher : null,
        index + 1,
        slide.fileName,
        getTotalGrains(slide.detections),
      ];
      if (slide.detections.length === 0) {
        rows.push([...shared, null, null, null, null, 0, null, slide.notes]);
        return;
      }
      for (const detection of slide.detections) {
        const species = getSpecies(detection.speciesId);
        rows.push([
          ...shared,
          species.code,
          species.scientificName,
          species.commonName || null,
          species.riskLevel,
          detection.grainCount,
          getConfidenceGrainCount(detection) > 0 ? Number(detection.avgConfidence.toFixed(4)) : null,
          slide.notes,
        ]);
      }
    });
  }
  return rows;
}

/**
 * Wraps a value for CSV: quote it, and double any quotes inside. Text that
 * starts like a formula (a note beginning "=", "+", "-" or "@") is prefixed
 * with an apostrophe so a spreadsheet opens it as text instead of running it.
 */
function csvCell(value: Value): string {
  if (value === null) return "";
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function exportReportsCsv(reports: Specimen[]): void {
  const lines = [
    DETECTION_COLUMNS.join(","),
    ...detectionRows(reports).map((row) => row.map(csvCell).join(",")),
  ];
  // A byte-order mark so Excel reads the file as UTF-8 ("Parañaque", "°C"),
  // and CRLF line endings, as RFC 4180 specifies.
  downloadBlob(
    new Blob(["﻿" + lines.join("\r\n") + "\r\n"], { type: "text/csv;charset=utf-8" }),
    `${BRAND_NAME}-detections-${stamp()}.csv`,
  );
}

const REPORT_COLUMNS = [
  "Sample ID",
  "Report Name",
  "Status",
  "Sample Detections",
  "Collection Date",
  "Location",
  "Researcher",
  "Slides",
  "Total Grains",
  "Pollen Types",
  "Top Pollen",
  "Avg. Model Confidence",
];

function reportRows(reports: Specimen[]): Value[][] {
  return reports.map((report) => {
    const detections = aggregateSlideDetections(report.slides);
    const top = getTopDetection(detections);
    const avgConfidence = getWeightedAvgConfidence(detections);
    return [
      report.sampleId,
      report.reportName ?? "",
      report.status === "Needs review" ? "Needs Review" : report.status,
      report.sampleDetections ? "Yes" : "No",
      getCollectionDate(report.collectedAt),
      report.location,
      report.canEdit && report.researcher ? report.researcher : null,
      report.slides.length,
      getReportGrains(report),
      detections.length,
      top ? speciesLabel(getSpecies(top.speciesId)) : null,
      avgConfidence === null ? null : Number(avgConfidence.toFixed(4)),
    ];
  });
}

/** Confidence columns (0–1 fractions) are shown as percentages in the workbook. */
function withPercent(rows: Value[][], column: number) {
  return rows.map((row) =>
    row.map((value, index) =>
      index === column && typeof value === "number" ? { value, format: "0.0%" } : value,
    ),
  );
}

/** An .xlsx workbook: Reports (one row per report) + Detections (long format). */
export async function exportReportsXlsx(reports: Specimen[], filename?: string): Promise<void> {
  // Loaded on click — the spreadsheet writer isn't needed anywhere else.
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const header = (labels: readonly string[]) =>
    labels.map((label) => ({ value: label, fontWeight: "bold" as const }));
  const blob = await writeXlsxFile([
    {
      sheet: "Reports",
      data: [
        header(REPORT_COLUMNS),
        ...withPercent(reportRows(reports), REPORT_COLUMNS.indexOf("Avg. Model Confidence")),
      ],
      stickyRowsCount: 1,
    },
    {
      sheet: "Detections",
      data: [
        header(DETECTION_COLUMNS),
        ...withPercent(detectionRows(reports), DETECTION_COLUMNS.indexOf("avg_confidence")),
      ],
      stickyRowsCount: 1,
    },
  ]).toBlob();
  downloadBlob(blob, filename ?? `${BRAND_NAME}-reports-${stamp()}.xlsx`);
}

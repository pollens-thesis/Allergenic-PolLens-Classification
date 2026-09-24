// ---------------------------------------------------------------------------
// Bulk export of reports.
//
// Three formats, because they serve different jobs:
//   Excel — a workbook for people: a Reports sheet (one row per report) and a
//           Detections sheet (one row per pollen type per slide)
//   CSV   — the Detections rows alone, the long format stats software (R, SPSS)
//           wants for analysis
//   JSON  — a faithful copy of the records, for archiving or other tools
//
// Slide images are deliberately not included: a batch of microscope photos
// would inflate a file into the hundreds of megabytes (and their links expire).
// The per-report PDF is the export that carries the pictures.
// ---------------------------------------------------------------------------

import {
  aggregateSlideDetections,
  getCollectionDate,
  getCollectionTime,
  getReportGrains,
  getSpecies,
  getTopDetection,
  getTotalGrains,
  getWeightedAvgConfidence,
  speciesLabel,
  type Specimen,
} from "@/lib/data";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function stamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
}

export function exportReportsJson(reports: Specimen[]): void {
  const payload = {
    exportedAt: new Date().toISOString(),
    formatVersion: 2,
    note: "Slide images are not included; download a report's PDF for those.",
    reportCount: reports.length,
    // Image links are presigned and expire, and canEdit is about the exporter.
    reports: reports.map((report) => {
      const { canEdit, ...rest } = report;
      void canEdit;
      return {
        ...rest,
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
    `pollens-reports-${stamp()}.json`,
  );
}

type Value = string | number | null;

const DETECTION_COLUMNS = [
  "sample_id",
  "status",
  "collection_date",
  "collection_time",
  "location",
  "researcher",
  "weather_condition",
  "temperature_c",
  "humidity_pct",
  "wind_kph",
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
        report.status,
        getCollectionDate(report.collectedAt),
        getCollectionTime(report.collectedAt),
        report.location,
        report.researcher,
        report.weather?.condition ?? null,
        report.weather?.temperatureC ?? null,
        report.weather?.humidityPct ?? null,
        report.weather?.windKph ?? null,
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
          Number(detection.avgConfidence.toFixed(4)),
          slide.notes,
        ]);
      }
    });
  }
  return rows;
}

/** Wraps a value for CSV: quote it, and double any quotes inside. */
function csvCell(value: Value): string {
  if (value === null) return "";
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function exportReportsCsv(reports: Specimen[]): void {
  const lines = [
    DETECTION_COLUMNS.join(","),
    ...detectionRows(reports).map((row) => row.map(csvCell).join(",")),
  ];
  downloadBlob(new Blob([lines.join("\n")], { type: "text/csv" }), `pollens-detections-${stamp()}.csv`);
}

const REPORT_COLUMNS = [
  "Sample ID",
  "Status",
  "Collection Date",
  "Collection Time",
  "Location",
  "Researcher",
  "Slides",
  "Total Grains",
  "Pollen Types",
  "Top Pollen",
  "Avg. Confidence",
  "Weather",
  "Temperature (°C)",
  "Humidity (%)",
  "Wind (km/h)",
];

function reportRows(reports: Specimen[]): Value[][] {
  return reports.map((report) => {
    const detections = aggregateSlideDetections(report.slides);
    const top = getTopDetection(detections);
    return [
      report.sampleId,
      report.status,
      getCollectionDate(report.collectedAt),
      getCollectionTime(report.collectedAt),
      report.location,
      report.researcher,
      report.slides.length,
      getReportGrains(report),
      detections.length,
      top ? speciesLabel(getSpecies(top.speciesId)) : null,
      detections.length ? Number(getWeightedAvgConfidence(detections).toFixed(4)) : null,
      report.weather?.condition ?? null,
      report.weather?.temperatureC ?? null,
      report.weather?.humidityPct ?? null,
      report.weather?.windKph ?? null,
    ];
  });
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
      data: [header(REPORT_COLUMNS), ...reportRows(reports)],
      stickyRowsCount: 1,
    },
    {
      sheet: "Detections",
      data: [header(DETECTION_COLUMNS), ...detectionRows(reports)],
      stickyRowsCount: 1,
    },
  ]).toBlob();
  downloadBlob(blob, filename ?? `pollens-reports-${stamp()}.xlsx`);
}

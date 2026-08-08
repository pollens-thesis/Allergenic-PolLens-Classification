// ---------------------------------------------------------------------------
// Bulk export of saved reports.
//
// Two formats, because they serve different jobs:
//   JSON — a faithful backup of the records, re-importable later
//   CSV  — one row per pollen type per slide, which is the shape stats software
//          (R, SPSS, Excel) wants for analysis
//
// Slide images are deliberately not included. Base64-encoding a batch of
// microscope photographs inflates a file into the hundreds of megabytes; the
// per-report PDF is the export that carries the pictures.
// ---------------------------------------------------------------------------

import {
  getSpecies,
  getCollectionDate,
  getCollectionTime,
  getTotalGrains,
  type Specimen,
} from "@/lib/data";

function download(content: string, filename: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
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
    formatVersion: 1,
    note: "Slide images are not included in this export; download a report's PDF for those.",
    reportCount: reports.length,
    reports,
  };
  download(JSON.stringify(payload, null, 2), `pollens-reports-${stamp()}.json`, "application/json");
}

/** Wraps a value for CSV: quote it, and double any quotes inside. */
function cell(value: string | number | null): string {
  if (value === null) return "";
  const text = String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * One row per detected pollen type per slide — the long format analysis tools
 * expect. Report-level fields repeat across a report's rows, which is intended:
 * it keeps every row independently filterable.
 */
export function exportReportsCsv(reports: Specimen[]): void {
  const header = [
    "sample_id",
    "collection_date",
    "collection_time",
    "location",
    "researcher",
    "status",
    "weather_condition",
    "temperature_c",
    "humidity_pct",
    "wind_kph",
    "slide_number",
    "slide_file",
    "slide_total_grains",
    "species_code",
    "genus",
    "common_name",
    "risk_level",
    "grain_count",
    "avg_confidence",
    "slide_notes",
  ];

  const rows: string[] = [header.join(",")];

  for (const report of reports) {
    report.slides.forEach((slide, index) => {
      const shared = [
        cell(report.sampleId),
        cell(getCollectionDate(report.collectedAt)),
        cell(getCollectionTime(report.collectedAt)),
        cell(report.location),
        cell(report.researcher),
        cell(report.status),
        cell(report.weather?.condition ?? null),
        cell(report.weather?.temperatureC ?? null),
        cell(report.weather?.humidityPct ?? null),
        cell(report.weather?.windKph ?? null),
        cell(index + 1),
        cell(slide.fileName),
        cell(getTotalGrains(slide.detections)),
      ];

      if (slide.detections.length === 0) {
        // A slide with nothing on it is still a result worth recording.
        rows.push([...shared, cell(null), cell(null), cell(null), cell(null), cell(0), cell(null), cell(slide.notes)].join(","));
        return;
      }

      for (const detection of slide.detections) {
        const species = getSpecies(detection.speciesId);
        rows.push(
          [
            ...shared,
            cell(species.code),
            cell(species.genus),
            cell(species.commonName),
            cell(species.riskLevel),
            cell(detection.grainCount),
            cell(detection.avgConfidence.toFixed(4)),
            cell(slide.notes),
          ].join(","),
        );
      }
    });
  }

  download(rows.join("\n"), `pollens-detections-${stamp()}.csv`, "text/csv");
}

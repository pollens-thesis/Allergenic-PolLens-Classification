// ---------------------------------------------------------------------------
// REPORT STORE — reports live on the server (api/, /api/v1/reports/).
//
// Reports are a shared corpus: every signed-in researcher can read every
// report; only a report's creator (or staff) can edit, finalise or delete it
// (`canEdit` on each report says which). A report's lifecycle is
//
//   Pending      — stored straight after analysis (Analyze → createReport)
//   Completed    — the researcher generated the report (updateReport status)
//   Needs review ⇄ Completed — flagged for another look
//
// Failures throw `ReportStoreError` with a message written for the
// researcher; nothing here falls back to made-up data.
// ---------------------------------------------------------------------------

import {
  type CollectedAt,
  type ReportStatus,
  type Specimen,
  type SpecimenSlide,
  type WeatherConditions,
} from "@/lib/data";
import type { NewReportInput } from "@/lib/analysis";
import { apiFetch, SessionExpiredError } from "@/lib/api";

export class ReportStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReportStoreError";
  }
}

// The backend's SlideSerializer emits `image_url` (snake_case), mapped here.
type BackendSlide = Omit<SpecimenSlide, "imageUrl"> & { image_url: string };
type BackendReport = Omit<Specimen, "slides"> & { slides: BackendSlide[] };

function mapBackendReport(row: BackendReport): Specimen {
  return {
    ...row,
    slides: row.slides.map(({ image_url, ...slide }) => ({ ...slide, imageUrl: image_url })),
  };
}

/**
 * The most useful message in an error response: the first field error when the
 * server lists them (`{"detail", "errors": {...}}`), else its `detail`.
 */
async function errorMessage(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as
    | { detail?: unknown; errors?: unknown }
    | null;
  const first = firstFieldError(body?.errors);
  if (first) return first;
  return typeof body?.detail === "string" ? body.detail : fallback;
}

function firstFieldError(errors: unknown): string | null {
  if (typeof errors === "string") return errors;
  if (Array.isArray(errors)) {
    for (const entry of errors) {
      const found = firstFieldError(entry);
      if (found) return found;
    }
    return null;
  }
  if (errors && typeof errors === "object") {
    for (const value of Object.values(errors)) {
      const found = firstFieldError(value);
      if (found) return found;
    }
  }
  return null;
}

/** apiFetch, with network failures turned into a readable error. */
async function request(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await apiFetch(path, init);
  } catch (error) {
    if (error instanceof SessionExpiredError) throw error;
    throw new ReportStoreError("Couldn't reach the PolLens server. Check your connection and try again.");
  }
}

function sortByRecency(a: Specimen, b: Specimen): number {
  // ISO timestamps sort chronologically as text; sampleId breaks ties.
  return b.collectedAt.localeCompare(a.collectedAt) || b.sampleId.localeCompare(a.sampleId);
}

/** Every report (shared corpus), newest collection first. `mine` narrows to your own. */
export async function listReports(
  options: { mine?: boolean; status?: ReportStatus } = {},
): Promise<Specimen[]> {
  const params = new URLSearchParams();
  if (options.mine) params.set("owner", "me");
  if (options.status) params.set("status", options.status);
  const query = params.size ? `?${params}` : "";
  const res = await request(`/api/v1/reports/${query}`);
  if (!res.ok) throw new ReportStoreError(await errorMessage(res, "Couldn't load reports."));
  const rows = (await res.json()) as BackendReport[];
  return rows.map(mapBackendReport).sort(sortByRecency);
}

/** One report, or null if it doesn't exist. */
export async function getReport(sampleId: string): Promise<Specimen | null> {
  const res = await request(`/api/v1/reports/${encodeURIComponent(sampleId)}/`);
  if (res.status === 404) return null;
  if (!res.ok) throw new ReportStoreError(await errorMessage(res, "Couldn't load this report."));
  return mapBackendReport((await res.json()) as BackendReport);
}

/** Direct <img src> URLs for a report's slide images. */
export function getReportImageUrls(report: Specimen): Record<string, string> {
  const urls: Record<string, string> = {};
  for (const slide of report.slides) {
    if (slide.imageUrl) urls[slide.id] = slide.imageUrl;
  }
  return urls;
}

/**
 * Blobs for a report's slides — used when building the PDF. Each slide is
 * fetched on its own, so one unreachable image leaves that slide out (the PDF
 * says so) instead of failing the whole document. `no-store` avoids reusing a
 * cached copy of the image that was loaded without CORS for the <img> tag.
 */
export async function getReportImageBlobs(report: Specimen): Promise<Record<string, Blob>> {
  const entries = await Promise.all(
    report.slides
      .filter((slide) => Boolean(slide.imageUrl))
      .map(async (slide) => {
        try {
          const res = await fetch(slide.imageUrl!, { cache: "no-store", mode: "cors" });
          return res.ok ? ([slide.id, await res.blob()] as const) : null;
        } catch {
          return null;
        }
      }),
  );
  return Object.fromEntries(entries.filter((entry) => entry !== null));
}

/**
 * Store a freshly analysed batch as one report — Pending by default, so the
 * researcher can review it, add notes and generate it later from any device.
 * `images` is keyed by the slide's index in `input.slides`.
 */
export async function createReport(
  input: NewReportInput,
  images: Record<string, Blob>,
  status: "Pending" | "Completed" = "Pending",
): Promise<Specimen> {
  const formData = new FormData();
  formData.append("collectedAt", input.collectedAt);
  formData.append("location", input.location.trim());
  formData.append("researcher", input.researcher.trim());
  formData.append("status", status);
  if (input.weather) formData.append("weather", JSON.stringify(input.weather));
  formData.append("slides", JSON.stringify(input.slides));
  input.slides.forEach((slide, index) => {
    const file = images[String(index)];
    if (file) formData.append(String(index), file, slide.fileName);
  });

  // No Content-Type header — the browser sets the multipart boundary itself.
  const res = await request("/api/v1/reports/", { method: "POST", body: formData });
  if (!res.ok) throw new ReportStoreError(await errorMessage(res, "Couldn't store the analysis."));
  return mapBackendReport((await res.json()) as BackendReport);
}

export type ReportPatch = {
  collectedAt?: CollectedAt;
  location?: string;
  researcher?: string;
  weather?: WeatherConditions | null;
  /** Per-slide notes, by slide id ("{sampleId}-S{n}"). */
  notes?: Record<string, string>;
  status?: ReportStatus;
};

/** Edit a report you created (details, notes) and/or move it along its lifecycle. */
export async function updateReport(sampleId: string, patch: ReportPatch): Promise<Specimen> {
  const { notes, ...fields } = patch;
  const body: Record<string, unknown> = { ...fields };
  if (notes) body.slides = Object.entries(notes).map(([id, text]) => ({ id, notes: text }));

  const res = await request(`/api/v1/reports/${encodeURIComponent(sampleId)}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new ReportStoreError(await errorMessage(res, "Couldn't update the report."));
  return mapBackendReport((await res.json()) as BackendReport);
}

/** Delete a report you created, with its slide images. */
export async function deleteReport(sampleId: string): Promise<void> {
  const res = await request(`/api/v1/reports/${encodeURIComponent(sampleId)}/`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) {
    throw new ReportStoreError(await errorMessage(res, "Couldn't delete the report."));
  }
}

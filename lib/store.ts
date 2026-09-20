// ---------------------------------------------------------------------------
// REPORT STORE — where saved reports live.
//
// Saved reports and their slide images live on the backend now
// (GET/POST /api/v1/reports/, GET /api/v1/reports/:sampleId/) — see
// listReports/getReport/saveReport below. Reports are a shared corpus, so
// reads/writes require a signed-in accessToken; signed out (or on a failed
// request) falls back to the seed history alone, matching the pattern
// already used for the species catalog and monthly pollen counts in
// lib/data.ts.
//
// The seed records in lib/data.ts are treated as read-only history that
// always appears alongside anything fetched from the backend.
//
// A third store, `drafts`, holds the analysis a researcher has just run but not
// yet saved. It exists because Analyze and the report page it hands off to are
// two routes: the readings, the images and the collection details have to
// outlive the navigation between them, and a draft in IndexedDB also survives a
// refresh of the report page. Only one draft is kept — a researcher works
// through one batch at a time. Drafts stay local-only — they're pre-save,
// pre-report-existence state, not part of the backend migration above.
// ---------------------------------------------------------------------------

import {
  API_BASE_URL,
  MOCK_TODAY,
  specimens as seedSpecimens,
  type CollectedAt,
  type DetectedGrain,
  type Specimen,
  type SpecimenDetection,
  type SpecimenSlide,
  type WeatherConditions,
} from "@/lib/data";
import type { NewReportInput } from "@/lib/analysis";
import { getSnapshot as getSettingsSnapshot } from "@/lib/settings";

const DB_NAME = "pollens";
const DB_VERSION = 2;
const REPORTS = "reports";
const IMAGES = "images";
const DRAFTS = "drafts";

/** A slide image kept alongside its report, keyed by the slide's id. */
type StoredImage = { slideId: string; sampleId: string; blob: Blob };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(REPORTS)) {
        db.createObjectStore(REPORTS, { keyPath: "sampleId" });
      }
      if (!db.objectStoreNames.contains(IMAGES)) {
        const images = db.createObjectStore(IMAGES, { keyPath: "slideId" });
        images.createIndex("bySample", "sampleId", { unique: false });
      }
      // Added in v2. Existing browsers hold a v1 database, so this runs as an
      // upgrade on them and leaves their saved reports untouched.
      if (!db.objectStoreNames.contains(DRAFTS)) {
        db.createObjectStore(DRAFTS, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * IndexedDB is unavailable during server rendering and in a few locked-down
 * browser modes. Callers get the seed records instead of an exception.
 */
function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

function sortByRecency(a: Specimen, b: Specimen): number {
  // ISO timestamps sort chronologically as text; sampleId breaks same-instant
  // ties so the order never flickers between renders.
  return b.collectedAt.localeCompare(a.collectedAt) || b.sampleId.localeCompare(a.sampleId);
}

// The backend's SlideSerializer emits `image_url` (snake_case — an
// inconsistency against its own camelCase convention elsewhere), mapped to
// `imageUrl` below rather than fixed server-side.
type BackendSlide = Omit<SpecimenSlide, "imageUrl"> & { image_url: string };
type BackendReport = Omit<Specimen, "slides"> & { slides: BackendSlide[] };

function mapBackendReport(row: BackendReport): Specimen {
  return {
    ...row,
    slides: row.slides.map(({ image_url, ...slide }) => ({ ...slide, imageUrl: image_url })),
  };
}

/** Saved reports (from the backend, once signed in) and seed history together, newest collection first. */
export async function listReports(): Promise<Specimen[]> {
  const { accessToken } = getSettingsSnapshot();
  let fetched: Specimen[] = [];
  if (accessToken) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/reports/`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const rows = (await res.json()) as BackendReport[];
        fetched = rows.map(mapBackendReport);
      }
    } catch {
      // Network failure — fall back to seed history below.
    }
  }
  return [...fetched, ...seedSpecimens].sort(sortByRecency);
}

export async function getReport(sampleId: string): Promise<Specimen | null> {
  const { accessToken } = getSettingsSnapshot();
  if (accessToken) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/reports/${sampleId}/`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) return mapBackendReport((await res.json()) as BackendReport);
    } catch {
      // Fall through to the seed lookup below.
    }
  }
  return seedSpecimens.find((s) => s.sampleId === sampleId) ?? null;
}

/** Direct <img src> URLs for a report's slide images — server-hosted, no object-URL lifecycle needed. */
export function getReportImageUrls(report: Specimen): Record<string, string> {
  const urls: Record<string, string> = {};
  for (const slide of report.slides) {
    if (slide.imageUrl) urls[slide.id] = slide.imageUrl;
  }
  return urls;
}

/** Blobs for a report's slides — used when building the PDF. */
export async function getReportImageBlobs(report: Specimen): Promise<Record<string, Blob>> {
  const entries = await Promise.all(
    report.slides
      .filter((slide) => Boolean(slide.imageUrl))
      .map(async (slide) => [slide.id, await (await fetch(slide.imageUrl!)).blob()] as const),
  );
  return Object.fromEntries(entries);
}

/**
 * Persist a finished batch as one report, storing each slide's image with it.
 * The sample id comes back from the backend rather than being minted
 * client-side.
 */
export async function saveReport(
  input: NewReportInput,
  images: Record<string, Blob>, // keyed by the index of the slide in input.slides
): Promise<Specimen> {
  const { accessToken } = getSettingsSnapshot();
  if (!accessToken) {
    throw new Error("You must be signed in to save a report.");
  }

  const formData = new FormData();
  formData.append("collectedAt", input.collectedAt);
  formData.append("location", input.location.trim());
  formData.append("researcher", input.researcher.trim());
  if (input.weather) formData.append("weather", JSON.stringify(input.weather));
  formData.append("slides", JSON.stringify(input.slides));
  input.slides.forEach((slide, index) => {
    const file = images[String(index)];
    if (file) formData.append(String(index), file, slide.fileName);
  });

  // No Content-Type header here — the browser sets the multipart boundary
  // itself from a FormData body.
  const res = await fetch(`${API_BASE_URL}/api/v1/reports/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(body?.detail ?? "Failed to save report.");
  }
  return mapBackendReport((await res.json()) as BackendReport);
}

// ---------------------------------------------------------------------------
// Draft — the analysis that has been run but not saved yet.
// ---------------------------------------------------------------------------

/** One analyzed slide waiting to be saved, image included. */
export type DraftSlide = {
  id: string;
  fileName: string;
  image: Blob;
  detections: SpecimenDetection[];
  grains: DetectedGrain[];
  notes: string;
};

/**
 * A finished analysis on its way to becoming a report: the readings, the
 * images, and the collection details the researcher typed on the Analyze
 * screen. Every field stays editable on the report page until it is saved.
 */
export type ReportDraft = {
  collectedAt: CollectedAt;
  location: string;
  researcher: string;
  weather: WeatherConditions;
  slides: DraftSlide[];
  /** When the analysis was run — not when the specimen was collected. */
  analyzedAt: string;
};

// One draft at a time, so it lives under a fixed key rather than an id that
// would have to be threaded through the URL.
const DRAFT_KEY = "current";

type StoredDraft = ReportDraft & { id: typeof DRAFT_KEY };

/** Replaces whatever draft was there — a new analysis supersedes the old one. */
export async function saveDraft(draft: ReportDraft): Promise<void> {
  if (!hasIndexedDb()) return;
  const db = await openDb();
  try {
    const tx = db.transaction(DRAFTS, "readwrite");
    tx.objectStore(DRAFTS).put({ ...draft, id: DRAFT_KEY } satisfies StoredDraft);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** The analysis waiting to be saved, or null when there isn't one. */
export async function getDraft(): Promise<ReportDraft | null> {
  if (!hasIndexedDb()) return null;
  const db = await openDb();
  try {
    const tx = db.transaction(DRAFTS, "readonly");
    const found = await promisify(
      tx.objectStore(DRAFTS).get(DRAFT_KEY) as IDBRequest<StoredDraft | undefined>,
    );
    return found ?? null;
  } finally {
    db.close();
  }
}

/** Drops the pending analysis — after it is saved, or when it is discarded. */
export async function clearDraft(): Promise<void> {
  if (!hasIndexedDb()) return;
  const db = await openDb();
  try {
    const tx = db.transaction(DRAFTS, "readwrite");
    tx.objectStore(DRAFTS).delete(DRAFT_KEY);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** Removes a locally saved report and its images. Seed records are read-only. */
export async function deleteReport(sampleId: string): Promise<void> {
  if (!hasIndexedDb()) return;
  const db = await openDb();
  try {
    const tx = db.transaction([REPORTS, IMAGES], "readwrite");
    tx.objectStore(REPORTS).delete(sampleId);
    const index = tx.objectStore(IMAGES).index("bySample");
    const keys = await promisify(index.getAllKeys(IDBKeyRange.only(sampleId)));
    keys.forEach((key) => tx.objectStore(IMAGES).delete(key));
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** Counts and rough size of what this browser is holding, for the Settings page. */
export async function getStorageSummary(): Promise<{
  reportCount: number;
  imageCount: number;
  approxBytes: number;
}> {
  if (!hasIndexedDb()) return { reportCount: 0, imageCount: 0, approxBytes: 0 };
  const db = await openDb();
  try {
    const tx = db.transaction([REPORTS, IMAGES], "readonly");
    const reports = await promisify(
      tx.objectStore(REPORTS).getAll() as IDBRequest<Specimen[]>,
    );
    const images = await promisify(tx.objectStore(IMAGES).getAll() as IDBRequest<StoredImage[]>);
    return {
      reportCount: reports.length,
      imageCount: images.length,
      // Images dominate; the JSON metadata is rounding error next to them.
      approxBytes:
        images.reduce((sum, i) => sum + i.blob.size, 0) + JSON.stringify(reports).length,
    };
  } finally {
    db.close();
  }
}

/**
 * Wipes every locally saved report and image, and any unsaved analysis with
 * them — "clear local data" would otherwise leave a draft's images behind.
 * Seed records are unaffected.
 */
export async function clearAllReports(): Promise<void> {
  if (!hasIndexedDb()) return;
  const db = await openDb();
  try {
    const tx = db.transaction([REPORTS, IMAGES, DRAFTS], "readwrite");
    tx.objectStore(REPORTS).clear();
    tx.objectStore(IMAGES).clear();
    tx.objectStore(DRAFTS).clear();
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** True for the read-only records that ship with the app. */
export function isSeedReport(sampleId: string): boolean {
  return seedSpecimens.some((s) => s.sampleId === sampleId);
}

export { MOCK_TODAY };

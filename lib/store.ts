// ---------------------------------------------------------------------------
// REPORT STORE — where saved reports live.
//
// There is no backend yet, so reports and their slide images are persisted in
// the browser's IndexedDB. That is what lets a saved report survive a refresh
// and still be there when Reports loads.
//
// Every function here is async and returns plain domain objects, so replacing
// the bodies with `fetch` calls is the whole of the backend migration:
//
//   listReports()      → GET  /api/reports
//   getReport(id)      → GET  /api/reports/:id
//   saveReport(input)  → POST /api/reports   (multipart, images included)
//
// The seed records in lib/data.ts are treated as read-only history that always
// appears alongside anything saved locally.
//
// A third store, `drafts`, holds the analysis a researcher has just run but not
// yet saved. It exists because Analyze and the report page it hands off to are
// two routes: the readings, the images and the collection details have to
// outlive the navigation between them, and a draft in IndexedDB also survives a
// refresh of the report page. Only one draft is kept — a researcher works
// through one batch at a time.
// ---------------------------------------------------------------------------

import {
  MOCK_TODAY,
  specimens as seedSpecimens,
  type CollectedAt,
  type Specimen,
  type SpecimenDetection,
  type WeatherConditions,
} from "@/lib/data";
import type { NewReportInput } from "@/lib/analysis";

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

async function readStoredReports(): Promise<Specimen[]> {
  if (!hasIndexedDb()) return [];
  const db = await openDb();
  try {
    const tx = db.transaction(REPORTS, "readonly");
    return await promisify(tx.objectStore(REPORTS).getAll() as IDBRequest<Specimen[]>);
  } finally {
    db.close();
  }
}

/** Saved reports and seed history together, newest collection first. */
export async function listReports(): Promise<Specimen[]> {
  const stored = await readStoredReports();
  return [...stored, ...seedSpecimens].sort((a, b) => {
    // ISO timestamps sort chronologically as text; sampleId breaks same-instant
    // ties so the order never flickers between renders.
    return b.collectedAt.localeCompare(a.collectedAt) || b.sampleId.localeCompare(a.sampleId);
  });
}

export async function getReport(sampleId: string): Promise<Specimen | null> {
  if (hasIndexedDb()) {
    const db = await openDb();
    try {
      const tx = db.transaction(REPORTS, "readonly");
      const found = await promisify(
        tx.objectStore(REPORTS).get(sampleId) as IDBRequest<Specimen | undefined>,
      );
      if (found) return found;
    } finally {
      db.close();
    }
  }
  return seedSpecimens.find((s) => s.sampleId === sampleId) ?? null;
}

/** Object URLs for a report's slide images, keyed by slide id. */
export async function getReportImageUrls(sampleId: string): Promise<Record<string, string>> {
  if (!hasIndexedDb()) return {};
  const db = await openDb();
  try {
    const tx = db.transaction(IMAGES, "readonly");
    const index = tx.objectStore(IMAGES).index("bySample");
    const images = await promisify(
      index.getAll(IDBKeyRange.only(sampleId)) as IDBRequest<StoredImage[]>,
    );
    return Object.fromEntries(images.map((i) => [i.slideId, URL.createObjectURL(i.blob)]));
  } finally {
    db.close();
  }
}

/** Blobs for a report's slides — used when building the PDF. */
export async function getReportImageBlobs(sampleId: string): Promise<Record<string, Blob>> {
  if (!hasIndexedDb()) return {};
  const db = await openDb();
  try {
    const tx = db.transaction(IMAGES, "readonly");
    const index = tx.objectStore(IMAGES).index("bySample");
    const images = await promisify(
      index.getAll(IDBKeyRange.only(sampleId)) as IDBRequest<StoredImage[]>,
    );
    return Object.fromEntries(images.map((i) => [i.slideId, i.blob]));
  } finally {
    db.close();
  }
}

/**
 * Mints the next PLN-YYYY-NNNN id, counting both seed and saved reports so ids
 * keep climbing across sessions instead of colliding after a refresh.
 */
function nextSampleId(existing: Specimen[]): string {
  const highest = existing.reduce((max, s) => {
    const n = parseInt(s.sampleId.split("-").pop() ?? "0", 10);
    return Number.isNaN(n) ? max : Math.max(max, n);
  }, 0);
  const year = new Date().getFullYear();
  return `PLN-${year}-${String(highest + 1).padStart(4, "0")}`;
}

/**
 * Persist a finished batch as one report, storing each slide's image with it.
 *
 * TODO(backend): POST the report and its images to /api/reports and return the
 * created row, so the sample ID comes from the database instead of being minted
 * client-side.
 */
export async function saveReport(
  input: NewReportInput,
  images: Record<string, Blob>, // keyed by the index of the slide in input.slides
): Promise<Specimen> {
  const existing = [...(await readStoredReports()), ...seedSpecimens];
  const sampleId = nextSampleId(existing);

  const report: Specimen = {
    sampleId,
    collectedAt: input.collectedAt,
    location: input.location.trim(),
    slides: input.slides.map((slide, index) => ({
      id: `${sampleId}-S${index + 1}`,
      fileName: slide.fileName,
      detections: slide.detections,
      notes: slide.notes.trim(),
    })),
    weather: input.weather,
    researcher: input.researcher.trim() || "Unknown",
    status: "Completed",
  };

  if (!hasIndexedDb()) return report;

  const db = await openDb();
  try {
    const tx = db.transaction([REPORTS, IMAGES], "readwrite");
    tx.objectStore(REPORTS).put(report);

    const imageStore = tx.objectStore(IMAGES);
    report.slides.forEach((slide, index) => {
      const file = images[String(index)];
      if (file) imageStore.put({ slideId: slide.id, sampleId, blob: file } satisfies StoredImage);
    });

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }

  return report;
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

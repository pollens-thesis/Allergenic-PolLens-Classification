// ---------------------------------------------------------------------------
// ANALYSIS SERVICE — the seam between the UI and the backend.
//
// Inference from the Analyze screen goes through this module. Once signed in,
// detection goes through the backend's Roboflow proxy
// (POST /api/v1/reports/detect/). Persisting a finished report is lib/store.ts's job.
//
// Until the Roboflow model is deployed the backend answers /detect/ from a
// canned, Roboflow-shaped response (ROBOFLOW_MOCK), so this file already runs
// the real mapping. A failed detection is reported as a `DetectionError`, never
// replaced with a made-up reading — a report must only ever hold what the
// model actually returned.
// ---------------------------------------------------------------------------

import {
  aggregateGrainPredictions,
  speciesCatalog,
  toDetectedGrains,
  type CollectedAt,
  type DetectedGrain,
  type GrainPrediction,
  type SpecimenDetection,
  type SpeciesId,
} from "@/lib/data";
import { apiFetch, SessionExpiredError } from "@/lib/api";
import { BRAND_NAME } from "@/lib/brand";

export type AnalysisResult = {
  detections: SpecimenDetection[];
  /** Every grain with its box, so the reading can be shown over the image. */
  grains: DetectedGrain[];
  /** The server answered from its built-in sample (ROBOFLOW_MOCK), not the model. */
  sampleDetections: boolean;
};

/** One slide's reading as it leaves the Analyze screen, before it is saved. */
export type NewSlideInput = {
  fileName: string;
  detections: SpecimenDetection[];
  grains: DetectedGrain[];
  notes: string;
};

export type NewReportInput = {
  /** Researcher-provided name to distinguish this collection in Reports. */
  reportName: string;
  /** When the specimen was collected in the field, not when it was analyzed. */
  collectedAt: CollectedAt;
  location: string;
  researcher: string;
  slides: NewSlideInput[];
};

// --- Roboflow mapping ------------------------------------------------------
// The backend passes Roboflow's own response through, trimmed to these fields.
// Boxes are in pixels with `x`/`y` at the box's centre; the app wants
// normalized 0–1 boxes from the top-left corner.

type RoboflowPrediction = {
  class: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

type DetectResponse = {
  image: { width: number; height: number };
  predictions: RoboflowPrediction[];
  mock?: boolean;
};

const knownSpecies = new Set<string>(speciesCatalog.map((s) => s.id));

/**
 * Model class name → catalog id. The dataset is labelled with the species slugs
 * themselves, so this only forgives case and separators ("Mimosa pudica",
 * "mimosa-pudica"). Returns null for anything outside the catalog.
 */
function toSpeciesId(className: string): SpeciesId | null {
  const id = className.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return knownSpecies.has(id) ? (id as SpeciesId) : null;
}

function fromRoboflow({ image, predictions }: DetectResponse): GrainPrediction[] {
  const grains: GrainPrediction[] = [];
  for (const p of predictions) {
    const speciesId = toSpeciesId(p.class);
    if (!speciesId) {
      // A class outside the catalog can't be named, counted or coloured.
      console.warn(`Skipping detection with unknown class "${p.class}"`);
      continue;
    }
    // A grain cut off by the frame edge comes back partly outside the image;
    // clip it to the frame (the server would clip it the same way).
    const x0 = Math.max(0, (p.x - p.width / 2) / image.width);
    const y0 = Math.max(0, (p.y - p.height / 2) / image.height);
    const x1 = Math.min(1, (p.x + p.width / 2) / image.width);
    const y1 = Math.min(1, (p.y + p.height / 2) / image.height);
    if (x1 <= x0 || y1 <= y0) continue;
    grains.push({
      speciesId,
      confidence: p.confidence,
      box: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 },
    });
  }
  return grains;
}

/** Detection didn't produce a reading; `message` is written for the researcher. */
export class DetectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DetectionError";
  }
}

async function detectionFailure(res: Response): Promise<DetectionError> {
  const body = (await res.json().catch(() => null)) as { detail?: unknown } | null;
  const detail = typeof body?.detail === "string" ? body.detail : "";
  if (res.status === 503) {
    return new DetectionError(`Detection is unavailable on the server right now. Contact the ${BRAND_NAME} team.`);
  }
  if (res.status === 502 || res.status === 504) {
    return new DetectionError(
      "The detection model didn't respond. The server may be waking up — try again in a minute.",
    );
  }
  if (res.status === 413) return new DetectionError("This image is over the server's size limit. Use a smaller JPEG or PNG.");
  if (res.status === 400) return new DetectionError(detail || "This image couldn't be read.");
  return new DetectionError(detail || "The server couldn't analyze this slide. Try again, or remove it to continue.");
}

// --- Public API ------------------------------------------------------------

/**
 * Identify and count the pollen grains on a specimen image via the backend's
 * Roboflow proxy. Throws `DetectionError` when there is no reading to show
 * (server unreachable, model down, unreadable image), or `SessionExpiredError`
 * when the session is gone (lib/api.ts is already redirecting to sign-in).
 */
export async function analyzeSpecimen(file: File): Promise<AnalysisResult> {
  const body = new FormData();
  body.append("image", file);

  let res: Response;
  try {
    res = await apiFetch("/api/v1/reports/detect/", { method: "POST", body });
  } catch (error) {
    if (error instanceof SessionExpiredError) throw error;
    throw new DetectionError(`Couldn't reach the ${BRAND_NAME} server. Check your connection and try again.`);
  }
  if (!res.ok) throw await detectionFailure(res);

  const payload = (await res.json()) as DetectResponse;
  const predictions = fromRoboflow(payload);
  return {
    detections: aggregateGrainPredictions(predictions),
    grains: toDetectedGrains(predictions),
    sampleDetections: payload.mock === true,
  };
}

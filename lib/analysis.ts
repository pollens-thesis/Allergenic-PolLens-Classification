// ---------------------------------------------------------------------------
// ANALYSIS SERVICE — the seam between the UI and the backend.
//
// Inference and lookups the Analyze screen performs go through this module, and
// every function here is async. Once signed in, detection goes through the
// backend's Roboflow proxy (POST /api/v1/reports/detect/) and weather through
// its OpenWeather proxy (GET /api/v1/reports/weather/). Persisting a finished
// report is lib/store.ts's job, not this file's.
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
  type WeatherConditions,
} from "@/lib/data";
import { apiFetch, hasSession, SessionExpiredError } from "@/lib/api";

export type AnalysisResult = {
  detections: SpecimenDetection[];
  /** Every grain with its box, so the reading can be shown over the image. */
  grains: DetectedGrain[];
  /** Filled in when a weather lookup is wired up; null means "ask the researcher". */
  weather: WeatherConditions | null;
};

/** One slide's reading as it leaves the Analyze screen, before it is saved. */
export type NewSlideInput = {
  fileName: string;
  detections: SpecimenDetection[];
  grains: DetectedGrain[];
  notes: string;
};

export type NewReportInput = {
  /** When the specimen was collected in the field, not when it was analyzed. */
  collectedAt: CollectedAt;
  location: string;
  researcher: string;
  weather: WeatherConditions | null;
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
      // getSpecies() throws on unknown ids, so an unmapped class can't go further.
      console.warn(`Skipping detection with unknown class "${p.class}"`);
      continue;
    }
    grains.push({
      speciesId,
      confidence: p.confidence,
      box: {
        x: (p.x - p.width / 2) / image.width,
        y: (p.y - p.height / 2) / image.height,
        width: p.width / image.width,
        height: p.height / image.height,
      },
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
    return new DetectionError("Detection isn't set up on the server yet (Roboflow settings are missing).");
  }
  if (res.status === 502 || res.status === 504) {
    return new DetectionError("The detection model didn't respond. Try again in a moment.");
  }
  if (res.status === 413) return new DetectionError("This image is too large to analyze.");
  if (res.status === 400) return new DetectionError(detail || "This image couldn't be read.");
  return new DetectionError(detail || `Detection failed (HTTP ${res.status}).`);
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
    throw new DetectionError("Couldn't reach the analysis server. Check your connection and try again.");
  }
  if (!res.ok) throw await detectionFailure(res);

  const predictions = fromRoboflow((await res.json()) as DetectResponse);
  return {
    detections: aggregateGrainPredictions(predictions),
    grains: toDetectedGrains(predictions),
    weather: null, // filled on the Analyze screen from the location search — see fetchWeather
  };
}

/**
 * Current weather for a collection site, via the backend's OpenWeather proxy,
 * already mapped onto `WeatherConditions`. Takes the coordinates of a place
 * picked from the location search (preferred — they always resolve) or a
 * free-text location. Null when signed out, unresolvable, or the lookup fails —
 * the fields then stay manual.
 */
export async function fetchWeather(
  site: string | { lat: number; lon: number },
): Promise<WeatherConditions | null> {
  if (!hasSession()) return null;
  const params =
    typeof site === "string"
      ? site.trim()
        ? new URLSearchParams({ location: site.trim() })
        : null
      : new URLSearchParams({ lat: String(site.lat), lon: String(site.lon) });
  if (!params) return null;
  try {
    const res = await apiFetch(`/api/v1/reports/weather/?${params}`);
    if (!res.ok) return null;
    return (await res.json()) as WeatherConditions;
  } catch {
    return null;
  }
}

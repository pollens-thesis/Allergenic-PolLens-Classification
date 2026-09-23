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
// the real mapping. Signed out, or if the request fails, the local
// deterministic mock below stands in — it produces the same raw per-grain
// predictions, so both paths share `aggregateGrainPredictions`.
// ---------------------------------------------------------------------------

import {
  API_BASE_URL,
  aggregateGrainPredictions,
  speciesCatalog,
  toDetectedGrains,
  type BoundingBox,
  type CollectedAt,
  type DetectedGrain,
  type GrainPrediction,
  type SpecimenDetection,
  type SpeciesId,
  type WeatherConditions,
} from "@/lib/data";
import { getSnapshot as getSettingsSnapshot } from "@/lib/settings";

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

/** How long the mock pretends inference takes. */
const MOCK_INFERENCE_MS = 1400;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Deterministic mock ----------------------------------------------------
// A real model returns the same reading for the same image. Seeding the mock
// from the file makes re-analysing one image reproducible, while different
// images still give different results.

function seedFromFile(file: File): number {
  const key = `${file.name}:${file.size}:${file.lastModified}`;
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Small deterministic PRNG (mulberry32), returning floats in [0, 1). */
function makeRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fraction of `a` that lies inside `b`, used to keep mock grains from stacking. */
function overlapRatio(a: BoundingBox, b: BoundingBox): number {
  const overlapWidth = Math.max(
    0,
    Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x),
  );
  const overlapHeight = Math.max(
    0,
    Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y),
  );
  return (overlapWidth * overlapHeight) / (a.width * a.height);
}

/**
 * A plausible grain box: roughly square, a few percent of the frame, and
 * nudged away from boxes already placed. Real detections do touch, so a light
 * overlap is allowed — this only stops the mock piling every grain in one spot.
 */
function mockBox(random: () => number, placed: BoundingBox[]): BoundingBox {
  for (let attempt = 0; attempt < 12; attempt++) {
    const size = 0.05 + random() * 0.06;
    // Slightly oval, the way a grain sits at an angle under the lens.
    const height = size * (0.85 + random() * 0.3);
    const box = {
      x: 0.02 + random() * (0.96 - size),
      y: 0.02 + random() * (0.96 - height),
      width: size,
      height,
    };
    if (placed.every((other) => overlapRatio(box, other) < 0.25)) return box;
  }
  // Crowded slide — take the last position rather than loop forever.
  const size = 0.05 + random() * 0.06;
  return {
    x: 0.02 + random() * (0.96 - size),
    y: 0.02 + random() * (0.96 - size),
    width: size,
    height: size,
  };
}

function mockGrainPredictions(random: () => number): GrainPrediction[] {
  const pool: SpeciesId[] = speciesCatalog.map((s) => s.id);

  // Shuffle the catalog, then keep the first 2–4 species as what's on the slide.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const speciesOnSlide = pool.slice(0, 2 + Math.floor(random() * 3));

  const predictions: GrainPrediction[] = [];
  const placed: BoundingBox[] = [];
  speciesOnSlide.forEach((speciesId, index) => {
    // The first species is the dominant one; later ones are progressively rarer.
    const grains = Math.max(1, Math.round((1 + random() * 19) / (index + 1)));
    // Per-species baseline score, with a little spread grain to grain.
    const base = 0.62 + random() * 0.33;
    for (let g = 0; g < grains; g++) {
      const confidence = Math.min(0.99, Math.max(0.4, base + (random() - 0.5) * 0.12));
      const box = mockBox(random, placed);
      placed.push(box);
      predictions.push({ speciesId, confidence, box });
    }
  });

  return predictions;
}

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

async function detectGrains(file: File, accessToken: string): Promise<GrainPrediction[] | null> {
  const body = new FormData();
  body.append("image", file);
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/reports/detect/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body,
    });
    if (!res.ok) return null;
    return fromRoboflow((await res.json()) as DetectResponse);
  } catch {
    return null;
  }
}

// --- Public API ------------------------------------------------------------

/**
 * Identify and count the pollen grains on a specimen image — via the backend's
 * Roboflow proxy when signed in, the local mock otherwise or if that fails.
 */
export async function analyzeSpecimen(file: File): Promise<AnalysisResult> {
  const { accessToken } = getSettingsSnapshot();
  let predictions = accessToken ? await detectGrains(file, accessToken) : null;
  if (!predictions) {
    if (accessToken) console.warn("Detection request failed; using the local mock reading.");
    await delay(MOCK_INFERENCE_MS);
    predictions = mockGrainPredictions(makeRandom(seedFromFile(file)));
  }
  return {
    detections: aggregateGrainPredictions(predictions),
    grains: toDetectedGrains(predictions),
    weather: null, // see fetchWeather — the Analyze screen doesn't call it yet
  };
}

/**
 * Current weather for a collection site, via the backend's OpenWeather proxy,
 * already mapped onto `WeatherConditions`. Null when signed out, the location
 * can't be resolved, or the lookup fails — the fields then stay manual.
 */
export async function fetchWeather(location: string): Promise<WeatherConditions | null> {
  const { accessToken } = getSettingsSnapshot();
  if (!accessToken || !location.trim()) return null;
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/v1/reports/weather/?location=${encodeURIComponent(location)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) return null;
    return (await res.json()) as WeatherConditions;
  } catch {
    return null;
  }
}

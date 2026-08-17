// ---------------------------------------------------------------------------
// ANALYSIS SERVICE — the seam between the UI and the backend.
//
// Inference and lookups the Analyze screen performs go through this module, and
// every function here is already async. Today each one resolves mock data; when
// the backend lands, only the bodies below change — no component is touched.
// Persisting a finished report is lib/store.ts's job, not this file's.
//
// The mock deliberately produces raw per-grain predictions and runs them
// through `aggregateGrainPredictions`, the same function real model output will
// go through, so the aggregation path is exercised from day one.
// ---------------------------------------------------------------------------

import {
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

// --- Public API ------------------------------------------------------------

/**
 * Identify and count the pollen grains on a specimen image.
 *
 * TODO(backend): POST the image to the Roboflow inference endpoint and map
 * `response.predictions` (one entry per detected grain, each with `class`,
 * `confidence` and a centre-plus-size box in pixels) to `GrainPrediction[]`.
 * Roboflow reports `x`/`y` as the box's centre against the image's pixel
 * dimensions, so the mapping is
 * `{ x: (p.x - p.width / 2) / imageWidth, y: (p.y - p.height / 2) / imageHeight,
 *    width: p.width / imageWidth, height: p.height / imageHeight }`.
 * Everything downstream is unchanged.
 */
export async function analyzeSpecimen(file: File): Promise<AnalysisResult> {
  await delay(MOCK_INFERENCE_MS);

  const random = makeRandom(seedFromFile(file));
  const predictions = mockGrainPredictions(random);
  return {
    detections: aggregateGrainPredictions(predictions),
    grains: toDetectedGrains(predictions),
    weather: null, // see fetchWeather — researcher fills the fields in by hand for now
  };
}

/**
 * Look up the weather for a collection site.
 *
 * TODO(backend): call the weather provider (OpenWeather) for `location` and map
 * its response onto `WeatherConditions`. Returning null today is what keeps the
 * conditions fields manually entered — the Analyze screen already handles both.
 */
export async function fetchWeather(location: string): Promise<WeatherConditions | null> {
  void location;
  return null;
}

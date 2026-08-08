// ---------------------------------------------------------------------------
// ANALYSIS SERVICE — the seam between the UI and the backend.
//
// Every call the Analyze screen makes goes through this module, and every
// function here is already async. Today each one resolves mock data; when the
// backend lands, only the bodies below change — no component has to be touched.
//
// The mock deliberately produces raw per-grain predictions and runs them
// through `aggregateGrainPredictions`, the same function real model output will
// go through, so the aggregation path is exercised from day one.
// ---------------------------------------------------------------------------

import {
  aggregateGrainPredictions,
  speciesCatalog,
  specimens,
  type GrainPrediction,
  type Specimen,
  type SpecimenDetection,
  type SpeciesId,
  type WeatherConditions,
} from "@/lib/data";

export type AnalysisResult = {
  detections: SpecimenDetection[];
  /** Filled in when a weather lookup is wired up; null means "ask the researcher". */
  weather: WeatherConditions | null;
};

export type NewSpecimenInput = {
  location: string;
  researcher: string;
  notes: string;
  weather: WeatherConditions | null;
  detections: SpecimenDetection[];
};

/** How long the mock pretends inference takes. */
const MOCK_INFERENCE_MS = 1400;
const MOCK_SAVE_MS = 500;

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

function mockGrainPredictions(random: () => number): GrainPrediction[] {
  const pool: SpeciesId[] = speciesCatalog.map((s) => s.id);

  // Shuffle the catalog, then keep the first 2–4 species as what's on the slide.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const speciesOnSlide = pool.slice(0, 2 + Math.floor(random() * 3));

  const predictions: GrainPrediction[] = [];
  speciesOnSlide.forEach((speciesId, index) => {
    // The first species is the dominant one; later ones are progressively rarer.
    const grains = Math.max(1, Math.round((1 + random() * 19) / (index + 1)));
    // Per-species baseline score, with a little spread grain to grain.
    const base = 0.62 + random() * 0.33;
    for (let g = 0; g < grains; g++) {
      const confidence = Math.min(0.99, Math.max(0.4, base + (random() - 0.5) * 0.12));
      predictions.push({ speciesId, confidence });
    }
  });

  return predictions;
}

// --- Public API ------------------------------------------------------------

/**
 * Identify and count the pollen grains on a specimen image.
 *
 * TODO(backend): POST the image to the Roboflow inference endpoint and map
 * `response.predictions` (one entry per detected grain, each with `class` and
 * `confidence`) to `GrainPrediction[]`. Everything downstream is unchanged.
 */
export async function analyzeSpecimen(file: File): Promise<AnalysisResult> {
  await delay(MOCK_INFERENCE_MS);

  const random = makeRandom(seedFromFile(file));
  return {
    detections: aggregateGrainPredictions(mockGrainPredictions(random)),
    weather: null, // see fetchWeather — researcher fills the fields in by hand for now
  };
}

/**
 * Persist a finished reading.
 *
 * TODO(backend): POST to /api/specimens and return the created row, so the
 * sample ID comes from the database instead of being minted client-side.
 */
export async function saveSpecimen(input: NewSpecimenInput): Promise<Specimen> {
  await delay(MOCK_SAVE_MS);

  return {
    sampleId: nextSampleId(),
    date: new Date().toISOString().slice(0, 10),
    location: input.location.trim(),
    detections: input.detections,
    notes: input.notes.trim(),
    weather: input.weather,
    researcher: input.researcher.trim() || "Unknown",
    status: "Completed",
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

// --- Helpers ---------------------------------------------------------------

let savedThisSession = 0;

/** Mints the next PLN-YYYY-NNNN id after the highest one already on record. */
function nextSampleId(): string {
  const highest = specimens.reduce((max, s) => {
    const n = parseInt(s.sampleId.split("-").pop() ?? "0", 10);
    return Number.isNaN(n) ? max : Math.max(max, n);
  }, 0);
  savedThisSession += 1;
  const year = new Date().getFullYear();
  return `PLN-${year}-${String(highest + savedThisSession).padStart(4, "0")}`;
}

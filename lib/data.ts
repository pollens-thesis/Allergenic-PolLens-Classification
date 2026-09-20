// ---------------------------------------------------------------------------
// SINGLE SOURCE OF TRUTH
// Everything below (allergen classes, report rows, recent detections,
// dashboard stats) is derived from `specimens`. Edit specimens/speciesCatalog
// and every screen that reads from this file stays consistent automatically.
// The one exception is `historicalPollenCounts`, which represents a separate
// real-world dataset (continuous monthly air-monitoring measurements) rather
// than individual specimen analyses — it shares the same species catalog for
// naming/color consistency, but its numbers are independent by design.
// ---------------------------------------------------------------------------

export type SpeciesId =
  | "amaranthus_spinosus"
  | "axonopus_compressus"
  | "brachiaria_mutica"
  | "chloris_barbata"
  | "chrysopogon_aciculatus"
  | "cocos_nucifera"
  | "cyperus_rotundus"
  | "dactyloctenium_aegyptium"
  | "digitaria_ciliaris"
  | "echinochloa_crus_galli"
  | "eleusine_indica"
  | "imperata_cylindrica"
  | "leucaena_leucocephala"
  | "panicum_maximum"
  | "pennisetum_polystachion"
  | "pithecellobium_dulce"
  | "saccharum_spontaneum"
  | "samanea_saman"
  | "sorghum_halepense"
  | "tridax_procumbens"
  | "oryza_sativa"
  | "mimosa_pudica"
  | "mangifera_indica";

export type Species = {
  id: SpeciesId;
  /** Full binomial, e.g. "Amaranthus spinosus" — pollen here is classified to species, not just genus. */
  scientificName: string;
  commonName: string;
  code: string; // taxonomic-style short tag, e.g. AMAR
  season: string;
  riskLevel: "High" | "Moderate" | "Low";
  color: string; // CSS color, used consistently across charts, badges, thumbnails
};

// The real 23-species UPLB taxonomic scope, replacing an earlier 8-species
// European/temperate placeholder catalog that was never cross-checked against
// the actual dataset (see the Taxonomic Scope row in docs/system-spec.md).
// commonName/season/riskLevel are unset placeholders (not real clinical
// assessments) pending real per-species data — riskLevel defaults to
// "Moderate" rather than widening the type for an "unknown" state. `color`
// cycles a validated 8-hue categorical palette (dataviz skill's reference
// palette — 23 mutually-distinguishable hues isn't achievable, confirmed by
// its own validator, so identity colors repeat every 8 species), except
// pithecellobium_dulce, deliberately pulled off the cycle: it and
// dactyloctenium_aegyptium shared the exact same red (#e34948), a guaranteed
// collision if both land in the historical chart's top-8-by-volume selection
// at once (confirmed live). Cycle-mates sharing a *similar but distinct* hue
// (e.g. the two greens, or orange vs. red) remain — that's the palette's own
// validated limit at 8 hues, not something this fix attempts to solve.
// IMPORTANT: this color is duplicated in api/reports/migrations — keep both
// in sync (see 0006_recolor_species.py).
export const speciesCatalog: Species[] = [
  { id: "amaranthus_spinosus", scientificName: "Amaranthus spinosus", commonName: "TBD", code: "AMAR", season: "TBD", riskLevel: "Moderate", color: "#2a78d6" },
  { id: "axonopus_compressus", scientificName: "Axonopus compressus", commonName: "TBD", code: "AXON", season: "TBD", riskLevel: "Moderate", color: "#eb6834" },
  { id: "brachiaria_mutica", scientificName: "Brachiaria mutica", commonName: "TBD", code: "BRAC", season: "TBD", riskLevel: "Moderate", color: "#1baf7a" },
  { id: "chloris_barbata", scientificName: "Chloris barbata", commonName: "TBD", code: "CHLO", season: "TBD", riskLevel: "Moderate", color: "#eda100" },
  { id: "chrysopogon_aciculatus", scientificName: "Chrysopogon aciculatus", commonName: "TBD", code: "CHRY", season: "TBD", riskLevel: "Moderate", color: "#e87ba4" },
  { id: "cocos_nucifera", scientificName: "Cocos nucifera", commonName: "TBD", code: "COCO", season: "TBD", riskLevel: "Moderate", color: "#008300" },
  { id: "cyperus_rotundus", scientificName: "Cyperus rotundus", commonName: "TBD", code: "CYPE", season: "TBD", riskLevel: "Moderate", color: "#4a3aa7" },
  { id: "dactyloctenium_aegyptium", scientificName: "Dactyloctenium aegyptium", commonName: "TBD", code: "DACT", season: "TBD", riskLevel: "Moderate", color: "#e34948" },
  { id: "digitaria_ciliaris", scientificName: "Digitaria ciliaris", commonName: "TBD", code: "DIGI", season: "TBD", riskLevel: "Moderate", color: "#2a78d6" },
  { id: "echinochloa_crus_galli", scientificName: "Echinochloa crus-galli", commonName: "TBD", code: "ECHI", season: "TBD", riskLevel: "Moderate", color: "#eb6834" },
  { id: "eleusine_indica", scientificName: "Eleusine indica", commonName: "TBD", code: "ELEU", season: "TBD", riskLevel: "Moderate", color: "#1baf7a" },
  { id: "imperata_cylindrica", scientificName: "Imperata cylindrica", commonName: "TBD", code: "IMPE", season: "TBD", riskLevel: "Moderate", color: "#eda100" },
  { id: "leucaena_leucocephala", scientificName: "Leucaena leucocephala", commonName: "TBD", code: "LEUC", season: "TBD", riskLevel: "Moderate", color: "#e87ba4" },
  { id: "panicum_maximum", scientificName: "Panicum maximum", commonName: "TBD", code: "PANI", season: "TBD", riskLevel: "Moderate", color: "#008300" },
  { id: "pennisetum_polystachion", scientificName: "Pennisetum polystachion", commonName: "TBD", code: "PENN", season: "TBD", riskLevel: "Moderate", color: "#4a3aa7" },
  { id: "pithecellobium_dulce", scientificName: "Pithecellobium dulce", commonName: "TBD", code: "PITH", season: "TBD", riskLevel: "Moderate", color: "#0891b2" },
  { id: "saccharum_spontaneum", scientificName: "Saccharum spontaneum", commonName: "TBD", code: "SACC", season: "TBD", riskLevel: "Moderate", color: "#2a78d6" },
  { id: "samanea_saman", scientificName: "Samanea saman", commonName: "TBD", code: "SAMA", season: "TBD", riskLevel: "Moderate", color: "#eb6834" },
  { id: "sorghum_halepense", scientificName: "Sorghum halepense", commonName: "TBD", code: "SORG", season: "TBD", riskLevel: "Moderate", color: "#1baf7a" },
  { id: "tridax_procumbens", scientificName: "Tridax procumbens", commonName: "TBD", code: "TRID", season: "TBD", riskLevel: "Moderate", color: "#eda100" },
  { id: "oryza_sativa", scientificName: "Oryza sativa", commonName: "TBD", code: "ORYZ", season: "TBD", riskLevel: "Moderate", color: "#e87ba4" },
  { id: "mimosa_pudica", scientificName: "Mimosa pudica", commonName: "TBD", code: "MIMO", season: "TBD", riskLevel: "Moderate", color: "#008300" },
  { id: "mangifera_indica", scientificName: "Mangifera indica", commonName: "TBD", code: "MANG", season: "TBD", riskLevel: "Moderate", color: "#4a3aa7" },
];

export function getSpecies(id: SpeciesId): Species {
  const found = speciesCatalog.find((s) => s.id === id);
  if (!found) throw new Error(`Unknown species id: ${id}`);
  return found;
}

/** "Scientific name (common name)", omitting the parenthetical while commonName is still an unset "TBD" placeholder. */
export function speciesLabel(sp: Species): string {
  return sp.commonName === "TBD" ? sp.scientificName : `${sp.scientificName} (${sp.commonName})`;
}

export type ReportStatus = "Completed" | "Processing" | "Needs review";

// ---------------------------------------------------------------------------
// Detections
//
// The detection model reports one box per pollen grain, so its raw output is a
// flat list of `GrainPrediction`. The UI (and the record we persist) wants one
// row per species, so `aggregateGrainPredictions` collapses that list into
// `SpecimenDetection[]`. Keeping the two shapes separate is what lets the mock
// in lib/analysis.ts be swapped for a real inference call without touching any
// component: only the source of the predictions changes.
// ---------------------------------------------------------------------------

/**
 * Where a grain sits on its slide image, as fractions of the image's width and
 * height with the origin top-left. Normalised rather than pixels so a box lands
 * correctly whatever size the image is displayed at — a thumbnail, a full-width
 * panel, or a placement in the PDF.
 */
export type BoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type GrainPrediction = {
  speciesId: SpeciesId;
  confidence: number; // 0-1, this single grain's score
  box: BoundingBox;
};

/**
 * One grain kept with its slide, so the box can be drawn over the image long
 * after the analysis ran. `detections` stays the summary the tables read; this
 * is the detail behind it.
 */
export type DetectedGrain = {
  id: string;
  speciesId: SpeciesId;
  confidence: number;
  box: BoundingBox;
};

/** Grain records for one slide, numbered in the order the model reported them. */
export function toDetectedGrains(predictions: GrainPrediction[]): DetectedGrain[] {
  return predictions.map((prediction, index) => ({
    id: `G${index + 1}`,
    speciesId: prediction.speciesId,
    confidence: prediction.confidence,
    box: prediction.box,
  }));
}

export type SpecimenDetection = {
  speciesId: SpeciesId;
  grainCount: number;
  avgConfidence: number; // 0-1, mean confidence across that species' grains
};

/** Collapse per-grain predictions into one row per species, richest first. */
export function aggregateGrainPredictions(predictions: GrainPrediction[]): SpecimenDetection[] {
  const bySpecies = new Map<SpeciesId, { grainCount: number; confidenceSum: number }>();

  for (const p of predictions) {
    const entry = bySpecies.get(p.speciesId) ?? { grainCount: 0, confidenceSum: 0 };
    entry.grainCount += 1;
    entry.confidenceSum += p.confidence;
    bySpecies.set(p.speciesId, entry);
  }

  return [...bySpecies.entries()]
    .map(([speciesId, { grainCount, confidenceSum }]) => ({
      speciesId,
      grainCount,
      avgConfidence: confidenceSum / grainCount,
    }))
    .sort(sortByAbundance);
}

/** Most abundant species first; ties broken by the more confident reading. */
export function sortByAbundance(a: SpecimenDetection, b: SpecimenDetection): number {
  return b.grainCount - a.grainCount || b.avgConfidence - a.avgConfidence;
}

export function getTopDetection(detections: SpecimenDetection[]): SpecimenDetection | null {
  if (detections.length === 0) return null;
  return [...detections].sort(sortByAbundance)[0];
}

export function getTotalGrains(detections: SpecimenDetection[]): number {
  return detections.reduce((sum, d) => sum + d.grainCount, 0);
}

/**
 * Overall confidence for a reading, weighted by grain count so a 14-grain
 * species counts for more than a single stray grain.
 */
export function getWeightedAvgConfidence(detections: SpecimenDetection[]): number {
  const grains = getTotalGrains(detections);
  if (grains === 0) return 0;
  return detections.reduce((sum, d) => sum + d.avgConfidence * d.grainCount, 0) / grains;
}

// ---------------------------------------------------------------------------
// Weather recorded at collection time. Entered by hand today; the same shape is
// what a weather API lookup would fill in later (see fetchWeather in
// lib/analysis.ts), which is why every measurement is nullable.
// ---------------------------------------------------------------------------

export type WeatherCondition = "Sunny" | "Partly cloudy" | "Overcast" | "Rainy" | "Windy";

export const weatherConditionOptions: WeatherCondition[] = [
  "Sunny",
  "Partly cloudy",
  "Overcast",
  "Rainy",
  "Windy",
];

export type WeatherConditions = {
  condition: WeatherCondition;
  temperatureC: number | null;
  humidityPct: number | null;
  windKph: number | null;
};

/** e.g. "Sunny · 31°C · 68% RH · 12 km/h", skipping anything not recorded. */
export function formatWeather(weather: WeatherConditions | null): string {
  if (!weather) return "Not recorded";
  const parts: string[] = [weather.condition];
  if (weather.temperatureC !== null) parts.push(`${weather.temperatureC}°C`);
  if (weather.humidityPct !== null) parts.push(`${weather.humidityPct}% RH`);
  if (weather.windKph !== null) parts.push(`${weather.windKph} km/h`);
  return parts.join(" · ");
}

// ---------------------------------------------------------------------------
// Specimens
// ---------------------------------------------------------------------------

/**
 * When the specimen was collected in the field — not when it was analyzed.
 * ISO 8601, either "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm" when the hour is known.
 * Sorts correctly as a plain string, which avoids the timezone traps of
 * parsing a bare date with `new Date()`.
 */
export type CollectedAt = string;

/** The date half of a `CollectedAt`, e.g. "2026-07-29". */
export function getCollectionDate(collectedAt: CollectedAt): string {
  return collectedAt.split("T")[0];
}

/** The time half, e.g. "08:30", or null when only the date was recorded. */
export function getCollectionTime(collectedAt: CollectedAt): string | null {
  return collectedAt.split("T")[1] ?? null;
}

/** "08:30" → "8:30 AM". */
export function formatTime(hhmm: string): string {
  const [rawHour, minute] = hhmm.split(":");
  const hour = Number(rawHour);
  const suffix = hour < 12 ? "AM" : "PM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${minute} ${suffix}`;
}

/** "Jul 29, 2026 · 8:30 AM", or just the date when no time was recorded. */
export function formatCollectedAt(collectedAt: CollectedAt): string {
  // Parsed as local midnight; `new Date("2026-07-29")` would be UTC midnight
  // and render as the previous day for anyone west of Greenwich.
  const date = new Date(`${getCollectionDate(collectedAt)}T00:00:00`);
  const formatted = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const time = getCollectionTime(collectedAt);
  return time ? `${formatted} · ${formatTime(time)}` : formatted;
}

/**
 * One microscope slide inside a report: its own image, its own reading, and its
 * own field note. A report may hold several, because a researcher normally
 * prepares a batch of slides from one collection session.
 */
export type SpecimenSlide = {
  id: string;
  fileName: string;
  detections: SpecimenDetection[]; // one row per pollen type found, richest first
  /**
   * Every grain the model boxed, for drawing over the image. Optional: the seed
   * records and any report saved before boxes were kept simply have none, and
   * the viewer says so rather than pretending the slide was empty.
   */
  grains?: DetectedGrain[];
  notes: string; // free-text note about this slide; "" when left blank
  /**
   * The slide's server-hosted image, for reports fetched from the backend.
   * Optional: seed/demo records have no real photographed slide.
   */
  imageUrl?: string;
};

/**
 * A saved report — one collection session. Location, time and weather describe
 * the session and are shared; the readings and notes live per slide.
 */
export type Specimen = {
  sampleId: string;
  collectedAt: CollectedAt;
  location: string;
  slides: SpecimenSlide[];
  weather: WeatherConditions | null; // null when conditions weren't recorded
  researcher: string;
  status: ReportStatus;
};

/** Every pollen type across a report's slides, combined and richest first. */
export function aggregateSlideDetections(slides: SpecimenSlide[]): SpecimenDetection[] {
  const bySpecies = new Map<SpeciesId, { grainCount: number; confidenceSum: number }>();

  for (const slide of slides) {
    for (const detection of slide.detections) {
      const entry = bySpecies.get(detection.speciesId) ?? { grainCount: 0, confidenceSum: 0 };
      entry.grainCount += detection.grainCount;
      // Weight each slide's mean by its grain count so the combined average
      // reflects grains, not slides.
      entry.confidenceSum += detection.avgConfidence * detection.grainCount;
      bySpecies.set(detection.speciesId, entry);
    }
  }

  return [...bySpecies.entries()]
    .map(([speciesId, { grainCount, confidenceSum }]) => ({
      speciesId,
      grainCount,
      avgConfidence: confidenceSum / grainCount,
    }))
    .sort(sortByAbundance);
}

/** Total grains counted across every slide in a report. */
export function getReportGrains(specimen: Specimen): number {
  return specimen.slides.reduce((sum, slide) => sum + getTotalGrains(slide.detections), 0);
}

// "Today" for the mock dataset, so "this week" / "recent" calculations are stable.
export const MOCK_TODAY = "2026-07-29";

/** Terse constructor so the specimen table below stays readable. */
function d(speciesId: SpeciesId, grainCount: number, avgConfidence: number): SpecimenDetection {
  return { speciesId, grainCount, avgConfidence };
}

/** Wraps a single-slide reading, which is how the seed records are shaped. */
function slide(sampleId: string, detections: SpecimenDetection[], notes: string): SpecimenSlide {
  return { id: `${sampleId}-S1`, fileName: `${sampleId.toLowerCase()}-slide-1.jpg`, detections, notes };
}

export const specimens: Specimen[] = [
  {
    sampleId: "PLN-2026-0142", collectedAt: "2026-07-29T07:15", location: "Lucena City, Quezon",
    slides: [slide("PLN-2026-0142", [d("cocos_nucifera", 18, 0.97), d("amaranthus_spinosus", 6, 0.84), d("dactyloctenium_aegyptium", 2, 0.71)], "Dense ragweed load along the roadside transect; slide re-stained once for contrast.")],
    weather: { condition: "Sunny", temperatureC: 32, humidityPct: 64, windKph: 11 },
    researcher: "You", status: "Completed",
  },
  {
    sampleId: "PLN-2026-0141", collectedAt: "2026-07-28T09:40", location: "Lucban, Quezon",
    slides: [slide("PLN-2026-0141", [d("axonopus_compressus", 12, 0.91), d("cyperus_rotundus", 5, 0.8), d("chrysopogon_aciculatus", 3, 0.76)], "Collected upslope of the treeline, mid-morning.")],
    weather: { condition: "Partly cloudy", temperatureC: 26, humidityPct: 78, windKph: 8 },
    researcher: "You", status: "Completed",
  },
  {
    sampleId: "PLN-2026-0140", collectedAt: "2026-07-28T14:05", location: "Lucena City, Quezon",
    slides: [slide("PLN-2026-0140", [d("amaranthus_spinosus", 9, 0.62), d("dactyloctenium_aegyptium", 4, 0.58)], "Several grains partly obscured by debris — flagged for a second reading.")],
    weather: { condition: "Overcast", temperatureC: 29, humidityPct: 85, windKph: 6 },
    researcher: "M. Reyes", status: "Needs review",
  },
  {
    sampleId: "PLN-2026-0139", collectedAt: "2026-07-27T08:30", location: "Tayabas, Quezon",
    slides: [slide("PLN-2026-0139", [d("chrysopogon_aciculatus", 15, 0.94), d("cyperus_rotundus", 4, 0.87), d("amaranthus_spinosus", 2, 0.69)], "")],
    weather: { condition: "Sunny", temperatureC: 31, humidityPct: 60, windKph: 14 },
    researcher: "You", status: "Completed",
  },
  {
    sampleId: "PLN-2026-0138", collectedAt: "2026-07-26", location: "Lucena City, Quezon",
    slides: [slide("PLN-2026-0138", [d("cocos_nucifera", 11, 0.79), d("amaranthus_spinosus", 7, 0.73)], "")],
    weather: null,
    researcher: "M. Reyes", status: "Processing",
  },
  {
    sampleId: "PLN-2026-0137", collectedAt: "2026-07-26T16:20", location: "Sariaya, Quezon",
    slides: [slide("PLN-2026-0137", [d("dactyloctenium_aegyptium", 13, 0.86), d("cocos_nucifera", 5, 0.82), d("amaranthus_spinosus", 3, 0.7)], "Fallow field margin; strong afternoon breeze during sampling.")],
    weather: { condition: "Windy", temperatureC: 30, humidityPct: 58, windKph: 27 },
    researcher: "You", status: "Completed",
  },
  {
    sampleId: "PLN-2026-0136", collectedAt: "2026-07-25T06:50", location: "Lucban, Quezon",
    slides: [slide("PLN-2026-0136", [d("cyperus_rotundus", 16, 0.88), d("axonopus_compressus", 4, 0.83)], "")],
    weather: { condition: "Partly cloudy", temperatureC: 25, humidityPct: 80, windKph: 9 },
    researcher: "You", status: "Completed",
  },
  {
    sampleId: "PLN-2026-0135", collectedAt: "2026-06-14T10:10", location: "Lucena City, Quezon",
    slides: [slide("PLN-2026-0135", [d("amaranthus_spinosus", 21, 0.93), d("chrysopogon_aciculatus", 3, 0.75)], "Peak grass season — highest grain count recorded at this site so far.")],
    weather: { condition: "Sunny", temperatureC: 33, humidityPct: 62, windKph: 12 },
    researcher: "You", status: "Completed",
  },
  {
    sampleId: "PLN-2026-0134", collectedAt: "2026-05-30", location: "Candelaria, Quezon",
    slides: [slide("PLN-2026-0134", [d("chloris_barbata", 10, 0.81), d("brachiaria_mutica", 6, 0.78), d("axonopus_compressus", 2, 0.72)], "")],
    weather: null,
    researcher: "M. Reyes", status: "Completed",
  },
  {
    sampleId: "PLN-2026-0133", collectedAt: "2026-05-12T07:35", location: "Lucban, Quezon",
    slides: [slide("PLN-2026-0133", [d("brachiaria_mutica", 14, 0.9), d("chloris_barbata", 5, 0.85)], "Sampled after two dry days; slide was unusually clean.")],
    weather: { condition: "Sunny", temperatureC: 27, humidityPct: 70, windKph: 10 },
    researcher: "You", status: "Completed",
  },
  {
    sampleId: "PLN-2026-0132", collectedAt: "2026-04-22T11:25", location: "Tayabas, Quezon",
    slides: [slide("PLN-2026-0132", [d("axonopus_compressus", 12, 0.85), d("chrysopogon_aciculatus", 6, 0.8), d("cyperus_rotundus", 3, 0.74)], "")],
    weather: { condition: "Partly cloudy", temperatureC: 28, humidityPct: 73, windKph: 15 },
    researcher: "You", status: "Completed",
  },
  {
    sampleId: "PLN-2026-0131", collectedAt: "2026-03-18T15:45", location: "Lucena City, Quezon",
    slides: [slide("PLN-2026-0131", [d("chrysopogon_aciculatus", 8, 0.77), d("amaranthus_spinosus", 6, 0.64), d("brachiaria_mutica", 2, 0.6)], "Low contrast on the oak grains; worth confirming against the reference set.")],
    weather: { condition: "Rainy", temperatureC: 24, humidityPct: 92, windKph: 18 },
    researcher: "M. Reyes", status: "Needs review",
  },
  {
    sampleId: "PLN-2026-0130", collectedAt: "2026-02-09T08:05", location: "Sariaya, Quezon",
    slides: [slide("PLN-2026-0130", [d("brachiaria_mutica", 17, 0.89), d("chloris_barbata", 7, 0.83), d("axonopus_compressus", 2, 0.76)], "")],
    weather: { condition: "Overcast", temperatureC: 23, humidityPct: 88, windKph: 7 },
    researcher: "You", status: "Completed",
  },
  {
    sampleId: "PLN-2026-0129", collectedAt: "2026-01-20T05:55", location: "Lucban, Quezon",
    slides: [slide("PLN-2026-0129", [d("chloris_barbata", 19, 0.92), d("brachiaria_mutica", 8, 0.87)], "Early hazel flush, sampled at dawn.")],
    weather: { condition: "Overcast", temperatureC: 22, humidityPct: 90, windKph: 5 },
    researcher: "You", status: "Completed",
  },
];

// ---------------------------------------------------------------------------
// Derived: reports table (Sample ID, Date, Location, Top pollen, Status)
// ---------------------------------------------------------------------------

export type ReportRow = {
  sampleId: string;
  collectedAt: CollectedAt;
  location: string;
  topPollen: string;
  totalGrains: number;
  slideCount: number;
  status: ReportStatus;
};

/** The row shown in the Reports table for one saved report. */
export function toReportRow(specimen: Specimen): ReportRow {
  const top = getTopDetection(aggregateSlideDetections(specimen.slides));
  const sp = top ? getSpecies(top.speciesId) : null;
  return {
    sampleId: specimen.sampleId,
    collectedAt: specimen.collectedAt,
    location: specimen.location,
    topPollen: sp ? speciesLabel(sp) : "No pollen detected",
    totalGrains: getReportGrains(specimen),
    slideCount: specimen.slides.length,
    status: specimen.status,
  };
}

export const reportRows: ReportRow[] = specimens.map(toReportRow);

// ---------------------------------------------------------------------------
// Derived: recent detections feed (most recent specimens, newest first)
// ---------------------------------------------------------------------------

export type Detection = {
  id: string;
  thumbColor: string;
  classId: SpeciesId;
  className: string;
  code: string;
  grainCount: number;
  confidence: number;
  researcher: string;
  createdAt: string;
};

export const recentDetections: Detection[] = [...specimens]
  // ISO strings sort chronologically as text, so no timezone-sensitive parsing.
  .sort((a, b) => b.collectedAt.localeCompare(a.collectedAt))
  .slice(0, 6)
  .flatMap((s) => {
    const top = getTopDetection(aggregateSlideDetections(s.slides));
    if (!top) return [];
    const sp = getSpecies(top.speciesId);
    const sampleNumber = parseInt(s.sampleId.split("-").pop() ?? "0", 10);
    return [
      {
        id: s.sampleId,
        thumbColor: sp.color,
        classId: sp.id,
        className: speciesLabel(sp),
        code: `${sp.code}·${sampleNumber}`,
        grainCount: top.grainCount,
        confidence: top.avgConfidence,
        researcher: s.researcher,
        createdAt: s.collectedAt,
      },
    ];
  });

// ---------------------------------------------------------------------------
// Derived: allergen class reference set, with counts computed from specimens
// ---------------------------------------------------------------------------

export type AllergenClass = {
  id: SpeciesId;
  scientificName: string;
  commonName: string;
  code: string;
  season: string;
  riskLevel: "High" | "Moderate" | "Low";
  count: number; // specimens this class was found in
  grainCount: number; // grains of this class across every specimen
};

export const allergenClasses: AllergenClass[] = speciesCatalog.map((sp) => ({
  id: sp.id,
  scientificName: sp.scientificName,
  commonName: sp.commonName,
  code: sp.code,
  season: sp.season,
  riskLevel: sp.riskLevel,
  count: specimens.filter((s) =>
    s.slides.some((sl) => sl.detections.some((det) => det.speciesId === sp.id)),
  ).length,
  grainCount: specimens.reduce(
    (sum, s) =>
      sum +
      aggregateSlideDetections(s.slides).reduce(
        (n, det) => (det.speciesId === sp.id ? n + det.grainCount : n),
        0,
      ),
    0,
  ),
}));

// ---------------------------------------------------------------------------
// Derived: dashboard stats, computed directly from specimens
// ---------------------------------------------------------------------------

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type DashboardStats = {
  totalSpecimens: number;
  classesTracked: number;
  detectionsThisWeek: number;
  avgConfidence: number;
};

/**
 * Computed from whatever set of reports is passed in, so the dashboard can show
 * saved reports alongside the seed records rather than the seed alone.
 * `today` is a parameter so the mock dataset's fixed "today" stays testable.
 */
export function computeDashboardStats(
  reports: Specimen[],
  today: string = MOCK_TODAY,
): DashboardStats {
  const withGrains = reports.filter((r) => r.slides.length > 0);
  return {
    totalSpecimens: reports.length,
    classesTracked: speciesCatalog.length,
    detectionsThisWeek: reports.filter((r) => {
      // Compare date parts only, so a recorded time can't shift the window.
      const days =
        new Date(today).getTime() - new Date(getCollectionDate(r.collectedAt)).getTime();
      return days >= 0 && days <= ONE_WEEK_MS;
    }).length,
    avgConfidence:
      withGrains.length === 0
        ? 0
        : withGrains.reduce(
            (sum, r) => sum + getWeightedAvgConfidence(aggregateSlideDetections(r.slides)),
            0,
          ) / withGrains.length,
  };
}

/** Seed-only stats, used as the server-rendered starting point. */
export const dashboardStats: DashboardStats = computeDashboardStats(specimens);

// ---------------------------------------------------------------------------
// Historical pollen counts: monthly environmental monitoring data.
// A separate real-world dataset from `specimens` above, but keyed to the
// same species catalog for consistent naming and color.
// ---------------------------------------------------------------------------

export type MonthlyPollenCount = {
  month: string;
  /** Dynamic, keyed by SpeciesId — not a fixed struct, so it scales as the catalog changes. */
  series: Record<SpeciesId, number>;
};

// pollenSeries covers the full catalog (23 species) — PollenCountChart caps how
// many it actually plots at once (see that component), since no categorical
// palette stays mutually distinguishable much past 8 simultaneous lines
// (confirmed by the dataviz skill's own validator).
export const pollenSeries = speciesCatalog.map((sp) => ({
  key: sp.id,
  label: speciesLabel(sp),
  color: sp.color,
}));

const MONTH_ABBREVIATIONS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Illustrative demo data only (matches the old hand-authored numbers' spirit,
 * not real measurements) — a per-species amplitude with a seasonal sine curve,
 * offset so different species peak in different months. Real historical counts
 * come from fetchMonthlyPollenCounts below once signed in.
 */
export const historicalPollenCounts: MonthlyPollenCount[] = MONTH_ABBREVIATIONS.map((month, monthIndex) => {
  const series = {} as Record<SpeciesId, number>;
  speciesCatalog.forEach((sp, speciesIndex) => {
    const amplitude = 20 + ((speciesIndex * 7) % 40);
    const phase = (speciesIndex * 5) % 12;
    const seasonal = Math.sin(((monthIndex - phase) / 12) * Math.PI * 2);
    series[sp.id] = Math.max(0, Math.round(amplitude * (0.5 + 0.5 * seasonal)));
  });
  return { month, series };
});

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

/**
 * Real trailing-12-month counts from the backend
 * (GET /api/v1/reports/monthly-counts/), shaped identically to
 * `historicalPollenCounts` above so a caller can swap the seed for this once
 * signed in. Throws on a non-2xx response; callers should keep the seed data
 * on display rather than let a failed refresh clear the chart.
 */
export async function fetchMonthlyPollenCounts(accessToken: string): Promise<MonthlyPollenCount[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/reports/monthly-counts/`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error("Failed to fetch monthly pollen counts.");
  }
  return (await res.json()) as MonthlyPollenCount[];
}

/**
 * Real species catalog from the backend (GET /api/v1/reports/species/),
 * shaped identically to `speciesCatalog` above so a caller can swap the
 * bundled fallback for this once signed in — see lib/species-catalog.ts.
 * Throws on a non-2xx response; callers should keep the fallback catalog on
 * display rather than let a failed refresh blank out species labels.
 * commonName/season come back as "" (unset) from the backend rather than the
 * "TBD" sentinel used here, normalized on the way in so speciesLabel() keeps
 * working unchanged for both sources.
 */
export async function fetchSpeciesCatalog(accessToken: string): Promise<Species[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/reports/species/`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error("Failed to fetch species catalog.");
  }
  const species = (await res.json()) as Species[];
  return species.map((sp) => ({
    ...sp,
    commonName: sp.commonName || "TBD",
    season: sp.season || "TBD",
  }));
}

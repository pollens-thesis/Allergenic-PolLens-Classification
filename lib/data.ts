// ---------------------------------------------------------------------------
// DOMAIN TYPES AND THE SPECIES CATALOG
// Shared shapes for reports, slides and detections (matching the API in
// api/reports/serializers.py), the bundled species catalog (the offline
// fallback for GET /api/v1/reports/species/), and pure helpers over them.
// There is no sample data here: every report comes from the server.
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
  /** "Not assessed" until real allergenicity data is entered (backend admin). */
  riskLevel: "High" | "Moderate" | "Low" | "Not assessed";
  color: string; // CSS color, used consistently across charts, badges, thumbnails
};

// The real 23-species UPLB taxonomic scope, replacing an earlier 8-species
// European/temperate placeholder catalog that was never cross-checked against
// the actual dataset (see the Taxonomic Scope row in docs/system-spec.md).
// commonName/season are "" and riskLevel is "Not assessed" until real
// per-species data is entered (Django admin → Species); nothing here is a
// clinical assessment. `color`
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
  { id: "amaranthus_spinosus", scientificName: "Amaranthus spinosus", commonName: "", code: "AMAR", season: "", riskLevel: "Not assessed", color: "#2a78d6" },
  { id: "axonopus_compressus", scientificName: "Axonopus compressus", commonName: "", code: "AXON", season: "", riskLevel: "Not assessed", color: "#eb6834" },
  { id: "brachiaria_mutica", scientificName: "Brachiaria mutica", commonName: "", code: "BRAC", season: "", riskLevel: "Not assessed", color: "#1baf7a" },
  { id: "chloris_barbata", scientificName: "Chloris barbata", commonName: "", code: "CHLO", season: "", riskLevel: "Not assessed", color: "#eda100" },
  { id: "chrysopogon_aciculatus", scientificName: "Chrysopogon aciculatus", commonName: "", code: "CHRY", season: "", riskLevel: "Not assessed", color: "#e87ba4" },
  { id: "cocos_nucifera", scientificName: "Cocos nucifera", commonName: "", code: "COCO", season: "", riskLevel: "Not assessed", color: "#008300" },
  { id: "cyperus_rotundus", scientificName: "Cyperus rotundus", commonName: "", code: "CYPE", season: "", riskLevel: "Not assessed", color: "#4a3aa7" },
  { id: "dactyloctenium_aegyptium", scientificName: "Dactyloctenium aegyptium", commonName: "", code: "DACT", season: "", riskLevel: "Not assessed", color: "#e34948" },
  { id: "digitaria_ciliaris", scientificName: "Digitaria ciliaris", commonName: "", code: "DIGI", season: "", riskLevel: "Not assessed", color: "#2a78d6" },
  { id: "echinochloa_crus_galli", scientificName: "Echinochloa crus-galli", commonName: "", code: "ECHI", season: "", riskLevel: "Not assessed", color: "#eb6834" },
  { id: "eleusine_indica", scientificName: "Eleusine indica", commonName: "", code: "ELEU", season: "", riskLevel: "Not assessed", color: "#1baf7a" },
  { id: "imperata_cylindrica", scientificName: "Imperata cylindrica", commonName: "", code: "IMPE", season: "", riskLevel: "Not assessed", color: "#eda100" },
  { id: "leucaena_leucocephala", scientificName: "Leucaena leucocephala", commonName: "", code: "LEUC", season: "", riskLevel: "Not assessed", color: "#e87ba4" },
  { id: "panicum_maximum", scientificName: "Panicum maximum", commonName: "", code: "PANI", season: "", riskLevel: "Not assessed", color: "#008300" },
  { id: "pennisetum_polystachion", scientificName: "Pennisetum polystachion", commonName: "", code: "PENN", season: "", riskLevel: "Not assessed", color: "#4a3aa7" },
  { id: "pithecellobium_dulce", scientificName: "Pithecellobium dulce", commonName: "", code: "PITH", season: "", riskLevel: "Not assessed", color: "#0891b2" },
  { id: "saccharum_spontaneum", scientificName: "Saccharum spontaneum", commonName: "", code: "SACC", season: "", riskLevel: "Not assessed", color: "#2a78d6" },
  { id: "samanea_saman", scientificName: "Samanea saman", commonName: "", code: "SAMA", season: "", riskLevel: "Not assessed", color: "#eb6834" },
  { id: "sorghum_halepense", scientificName: "Sorghum halepense", commonName: "", code: "SORG", season: "", riskLevel: "Not assessed", color: "#1baf7a" },
  { id: "tridax_procumbens", scientificName: "Tridax procumbens", commonName: "", code: "TRID", season: "", riskLevel: "Not assessed", color: "#eda100" },
  { id: "oryza_sativa", scientificName: "Oryza sativa", commonName: "", code: "ORYZ", season: "", riskLevel: "Not assessed", color: "#e87ba4" },
  { id: "mimosa_pudica", scientificName: "Mimosa pudica", commonName: "", code: "MIMO", season: "", riskLevel: "Not assessed", color: "#008300" },
  { id: "mangifera_indica", scientificName: "Mangifera indica", commonName: "", code: "MANG", season: "", riskLevel: "Not assessed", color: "#4a3aa7" },
];

/**
 * The bundled entry for `id`. A species added on the server after this build
 * gets a neutral stand-in (its id, humanised) instead of crashing the page.
 */
export function getSpecies(id: SpeciesId): Species {
  const found = speciesCatalog.find((s) => s.id === id);
  if (found) return found;
  const name = String(id).replace(/_/g, " ");
  return {
    id,
    scientificName: name.charAt(0).toUpperCase() + name.slice(1),
    commonName: "",
    code: String(id).slice(0, 4).toUpperCase(),
    season: "",
    riskLevel: "Not assessed",
    color: "#8a8f98",
  };
}

/** "Scientific name (common name)", or just the scientific name while no common name is recorded. */
export function speciesLabel(sp: Species): string {
  return sp.commonName ? `${sp.scientificName} (${sp.commonName})` : sp.scientificName;
}

/**
 * A report's lifecycle (api/reports/models.py): Pending until the researcher
 * generates the report, then Completed; a completed report can be flagged
 * Needs review. Completed and Needs review reports ("finalised") count in
 * charts, stats and the map; Pending ones don't.
 */
export type ReportStatus = "Pending" | "Completed" | "Needs review";
export const REPORT_STATUSES: ReportStatus[] = ["Pending", "Completed", "Needs review"];

/** Reports that describe finished work — what charts, stats and the map count. */
export function isFinalised(report: { status: ReportStatus }): boolean {
  return report.status !== "Pending";
}

// ---------------------------------------------------------------------------
// Detections
//
// The detection model reports one box per pollen grain, so its raw output is a
// flat list of `GrainPrediction`. The UI (and the record we persist) wants one
// row per species, so `aggregateGrainPredictions` collapses that list into
// `SpecimenDetection[]`. Keeping the two shapes separate keeps the model's raw
// output (lib/analysis.ts) independent of how readings are shown and stored.
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
   * Every grain the model boxed, for drawing over the image. Optional: a report
   * saved before boxes were kept has none, and the viewer says so rather than
   * pretending the slide was empty.
   */
  grains?: DetectedGrain[];
  notes: string; // free-text note about this slide; "" when left blank
  /** The slide's server-hosted image (a presigned URL in production — it expires). */
  imageUrl?: string;
};

/**
 * A report — one collection session. Location, time and weather describe the
 * session and are shared; the readings and notes live per slide.
 */
export type Specimen = {
  sampleId: string;
  collectedAt: CollectedAt;
  location: string; // "" only while Pending
  slides: SpecimenSlide[];
  weather: WeatherConditions | null; // null when conditions weren't recorded
  researcher: string;
  status: ReportStatus;
  /** When it was analyzed and stored (ISO timestamp) — not the collection date. */
  createdAt: string;
  /** Whether the signed-in researcher may edit, change the status of, or delete it. */
  canEdit: boolean;
  /** Detections came from the server's built-in sample, not a trained model. */
  sampleDetections?: boolean;
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


// ---------------------------------------------------------------------------
// Derived: dashboard stats
// ---------------------------------------------------------------------------

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
// A report stored a moment ago can carry a server timestamp slightly ahead of
// this device's clock; it still counts as this week.
const CLOCK_SKEW_MS = 5 * 60 * 1000;

export type DashboardStats = {
  totalSpecimens: number;
  classesTracked: number;
  detectionsThisWeek: number;
  avgConfidence: number;
};

/**
 * Dashboard figures over finalised reports (Pending ones aren't results yet):
 * how many reports, how many were analyzed in the last 7 days (by when they
 * were stored, not when the sample was collected), and the mean confidence
 * over every grain — weighted by grains, so a big slide counts for more than
 * a sparse one.
 */
export function computeDashboardStats(
  reports: Specimen[],
  classesTracked: number,
  now: Date = new Date(),
): DashboardStats {
  const finalised = reports.filter(isFinalised);
  const detections = finalised.flatMap((r) => r.slides.flatMap((s) => s.detections));
  return {
    totalSpecimens: finalised.length,
    classesTracked,
    detectionsThisWeek: finalised.filter((r) => {
      const age = now.getTime() - new Date(r.createdAt).getTime();
      return age >= -CLOCK_SKEW_MS && age <= ONE_WEEK_MS;
    }).length,
    avgConfidence: getWeightedAvgConfidence(detections),
  };
}

// ---------------------------------------------------------------------------
// Monthly pollen counts — grains counted per species per month, from the
// backend (lib/backend.ts fetchMonthlyPollenCounts, finalised reports only).
// ---------------------------------------------------------------------------

export type MonthlyPollenCount = {
  month: string;
  /** Dynamic, keyed by SpeciesId — not a fixed struct, so it scales as the catalog changes. */
  series: Record<SpeciesId, number>;
};


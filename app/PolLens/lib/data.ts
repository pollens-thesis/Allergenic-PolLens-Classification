// ---------------------------------------------------------------------------
// DOMAIN TYPES AND THE SPECIES CATALOG
// Shared shapes for reports, slides and detections (matching the API in
// api/reports/serializers.py), the bundled species catalog (the offline
// fallback for GET /api/v1/reports/species/), and pure helpers over them.
// There is no sample data here: every report comes from the server.
// ---------------------------------------------------------------------------

import { withReferenceName } from "./species-names";

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
  /**
   * The name shown for the species everywhere: the Allergen Reference label
   * (lib/species-names.ts `withReferenceName`), or the catalog's English name
   * for the species the reference has no label for.
   */
  commonName: string;
  /** The catalog's English plant name before the reference label replaced `commonName`. */
  catalogName?: string;
  /** The Allergen Reference name admins edit (API only); the bundled copy falls back to lib/species-names.ts. */
  referenceName?: string;
  code: string; // taxonomic-style short tag, e.g. AMAR
  season: string;
  /** "Not assessed" until real allergenicity data is entered (backend admin). */
  riskLevel: "High" | "Moderate" | "Low" | "Not assessed";
  color: string; // CSS color, used consistently across charts, badges, thumbnails
  // Allergen Reference content, served by the API (Django admin → Species).
  // Botanical only: allergenicity stays in `riskLevel`. Absent in the bundled
  // fallback below apart from the common name.
  filipinoName?: string;
  family?: string;
  growthForm?: string;
  description?: string;
  distribution?: string;
  pollination?: string;
  infoSource?: string;
  /** The photo: bundled at /species/<id>.jpg, or an admin's upload (`photoUploaded`), with its credit. */
  photoUrl?: string;
  photoUploaded?: boolean;
  photoCredit?: string;
  photoLicense?: string;
  photoSource?: string;
};

// The real 23-species UPLB taxonomic scope, replacing an earlier 8-species
// European/temperate placeholder catalog that was never cross-checked against
// the actual dataset (see the Taxonomic Scope row in docs/system-spec.md).
// commonName is the English plant name (the API also serves Filipino names and
// reference text); season is "" and riskLevel is "Not assessed" until real
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
const bundledSpecies: Species[] = [
  { id: "amaranthus_spinosus", scientificName: "Amaranthus spinosus", commonName: "Spiny amaranth", code: "AMAR", season: "", riskLevel: "Not assessed", color: "#2a78d6" },
  { id: "axonopus_compressus", scientificName: "Axonopus compressus", commonName: "Broadleaf carpet grass", code: "AXON", season: "", riskLevel: "Not assessed", color: "#eb6834" },
  { id: "brachiaria_mutica", scientificName: "Brachiaria mutica", commonName: "Para grass", code: "BRAC", season: "", riskLevel: "Not assessed", color: "#1baf7a" },
  { id: "chloris_barbata", scientificName: "Chloris barbata", commonName: "Swollen finger grass", code: "CHLO", season: "", riskLevel: "Not assessed", color: "#eda100" },
  { id: "chrysopogon_aciculatus", scientificName: "Chrysopogon aciculatus", commonName: "Golden false beardgrass", code: "CHRY", season: "", riskLevel: "Not assessed", color: "#e87ba4" },
  { id: "cocos_nucifera", scientificName: "Cocos nucifera", commonName: "Coconut", code: "COCO", season: "", riskLevel: "Not assessed", color: "#008300" },
  { id: "cyperus_rotundus", scientificName: "Cyperus rotundus", commonName: "Purple nutsedge", code: "CYPE", season: "", riskLevel: "Not assessed", color: "#4a3aa7" },
  { id: "dactyloctenium_aegyptium", scientificName: "Dactyloctenium aegyptium", commonName: "Crowfoot grass", code: "DACT", season: "", riskLevel: "Not assessed", color: "#e34948" },
  { id: "digitaria_ciliaris", scientificName: "Digitaria ciliaris", commonName: "Southern crabgrass", code: "DIGI", season: "", riskLevel: "Not assessed", color: "#2a78d6" },
  { id: "echinochloa_crus_galli", scientificName: "Echinochloa crus-galli", commonName: "Barnyard grass", code: "ECHI", season: "", riskLevel: "Not assessed", color: "#eb6834" },
  { id: "eleusine_indica", scientificName: "Eleusine indica", commonName: "Goosegrass", code: "ELEU", season: "", riskLevel: "Not assessed", color: "#1baf7a" },
  { id: "imperata_cylindrica", scientificName: "Imperata cylindrica", commonName: "Cogon grass", code: "IMPE", season: "", riskLevel: "Not assessed", color: "#eda100" },
  { id: "leucaena_leucocephala", scientificName: "Leucaena leucocephala", commonName: "White leadtree", code: "LEUC", season: "", riskLevel: "Not assessed", color: "#e87ba4" },
  { id: "panicum_maximum", scientificName: "Panicum maximum", commonName: "Guinea grass", code: "PANI", season: "", riskLevel: "Not assessed", color: "#008300" },
  { id: "pennisetum_polystachion", scientificName: "Pennisetum polystachion", commonName: "Mission grass", code: "PENN", season: "", riskLevel: "Not assessed", color: "#4a3aa7" },
  { id: "pithecellobium_dulce", scientificName: "Pithecellobium dulce", commonName: "Manila tamarind", code: "PITH", season: "", riskLevel: "Not assessed", color: "#0891b2" },
  { id: "saccharum_spontaneum", scientificName: "Saccharum spontaneum", commonName: "Wild sugarcane", code: "SACC", season: "", riskLevel: "Not assessed", color: "#2a78d6" },
  { id: "samanea_saman", scientificName: "Samanea saman", commonName: "Rain tree", code: "SAMA", season: "", riskLevel: "Not assessed", color: "#eb6834" },
  { id: "sorghum_halepense", scientificName: "Sorghum halepense", commonName: "Johnson grass", code: "SORG", season: "", riskLevel: "Not assessed", color: "#1baf7a" },
  { id: "tridax_procumbens", scientificName: "Tridax procumbens", commonName: "Coat buttons", code: "TRID", season: "", riskLevel: "Not assessed", color: "#eda100" },
  { id: "oryza_sativa", scientificName: "Oryza sativa", commonName: "Rice", code: "ORYZ", season: "", riskLevel: "Not assessed", color: "#e87ba4" },
  { id: "mimosa_pudica", scientificName: "Mimosa pudica", commonName: "Sensitive plant", code: "MIMO", season: "", riskLevel: "Not assessed", color: "#008300" },
  { id: "mangifera_indica", scientificName: "Mangifera indica", commonName: "Mango", code: "MANG", season: "", riskLevel: "Not assessed", color: "#4a3aa7" },
];

/**
 * The bundled catalog, with the Allergen Reference labels applied as common
 * names (see `withReferenceName`). The API catalog gets the same treatment in
 * lib/backend.ts, so both sources agree.
 */
export const speciesCatalog: Species[] = bundledSpecies.map(withReferenceName);

let liveSpecies: Species[] | null = null;

/**
 * Registers the catalog fetched from the API so `getSpecies` (and so the PDF and
 * Excel exports and the chart colours) reflect an admin's edits, not just the
 * bundled copy. Called by lib/species-catalog.ts after each fetch.
 */
export function setLiveSpecies(catalog: Species[]): void {
  liveSpecies = catalog;
}

/**
 * The catalog entry for `id` (live once fetched, else the bundled one). A species added on the server after this build
 * gets a neutral stand-in (its id, humanised) instead of crashing the page.
 */
export function getSpecies(id: SpeciesId): Species {
  const found = (liveSpecies ?? speciesCatalog).find((s) => s.id === id) ?? speciesCatalog.find((s) => s.id === id);
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
 * generates it, then Needs review until they mark it Completed. Completed
 * reports can be flagged Needs review again. Completed and Needs review
 * reports ("finalised") count in charts, stats and the map; Pending ones don't.
 */
export type ReportStatus = "Pending" | "Needs review" | "Completed";
export const REPORT_STATUSES: ReportStatus[] = ["Pending", "Needs review", "Completed"];

/** Reports that describe finished work. */
export function isFinalised(report: { status: ReportStatus }): boolean {
  return report.status !== "Pending";
}

/**
 * Whether a verifier or admin has accepted a report (api/reports/models.py).
 * A user's report is Awaiting until then; a Declined one goes back to its owner.
 */
export type Verification = "Awaiting" | "Verified" | "Declined";
export const VERIFICATIONS: Verification[] = ["Awaiting", "Verified", "Declined"];

/**
 * Reports everyone can rely on — what charts, stats and the map count: finished
 * and verified. The list also holds the signed-in person's own unverified
 * reports, which must never reach shared figures.
 */
export function isPublic(report: { status: ReportStatus; verification: Verification }): boolean {
  return isFinalised(report) && report.verification === "Verified";
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
  /** Added during researcher review; it has no model confidence score. */
  source?: "model" | "manual";
};

/** A researcher's label and box review, stored separately from model output. */
export type GrainAnnotationKind =
  | "confirmed"
  | "corrected"
  | "false_positive"
  | "missed"
  | "uncertain";

export type GrainAnnotation = {
  id: string;
  /** Model grain id (G1, G2, …), or null for a manually added missed grain. */
  grainId: string | null;
  kind: GrainAnnotationKind;
  speciesId: SpeciesId | null;
  box: BoundingBox;
  reviewedAt: string;
  /** Sample-report annotations are review-only and are never training candidates. */
  trainingEligible?: boolean;
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
  /** Mean model confidence; manually added missed grains do not contribute. */
  avgConfidence: number; // 0-1, or 0 when confidenceGrainCount is zero
  /** Number of counted grains with a model confidence score; absent on older API data. */
  confidenceGrainCount?: number;
};

export function getConfidenceGrainCount(detection: SpecimenDetection): number {
  return detection.confidenceGrainCount ?? detection.grainCount;
}

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
      confidenceGrainCount: grainCount,
    }))
    .sort(sortByAbundance);
}

/** Apply reviewer corrections, removals, and manually added missed grains to the result summary. */
export function getReviewedDetections(
  modelDetections: SpecimenDetection[],
  grains: DetectedGrain[] = [],
  annotations: GrainAnnotation[] = [],
): SpecimenDetection[] {
  const grainsById = new Map(grains.map((grain) => [grain.id, grain]));
  const removedBySpecies = new Map<SpeciesId, { grainCount: number; confidenceSum: number }>();
  const correctedBySpecies = new Map<SpeciesId, { grainCount: number; confidenceSum: number }>();
  const missedBySpecies = new Map<SpeciesId, number>();

  for (const annotation of annotations) {
    if (annotation.kind === "missed" && annotation.speciesId) {
      missedBySpecies.set(annotation.speciesId, (missedBySpecies.get(annotation.speciesId) ?? 0) + 1);
      continue;
    }
    if ((annotation.kind !== "false_positive" && annotation.kind !== "corrected") || !annotation.grainId) continue;
    const grain = grainsById.get(annotation.grainId);
    if (!grain) continue;
    const removed = removedBySpecies.get(grain.speciesId) ?? { grainCount: 0, confidenceSum: 0 };
    removed.grainCount += 1;
    removed.confidenceSum += grain.confidence;
    removedBySpecies.set(grain.speciesId, removed);

    if (annotation.kind === "corrected" && annotation.speciesId) {
      const corrected = correctedBySpecies.get(annotation.speciesId) ?? { grainCount: 0, confidenceSum: 0 };
      corrected.grainCount += 1;
      corrected.confidenceSum += grain.confidence;
      correctedBySpecies.set(annotation.speciesId, corrected);
    }
  }

  const reviewed = new Map<SpeciesId, SpecimenDetection>();
  for (const detection of modelDetections) {
    const modelCount = getConfidenceGrainCount(detection);
    const removed = removedBySpecies.get(detection.speciesId);
    const confidenceGrainCount = Math.max(0, modelCount - (removed?.grainCount ?? 0));
    const confidenceSum = Math.max(
      0,
      detection.avgConfidence * modelCount - (removed?.confidenceSum ?? 0),
    );
    const missedCount = missedBySpecies.get(detection.speciesId) ?? 0;
    const grainCount = confidenceGrainCount + missedCount;
    if (grainCount === 0) continue;
    reviewed.set(detection.speciesId, {
      ...detection,
      grainCount,
      confidenceGrainCount,
      avgConfidence: confidenceGrainCount ? confidenceSum / confidenceGrainCount : 0,
    });
  }

  for (const [speciesId, corrected] of correctedBySpecies) {
    const existing = reviewed.get(speciesId);
    const priorConfidenceCount = existing ? getConfidenceGrainCount(existing) : 0;
    const priorConfidenceSum = existing ? existing.avgConfidence * priorConfidenceCount : 0;
    const confidenceGrainCount = priorConfidenceCount + corrected.grainCount;
    reviewed.set(speciesId, {
      speciesId,
      grainCount: (existing?.grainCount ?? 0) + corrected.grainCount,
      confidenceGrainCount,
      avgConfidence: confidenceGrainCount
        ? (priorConfidenceSum + corrected.confidenceSum) / confidenceGrainCount
        : 0,
    });
  }

  for (const [speciesId, missedCount] of missedBySpecies) {
    if (reviewed.has(speciesId)) continue;
    reviewed.set(speciesId, {
      speciesId,
      grainCount: missedCount,
      confidenceGrainCount: 0,
      avgConfidence: 0,
    });
  }

  return [...reviewed.values()].sort(sortByAbundance);
}

/** Most abundant species first; ties broken by the more confident reading. */
export function sortByAbundance(a: SpecimenDetection, b: SpecimenDetection): number {
  return b.grainCount - a.grainCount ||
    (getConfidenceGrainCount(b) ? b.avgConfidence : 0) -
      (getConfidenceGrainCount(a) ? a.avgConfidence : 0);
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
export function getWeightedAvgConfidence(detections: SpecimenDetection[]): number | null {
  const confidenceGrains = detections.reduce((sum, detection) => sum + getConfidenceGrainCount(detection), 0);
  if (confidenceGrains === 0) return null;
  return detections.reduce(
    (sum, detection) => sum + detection.avgConfidence * getConfidenceGrainCount(detection),
    0,
  ) / confidenceGrains;
}

// ---------------------------------------------------------------------------
// Legacy weather fields remain in the API shape so older reports can still be
// read and preserved. New reports do not collect or display weather.
// ---------------------------------------------------------------------------

export type WeatherCondition = "Sunny" | "Partly cloudy" | "Overcast" | "Rainy" | "Windy";

export type WeatherConditions = {
  condition: WeatherCondition;
  temperatureC: number | null;
  humidityPct: number | null;
  windKph: number | null;
};

// ---------------------------------------------------------------------------
// Specimens
// ---------------------------------------------------------------------------

/**
 * When the specimen was collected in the field — not when it was analyzed.
 * Collection date as YYYY-MM-DD. Older API records may still include a time
 * suffix, which the interface intentionally ignores.
 */
export type CollectedAt = string;

/** The date half of a `CollectedAt`, e.g. "2026-07-29". */
export function getCollectionDate(collectedAt: CollectedAt): string {
  return collectedAt.split("T")[0];
}

/** Format the collection date only, even for older records containing a time. */
export function formatCollectedAt(collectedAt: CollectedAt): string {
  // Parsed as local midnight; `new Date("2026-07-29")` would be UTC midnight
  // and render as the previous day for anyone west of Greenwich.
  const date = new Date(`${getCollectionDate(collectedAt)}T00:00:00`);
  const formatted = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return formatted;
}

/**
 * One microscope slide inside a report: its own image, its own reading, and its
 * own field note. A report may hold several, because a researcher normally
 * prepares a batch of slides from one collection session.
 */
export type SpecimenSlide = {
  id: string;
  fileName: string;
  /** Reviewed counts, with verified false positives removed. */
  detections: SpecimenDetection[];
  /** Unmodified model summary, retained for audit and review controls. */
  modelDetections?: SpecimenDetection[];
  /**
   * Every grain the model boxed, for drawing over the image. Optional: a report
   * saved before boxes were kept has none, and the viewer says so rather than
   * pretending the slide was empty.
   */
  grains?: DetectedGrain[];
  /** Researcher labels are kept alongside the original model detections. */
  annotations?: GrainAnnotation[];
  notes: string; // free-text note about this slide; "" when left blank
  /** The slide's server-hosted image (a presigned URL in production — it expires). */
  imageUrl?: string;
};

/**
 * A report — one collection session. Location and collection date describe the
 * session and are shared; the readings and notes live per slide.
 */
export type Specimen = {
  sampleId: string;
  /** Researcher-provided label for the collection; older records may be unnamed. */
  reportName?: string;
  collectedAt: CollectedAt;
  location: string; // "" only while Pending
  slides: SpecimenSlide[];
  /** Legacy API field; new reports do not collect weather. */
  weather: WeatherConditions | null;
  researcher: string;
  status: ReportStatus;
  /** When it was analyzed and stored (ISO timestamp) — not the collection date. */
  createdAt: string;
  /** Whether the signed-in researcher may edit, change the status of, or delete it. */
  canEdit: boolean;
  /** Whether the signed-in researcher created it (unlike canEdit, false for staff on others' reports). */
  isMine: boolean;
  /** Whether a verifier has accepted it; only Verified reports are shared. */
  verification: Verification;
  verifiedAt: string | null;
  /** Why a verifier declined it; "" unless you own it or can verify. */
  declineReason: string;
  /** Whether the signed-in verifier may approve or decline it now. */
  canVerify: boolean;
  /** Detections came from the server's built-in sample, not a trained model. */
  sampleDetections?: boolean;
};

/** Every pollen type across a report's slides, combined and richest first. */
export function aggregateSlideDetections(slides: SpecimenSlide[]): SpecimenDetection[] {
  const bySpecies = new Map<SpeciesId, { grainCount: number; confidenceGrainCount: number; confidenceSum: number }>();

  for (const slide of slides) {
    for (const detection of slide.detections) {
      const entry = bySpecies.get(detection.speciesId) ?? { grainCount: 0, confidenceGrainCount: 0, confidenceSum: 0 };
      entry.grainCount += detection.grainCount;
      const confidenceGrainCount = getConfidenceGrainCount(detection);
      entry.confidenceGrainCount += confidenceGrainCount;
      entry.confidenceSum += detection.avgConfidence * confidenceGrainCount;
      bySpecies.set(detection.speciesId, entry);
    }
  }

  return [...bySpecies.entries()]
    .map(([speciesId, { grainCount, confidenceGrainCount, confidenceSum }]) => ({
      speciesId,
      grainCount,
      avgConfidence: confidenceGrainCount ? confidenceSum / confidenceGrainCount : 0,
      confidenceGrainCount,
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
  reportName: string;
  collectedAt: CollectedAt;
  location: string;
  topPollen: string;
  /** The species behind `topPollen`, for setting its name as a binomial. */
  topSpecies: Species | null;
  totalGrains: number;
  slideCount: number;
  status: ReportStatus;
  verification: Verification;
  /** Counts are the server's built-in sample reading, not results. */
  sampleDetections: boolean;
};

/** The row shown in the Reports table for one saved report. */
export function toReportRow(specimen: Specimen): ReportRow {
  const top = getTopDetection(aggregateSlideDetections(specimen.slides));
  const sp = top ? getSpecies(top.speciesId) : null;
  return {
    sampleId: specimen.sampleId,
    reportName: specimen.reportName?.trim() ?? "",
    collectedAt: specimen.collectedAt,
    location: specimen.location,
    topPollen: sp ? speciesLabel(sp) : "No pollen grains detected",
    topSpecies: sp,
    totalGrains: getReportGrains(specimen),
    slideCount: specimen.slides.length,
    status: specimen.status,
    verification: specimen.verification,
    sampleDetections: Boolean(specimen.sampleDetections),
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
  avgConfidence: number | null;
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
  const finalised = reports.filter(isPublic);
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

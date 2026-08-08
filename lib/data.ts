// ---------------------------------------------------------------------------
// SINGLE SOURCE OF TRUTH
// Everything below (allergen classes, history reports, recent detections,
// dashboard stats) is derived from `specimens`. Edit specimens/speciesCatalog
// and every screen that reads from this file stays consistent automatically.
// The one exception is `historicalPollenCounts`, which represents a separate
// real-world dataset (continuous monthly air-monitoring measurements) rather
// than individual specimen analyses — it shares the same species catalog for
// naming/color consistency, but its numbers are independent by design.
// ---------------------------------------------------------------------------

export type SpeciesId =
  | "poaceae"
  | "betula"
  | "alnus"
  | "corylus"
  | "quercus"
  | "ambrosia"
  | "pinus"
  | "artemisia";

export type Species = {
  id: SpeciesId;
  genus: string;
  commonName: string;
  code: string; // taxonomic-style short tag, e.g. AMBR
  season: string;
  riskLevel: "High" | "Moderate" | "Low";
  color: string; // CSS color/var, used consistently across charts, badges, thumbnails
};

export const speciesCatalog: Species[] = [
  { id: "poaceae", genus: "Poaceae", commonName: "Grass", code: "POAC", season: "Late spring – summer", riskLevel: "Moderate", color: "var(--grass)" },
  { id: "betula", genus: "Betula", commonName: "Birch", code: "BETU", season: "Early spring", riskLevel: "High", color: "var(--birch)" },
  { id: "alnus", genus: "Alnus", commonName: "Alder", code: "ALNU", season: "Winter – early spring", riskLevel: "Moderate", color: "var(--pollen)" },
  { id: "corylus", genus: "Corylus", commonName: "Hazel", code: "CORY", season: "Winter – early spring", riskLevel: "Moderate", color: "var(--hazel)" },
  { id: "quercus", genus: "Quercus", commonName: "Oak", code: "QUER", season: "Spring", riskLevel: "Moderate", color: "var(--anther)" },
  { id: "ambrosia", genus: "Ambrosia", commonName: "Ragweed", code: "AMBR", season: "Late summer – fall", riskLevel: "High", color: "#c2703d" },
  { id: "pinus", genus: "Pinus", commonName: "Pine", code: "PINU", season: "Spring", riskLevel: "Low", color: "#6f8f6a" },
  { id: "artemisia", genus: "Artemisia", commonName: "Mugwort", code: "ARTE", season: "Summer – fall", riskLevel: "Moderate", color: "#a1785a" },
];

export function getSpecies(id: SpeciesId): Species {
  const found = speciesCatalog.find((s) => s.id === id);
  if (!found) throw new Error(`Unknown species id: ${id}`);
  return found;
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

export type GrainPrediction = {
  speciesId: SpeciesId;
  confidence: number; // 0-1, this single grain's score
};

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
  notes: string; // free-text note about this slide; "" when left blank
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
    slides: [slide("PLN-2026-0142", [d("ambrosia", 18, 0.97), d("poaceae", 6, 0.84), d("artemisia", 2, 0.71)], "Dense ragweed load along the roadside transect; slide re-stained once for contrast.")],
    weather: { condition: "Sunny", temperatureC: 32, humidityPct: 64, windKph: 11 },
    researcher: "You", status: "Completed",
  },
  {
    sampleId: "PLN-2026-0141", collectedAt: "2026-07-28T09:40", location: "Lucban, Quezon",
    slides: [slide("PLN-2026-0141", [d("betula", 12, 0.91), d("pinus", 5, 0.8), d("quercus", 3, 0.76)], "Collected upslope of the treeline, mid-morning.")],
    weather: { condition: "Partly cloudy", temperatureC: 26, humidityPct: 78, windKph: 8 },
    researcher: "You", status: "Completed",
  },
  {
    sampleId: "PLN-2026-0140", collectedAt: "2026-07-28T14:05", location: "Lucena City, Quezon",
    slides: [slide("PLN-2026-0140", [d("poaceae", 9, 0.62), d("artemisia", 4, 0.58)], "Several grains partly obscured by debris — flagged for a second reading.")],
    weather: { condition: "Overcast", temperatureC: 29, humidityPct: 85, windKph: 6 },
    researcher: "M. Reyes", status: "Needs review",
  },
  {
    sampleId: "PLN-2026-0139", collectedAt: "2026-07-27T08:30", location: "Tayabas, Quezon",
    slides: [slide("PLN-2026-0139", [d("quercus", 15, 0.94), d("pinus", 4, 0.87), d("poaceae", 2, 0.69)], "")],
    weather: { condition: "Sunny", temperatureC: 31, humidityPct: 60, windKph: 14 },
    researcher: "You", status: "Completed",
  },
  {
    sampleId: "PLN-2026-0138", collectedAt: "2026-07-26", location: "Lucena City, Quezon",
    slides: [slide("PLN-2026-0138", [d("ambrosia", 11, 0.79), d("poaceae", 7, 0.73)], "")],
    weather: null,
    researcher: "M. Reyes", status: "Processing",
  },
  {
    sampleId: "PLN-2026-0137", collectedAt: "2026-07-26T16:20", location: "Sariaya, Quezon",
    slides: [slide("PLN-2026-0137", [d("artemisia", 13, 0.86), d("ambrosia", 5, 0.82), d("poaceae", 3, 0.7)], "Fallow field margin; strong afternoon breeze during sampling.")],
    weather: { condition: "Windy", temperatureC: 30, humidityPct: 58, windKph: 27 },
    researcher: "You", status: "Completed",
  },
  {
    sampleId: "PLN-2026-0136", collectedAt: "2026-07-25T06:50", location: "Lucban, Quezon",
    slides: [slide("PLN-2026-0136", [d("pinus", 16, 0.88), d("betula", 4, 0.83)], "")],
    weather: { condition: "Partly cloudy", temperatureC: 25, humidityPct: 80, windKph: 9 },
    researcher: "You", status: "Completed",
  },
  {
    sampleId: "PLN-2026-0135", collectedAt: "2026-06-14T10:10", location: "Lucena City, Quezon",
    slides: [slide("PLN-2026-0135", [d("poaceae", 21, 0.93), d("quercus", 3, 0.75)], "Peak grass season — highest grain count recorded at this site so far.")],
    weather: { condition: "Sunny", temperatureC: 33, humidityPct: 62, windKph: 12 },
    researcher: "You", status: "Completed",
  },
  {
    sampleId: "PLN-2026-0134", collectedAt: "2026-05-30", location: "Candelaria, Quezon",
    slides: [slide("PLN-2026-0134", [d("corylus", 10, 0.81), d("alnus", 6, 0.78), d("betula", 2, 0.72)], "")],
    weather: null,
    researcher: "M. Reyes", status: "Completed",
  },
  {
    sampleId: "PLN-2026-0133", collectedAt: "2026-05-12T07:35", location: "Lucban, Quezon",
    slides: [slide("PLN-2026-0133", [d("alnus", 14, 0.9), d("corylus", 5, 0.85)], "Sampled after two dry days; slide was unusually clean.")],
    weather: { condition: "Sunny", temperatureC: 27, humidityPct: 70, windKph: 10 },
    researcher: "You", status: "Completed",
  },
  {
    sampleId: "PLN-2026-0132", collectedAt: "2026-04-22T11:25", location: "Tayabas, Quezon",
    slides: [slide("PLN-2026-0132", [d("betula", 12, 0.85), d("quercus", 6, 0.8), d("pinus", 3, 0.74)], "")],
    weather: { condition: "Partly cloudy", temperatureC: 28, humidityPct: 73, windKph: 15 },
    researcher: "You", status: "Completed",
  },
  {
    sampleId: "PLN-2026-0131", collectedAt: "2026-03-18T15:45", location: "Lucena City, Quezon",
    slides: [slide("PLN-2026-0131", [d("quercus", 8, 0.77), d("poaceae", 6, 0.64), d("alnus", 2, 0.6)], "Low contrast on the oak grains; worth confirming against the reference set.")],
    weather: { condition: "Rainy", temperatureC: 24, humidityPct: 92, windKph: 18 },
    researcher: "M. Reyes", status: "Needs review",
  },
  {
    sampleId: "PLN-2026-0130", collectedAt: "2026-02-09T08:05", location: "Sariaya, Quezon",
    slides: [slide("PLN-2026-0130", [d("alnus", 17, 0.89), d("corylus", 7, 0.83), d("betula", 2, 0.76)], "")],
    weather: { condition: "Overcast", temperatureC: 23, humidityPct: 88, windKph: 7 },
    researcher: "You", status: "Completed",
  },
  {
    sampleId: "PLN-2026-0129", collectedAt: "2026-01-20T05:55", location: "Lucban, Quezon",
    slides: [slide("PLN-2026-0129", [d("corylus", 19, 0.92), d("alnus", 8, 0.87)], "Early hazel flush, sampled at dawn.")],
    weather: { condition: "Overcast", temperatureC: 22, humidityPct: 90, windKph: 5 },
    researcher: "You", status: "Completed",
  },
];

// ---------------------------------------------------------------------------
// Derived: history reports table (Sample ID, Date, Location, Top pollen, Status)
// ---------------------------------------------------------------------------

export type HistoryReport = {
  sampleId: string;
  collectedAt: CollectedAt;
  location: string;
  topPollen: string;
  totalGrains: number;
  slideCount: number;
  status: ReportStatus;
};

/** The row shown in the History table for one saved report. */
export function toHistoryReport(specimen: Specimen): HistoryReport {
  const top = getTopDetection(aggregateSlideDetections(specimen.slides));
  const sp = top ? getSpecies(top.speciesId) : null;
  return {
    sampleId: specimen.sampleId,
    collectedAt: specimen.collectedAt,
    location: specimen.location,
    topPollen: sp ? `${sp.genus} (${sp.commonName})` : "No pollen detected",
    totalGrains: getReportGrains(specimen),
    slideCount: specimen.slides.length,
    status: specimen.status,
  };
}

export const historyReports: HistoryReport[] = specimens.map(toHistoryReport);

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
        className: `${sp.genus} (${sp.commonName})`,
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
  genus: string;
  commonName: string;
  code: string;
  season: string;
  riskLevel: "High" | "Moderate" | "Low";
  count: number; // specimens this class was found in
  grainCount: number; // grains of this class across every specimen
};

export const allergenClasses: AllergenClass[] = speciesCatalog.map((sp) => ({
  id: sp.id,
  genus: sp.genus,
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
  Poaceae: number;
  Betula: number;
  Alnus: number;
  Corylus: number;
  Quercus: number;
};

const CHART_SPECIES_IDS: SpeciesId[] = ["poaceae", "betula", "alnus", "corylus", "quercus"];

export const pollenSeries = CHART_SPECIES_IDS.map((id) => {
  const sp = getSpecies(id);
  return { key: sp.genus, label: `${sp.genus} (${sp.commonName})`, color: sp.color };
});

export const historicalPollenCounts: MonthlyPollenCount[] = [
  { month: "Jan", Poaceae: 45, Betula: 32, Alnus: 28, Corylus: 20, Quercus: 13 },
  { month: "Feb", Poaceae: 52, Betula: 38, Alnus: 35, Corylus: 26, Quercus: 16 },
  { month: "Mar", Poaceae: 67, Betula: 46, Alnus: 33, Corylus: 28, Quercus: 20 },
  { month: "Apr", Poaceae: 89, Betula: 78, Alnus: 44, Corylus: 39, Quercus: 29 },
  { month: "May", Poaceae: 116, Betula: 97, Alnus: 52, Corylus: 46, Quercus: 35 },
  { month: "Jun", Poaceae: 100, Betula: 67, Alnus: 40, Corylus: 32, Quercus: 28 },
  { month: "Jul", Poaceae: 92, Betula: 55, Alnus: 36, Corylus: 29, Quercus: 24 },
  { month: "Aug", Poaceae: 84, Betula: 44, Alnus: 33, Corylus: 27, Quercus: 22 },
  { month: "Sep", Poaceae: 70, Betula: 36, Alnus: 30, Corylus: 24, Quercus: 19 },
  { month: "Oct", Poaceae: 55, Betula: 28, Alnus: 26, Corylus: 20, Quercus: 15 },
  { month: "Nov", Poaceae: 40, Betula: 22, Alnus: 22, Corylus: 16, Quercus: 12 },
  { month: "Dec", Poaceae: 34, Betula: 18, Alnus: 19, Corylus: 14, Quercus: 10 },
];

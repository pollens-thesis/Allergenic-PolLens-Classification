import {
  getCollectionDate, getTotalGrains, getWeightedAvgConfidence, isFinalised,
  type Specimen, type SpeciesId, type WeatherConditions,
} from "@/lib/data";
import { ALL_DASHBOARD_LOCATIONS, getDashboardLocation, matchesDashboardLocation } from "@/lib/dashboard-locations";

export type DashboardRange = 6 | 12;
export type DashboardMonth = {
  month: string;
  monthKey: string;
  collectionCount: number;
};
export type DashboardLocationSummary = {
  key: string;
  label: string;
  collectionCount: number;
  slideCount: number;
  monthly: number[];
  occurrences: Partial<Record<SpeciesId, number>>;
  sampleCount: number;
};
export type DashboardSpeciesOccurrence = { speciesId: SpeciesId; collectionCount: number; monthly: number[] };
export type DashboardPollenCount = { speciesId: SpeciesId; grainCount: number; sampleGrainCount: number };
export type DashboardMeasurement = { minimum: number; maximum: number; recordedCount: number };
export type DashboardConditions = {
  recordedCount: number;
  temperature: DashboardMeasurement | null;
  humidity: DashboardMeasurement | null;
  wind: DashboardMeasurement | null;
  conditions: { label: WeatherConditions["condition"]; collectionCount: number }[];
};
export type DashboardSummary = {
  from: string;
  to: string;
  collectionCount: number;
  slideCount: number;
  grainCount: number;
  needsReviewCount: number;
  pendingCount: number;
  siteCount: number;
  sampleCount: number;
  avgConfidence: number;
  locationFilter: string;
  locations: DashboardLocationSummary[];
  monthly: DashboardMonth[];
  recentCollections: Specimen[];
  pollenTypeCount: number;
  species: DashboardSpeciesOccurrence[];
  topPollenCounts: DashboardPollenCount[];
  conditions: DashboardConditions;
};

function measurement(values: (number | null | undefined)[]): DashboardMeasurement | null {
  const recorded = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return recorded.length ? { minimum: Math.min(...recorded), maximum: Math.max(...recorded), recordedCount: recorded.length } : null;
}

function collectionConditions(reports: Specimen[]): DashboardConditions {
  const conditions = new Map<WeatherConditions["condition"], number>();
  for (const report of reports) {
    if (report.weather) conditions.set(report.weather.condition, (conditions.get(report.weather.condition) ?? 0) + 1);
  }
  return {
    recordedCount: reports.filter((report) => report.weather !== null).length,
    temperature: measurement(reports.map((report) => report.weather?.temperatureC)),
    humidity: measurement(reports.map((report) => report.weather?.humidityPct)),
    wind: measurement(reports.map((report) => report.weather?.windKph)),
    conditions: [...conditions].map(([label, collectionCount]) => ({ label, collectionCount })).sort((a, b) => a.label.localeCompare(b.label)),
  };
}

/** One collection-date window for every dashboard figure, in Philippine time. */
export function buildDashboardSummary(reports: Specimen[], range: DashboardRange, now: Date = new Date(), locationFilter: string = ALL_DASHBOARD_LOCATIONS): DashboardSummary {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (name: string) => parts.find((item) => item.type === name)!.value;
  const year = Number(part("year"));
  const month = Number(part("month")) - 1;
  const to = `${part("year")}-${part("month")}-${part("day")}`;
  const firstMonth = new Date(Date.UTC(year, month - range + 1, 1));
  const from = firstMonth.toISOString().slice(0, 10);
  const labels = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });
  const buckets = new Map<string, DashboardMonth>();
  for (let index = 0; index < range; index++) {
    const date = new Date(Date.UTC(firstMonth.getUTCFullYear(), firstMonth.getUTCMonth() + index, 1));
    const monthKey = date.toISOString().slice(0, 7);
    buckets.set(monthKey, { month: labels.format(date), monthKey, collectionCount: 0 });
  }
  const scoped = reports.filter((report) => matchesDashboardLocation(report.location, locationFilter));
  const inRange = scoped.filter((report) => {
    const date = getCollectionDate(report.collectedAt);
    return date >= from && date <= to;
  });
  const included = inRange.filter(isFinalised);
  const locations = new Map<string, DashboardLocationSummary>();
  // Keep previously sampled locations visible, even when this period has a gap.
  for (const report of scoped.filter((report) => isFinalised(report) && getCollectionDate(report.collectedAt) <= to)) {
    const location = getDashboardLocation(report.location);
    if (!locations.has(location.key)) {
      locations.set(location.key, { key: location.key, label: location.label, collectionCount: 0, slideCount: 0, monthly: Array(range).fill(0), occurrences: {}, sampleCount: 0 });
    }
  }
  const monthKeys = [...buckets.keys()];
  const detections = included.flatMap((report) => report.slides.flatMap((slide) => slide.detections));
  const species = new Map<SpeciesId, DashboardSpeciesOccurrence>();
  const pollenCounts = new Map<SpeciesId, DashboardPollenCount>();
  for (const report of included) {
    const monthKey = getCollectionDate(report.collectedAt).slice(0, 7);
    const bucket = buckets.get(monthKey)!;
    bucket.collectionCount += 1;
    const location = locations.get(getDashboardLocation(report.location).key)!;
    location.collectionCount += 1;
    location.slideCount += report.slides.length;
    const monthIndex = monthKeys.indexOf(monthKey);
    location.monthly[monthIndex] += 1;
    if (report.sampleDetections) location.sampleCount += 1;
    for (const detection of report.slides.flatMap((slide) => slide.detections)) {
      if (detection.grainCount <= 0) continue;
      const count = pollenCounts.get(detection.speciesId) ?? { speciesId: detection.speciesId, grainCount: 0, sampleGrainCount: 0 };
      count.grainCount += detection.grainCount;
      if (report.sampleDetections) count.sampleGrainCount += detection.grainCount;
      pollenCounts.set(detection.speciesId, count);
    }
    // Presence counts once per collection, regardless of grains or repeated slides.
    const present = new Set(report.slides.flatMap((slide) => slide.detections).filter((detection) => detection.grainCount > 0).map((detection) => detection.speciesId));
    for (const speciesId of present) {
      location.occurrences[speciesId] = (location.occurrences[speciesId] ?? 0) + 1;
      const occurrence = species.get(speciesId) ?? { speciesId, collectionCount: 0, monthly: Array(range).fill(0) };
      occurrence.collectionCount += 1;
      occurrence.monthly[monthIndex] += 1;
      species.set(speciesId, occurrence);
    }
  }
  return {
    from, to,
    collectionCount: included.length,
    slideCount: included.reduce((sum, report) => sum + report.slides.length, 0),
    grainCount: getTotalGrains(detections),
    needsReviewCount: included.filter((report) => report.status === "Needs review").length,
    pendingCount: inRange.filter((report) => report.status === "Pending").length,
    siteCount: new Set(included.filter((report) => report.location.trim()).map((report) => getDashboardLocation(report.location).key)).size,
    sampleCount: included.filter((report) => report.sampleDetections).length,
    avgConfidence: getWeightedAvgConfidence(detections),
    locationFilter,
    locations: [...locations.values()].sort((a, b) => b.collectionCount - a.collectionCount || a.label.localeCompare(b.label)),
    monthly: [...buckets.values()],
    recentCollections: [...included]
      .sort((a, b) => b.collectedAt.localeCompare(a.collectedAt) || b.createdAt.localeCompare(a.createdAt) || a.sampleId.localeCompare(b.sampleId))
      .slice(0, 5),
    pollenTypeCount: species.size,
    species: [...species.values()],
    topPollenCounts: [...pollenCounts.values()].sort((a, b) => b.grainCount - a.grainCount || a.speciesId.localeCompare(b.speciesId)).slice(0, 5),
    conditions: collectionConditions(included),
  };
}

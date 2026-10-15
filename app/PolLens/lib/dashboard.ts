import {
  getCollectionDate, getTotalGrains, getWeightedAvgConfidence, isFinalised,
  type Specimen, type SpeciesId,
} from "@/lib/data";
import { ALL_DASHBOARD_LOCATIONS, getDashboardLocation, matchesDashboardLocation } from "@/lib/dashboard-locations";
import { CLASSIFIER_SPECIES_IDS } from "@/lib/species-names";

export type DashboardRange = 6 | 12;
export type DashboardHalf = 1 | 2;
export type DashboardPeriodSelection = { year: number; half: DashboardHalf };
export type DashboardMonth = {
  month: string;
  monthKey: string;
  collectionCount: number;
};
export type DashboardTrendMonth = DashboardMonth & {
  /** Grain counts for the 15 species supported by the current classifier. */
  series: Partial<Record<SpeciesId, number | null>>;
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
export type DashboardSummary = {
  from: string;
  to: string;
  currentDate: string;
  currentMonthKey: string;
  collectionCount: number;
  slideCount: number;
  grainCount: number;
  needsReviewCount: number;
  pendingCount: number;
  siteCount: number;
  sampleCount: number;
  avgConfidence: number | null;
  locationFilter: string;
  locations: DashboardLocationSummary[];
  monthly: DashboardMonth[];
  monthlyGrainCounts: DashboardTrendMonth[];
  recentCollections: Specimen[];
  pollenTypeCount: number;
  species: DashboardSpeciesOccurrence[];
  topPollenCounts: DashboardPollenCount[];
};

function philippineDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const part = (name: string) => parts.find((item) => item.type === name)!.value;
  return { year: Number(part("year")), month: Number(part("month")), day: Number(part("day")) };
}

export function getCurrentDashboardYear(now: Date = new Date()): number {
  return philippineDateParts(now).year;
}

export function getCurrentDashboardHalf(now: Date = new Date()): DashboardHalf {
  return philippineDateParts(now).month <= 6 ? 1 : 2;
}

/** Calendar years from the earliest saved collection through the current year. */
export function getDashboardYearOptions(reports: Specimen[], now: Date = new Date()): number[] {
  const currentYear = getCurrentDashboardYear(now);
  const historicalYears = reports
    .map((report) => Number(getCollectionDate(report.collectedAt).slice(0, 4)))
    .filter((year) => Number.isInteger(year) && year <= currentYear);
  const firstYear = historicalYears.length ? Math.min(currentYear, ...historicalYears) : currentYear;
  return Array.from({ length: currentYear - firstYear + 1 }, (_, index) => currentYear - index);
}

/** One collection-date window for every dashboard figure, in Philippine time. */
export function buildDashboardSummary(
  reports: Specimen[],
  range: DashboardRange,
  now: Date = new Date(),
  locationFilter: string = ALL_DASHBOARD_LOCATIONS,
  selection?: DashboardPeriodSelection,
): DashboardSummary {
  const today = philippineDateParts(now);
  const year = selection?.year ?? today.year;
  const half = selection?.half ?? (today.month <= 6 ? 1 : 2);
  const startMonth = range === 12 ? 0 : half === 1 ? 0 : 6;
  const endMonth = startMonth + range - 1;
  const from = new Date(Date.UTC(year, startMonth, 1)).toISOString().slice(0, 10);
  const to = new Date(Date.UTC(year, endMonth + 1, 0)).toISOString().slice(0, 10);
  const currentDate = `${today.year}-${String(today.month).padStart(2, "0")}-${String(today.day).padStart(2, "0")}`;
  const currentMonthKey = currentDate.slice(0, 7);
  const throughDate = currentDate < to ? currentDate : to;
  const firstMonth = new Date(Date.UTC(year, startMonth, 1));
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
    return date >= from && date <= throughDate;
  });
  const included = inRange.filter(isFinalised);
  const locations = new Map<string, DashboardLocationSummary>();
  // Keep previously sampled locations visible, even when this period has a gap.
  for (const report of scoped.filter((report) => isFinalised(report) && getCollectionDate(report.collectedAt) <= throughDate)) {
    const location = getDashboardLocation(report.location);
    if (!locations.has(location.key)) {
      locations.set(location.key, { key: location.key, label: location.label, collectionCount: 0, slideCount: 0, monthly: Array(range).fill(0), occurrences: {}, sampleCount: 0 });
    }
  }
  const monthKeys = [...buckets.keys()];
  const monthlyGrainCounts: DashboardTrendMonth[] = monthKeys.map((monthKey) => ({
    ...buckets.get(monthKey)!,
    series: Object.fromEntries(
      [...CLASSIFIER_SPECIES_IDS].map((speciesId) => [speciesId, monthKey > currentMonthKey ? null : 0]),
    ) as Partial<Record<SpeciesId, number | null>>,
  }));
  const trendByMonth = new Map(monthlyGrainCounts.map((month) => [month.monthKey, month]));
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
    const trendMonth = trendByMonth.get(monthKey)!;
    if (report.sampleDetections) location.sampleCount += 1;
    for (const detection of report.slides.flatMap((slide) => slide.detections)) {
      if (detection.grainCount <= 0) continue;
      const count = pollenCounts.get(detection.speciesId) ?? { speciesId: detection.speciesId, grainCount: 0, sampleGrainCount: 0 };
      count.grainCount += detection.grainCount;
      if (report.sampleDetections) count.sampleGrainCount += detection.grainCount;
      pollenCounts.set(detection.speciesId, count);
      if (CLASSIFIER_SPECIES_IDS.has(detection.speciesId)) {
        trendMonth.series[detection.speciesId] =
          (trendMonth.series[detection.speciesId] ?? 0) + detection.grainCount;
      }
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
    from, to, currentDate, currentMonthKey,
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
    monthlyGrainCounts,
    recentCollections: [...included]
      .sort((a, b) => b.collectedAt.localeCompare(a.collectedAt) || b.createdAt.localeCompare(a.createdAt) || a.sampleId.localeCompare(b.sampleId))
      .slice(0, 5),
    pollenTypeCount: species.size,
    species: [...species.values()],
    topPollenCounts: [...pollenCounts.values()].sort((a, b) => b.grainCount - a.grainCount || a.speciesId.localeCompare(b.speciesId)).slice(0, 5),
  };
}

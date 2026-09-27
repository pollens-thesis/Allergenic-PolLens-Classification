import {
  getCollectionDate, getTotalGrains, getWeightedAvgConfidence, isFinalised, speciesCatalog,
  type MonthlyPollenCount, type SpeciesId, type Specimen,
} from "@/lib/data";

export type DashboardRange = 6 | 12;
export type DashboardMonth = MonthlyPollenCount & {
  monthKey: string;
  collectionCount: number;
};
export type DashboardSpecies = { speciesId: SpeciesId; grainCount: number; collectionCount: number };
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
  monthly: DashboardMonth[];
  recentCollections: Specimen[];
  topTypes: DashboardSpecies[];
};

/** One collection-date window for every dashboard figure, in Philippine time. */
export function buildDashboardSummary(reports: Specimen[], range: DashboardRange, now: Date = new Date()): DashboardSummary {
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
    const series = Object.fromEntries(speciesCatalog.map((species) => [species.id, 0])) as Record<SpeciesId, number>;
    const monthKey = date.toISOString().slice(0, 7);
    buckets.set(monthKey, { month: labels.format(date), monthKey, collectionCount: 0, series });
  }
  const inRange = reports.filter((report) => {
    const date = getCollectionDate(report.collectedAt);
    return date >= from && date <= to;
  });
  const included = inRange.filter(isFinalised);
  const counts = new Map<SpeciesId, number>();
  const speciesCollections = new Map<SpeciesId, number>();
  const detections = included.flatMap((report) => report.slides.flatMap((slide) => slide.detections));
  for (const report of included) {
    const monthKey = getCollectionDate(report.collectedAt).slice(0, 7);
    const bucket = buckets.get(monthKey)!;
    bucket.collectionCount += 1;
    const speciesInReport = new Set<SpeciesId>();
    for (const slide of report.slides) {
      for (const detection of slide.detections) {
        counts.set(detection.speciesId, (counts.get(detection.speciesId) ?? 0) + detection.grainCount);
        bucket.series[detection.speciesId] = (bucket.series[detection.speciesId] ?? 0) + detection.grainCount;
        speciesInReport.add(detection.speciesId);
      }
    }
    for (const speciesId of speciesInReport) {
      speciesCollections.set(speciesId, (speciesCollections.get(speciesId) ?? 0) + 1);
    }
  }
  return {
    from, to,
    collectionCount: included.length,
    slideCount: included.reduce((sum, report) => sum + report.slides.length, 0),
    grainCount: getTotalGrains(detections),
    needsReviewCount: included.filter((report) => report.status === "Needs review").length,
    pendingCount: inRange.filter((report) => report.status === "Pending").length,
    siteCount: new Set(included.map((report) => report.location.trim()).filter(Boolean)).size,
    sampleCount: included.filter((report) => report.sampleDetections).length,
    avgConfidence: getWeightedAvgConfidence(detections),
    monthly: [...buckets.values()],
    recentCollections: [...included]
      .sort((a, b) => b.collectedAt.localeCompare(a.collectedAt) || b.createdAt.localeCompare(a.createdAt))
      .slice(0, 6),
    topTypes: [...counts.entries()]
      .filter(([, grainCount]) => grainCount > 0)
      .map(([speciesId, grainCount]) => ({ speciesId, grainCount, collectionCount: speciesCollections.get(speciesId) ?? 0 }))
      .sort((a, b) => b.grainCount - a.grainCount || a.speciesId.localeCompare(b.speciesId)),
  };
}

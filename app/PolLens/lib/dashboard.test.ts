import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDashboardSummary } from "@/lib/dashboard";
import { dashboardReportsHref, dashboardOccurrenceHref, getDashboardLocation, getDashboardLocationOptions, matchesDashboardLocation, matchesDashboardOccurrence } from "@/lib/dashboard-locations";
import type { Specimen, SpeciesId } from "@/lib/data";

const now = new Date("2026-09-27T10:00:00Z");
function report(overrides: Partial<Specimen> = {}): Specimen {
  return { sampleId: "test", collectedAt: "2026-09-27", location: "Lucban, Quezon", slides: [{ id: "slide", fileName: "test.png", notes: "", detections: [] }], weather: null, researcher: "Test researcher", status: "Completed", createdAt: "2026-09-27T10:00:00Z", canEdit: false, ...overrides };
}

test("sampling counts collections with no pollen, counts slides separately, and excludes Pending", () => {
  const records = [report(), report({ status: "Needs review", slides: [report().slides[0], report().slides[0]], sampleDetections: true }), report({ status: "Pending" })];
  const summary = buildDashboardSummary(records, 6, now);
  assert.equal(summary.collectionCount, 2);
  assert.equal(summary.slideCount, 3);
  assert.equal(summary.grainCount, 0);
  assert.equal(summary.pendingCount, 1);
  assert.equal(summary.needsReviewCount, 1);
  assert.equal(summary.sampleCount, 1);
  assert.deepEqual(summary.locations[0].monthly, [0, 0, 0, 0, 0, 2]);
  assert.equal(summary.locations[0].slideCount, 3);
});

test("date windows use collection dates, include the boundaries, and preserve historical sampling gaps", () => {
  const records = [report({ collectedAt: "2026-04-01" }), report({ collectedAt: "2026-09-27T23:59" }), report({ collectedAt: "2026-03-31", location: "Mauban, Quezon" }), report({ collectedAt: "2026-09-28" }), report({ status: "Pending", location: "Sariaya, Quezon" })];
  const summary = buildDashboardSummary(records, 6, now);
  assert.equal(summary.from, "2026-04-01");
  assert.equal(summary.collectionCount, 2);
  const gap = summary.locations.find((location) => location.label === "Mauban, Quezon")!;
  assert.equal(gap.collectionCount, 0);
  assert.deepEqual(gap.monthly, [0, 0, 0, 0, 0, 0]);
  assert.equal(summary.locations.some((location) => location.label === "Sariaya, Quezon"), false);
  assert.equal(summary.locations.reduce((sum, location) => sum + location.collectionCount, 0), summary.collectionCount);
});

test("Philippine midnight determines the month and year boundaries", () => {
  const summary = buildDashboardSummary([], 12, new Date("2025-12-31T16:01:00Z"));
  assert.equal(summary.to, "2026-01-01");
  assert.equal(summary.from, "2025-02-01");
  assert.equal(summary.monthly.at(-1)?.monthKey, "2026-01");
});

test("Quezon province includes province-only records but excludes Quezon City in Metro Manila", () => {
  const records = [report(), report({ location: "Quezon" }), report({ location: "Quezon City, Metro Manila" }), report({ status: "Pending" })];
  const summary = buildDashboardSummary(records, 6, now, "province:quezon");
  assert.equal(summary.collectionCount, 2);
  assert.equal(summary.pendingCount, 1);
  assert.equal(summary.recentCollections.length, 2);
  assert.equal(summary.siteCount, 2);
  assert.equal(matchesDashboardLocation("Quezon City, Metro Manila", "province:quezon"), false);
});

test("Metro Manila aliases and districts share an area filter without merging recorded locations", () => {
  const records = [report({ location: "Manila City, Metro Manila" }), report({ location: "Parañaque, NCR" }), report({ location: "Metro Manila (Fourth District)" }), report({ location: "Metro Manila (Second District)" })];
  const options = getDashboardLocationOptions(records);
  assert.deepEqual(options.provinces, [{ value: "province:ncr", label: "Metro Manila" }]);
  assert.equal(buildDashboardSummary(records, 6, now, "province:ncr").collectionCount, 4);
  assert.equal(options.locations.length, 4);
});

test("accent and city aliases match while the displayed Unicode label is preserved", () => {
  const records = [report({ location: "Parañaque City, Metro Manila" }), report({ location: "City of Paranaque, NCR" })];
  const summary = buildDashboardSummary(records, 6, now);
  assert.equal(summary.locations.length, 1);
  assert.equal(summary.locations[0].label, "Parañaque City, Metro Manila");
  assert.equal(summary.locations[0].collectionCount, 2);
  assert.equal(summary.siteCount, 1);
});

test("Isabela City stays distinct from Isabela province, and free-text sites are retained", () => {
  assert.notEqual(getDashboardLocation("Isabela City").key, getDashboardLocation("Isabela").key);
  const summary = buildDashboardSummary([report({ location: "Farm, Barangay Uno, Quezon" }), report({ location: "Farm, Barangay Dos, Quezon" }), report({ location: "" })], 6, now);
  assert.equal(summary.locations.length, 3);
  assert.equal(summary.locations.some((location) => location.label === "Location not recorded"), true);
  assert.equal(summary.locations.reduce((sum, location) => sum + location.slideCount, 0), 3);
});

test("selected municipality scopes all totals, review links, and recent collections", () => {
  const records = [report({ sampleDetections: true, slides: [{ ...report().slides[0], detections: [{ speciesId: "imperata_cylindrica", grainCount: 5, avgConfidence: 0.8 }] }] }), report({ location: "Lucena, Quezon", status: "Needs review" })];
  const filter = `location:${getDashboardLocation("Lucban, Quezon").key}`;
  const summary = buildDashboardSummary(records, 12, now, filter);
  assert.equal(summary.grainCount, 5);
  assert.equal(summary.avgConfidence, 0.8);
  assert.equal(summary.needsReviewCount, 0);
  assert.equal(summary.sampleCount, 1);
  assert.equal(summary.recentCollections.length, 1);
  const url = new URL(dashboardReportsHref(summary, "Needs review"), "https://pollens.test");
  assert.equal(url.searchParams.get("locationScope"), filter);
  assert.equal(url.searchParams.get("status"), "Needs review");
  assert.equal(url.searchParams.get("from"), "2025-10-01");
  assert.equal(url.searchParams.get("to"), "2026-09-27");
});

test("empty reports yield no locations or invented collection counts", () => {
  const summary = buildDashboardSummary([], 6, now);
  assert.equal(summary.collectionCount, 0);
  assert.deepEqual(summary.topPollenCounts, []);
  assert.deepEqual(summary.locations, []);
  assert.equal(summary.monthly.length, 6);
  assert.deepEqual(getDashboardLocationOptions([]), { provinces: [], locations: [] });
});

test("top pollen counts sum every finalized slide in scope and retain sample contributions", () => {
  const slide = (grains: number, speciesId: SpeciesId = "imperata_cylindrica") => ({ ...report().slides[0], detections: [{ speciesId, grainCount: grains, avgConfidence: 0.8 }] });
  const records = [
    report({ slides: [slide(4), slide(6)] }),
    report({ collectedAt: "2026-04-01", status: "Needs review", sampleDetections: true, slides: [slide(5), slide(2, "oryza_sativa"), slide(0, "cocos_nucifera")] }),
    report({ status: "Pending", sampleDetections: true, slides: [slide(999)] }),
    report({ location: "Mauban, Quezon", slides: [slide(999)] }),
    report({ collectedAt: "2026-03-31", slides: [slide(999)] }),
    report({ collectedAt: "2026-09-28", slides: [slide(999)] }),
  ];
  const summary = buildDashboardSummary(records, 6, now, `location:${getDashboardLocation("Lucban, Quezon").key}`);
  assert.deepEqual(summary.topPollenCounts, [
    { speciesId: "imperata_cylindrica", grainCount: 15, sampleGrainCount: 5 },
    { speciesId: "oryza_sativa", grainCount: 2, sampleGrainCount: 2 },
  ]);
  assert.equal(summary.grainCount, 17);
  assert.equal(summary.species.find((item) => item.speciesId === "imperata_cylindrica")?.collectionCount, 2);
});

test("top five rank ties deterministically without padding absent or zero-count species", () => {
  const species: SpeciesId[] = ["oryza_sativa", "mimosa_pudica", "imperata_cylindrica", "cocos_nucifera", "chloris_barbata", "amaranthus_spinosus"];
  const records = [report({ slides: [{ ...report().slides[0], detections: species.map((speciesId) => ({ speciesId, grainCount: 3, avgConfidence: 0.8 })) }] })];
  const summary = buildDashboardSummary(records, 12, now);
  assert.deepEqual(summary.topPollenCounts.map((item) => item.speciesId), [...species].sort().slice(0, 5));
  assert.equal(summary.grainCount, 18);
  assert.equal(summary.topPollenCounts.every((item) => item.sampleGrainCount === 0), true);
  assert.deepEqual(buildDashboardSummary([report({ sampleDetections: true })], 6, now).topPollenCounts, []);
});

test("recent collections show five deterministic records while pollen totals include older records", () => {
  const records = Array.from({ length: 7 }, (_, index) => report({
    sampleId: `test-${index}`,
    collectedAt: `2026-09-${String(27 - index).padStart(2, "0")}`,
    slides: [{ ...report().slides[0], detections: [{ speciesId: "imperata_cylindrica", grainCount: 1, avgConfidence: 0.8 }] }],
  }));
  records.push(report({ sampleId: "pending", status: "Pending" }));
  const summary = buildDashboardSummary(records.reverse(), 6, now);
  assert.deepEqual(summary.recentCollections.map((item) => item.sampleId), ["test-0", "test-1", "test-2", "test-3", "test-4"]);
  assert.equal(summary.topPollenCounts[0].grainCount, 7);
  const tied = buildDashboardSummary([report({ sampleId: "B" }), report({ sampleId: "A" })], 6, now);
  assert.deepEqual(tied.recentCollections.map((item) => item.sampleId), ["A", "B"]);
});

test("species occurrence counts each collection once across repeated slides and excludes zero detections", () => {
  const detection = { speciesId: "imperata_cylindrica" as const, grainCount: 40, avgConfidence: 0.8 };
  const slide = { ...report().slides[0], detections: [detection, { ...detection, speciesId: "oryza_sativa" as const, grainCount: 0 }] };
  const records = [report({ slides: [slide, slide] }), report({ status: "Needs review", slides: [slide], collectedAt: "2026-04-02", location: "Mauban, Quezon" }), report({ status: "Pending", slides: [slide] }), report(), report({ collectedAt: "2026-06-12" })];
  const summary = buildDashboardSummary(records, 6, now);
  assert.equal(summary.collectionCount, 4);
  assert.equal(summary.species.length, 1);
  assert.equal(summary.species[0].collectionCount, 2);
  assert.deepEqual(summary.species[0].monthly, [1, 0, 0, 0, 0, 1]);
  assert.equal(summary.monthly[5].collectionCount, 2);
  assert.equal(summary.monthly[2].collectionCount, 1);
  assert.equal(summary.species[0].monthly[2], 0);
  assert.equal(summary.monthly[1].collectionCount, 0);
  assert.equal(summary.locations.find((location) => location.label === "Lucban, Quezon")?.occurrences.imperata_cylindrica, 1);
  assert.equal(matchesDashboardOccurrence(records[0], "oryza_sativa"), false);
  assert.equal(matchesDashboardOccurrence(records[0], "imperata_cylindrica"), true);
});

test("weather excludes missing measurements, retains zero readings, and follows period, status and location", () => {
  const records = [report({ weather: { condition: "Sunny", temperatureC: 30, humidityPct: null, windKph: 0 } }), report({ weather: { condition: "Rainy", temperatureC: 20, humidityPct: 80, windKph: null } }), report(), report({ status: "Pending", weather: { condition: "Windy", temperatureC: 99, humidityPct: 10, windKph: 99 } }), report({ location: "Mauban, Quezon", weather: { condition: "Sunny", temperatureC: 40, humidityPct: null, windKph: 5 } }), report({ collectedAt: "2025-01-01", weather: { condition: "Sunny", temperatureC: 100, humidityPct: 100, windKph: 100 } })];
  const summary = buildDashboardSummary(records, 6, now, `location:${getDashboardLocation("Lucban, Quezon").key}`);
  assert.equal(summary.collectionCount, 3);
  assert.equal(summary.conditions.recordedCount, 2);
  assert.deepEqual(summary.conditions.temperature, { minimum: 20, maximum: 30, recordedCount: 2 });
  assert.deepEqual(summary.conditions.humidity, { minimum: 80, maximum: 80, recordedCount: 1 });
  assert.deepEqual(summary.conditions.wind, { minimum: 0, maximum: 0, recordedCount: 1 });
  assert.deepEqual(summary.conditions.conditions, [{ label: "Rainy", collectionCount: 1 }, { label: "Sunny", collectionCount: 1 }]);
  assert.equal(buildDashboardSummary([report()], 6, now).conditions.temperature, null);
});

test("occurrence links preserve exact species and location, finalized status, leap months and partial month bounds", () => {
  const summary = buildDashboardSummary([], 12, now, "province:quezon");
  const key = getDashboardLocation("Lucban, Quezon").key;
  const current = new URL(dashboardOccurrenceHref(summary, "imperata_cylindrica", key, "2026-09"), "https://pollens.test");
  assert.equal(current.searchParams.get("locationScope"), `location:${key}`);
  assert.equal(current.searchParams.get("q"), "Imperata cylindrica");
  assert.equal(current.searchParams.get("status"), "Finalized");
  assert.equal(current.searchParams.get("from"), "2026-09-01");
  assert.equal(current.searchParams.get("to"), "2026-09-27");
  const leap = new URL(dashboardOccurrenceHref({ from: "2024-01-01", to: "2024-03-30", locationFilter: "all" }, "oryza_sativa", undefined, "2024-02"), "https://pollens.test");
  assert.equal(leap.searchParams.get("to"), "2024-02-29");
  assert.equal(leap.searchParams.has("locationScope"), false);
  assert.equal(leap.searchParams.get("q"), "Oryza sativa");
});

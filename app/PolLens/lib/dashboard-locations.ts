import { parseLocation } from "@/lib/geo";
import { getSpecies, type Specimen, type SpeciesId } from "@/lib/data";

export const ALL_DASHBOARD_LOCATIONS = "all";
export type DashboardLocationOption = { value: string; label: string };

/** Reuse map matching, but keep Metro Manila's four districts in one area filter. */
export function getDashboardLocation(location: string) {
  const parsed = parseLocation(location);
  const metroManila = parsed.provinceKey === "ncr" || parsed.provinceKey.startsWith("ncr ");
  const provinceKey = metroManila ? "ncr" : parsed.provinceKey;
  const parts = location.split(",").map((part) => part.trim()).filter(Boolean);
  // Preserve additional site/barangay detail rather than merging distinct free-text locations.
  const locationKey = parts.length > 2
    ? parts.join(", ").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
    : parsed.townKey || parsed.provinceKey;
  return {
    key: JSON.stringify([provinceKey, locationKey]),
    label: parts.join(", ") || "Location not recorded",
    provinceKey,
    provinceLabel: metroManila ? "Metro Manila" : parsed.province,
  };
}

/** Options come from all saved reports so changing the period never drops a selection. */
export function getDashboardLocationOptions(reports: Specimen[]) {
  const provinces = new Map<string, DashboardLocationOption>();
  const locations = new Map<string, DashboardLocationOption>();
  for (const report of reports) {
    const location = getDashboardLocation(report.location);
    if (location.provinceKey) {
      const value = `province:${location.provinceKey}`;
      if (!provinces.has(value)) provinces.set(value, { value, label: location.provinceLabel });
    }
    const value = `location:${location.key}`;
    if (!locations.has(value)) locations.set(value, { value, label: location.label });
  }
  const alphabetically = (a: DashboardLocationOption, b: DashboardLocationOption) => a.label.localeCompare(b.label);
  return { provinces: [...provinces.values()].sort(alphabetically), locations: [...locations.values()].sort(alphabetically) };
}

export function matchesDashboardLocation(location: string, filter: string): boolean {
  if (filter === ALL_DASHBOARD_LOCATIONS) return true;
  const place = getDashboardLocation(location);
  return filter === `province:${place.provinceKey}` || filter === `location:${place.key}`;
}

/** Report links use an exact location scope rather than a broad text search. */
export function dashboardReportsHref(summary: { from: string; to: string; locationFilter: string }, status?: string): string {
  const params = new URLSearchParams({ from: summary.from, to: summary.to });
  if (summary.locationFilter !== ALL_DASHBOARD_LOCATIONS) params.set("locationScope", summary.locationFilter);
  if (status) params.set("status", status);
  return `/reports?${params}`;
}

export function matchesDashboardOccurrence(report: Specimen, speciesId: string): boolean {
  return report.slides.some((slide) => slide.detections.some((detection) => detection.speciesId === speciesId && detection.grainCount > 0));
}

/** Exact supporting records for a species, location and optional calendar month. */
export function dashboardOccurrenceHref(summary: { from: string; to: string; locationFilter: string }, speciesId: SpeciesId, locationKey?: string, monthKey?: string): string {
  let { from, to } = summary;
  if (monthKey) {
    const [year, month] = monthKey.split("-").map(Number);
    const lastDay = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    from = `${monthKey}-01` > from ? `${monthKey}-01` : from;
    to = lastDay < to ? lastDay : to;
  }
  const href = dashboardReportsHref({ from, to, locationFilter: locationKey ? `location:${locationKey}` : summary.locationFilter }, "Finalized");
  return `${href}&q=${encodeURIComponent(getSpecies(speciesId).scientificName)}`;
}

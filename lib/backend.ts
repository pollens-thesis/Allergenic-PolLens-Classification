// Backend reads that replace bundled seed data once signed in. Kept out of
// lib/data.ts, which server components import too, because they go through
// the client-only session layer (lib/api.ts).

import { apiFetch } from "@/lib/api";
import type { MonthlyPollenCount, Species } from "@/lib/data";

/**
 * Real trailing-12-month counts from the backend
 * (GET /api/v1/reports/monthly-counts/), shaped identically to
 * `historicalPollenCounts` in lib/data.ts so a caller can swap the seed for this once
 * signed in. Throws on a non-2xx response; callers should keep the seed data
 * on display rather than let a failed refresh clear the chart.
 */
export async function fetchMonthlyPollenCounts(): Promise<MonthlyPollenCount[]> {
  const res = await apiFetch("/api/v1/reports/monthly-counts/");
  if (!res.ok) {
    throw new Error("Failed to fetch monthly pollen counts.");
  }
  return (await res.json()) as MonthlyPollenCount[];
}

/**
 * Real species catalog from the backend (GET /api/v1/reports/species/),
 * shaped identically to `speciesCatalog` in lib/data.ts so a caller can swap the
 * bundled fallback for this once signed in — see lib/species-catalog.ts.
 * Throws on a non-2xx response; callers should keep the fallback catalog on
 * display rather than let a failed refresh blank out species labels.
 * commonName/season come back as "" (unset) from the backend rather than the
 * "TBD" sentinel used here, normalized on the way in so speciesLabel() keeps
 * working unchanged for both sources.
 */
export async function fetchSpeciesCatalog(): Promise<Species[]> {
  const res = await apiFetch("/api/v1/reports/species/");
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

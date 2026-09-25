// Backend reads for the dashboard chart and the live species catalog. Kept
// out of lib/data.ts, which server components import too, because they go
// through the client-only session layer (lib/api.ts).

import { apiFetch } from "@/lib/api";
import type { MonthlyPollenCount, Species } from "@/lib/data";

/**
 * Trailing-12-month grain counts per species (GET /api/v1/reports/monthly-counts/,
 * Completed and Needs review reports). Throws on a non-2xx response.
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
 */
export async function fetchSpeciesCatalog(): Promise<Species[]> {
  const res = await apiFetch("/api/v1/reports/species/");
  if (!res.ok) {
    throw new Error("Failed to fetch species catalog.");
  }
  return (await res.json()) as Species[];
}

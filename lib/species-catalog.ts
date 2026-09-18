// ---------------------------------------------------------------------------
// LIVE SPECIES CATALOG
//
// The bundled `speciesCatalog` in lib/data.ts is the build-time fallback —
// this module prefers the real catalog from the backend
// (GET /api/v1/reports/species/) once signed in, mirroring how
// PollenCountChart swaps `historicalPollenCounts` for
// fetchMonthlyPollenCounts: fetch once, silently swap in the result, and
// silently keep the fallback on failure or while signed out.
//
// Kept in-memory only (not localStorage, unlike lib/settings.ts) — 23 rows
// is cheap to refetch each session and there's no offline-editing need here.
// Reading is done through useSyncExternalStore so every component calling
// useSpeciesCatalog() re-renders together after the one shared fetch
// resolves, without each of them issuing its own request.
// ---------------------------------------------------------------------------

import { useEffect, useSyncExternalStore } from "react";
import { fetchSpeciesCatalog, getSpecies, speciesCatalog, type Species, type SpeciesId } from "./data";
import { useSettings } from "./settings";

let currentCatalog: Species[] = speciesCatalog;
let fetchedForToken: string | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): Species[] {
  return currentCatalog;
}

function getServerSnapshot(): Species[] {
  return speciesCatalog;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

function notify(): void {
  for (const listener of listeners) listener();
}

async function refreshCatalog(accessToken: string): Promise<void> {
  if (fetchedForToken === accessToken) return;
  fetchedForToken = accessToken;
  try {
    currentCatalog = await fetchSpeciesCatalog(accessToken);
    notify();
  } catch {
    // Keep showing the fallback catalog — a failed refresh shouldn't blank
    // out species labels. Clear the guard so a later render can retry.
    fetchedForToken = null;
  }
}

/**
 * The species catalog, preferring live backend data over the bundled
 * fallback once signed in. Fetches at most once per access token no matter
 * how many components call this hook.
 */
export function useSpeciesCatalog(): Species[] {
  const { accessToken } = useSettings();
  const catalog = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    if (!accessToken) return;
    void refreshCatalog(accessToken);
  }, [accessToken]);

  return catalog;
}

/** Looks up a species in `catalog`, falling back to the bundled catalog if missing (defensive only — both list the same ids). */
export function findSpecies(catalog: Species[], id: SpeciesId): Species {
  return catalog.find((s) => s.id === id) ?? getSpecies(id);
}

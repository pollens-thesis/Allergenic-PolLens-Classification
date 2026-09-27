"use client";

import { useMemo } from "react";
import { Inbox } from "lucide-react";
import SpeciesName from "@/components/SpeciesName";
import { speciesLabel } from "@/lib/data";
import { useSpeciesCatalog } from "@/lib/species-catalog";
import type { DashboardMonth, DashboardRange } from "@/lib/dashboard";

/**
 * "loading" — first fetch in flight.
 * "live" — fetch succeeded with real, non-zero totals.
 * "empty-live" — fetch succeeded but there's genuinely nothing to plot yet.
 * "error" — the shared dashboard request failed.
 */
type Status = "loading" | "live" | "empty-live" | "error";

const MAX_SPECIES = 8;

function heatShade(count: number, maximum: number): string {
  if (count <= 0 || maximum <= 0) return "var(--surface)";

  const relativeCount = Math.log1p(count) / Math.log1p(maximum);
  if (relativeCount >= 0.78) return "var(--border-strong)";
  if (relativeCount >= 0.52) return "var(--border)";
  if (relativeCount >= 0.26) {
    return "color-mix(in srgb, var(--surface-sunken) 35%, var(--border) 65%)";
  }
  return "var(--surface-sunken)";
}

/**
 * Counts of detected grains per pollen type by collection month. They are
 * counts from the collected slides, not an airborne concentration.
 */
export default function PollenCountChart({ data, range, status, emptyMessage }: {
  data: DashboardMonth[];
  range: DashboardRange;
  status: Status;
  emptyMessage: string;
}) {
  const catalog = useSpeciesCatalog();
  const visible = data;
  const empty = status === "empty-live";

  const rankedTypes = useMemo(() => catalog
    .map((species) => ({
      species,
      total: visible.reduce((sum, month) => sum + (month.series[species.id] ?? 0), 0),
    }))
    .filter(({ total }) => total > 0)
    .sort((a, b) => b.total - a.total || speciesLabel(a.species).localeCompare(speciesLabel(b.species))),
  [catalog, visible]);
  const typesToShow = rankedTypes.slice(0, MAX_SPECIES);
  const maxCellCount = Math.max(
    0,
    ...typesToShow.flatMap(({ species }) => visible.map((month) =>
      month.collectionCount > 0 ? month.series[species.id] ?? 0 : 0,
    )),
  );

  return (
    <div className="card-panel h-full p-4 sm:p-5">
      <div className="mb-1">
        <h2 className="t-plate-title text-text">Pollen Grain Counts</h2>
        <p className="text-[12px] text-text-muted">By pollen type and collection month. Darker cells show higher counts.</p>
      </div>

      {status === "loading" ? (
        <div className="mt-3 space-y-2" role="status" aria-label="Loading monthly counts" aria-busy="true">
          {Array.from({ length: Math.min(range, 6) }, (_, index) => (
            <div key={index} className="flex items-center gap-2">
              <div aria-hidden="true" className="h-3 w-28 animate-pulse rounded-sm bg-surface-sunken" />
              <div aria-hidden="true" className="h-7 flex-1 animate-pulse rounded-sm bg-surface-sunken" />
            </div>
          ))}
        </div>
      ) : status === "error" ? (
        <div className="mt-3 flex h-32 flex-col items-center justify-center gap-1.5 rounded-md bg-surface-sunken text-center">
          <span className="px-3 text-[12.5px] text-text-muted">Monthly counts unavailable.</span>
        </div>
      ) : empty ? (
        <div className="mt-3 flex h-32 flex-col items-center justify-center gap-1.5 rounded-md bg-surface-sunken text-center">
          <Inbox size={18} strokeWidth={1.5} className="text-text-faint" />
          <span className="px-3 text-[12.5px] text-text-muted">{emptyMessage}</span>
        </div>
      ) : (
        <>
          <div className="mt-3 overflow-x-auto" aria-label="Monthly pollen grain counts">
            <table
              className="w-full table-fixed border-separate border-spacing-0 text-left"
              style={{ minWidth: `${176 + visible.length * 38}px` }}
            >
              <caption className="sr-only">
                Monthly pollen grain counts by type for the trailing {range} months. Pending analyses are excluded.
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="sticky left-0 z-20 w-44 border-b border-r border-border bg-surface px-3 py-2 text-[12px] font-medium text-text-muted">
                    Pollen Type
                  </th>
                  {visible.map((month) => (
                    <th
                      key={month.monthKey}
                      scope="col"
                      aria-label={`${month.monthKey}, ${month.collectionCount} ${month.collectionCount === 1 ? "collection" : "collections"}`}
                      className="w-[38px] border-b border-r border-border bg-surface px-1 py-2 text-center text-[12px] font-medium text-text last:border-r-0"
                    >
                      <span className="block">{month.month}</span>
                      <span aria-hidden="true" className="mt-0.5 block text-[10px] font-normal tabular-nums text-text-muted" style={{ fontFamily: "var(--font-mono)" }}>
                        n={month.collectionCount}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {typesToShow.map(({ species }) => (
                  <tr key={species.id}>
                    <th scope="row" className="sticky left-0 z-10 border-b border-r border-border bg-surface px-3 py-2 text-left font-normal">
                      <span className="flex min-w-0 items-start gap-2">
                        <span
                          aria-hidden="true"
                          className="mt-1.5 h-2 w-2 shrink-0 rounded-full border border-black/10"
                          style={{ backgroundColor: species.color }}
                        />
                        <SpeciesName species={species} commonName={false} className="break-words text-[12.5px] leading-snug text-text" />
                      </span>
                    </th>
                    {visible.map((month) => {
                      const hasCollection = month.collectionCount > 0;
                      const count = hasCollection ? month.series[species.id] ?? 0 : 0;
                      const cellText = hasCollection ? count.toLocaleString() : "—";
                      const spokenValue = !hasCollection
                        ? "No collection"
                        : count === 0
                          ? "No grains detected"
                          : `${count} ${count === 1 ? "grain" : "grains"} detected`;

                      return (
                        <td
                          key={month.monthKey}
                          className="h-9 border-b border-r border-border px-1 text-center text-[12px] tabular-nums text-text last:border-r-0"
                          style={{
                            backgroundColor: hasCollection ? heatShade(count, maxCellCount) : "var(--surface)",
                            fontFamily: "var(--font-mono)",
                          }}
                        >
                          <span aria-hidden="true">{cellText}</span>
                          <span className="sr-only">{spokenValue}</span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {rankedTypes.length > MAX_SPECIES && (
            <p className="mt-1 text-[12px] text-text-muted">
              Showing the {MAX_SPECIES} most-counted pollen types of {rankedTypes.length} with grains in this window.
            </p>
          )}

          <p className="mt-2 border-t border-border pt-2 text-[12px] text-text-muted">
            <span style={{ fontFamily: "var(--font-mono)" }}>0</span> = no grains detected; <span style={{ fontFamily: "var(--font-mono)" }}>—</span> = no collection. Counts are not airborne concentrations.
          </p>
        </>
      )}
    </div>
  );
}

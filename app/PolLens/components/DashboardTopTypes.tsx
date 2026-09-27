"use client";

import { useMemo } from "react";
import type { DashboardSummary } from "@/lib/dashboard";
import { findSpecies, useSpeciesCatalog } from "@/lib/species-catalog";
import SpeciesName from "@/components/SpeciesName";
import { SampleBadge } from "@/components/StatusBadge";

const TOP_TYPES = 5;

export default function DashboardTopTypes({ summary, failed }: { summary: DashboardSummary | null; failed: boolean }) {
  const catalog = useSpeciesCatalog();
  const topTypes = useMemo(() => [...(summary?.topTypes ?? [])]
    .sort((a, b) => b.grainCount - a.grainCount || findSpecies(catalog, a.speciesId).scientificName.localeCompare(findSpecies(catalog, b.speciesId).scientificName))
    .slice(0, TOP_TYPES), [catalog, summary]);
  const highestCount = topTypes[0]?.grainCount ?? 0;

  return (
    <section className="card-panel h-full p-5" aria-labelledby="top-types-heading">
      <div className="mb-3">
        <div className="flex items-start justify-between gap-3">
          <h2 id="top-types-heading" className="t-plate-title text-text">Top Pollen Types</h2>
          {summary && summary.sampleCount > 0 && <SampleBadge />}
        </div>
        <p className="mt-0.5 text-[12px] text-text-muted">Grains in the selected collection period</p>
      </div>
      {summary === null && !failed ? (
        <div className="space-y-4 py-2" role="status" aria-label="Loading pollen counts" aria-busy="true">
          {Array.from({ length: TOP_TYPES }, (_, index) => (
            <div key={index} aria-hidden="true">
              <div className="mb-2 h-3 w-2/3 rounded-sm bg-surface-sunken" />
              <div className="h-1.5 w-full rounded-sm bg-surface-sunken" />
            </div>
          ))}
        </div>
      ) : failed ? (
        <p className="py-8 text-center text-[13px] text-text-muted">Pollen summary unavailable.</p>
      ) : topTypes.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-text-muted">No pollen grains recorded in this period.</p>
      ) : (
        <ol className="divide-y divide-border">
          {topTypes.map(({ speciesId, grainCount, collectionCount }) => {
            const species = findSpecies(catalog, speciesId);
            const width = `${highestCount > 0 ? (grainCount / highestCount) * 100 : 0}%`;
            return (
              <li key={speciesId} className="py-2 first:pt-1 last:pb-1">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <SpeciesName species={species} commonName={false} className="block text-[13.5px] leading-snug text-text" />
                  </div>
                  <span className="shrink-0 text-[12px] text-text-muted" style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
                    {grainCount.toLocaleString()} {grainCount === 1 ? "grain" : "grains"}
                  </span>
                </div>
                <p className="mt-1 text-[12px] text-text-muted">
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>{species.code}</span>
                  <span> · {collectionCount} {collectionCount === 1 ? "collection" : "collections"}</span>
                  {summary && summary.grainCount > 0 && <span> · {Math.round((grainCount / summary.grainCount) * 100)}% of grains</span>}
                </p>
                <div aria-hidden="true" className="mt-2 h-1.5 w-full">
                  <div className="h-full rounded-sm" style={{ width, backgroundColor: species.color }} />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

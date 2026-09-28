import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { DashboardSummary } from "@/lib/dashboard";
import { dashboardOccurrenceHref } from "@/lib/dashboard-locations";
import type { Species } from "@/lib/data";
import { findSpecies } from "@/lib/species-catalog";
import SpeciesName from "@/components/SpeciesName";
import { SampleBadge } from "@/components/StatusBadge";

export default function DashboardTopPollenCounts({ summary, failed, catalog }: {
  summary: DashboardSummary | null;
  failed: boolean;
  catalog: Species[];
}) {
  const counts = summary?.topPollenCounts ?? [];
  const maximum = counts[0]?.grainCount ?? 0;
  const hasSamples = counts.some((count) => count.sampleGrainCount > 0);

  return (
    <section className="card-panel flex h-full min-w-0 flex-col p-4 sm:p-5" aria-labelledby="top-pollen-counts-heading" aria-busy={!summary && !failed}>
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="top-pollen-counts-heading" className="t-plate-title text-text">Top Pollen Counts</h2>
          {hasSamples && <SampleBadge />}
        </div>
        <span className="text-[12px] text-text-muted">Grains</span>
      </div>
      {!summary && !failed ? (
        <div role="status" aria-label="Loading top pollen counts" className="mt-4 space-y-3">
          {[0, 1, 2, 3, 4].map((index) => <div key={index} className="h-12 animate-pulse rounded-sm bg-surface-sunken" />)}
        </div>
      ) : failed ? (
        <p className="py-8 text-[13px] text-text-muted">Pollen counts unavailable. Use Try Again above to reload.</p>
      ) : !summary?.collectionCount ? (
        <p className="py-8 text-[13px] text-text-muted">No finalized collections in this location and period.</p>
      ) : counts.length === 0 ? (
        <p className="py-8 text-[13px] text-text-muted">No pollen grains recorded in the selected collections.</p>
      ) : (
        <ol className="mt-3 divide-y divide-border">
          {counts.map((count) => {
            const species = findSpecies(catalog, count.speciesId);
            return (
              <li key={count.speciesId}>
                <Link href={dashboardOccurrenceHref(summary!, count.speciesId)} className="focus-ring block min-h-11 rounded-sm py-3 transition-colors hover:bg-surface-sunken">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <SpeciesName species={species} commonName={false} className="block break-words text-[14px] text-text" />
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="text-[12px] text-text-muted" style={{ fontFamily: "var(--font-mono)" }}>{species.code}</span>
                        {count.sampleGrainCount > 0 && <SampleBadge />}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 pt-0.5">
                      <span className="text-[14px] tabular-nums text-text" style={{ fontFamily: "var(--font-mono)" }}>{count.grainCount.toLocaleString()}<span className="sr-only"> {count.grainCount === 1 ? "grain" : "grains"}. Open supporting reports.</span></span>
                      <ArrowUpRight size={13} strokeWidth={1.75} className="text-text-faint" aria-hidden="true" />
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-sm bg-surface-sunken" aria-hidden="true">
                    <div className="h-full rounded-sm" style={{ width: `${count.grainCount / maximum * 100}%`, backgroundColor: species.color }} />
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

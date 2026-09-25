"use client";

import { useSpeciesCatalog } from "@/lib/species-catalog";
import { useReportGrainCounts } from "@/lib/report-grain-counts";
import RiskBadge from "@/components/RiskBadge";

/**
 * The full 23-species taxonomic scope this console classifies against.
 * Common name and season are omitted until real per-species data is entered
 * (Django admin → Species); the risk column reads "Not Assessed" until then.
 */
export default function AllergenReference() {
  const speciesCatalog = useSpeciesCatalog();
  const counts = useReportGrainCounts();

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full min-w-[34rem] text-left text-[13px]">
        <thead>
          <tr
            className="caption-label text-[14px] border-b border-border"
            
          >
            <th className="px-4 py-3 font-medium">Species</th>
            <th className="px-4 py-3 font-medium">Code</th>
            <th className="px-4 py-3 font-medium">Risk Level</th>
            <th className="px-4 py-3 text-right font-medium">Grains in Finalized Reports</th>
          </tr>
        </thead>
        <tbody>
          {speciesCatalog.map((sp) => (
            <tr
              key={sp.id}
              id={sp.id}
              className="scroll-mt-24 border-b lg:scroll-mt-48 border-border/70 last:border-0 target:bg-accent-muted"
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: sp.color }}
                  />
                  <i className="t-binomial text-[15px] text-text">{sp.scientificName}</i>
                </div>
              </td>
              <td className="px-4 py-3 text-text-muted" style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
                {sp.code}
              </td>
              <td className="px-4 py-3">
                <RiskBadge level={sp.riskLevel} suffix={false} />
              </td>
              <td className="px-4 py-3 text-right text-text" style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
                {counts === null ? "…" : (counts[sp.id] ?? 0).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

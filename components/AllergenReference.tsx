"use client";

import { useEffect, useState } from "react";
import { useSpeciesCatalog } from "@/lib/species-catalog";
import { aggregateSlideDetections, type Species } from "@/lib/data";
import { listReports } from "@/lib/store";

function riskBadgeClass(level: Species["riskLevel"]) {
  if (level === "High") return "bg-danger-bg text-danger";
  if (level === "Moderate") return "bg-processing-bg text-processing";
  return "bg-success-bg text-success";
}

/** Total grains detected per species across every saved report, computed client-side from real local data — not the unused mock `allergenClasses`. */
function useReportGrainCounts(): Record<string, number> | null {
  const [counts, setCounts] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    let cancelled = false;
    listReports().then((reports) => {
      if (cancelled) return;
      const totals: Record<string, number> = {};
      for (const specimen of reports) {
        for (const detection of aggregateSlideDetections(specimen.slides)) {
          totals[detection.speciesId] = (totals[detection.speciesId] ?? 0) + detection.grainCount;
        }
      }
      setCounts(totals);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return counts;
}

/**
 * The full 23-species taxonomic scope this console classifies against.
 * commonName/season are omitted — both are still unset "TBD" placeholders
 * for every species today, and showing 23 literal "TBD"s would be worse
 * than not showing the field at all.
 */
export default function AllergenReference() {
  const speciesCatalog = useSpeciesCatalog();
  const counts = useReportGrainCounts();

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr
            className="border-b border-border text-[11.5px] tracking-widest text-text-muted uppercase"
            style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}
          >
            <th className="px-4 py-3 font-medium">Species</th>
            <th className="px-4 py-3 font-medium">Code</th>
            <th className="px-4 py-3 font-medium">Risk level</th>
            <th className="px-4 py-3 text-right font-medium">Grains in your reports</th>
          </tr>
        </thead>
        <tbody>
          {speciesCatalog.map((sp) => (
            <tr key={sp.id} className="border-b border-border/70 last:border-0">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: sp.color }}
                  />
                  <span className="text-text italic">{sp.scientificName}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-text-muted" style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
                {sp.code}
              </td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-medium ${riskBadgeClass(sp.riskLevel)}`}>
                  {sp.riskLevel}
                </span>
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

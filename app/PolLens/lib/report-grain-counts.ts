"use client";

import { useEffect, useState } from "react";
import { aggregateSlideDetections, isFinalised } from "@/lib/data";
import { listReports } from "@/lib/store";

/**
 * Total grains detected per species across every completed report (all
 * researchers), computed from the same reports the Reports page lists. `null`
 * while loading (or if the server can't be reached). Shared by the Allergen Reference page and the specimen inspector's
 * reference card.
 */
export function useReportGrainCounts(): Record<string, number> | null {
  const [counts, setCounts] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    let cancelled = false;
    listReports()
      .then((reports) => {
      if (cancelled) return;
      const totals: Record<string, number> = {};
      for (const specimen of reports.filter(isFinalised)) {
        for (const detection of aggregateSlideDetections(specimen.slides)) {
          totals[detection.speciesId] = (totals[detection.speciesId] ?? 0) + detection.grainCount;
        }
      }
      setCounts(totals);
    })
      .catch(() => {
        // Leave the counts showing as not-yet-loaded rather than zeroes.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return counts;
}

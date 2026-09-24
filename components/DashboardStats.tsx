"use client";

import { useEffect, useState } from "react";
import { Leaf, ScanLine, Microscope, Percent } from "lucide-react";
import { computeDashboardStats, type DashboardStats as Stats } from "@/lib/data";
import { listReports } from "@/lib/store";
import { useSpeciesCatalog } from "@/lib/species-catalog";
import StatCard from "@/components/StatCard";

/**
 * Headline figures over every finalised report on the server (Pending ones
 * aren't results yet). Shows dashes while loading or if the server can't be
 * reached, never made-up numbers.
 */
export default function DashboardStats() {
  const catalog = useSpeciesCatalog();
  const [stats, setStats] = useState<Stats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listReports()
      .then((reports) => {
        if (!cancelled) setStats(computeDashboardStats(reports, 0));
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dash = failed ? "—" : "…";
  return (
    <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard
        label="Reports Completed"
        value={stats ? stats.totalSpecimens.toLocaleString() : dash}
        sublabel={failed ? "Couldn't reach the server" : "All researchers, all time"}
        icon={Microscope}
      />
      <StatCard
        label="Pollen Types"
        value={String(catalog.length)}
        sublabel="In the reference catalog"
        icon={Leaf}
      />
      <StatCard
        label="This Week"
        value={stats ? String(stats.detectionsThisWeek) : dash}
        sublabel="Reports analysed in the last 7 days"
        icon={ScanLine}
      />
      <StatCard
        label="Avg. Confidence"
        value={stats ? (stats.avgConfidence ? `${Math.round(stats.avgConfidence * 100)}%` : "—") : dash}
        sublabel="Over every detected grain"
        icon={Percent}
      />
    </div>
  );
}

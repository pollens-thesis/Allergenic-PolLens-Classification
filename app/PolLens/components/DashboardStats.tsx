"use client";

import { useEffect, useState } from "react";
import { Leaf, ScanLine, Microscope, Percent } from "lucide-react";
import { computeDashboardStats, isFinalised, type DashboardStats as Stats } from "@/lib/data";
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
  // Finalised reports whose counts are the server's sample reading, not results.
  const [sampleCount, setSampleCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    listReports()
      .then((reports) => {
        if (cancelled) return;
        setStats(computeDashboardStats(reports, 0));
        setSampleCount(reports.filter((r) => isFinalised(r) && r.sampleDetections).length);
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
    <div>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border xl:grid-cols-4">
        <StatCard
          label="Reports Generated"
          value={stats ? stats.totalSpecimens.toLocaleString() : dash}
          sublabel={failed ? "Couldn't reach the server — reload to try again" : "Completed or Needs Review · all researchers"}
          icon={Microscope}
        />
        <StatCard
          label="This Week"
          value={stats ? String(stats.detectionsThisWeek) : dash}
          sublabel="Finalized reports first analyzed in the last 7 days"
          icon={ScanLine}
        />
        <StatCard
          label="Avg. Confidence"
          value={stats ? (stats.avgConfidence ? `${Math.round(stats.avgConfidence * 100)}%` : "—") : dash}
          sublabel="Over every detected grain"
          icon={Percent}
        />
        <StatCard
          label="Pollen Types"
          value={String(catalog.length)}
          sublabel="In the reference catalog"
          icon={Leaf}
        />
      </div>
      {sampleCount > 0 && (
        <p className="mt-2 text-[13px] text-text-muted">
          Includes {sampleCount} {sampleCount === 1 ? "report" : "reports"}{" "}
          with sample detections (the
          server&apos;s built-in reading, not results).
        </p>
      )}
    </div>
  );
}

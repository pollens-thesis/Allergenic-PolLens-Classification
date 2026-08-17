"use client";

import { useEffect, useState } from "react";
import { Leaf, ScanLine, Microscope, Percent } from "lucide-react";
import { computeDashboardStats, type DashboardStats as Stats } from "@/lib/data";
import { listReports } from "@/lib/store";
import StatCard from "@/components/StatCard";

/**
 * Starts from the server-rendered seed figures, then recomputes once the saved
 * reports are read out of IndexedDB — so the cards agree with what the report
 * list actually shows instead of counting only the records shipped with the app.
 */
export default function DashboardStats({ initial }: { initial: Stats }) {
  const [stats, setStats] = useState<Stats>(initial);

  useEffect(() => {
    let cancelled = false;
    listReports().then((reports) => {
      if (!cancelled) setStats(computeDashboardStats(reports));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard
        label="Specimens analyzed"
        value={stats.totalSpecimens.toLocaleString()}
        sublabel="All time"
        icon={Microscope}
      />
      <StatCard
        label="Allergen classes"
        value={String(stats.classesTracked)}
        sublabel="In reference set"
        icon={Leaf}
      />
      <StatCard
        label="This week"
        value={String(stats.detectionsThisWeek)}
        sublabel="New identifications"
        icon={ScanLine}
      />
      <StatCard
        label="Avg. confidence"
        value={`${Math.round(stats.avgConfidence * 100)}%`}
        sublabel="Across all classes"
        icon={Percent}
      />
    </div>
  );
}

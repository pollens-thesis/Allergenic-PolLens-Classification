"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toHistoryReport, type Specimen } from "@/lib/data";
import { listReports } from "@/lib/store";
import HistoryReportsTable from "@/components/HistoryReportsTable";

/**
 * Reports live in IndexedDB, which only exists in the browser, so the list is
 * loaded after mount. Fetching per mount (rather than caching at module scope)
 * is what makes a report saved seconds ago appear the moment we land here.
 */
export default function HistoryWorkspace() {
  const [reports, setReports] = useState<Specimen[] | null>(null);
  const searchParams = useSearchParams();
  const savedId = searchParams.get("saved");
  const initialQuery = searchParams.get("q") ?? "";

  useEffect(() => {
    let cancelled = false;
    listReports().then((loaded) => {
      if (!cancelled) setReports(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (reports === null) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border border-panel-line bg-white/60 px-6 py-16 text-[13px] text-ink/65">
        <Loader2 size={16} strokeWidth={1.75} className="animate-spin" />
        Loading reports…
      </div>
    );
  }

  return (
    <HistoryReportsTable
      data={reports.map(toHistoryReport)}
      highlightId={savedId}
      initialQuery={initialQuery}
    />
  );
}

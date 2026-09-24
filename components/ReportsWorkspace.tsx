"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CloudOff, Loader2 } from "lucide-react";
import { type Specimen } from "@/lib/data";
import { listReports } from "@/lib/store";
import { SessionExpiredError } from "@/lib/api";
import ReportsTable from "@/components/ReportsTable";
import { Button } from "@/components/Button";

/**
 * Every report on the server (shared across researchers), loaded after mount
 * so a report generated seconds ago is there when we land here.
 */
export default function ReportsWorkspace() {
  const [reports, setReports] = useState<Specimen[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const searchParams = useSearchParams();
  const savedId = searchParams.get("saved");
  const initialQuery = searchParams.get("q") ?? "";

  useEffect(() => {
    let cancelled = false;
    listReports()
      .then((loaded) => {
        if (!cancelled) setReports(loaded);
      })
      .catch((err: unknown) => {
        if (cancelled || err instanceof SessionExpiredError) return;
        setError(err instanceof Error ? err.message : "Couldn't load reports.");
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface px-6 py-16 text-center">
        <CloudOff size={22} strokeWidth={1.5} className="text-text-faint" />
        <p className="text-[13.5px] text-text-muted">{error}</p>
        <Button
          type="button"
          intent="secondary"
          size="sm"
          onClick={() => {
            setError(null);
            setAttempt((n) => n + 1);
          }}
        >
          Try Again
        </Button>
      </div>
    );
  }

  if (reports === null) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-6 py-16 text-[13px] text-text-muted">
        <Loader2 size={16} strokeWidth={1.75} className="animate-spin" />
        Loading reports…
      </div>
    );
  }

  return (
    // Keyed on the query so following a link that changes ?q= (e.g. from the
    // Pollen Map) re-seeds the search box instead of keeping stale text.
    <ReportsTable
      key={initialQuery}
      reports={reports}
      highlightId={savedId}
      initialQuery={initialQuery}
    />
  );
}

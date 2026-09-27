"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CloudOff, Loader2 } from "lucide-react";
import { REPORT_STATUSES, type ReportStatus, type Specimen } from "@/lib/data";
import { listReports } from "@/lib/store";
import { SessionExpiredError } from "@/lib/api";
import ReportsTable from "@/components/ReportsTable";
import { Button } from "@/components/Button";

function dateFilter(value: string | null): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : "";
}

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
  const statusParam = searchParams.get("status");
  const initialStatus: ReportStatus | "All" = REPORT_STATUSES.find((status) => status === statusParam) ?? "All";
  const initialFrom = dateFilter(searchParams.get("from"));
  const initialTo = dateFilter(searchParams.get("to"));

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
      <div className="card-panel flex flex-col items-center gap-3 px-6 py-16 text-center">
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
      <div className="card-panel flex items-center justify-center gap-2 px-6 py-16 text-[13px] text-text-muted">
        <Loader2 size={16} strokeWidth={1.75} className="animate-spin" />
        Loading reports…
      </div>
    );
  }

  return (
    // Re-seed filters when a dashboard or map link changes the URL.
    <ReportsTable
      key={JSON.stringify([initialQuery, initialStatus, initialFrom, initialTo])}
      reports={reports}
      highlightId={savedId}
      initialQuery={initialQuery}
      initialStatus={initialStatus}
      initialFrom={initialFrom}
      initialTo={initialTo}
    />
  );
}

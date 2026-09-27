"use client";

import { useEffect, useMemo, useState } from "react";
import { CloudOff } from "lucide-react";
import { buildDashboardSummary, type DashboardRange } from "@/lib/dashboard";
import { type Specimen } from "@/lib/data";
import { listReports } from "@/lib/store";
import { SessionExpiredError } from "@/lib/api";
import { useSettings } from "@/lib/settings";
import { Button } from "@/components/Button";
import DashboardStats from "@/components/DashboardStats";
import DashboardRecentCollections from "@/components/DashboardRecentCollections";
import DashboardTopTypes from "@/components/DashboardTopTypes";
import PollenCountChart from "@/components/PollenCountChart";

type Result = { email: string; reports: Specimen[] | null; error: string | null };
const ranges: DashboardRange[] = [6, 12];
const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export default function DashboardWorkspace() {
  const { email } = useSettings();
  const [range, setRange] = useState<DashboardRange>(12);
  const [now, setNow] = useState(() => new Date());
  const [result, setResult] = useState<Result | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!email) return;
    let cancelled = false;
    listReports()
      .then((reports) => {
        if (!cancelled) setResult({ email, reports, error: null });
      })
      .catch((error: unknown) => {
        if (cancelled || error instanceof SessionExpiredError) return;
        setResult({ email, reports: null, error: error instanceof Error ? error.message : "Couldn't load dashboard counts. Try again." });
      });
    return () => { cancelled = true; };
  }, [email, attempt]);

  const reports = result?.email === email ? result.reports : null;
  const error = result?.email === email ? result.error : null;
  const summary = useMemo(() => buildDashboardSummary(reports ?? [], range, now), [reports, range, now]);
  const loaded = reports !== null;
  const status = error ? "error" : !loaded ? "loading" : summary.grainCount > 0 ? "live" : "empty-live";

  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="collection-overview-heading">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="collection-overview-heading" className="text-[14px] font-medium text-text">Collection Overview</h2>
            <p className="mt-1 text-[12px] text-text-muted">
              Collection dates {dateFormat.format(new Date(`${summary.from}T00:00:00Z`))} – {dateFormat.format(new Date(`${summary.to}T00:00:00Z`))}
              {loaded && <> <span aria-hidden="true">·</span> {summary.siteCount} recorded {summary.siteCount === 1 ? "site" : "sites"}</>}
            </p>
          </div>
          <div className="flex items-center gap-3 sm:justify-end">
            <span className="text-[12px] text-text-muted">Period</span>
            <div className="flex rounded-md border border-border bg-surface p-0.5" role="group" aria-label="Collection date range">
              {ranges.map((months) => (
                <button
                  key={months} type="button" aria-pressed={range === months} onClick={() => setRange(months)}
                  aria-label={`Show ${months} months`}
                  className={`focus-ring min-h-10 whitespace-nowrap rounded-sm px-3 py-2 text-[13px] transition-colors active:scale-[0.98] ${range === months ? "bg-text text-bg" : "text-text-muted hover:bg-surface-sunken hover:text-text"}`}
                >{months} Months</button>
              ))}
            </div>
          </div>
        </div>
        <p className="mt-2 text-[12px] text-text-muted">Finalized totals include Completed and Needs Review. Pending analyses are shown separately.</p>
      </section>
      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface px-4 py-3" role="alert">
          <p className="flex items-center gap-2 text-[13px] text-text-muted"><CloudOff size={16} strokeWidth={1.75} className="shrink-0" />{error}</p>
          <Button intent="secondary" size="sm" onClick={() => { setResult(null); setNow(new Date()); setAttempt((value) => value + 1); }}>Try Again</Button>
        </div>
      )}
      <DashboardStats summary={loaded ? summary : null} failed={Boolean(error)} />
      <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(18rem,1fr)]">
        <PollenCountChart
          data={loaded ? summary.monthly : []}
          range={range}
          status={status}
          emptyMessage={summary.collectionCount === 0 ? "No collections in this period." : "Collections recorded; no pollen grains counted in this period."}
        />
        <DashboardTopTypes summary={loaded ? summary : null} failed={Boolean(error)} />
      </div>
      {loaded && <DashboardRecentCollections collections={summary.recentCollections} />}
    </div>
  );
}

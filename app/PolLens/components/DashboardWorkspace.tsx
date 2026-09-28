"use client";

import { useEffect, useMemo, useState } from "react";
import { CloudOff } from "lucide-react";
import { buildDashboardSummary, type DashboardRange } from "@/lib/dashboard";
import { ALL_DASHBOARD_LOCATIONS, dashboardReportsHref, getDashboardLocationOptions } from "@/lib/dashboard-locations";
import { type Specimen } from "@/lib/data";
import { listReports } from "@/lib/store";
import { SessionExpiredError } from "@/lib/api";
import { useSettings } from "@/lib/settings";
import { Button } from "@/components/Button";
import DashboardStats from "@/components/DashboardStats";
import DashboardRecentCollections from "@/components/DashboardRecentCollections";
import DashboardTopPollenCounts from "@/components/DashboardTopPollenCounts";
import DashboardCollectionConditions from "@/components/DashboardCollectionConditions";
import { useSpeciesCatalog } from "@/lib/species-catalog";

type Result = { email: string; reports: Specimen[] | null; error: string | null };
const ranges: DashboardRange[] = [6, 12];

export default function DashboardWorkspace() {
  const { email } = useSettings();
  const catalog = useSpeciesCatalog();
  const [range, setRange] = useState<DashboardRange>(6);
  const [location, setLocation] = useState(ALL_DASHBOARD_LOCATIONS);
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
  const locations = useMemo(() => getDashboardLocationOptions(reports ?? []), [reports]);
  const activeLocation = [...locations.provinces, ...locations.locations].some((option) => option.value === location) ? location : ALL_DASHBOARD_LOCATIONS;
  const summary = useMemo(() => buildDashboardSummary(reports ?? [], range, now, activeLocation), [reports, range, now, activeLocation]);
  const loaded = reports !== null;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <section className="min-w-0" aria-label="Dashboard filters" aria-busy={!loaded && !error}>
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
          <label className="flex min-w-0 flex-col gap-1 text-[12px] text-text-muted sm:w-72">
            Location
            <select value={activeLocation} onChange={(event) => setLocation(event.target.value)} disabled={!loaded} className="focus-ring min-h-11 min-w-0 rounded-sm border border-border bg-surface px-3 text-[13px] text-text disabled:cursor-not-allowed disabled:opacity-50">
              <option value={ALL_DASHBOARD_LOCATIONS}>All Locations</option>
              {locations.provinces.length > 0 && <optgroup label="Provinces / Recorded Areas">{locations.provinces.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</optgroup>}
              {locations.locations.length > 0 && <optgroup label="Recorded Locations">{locations.locations.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</optgroup>}
            </select>
          </label>
          <div className="flex flex-col gap-1">
            <span className="text-[12px] text-text-muted">Period</span>
            <div className="flex rounded-sm border border-border bg-surface p-0.5" role="group" aria-label="Collection date range">
              {ranges.map((months) => (
                <button key={months} type="button" aria-pressed={range === months} onClick={() => setRange(months)} aria-label={`Show ${months} months`}
                  className={`focus-ring min-h-11 flex-1 whitespace-nowrap rounded-sm px-3 py-2 text-[13px] transition-colors active:scale-[0.98] ${range === months ? "bg-text text-bg" : "text-text-muted hover:bg-surface-sunken hover:text-text"}`}
                >{months} Months</button>
              ))}
            </div>
          </div>
        </div>
      </section>
      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-border bg-surface px-4 py-3" role="alert">
          <p className="flex items-center gap-2 text-[13px] text-text-muted"><CloudOff size={16} strokeWidth={1.75} className="shrink-0" aria-hidden="true" />{error}</p>
          <Button intent="secondary" size="sm" onClick={() => { setResult(null); setNow(new Date()); setAttempt((value) => value + 1); }}>Try Again</Button>
        </div>
      )}
      <DashboardStats summary={loaded ? summary : null} failed={Boolean(error)} />
      {loaded && summary.sampleCount > 0 && <p className="text-[12px] text-processing" role="note">Sample detections in {summary.sampleCount} {summary.sampleCount === 1 ? "collection" : "collections"}; pollen counts are illustrative.</p>}
      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(18rem,1fr)]">
        <DashboardRecentCollections collections={loaded ? summary.recentCollections : null} failed={Boolean(error)} catalog={catalog} reportsHref={dashboardReportsHref(summary, "Finalized")} />
        <DashboardTopPollenCounts summary={loaded ? summary : null} failed={Boolean(error)} catalog={catalog} />
      </div>
      <DashboardCollectionConditions summary={loaded ? summary : null} failed={Boolean(error)} />
    </div>
  );
}

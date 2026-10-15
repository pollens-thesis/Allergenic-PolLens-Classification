"use client";

import { useEffect, useMemo, useState } from "react";
import { CloudOff } from "lucide-react";
import {
  buildDashboardSummary,
  getCurrentDashboardHalf,
  getCurrentDashboardYear,
  getDashboardYearOptions,
  type DashboardHalf,
  type DashboardRange,
} from "@/lib/dashboard";
import { ALL_DASHBOARD_LOCATIONS, dashboardReportsHref, getDashboardLocationOptions } from "@/lib/dashboard-locations";
import { type Specimen } from "@/lib/data";
import { listReports } from "@/lib/store";
import { SessionExpiredError } from "@/lib/api";
import { useSettings } from "@/lib/settings";
import { Button } from "@/components/Button";
import DashboardStats from "@/components/DashboardStats";
import DashboardRecentCollections from "@/components/DashboardRecentCollections";
import DashboardTopPollenCounts from "@/components/DashboardTopPollenCounts";
import PollenTrendChart from "@/components/PollenTrendChart";
import { useSpeciesCatalog } from "@/lib/species-catalog";
import CollectionPeriodFilter from "@/components/CollectionPeriodFilter";

type Result = { email: string; reports: Specimen[] | null; error: string | null };

export default function DashboardWorkspace() {
  const { email } = useSettings();
  const catalog = useSpeciesCatalog();
  const [range, setRange] = useState<DashboardRange>(12);
  const [year, setYear] = useState(() => getCurrentDashboardYear());
  const [half, setHalf] = useState<DashboardHalf>(() => getCurrentDashboardHalf());
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
  const years = useMemo(() => getDashboardYearOptions(reports ?? [], now), [reports, now]);
  const activeYear = years.includes(year) ? year : getCurrentDashboardYear(now);
  const activeLocation = [...locations.provinces, ...locations.locations].some((option) => option.value === location) ? location : ALL_DASHBOARD_LOCATIONS;
  const summary = useMemo(
    () => buildDashboardSummary(reports ?? [], range, now, activeLocation, { year: activeYear, half }),
    [reports, range, now, activeLocation, activeYear, half],
  );
  const loaded = reports !== null;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <section className="min-w-0" aria-label="Dashboard filters" aria-busy={!loaded && !error}>
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:gap-4">
          <label className="flex min-w-0 flex-col gap-1 text-[12px] text-text-muted sm:w-40">
            Location
            <select value={activeLocation} onChange={(event) => setLocation(event.target.value)} disabled={!loaded} className="focus-ring min-h-11 min-w-0 rounded-sm border border-border bg-surface px-3 text-[13px] text-text disabled:cursor-not-allowed disabled:opacity-50">
              <option value={ALL_DASHBOARD_LOCATIONS}>All Locations</option>
              {locations.provinces.length > 0 && <optgroup label="Provinces / Recorded Areas">{locations.provinces.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</optgroup>}
              {locations.locations.length > 0 && <optgroup label="Recorded Locations">{locations.locations.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</optgroup>}
            </select>
          </label>
          <CollectionPeriodFilter
            year={activeYear}
            years={years}
            range={range}
            half={half}
            disabled={!loaded}
            onYearChange={setYear}
            onRangeChange={setRange}
            onHalfChange={setHalf}
          />
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
      <PollenTrendChart summary={loaded ? summary : null} failed={Boolean(error)} catalog={catalog} />
      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(18rem,1fr)]">
        <DashboardRecentCollections collections={loaded ? summary.recentCollections : null} failed={Boolean(error)} catalog={catalog} reportsHref={dashboardReportsHref(summary, "Finalized")} />
        <DashboardTopPollenCounts summary={loaded ? summary : null} failed={Boolean(error)} catalog={catalog} />
      </div>
    </div>
  );
}

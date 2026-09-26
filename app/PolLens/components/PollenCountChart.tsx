"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { AlertTriangle, Inbox } from "lucide-react";
import type { MonthlyPollenCount } from "@/lib/data";
import { speciesLabel } from "@/lib/data";
import { useSpeciesCatalog } from "@/lib/species-catalog";
import { fetchMonthlyPollenCounts } from "@/lib/backend";
import { useSettings } from "@/lib/settings";

/**
 * "loading" — first fetch in flight.
 * "live" — fetch succeeded with real, non-zero totals.
 * "empty-live" — fetch succeeded but there's genuinely nothing to plot yet.
 * "error" — fetch failed (keeps any data from an earlier successful fetch).
 * Distinguishing these is the point: a flat zero-line chart looks identical
 * to "broken" and to "no data yet".
 */
type Status = "loading" | "live" | "empty-live" | "error";

const RANGES = [
  { label: "6 Months", value: 6 },
  { label: "12 Months", value: 12 },
] as const;

// No categorical palette stays mutually distinguishable much past 8
// simultaneous lines (confirmed by the dataviz skill's own validator against
// this app's colors) — with 23 species now in the catalog, show only the
// most abundant ones in the visible window rather than all of them at once.
const MAX_LINES = 8;

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; name: string; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2 shadow-sm">
      <div className="caption-label text-[14.5px] mb-1" >
        {label}
      </div>
      <div className="flex flex-col gap-0.5">
        {payload.map((p) => (
          <div key={p.name} className="flex items-center gap-1.5 text-[13px] text-text/80">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.color }} />
            {p.name}: {p.value} {p.value === 1 ? "grain" : "grains"}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Grains counted per species per month over the trailing year, from the
 * server (Completed and Needs review reports). These are counts of detected grains, not an
 * airborne concentration — nothing here measures a sampled air volume.
 */
export default function PollenCountChart() {
  const [range, setRange] = useState<number>(12);
  const [data, setData] = useState<MonthlyPollenCount[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  // Keyed on who is signed in, not the access token — that rotates every 15
  // minutes and would refetch for nothing.
  const { email } = useSettings();
  const catalog = useSpeciesCatalog();
  const pollenSeries = useMemo(
    () => catalog.map((sp) => ({ key: sp.id, label: speciesLabel(sp), color: sp.color })),
    [catalog],
  );

  useEffect(() => {
    // The page is behind the session guard, so an email is always present
    // here; the guard is just for the first render before settings hydrate.
    if (!email) return;
    let cancelled = false;
    fetchMonthlyPollenCounts()
      .then((counts) => {
        if (cancelled) return;
        setData(counts);
        const total = counts.reduce(
          (sum, month) => sum + Object.values(month.series).reduce((a, b) => a + b, 0),
          0,
        );
        setStatus(total > 0 ? "live" : "empty-live");
        // (Whether the *visible* window is empty is decided at render time.)
      })
      .catch(() => {
        // Keep showing the last-known data — a failed refresh shouldn't blank the chart.
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [email]);

  const visible = useMemo(() => data.slice(-range), [data, range]);
  const visibleTotal = visible.reduce(
    (sum, month) => sum + Object.values(month.series).reduce((a, b) => a + b, 0),
    0,
  );
  // Counts older than six months leave the 6-month window empty.
  const empty = status === "empty-live" || (status === "live" && visibleTotal === 0);

  // Rank by total within the visible window so the busiest species (not an
  // arbitrary catalog subset) get the limited line slots; falls back to the
  // catalog's first MAX_LINES when everything is still zero (e.g. no reports
  // yet), so the chart isn't blank before any real data exists.
  const linesToShow = useMemo(() => {
    const totals = new Map(pollenSeries.map((s) => [s.key, 0]));
    for (const month of visible) {
      for (const s of pollenSeries) {
        totals.set(s.key, (totals.get(s.key) ?? 0) + (month.series[s.key] ?? 0));
      }
    }
    const withData = pollenSeries
      .filter((s) => (totals.get(s.key) ?? 0) > 0)
      .sort((a, b) => (totals.get(b.key) ?? 0) - (totals.get(a.key) ?? 0));
    return (withData.length > 0 ? withData : pollenSeries).slice(0, MAX_LINES);
  }, [visible, pollenSeries]);

  // How many types have grains in the window, to say when the chart shows only some of them.
  const typesWithGrains = pollenSeries.filter((s) =>
    visible.some((month) => (month.series[s.key] ?? 0) > 0),
  ).length;

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="t-plate-title text-text">
            Historical Pollen Counts
          </h2>
          <p className="text-[13px] text-text-muted">Grains counted in generated reports, by month</p>
        </div>
        <div className="flex rounded-md border border-border bg-surface p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setRange(r.value)}
              aria-pressed={range === r.value}
              className={`focus-ring rounded-sm px-2.5 py-1 text-[13px] transition-[transform,background-color,color] duration-[var(--duration-fast)] ease-[var(--ease-out)] active:scale-[0.97] ${
                range === r.value
                  ? "bg-text text-bg"
                  : "text-text-muted hover:bg-surface-sunken hover:text-text"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {status === "error" && data.length > 0 && (
        <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-text-muted">
          <AlertTriangle size={13} strokeWidth={1.75} className="shrink-0 text-processing" />
          Couldn&apos;t refresh — showing last known data.
        </p>
      )}

      {status === "loading" || (status === "error" && data.length === 0) ? (
        <div className="mt-3 flex h-56 flex-col items-center justify-center gap-1.5 rounded-md bg-surface-sunken text-center">
          <span className="px-3 text-[12.5px] text-text-muted">
            {status === "loading" ? "Loading monthly counts…" : "Couldn't reach the server to load the counts. Reload the page to try again."}
          </span>
        </div>
      ) : empty ? (
        <div className="mt-3 flex h-56 flex-col items-center justify-center gap-1.5 rounded-md bg-surface-sunken text-center">
          <Inbox size={18} strokeWidth={1.5} className="text-text-faint" />
          <span className="px-3 text-[12.5px] text-text-muted">
            No pollen counts recorded yet for this window.
          </span>
        </div>
      ) : (
        <>
          {/* The SVG below conveys nothing to assistive tech on its own; the
              sr-only table beside it is the real accessible data. */}
          <div className="mt-3" style={{ width: "100%", height: 320 }} aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%" debounce={1}>
              <LineChart data={visible} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: "var(--text-muted)", fontWeight: 500 }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "var(--text-muted)", fontWeight: 500 }}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="bottom"
                  height={32}
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 13, paddingTop: 8 }}
                  // Recharts colours the label to match its line, and some line
                  // colors read too light on white for legend text. The dot
                  // already carries the colour; the words only have to be readable.
                  formatter={(value) => <span style={{ color: "var(--text)" }}>{value}</span>}
                />
                {linesToShow.map((s) => (
                  <Line
                    key={s.key}
                    type="monotone"
                    dataKey={(entry: MonthlyPollenCount) => entry.series[s.key] ?? 0}
                    name={s.label}
                    stroke={s.color}
                    strokeWidth={2.25}
                    dot={{ r: 3, fill: s.color, strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {typesWithGrains > MAX_LINES && (
            <p className="mt-1 text-[13px] text-text-muted">
              Showing the {MAX_LINES} most-counted pollen types of {typesWithGrains} with grains in this window.
            </p>
          )}

          {/* Wrapped: a <table> ignores sr-only's 1px width and widened the page. */}
          <div className="sr-only">
          <table>
            <caption>
              Monthly pollen grain counts per species, trailing {range} months
            </caption>
            <thead>
              <tr>
                <th scope="col">Month</th>
                {linesToShow.map((s) => (
                  <th scope="col" key={s.key}>
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((month) => (
                <tr key={month.month}>
                  <th scope="row">{month.month}</th>
                  {linesToShow.map((s) => (
                    <td key={s.key}>{month.series[s.key] ?? 0} grains</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      )}
    </div>
  );
}
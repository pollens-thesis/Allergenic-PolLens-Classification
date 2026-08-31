"use client";

import { useEffect, useState } from "react";
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
import type { MonthlyPollenCount } from "@/lib/data";
import { fetchMonthlyPollenCounts, pollenSeries } from "@/lib/data";
import { useSettings } from "@/lib/settings";

const RANGES = [
  { label: "6 months", value: 6 },
  { label: "12 months", value: 12 },
] as const;

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
    <div className="rounded-md border border-panel-line bg-white px-3 py-2 shadow-sm">
      <div className="mb-1 text-[12px] tracking-widest text-ink/65 uppercase" style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
        {label}
      </div>
      <div className="flex flex-col gap-0.5">
        {payload.map((p) => (
          <div key={p.name} className="flex items-center gap-1.5 text-[13px] text-ink/80">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.color }} />
            {p.name}: {p.value} grains/m&sup3;
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Starts from the server-rendered seed months, then swaps in the real
 * per-species counts once fetched — mirrors DashboardStats's `initial` +
 * background-refresh pattern. Keeps showing the seed if the fetch fails
 * (e.g. signed out, backend unreachable) rather than clearing the chart.
 */
export default function PollenCountChart({ initial }: { initial: MonthlyPollenCount[] }) {
  const [range, setRange] = useState<number>(12);
  const [data, setData] = useState<MonthlyPollenCount[]>(initial);
  const { accessToken } = useSettings();

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    fetchMonthlyPollenCounts(accessToken)
      .then((counts) => {
        if (!cancelled) setData(counts);
      })
      .catch(() => {
        // Keep showing the seed data — a failed refresh shouldn't blank the chart.
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const visible = data.slice(-range);

  return (
    <div className="rounded-lg border border-panel-line bg-white/60 p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg text-ink" style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>
            Historical pollen counts
          </h2>
          <p className="text-[13px] text-ink/70">Average grains per m&sup3;, by month</p>
        </div>
        <div className="flex rounded-md border border-panel-line bg-white p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setRange(r.value)}
              className={`focus-ring rounded-[5px] px-2.5 py-1 text-[13px] transition ${
                range === r.value ? "bg-ink text-parchment" : "text-ink/70 hover:text-ink"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3" style={{ width: "100%", height: 320 }}>
        <ResponsiveContainer width="100%" height="100%" debounce={1}>
          <LineChart data={visible} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
            <CartesianGrid stroke="var(--panel-line)" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 12, fill: "#1c2a20b3", fontWeight: 500 }}
              tickLine={false}
              axisLine={{ stroke: "var(--panel-line)" }}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "#1c2a20b3", fontWeight: 500 }}
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
              // Recharts colours the label to match its line, which puts
              // Alnus's gold at 1.75:1 on white. The dot already carries the
              // colour; the words only have to be readable.
              formatter={(value) => <span style={{ color: "#1c2a20cc" }}>{value}</span>}
            />
            {pollenSeries.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={2.25}
                dot={{ r: 3, fill: s.color, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
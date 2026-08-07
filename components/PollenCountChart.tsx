"use client";

import { useState } from "react";
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
import { pollenSeries } from "@/lib/data";

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
      <div className="mb-1 text-[11px] tracking-widest text-ink/45 uppercase" style={{ fontFamily: "var(--font-mono)" }}>
        {label}
      </div>
      <div className="flex flex-col gap-0.5">
        {payload.map((p) => (
          <div key={p.name} className="flex items-center gap-1.5 text-[12px] text-ink/80">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.color }} />
            {p.name}: {p.value} grains/m&sup3;
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PollenCountChart({ data }: { data: MonthlyPollenCount[] }) {
  const [range, setRange] = useState<number>(12);
  const visible = data.slice(-range);

  return (
    <div className="rounded-lg border border-panel-line bg-white/60 p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg text-ink" style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}>
            Historical pollen counts
          </h2>
          <p className="text-[12.5px] text-ink/50">Average grains per m&sup3;, by month</p>
        </div>
        <div className="flex rounded-md border border-panel-line bg-white p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setRange(r.value)}
              className={`focus-ring rounded-[5px] px-2.5 py-1 text-[12px] transition ${
                range === r.value ? "bg-ink text-parchment" : "text-ink/55 hover:text-ink"
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
              tick={{ fontSize: 11, fill: "#1c2a2099" }}
              tickLine={false}
              axisLine={{ stroke: "var(--panel-line)" }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#1c2a2099" }}
              tickLine={false}
              axisLine={false}
              width={36}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="bottom"
              height={32}
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12.5, color: "#1c2a20cc", paddingTop: 8 }}
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
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardSummary } from "@/lib/dashboard";
import {
  additionalSpeciesNames,
  CLASSIFIER_SPECIES_IDS,
  researchSpeciesName,
} from "@/lib/species-names";
import type { Species, SpeciesId } from "@/lib/data";
import { pollenTrendColor } from "@/lib/pollen-trend-colors";
import { findSpecies } from "@/lib/species-catalog";
import { SampleBadge } from "@/components/StatusBadge";

const DASH_PATTERNS = ["", "7 3", "2 2", "9 3 2 3", "1 3", "12 4"];

function formatMonth(monthKey: string, incompleteMonth?: string) {
  const date = new Date(`${monthKey}-01T00:00:00.000Z`);
  const label = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
  return monthKey === incompleteMonth ? `${label} (so far)` : label;
}

function formatTick(monthKey: string) {
  const date = new Date(`${monthKey}-01T00:00:00.000Z`);
  const month = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(date);
  return `${month} '${monthKey.slice(2, 4)}`;
}

function formatCount(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
  if (value >= 10_000) return `${Math.round(value / 1_000)}k`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return value.toLocaleString();
}

function speciesOtherNames(species: Species): string[] {
  return [
    researchSpeciesName(species),
    ...additionalSpeciesNames(species).split(" · ").filter(Boolean),
  ];
}

function speciesTrendLabel(species: Species): string {
  return `${species.scientificName} (${speciesOtherNames(species).join(" · ")})`;
}

function TrendSpeciesName({ species }: { species: Species }) {
  return (
    <span className="block min-w-0 break-words">
      <i className="t-binomial">{species.scientificName}</i>
      <span className="mt-0.5 block text-[12px] leading-snug text-text-muted">
        {speciesOtherNames(species).join(" · ")}
      </span>
    </span>
  );
}

export default function PollenTrendChart({
  summary,
  failed,
  catalog,
  detailed = false,
}: {
  summary: DashboardSummary | null;
  failed: boolean;
  catalog: Species[];
  detailed?: boolean;
}) {
  const supportedSpecies = useMemo(
    () => catalog.filter((species) => CLASSIFIER_SPECIES_IDS.has(species.id)),
    [catalog],
  );
  const rankedSpecies = useMemo(() => {
    const totals = new Map<SpeciesId, number>();
    for (const species of supportedSpecies) {
      totals.set(
        species.id,
        summary?.monthlyGrainCounts.reduce(
          (total, month) => total + (month.series[species.id] ?? 0),
          0,
        ) ?? 0,
      );
    }
    return [...supportedSpecies].sort(
      (a, b) => (totals.get(b.id)! - totals.get(a.id)!) || a.scientificName.localeCompare(b.scientificName),
    );
  }, [summary, supportedSpecies]);
  const defaultSelection = rankedSpecies.slice(0, detailed ? 5 : 4).map((species) => species.id);
  const [selection, setSelection] = useState<SpeciesId[] | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(detailed);
  const selectedIds = selection ?? defaultSelection;
  const selectedSpecies = supportedSpecies.filter((species) => selectedIds.includes(species.id));
  const points = useMemo(
    () => (summary?.monthlyGrainCounts ?? []).map((month) => ({
      monthKey: month.monthKey,
      collectionCount: month.collectionCount,
      ...month.series,
    })),
    [summary],
  );
  const selectedGrainCount = points.reduce(
    (total, point) => total + selectedSpecies.reduce(
      (monthTotal, species) => monthTotal + (point[species.id] ?? 0),
      0,
    ),
    0,
  );
  function toggleSpecies(speciesId: SpeciesId, checked: boolean) {
    const current = selection ?? defaultSelection;
    setSelection(
      checked
        ? [...new Set([...current, speciesId])]
        : current.filter((id) => id !== speciesId),
    );
  }

  const title = detailed ? "Monthly Grain Counts" : "Pollen Trends";

  return (
    <section
      className="card-panel min-w-0 p-4 sm:p-5"
      aria-labelledby="pollen-trend-heading"
      aria-busy={!summary && !failed}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="pollen-trend-heading" className="t-plate-title text-text">{title}</h2>
          {Boolean(summary?.sampleCount) && <SampleBadge />}
        </div>
        {!detailed && (
          <Link
            href="/trends"
            className="focus-ring min-h-11 rounded-sm py-2 text-[13px] text-text underline decoration-border-strong underline-offset-4 hover:text-text-muted"
          >
            View detailed trends
          </Link>
        )}
      </div>
      {!summary ? (
        failed ? (
          <p className="py-10 text-[13px] text-text-muted">Pollen trends are unavailable. Try reloading the dashboard data.</p>
        ) : (
          <div role="status" aria-label="Loading pollen trends" className="mt-5 h-64 animate-pulse rounded-sm bg-surface-sunken" />
        )
      ) : summary.collectionCount === 0 ? (
        <p className="py-10 text-[13px] text-text-muted">No verified collections in this location and period.</p>
      ) : supportedSpecies.length === 0 ? (
        <p className="py-10 text-[13px] text-text-muted">The current pollen reference could not be loaded.</p>
      ) : (
        <>
          <div className="mt-4 border-y border-border py-2.5">
            <button
              type="button"
              aria-expanded={filtersOpen}
              aria-controls="pollen-trend-species-filter"
              onClick={() => setFiltersOpen((open) => !open)}
              className="focus-ring flex min-h-11 w-full flex-wrap items-center justify-between gap-2 rounded-sm text-left text-[13px] text-text"
            >
              <span>Filter pollen types</span>
              <span className="text-[12px] text-text-muted">
                {selectedIds.length} of {supportedSpecies.length} selected
              </span>
            </button>
            {filtersOpen && (
              <div id="pollen-trend-species-filter" className="pb-2 pt-1">
                <div className="mb-2 flex gap-4 text-[12px]">
                  <button
                    type="button"
                    onClick={() => setSelection(supportedSpecies.map((species) => species.id))}
                    className="focus-ring min-h-9 rounded-sm text-text underline underline-offset-4"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelection([])}
                    className="focus-ring min-h-9 rounded-sm text-text-muted underline underline-offset-4"
                  >
                    Clear
                  </button>
                </div>
                <fieldset>
                  <legend className="sr-only">Species shown in the pollen trend chart</legend>
                  <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2 xl:grid-cols-3">
                    {supportedSpecies.map((species) => (
                      <label
                        key={species.id}
                        className="flex min-h-10 min-w-0 cursor-pointer items-center gap-2 rounded-sm px-1 text-[12px] text-text hover:bg-surface-sunken"
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(species.id)}
                          onChange={(event) => toggleSpecies(species.id, event.target.checked)}
                          className="h-4 w-4 shrink-0 accent-current"
                          style={{ accentColor: pollenTrendColor(species.id, species.color) }}
                        />
                        <span
                          aria-hidden="true"
                          className="w-4 shrink-0 border-t-2"
                          style={{
                            borderColor: pollenTrendColor(species.id, species.color),
                            borderTopStyle: (DASH_PATTERNS[[...CLASSIFIER_SPECIES_IDS].indexOf(species.id) % DASH_PATTERNS.length] || "")
                              ? "dashed"
                              : "solid",
                          }}
                        />
                        <span className="min-w-0 flex-1">
                          <TrendSpeciesName species={species} />
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
            )}
          </div>

          {selectedIds.length === 0 ? (
            <p className="py-10 text-[13px] text-text-muted">Choose at least one pollen type to display its trend.</p>
          ) : selectedGrainCount === 0 ? (
            <p className="py-10 text-[13px] text-text-muted">No grains from the selected pollen types were recorded in this location and period.</p>
          ) : (
            <>
              <div
                role="img"
                aria-label={`Monthly grain counts for ${selectedSpecies.map(speciesTrendLabel).join(", ")}`}
                className={`mt-4 w-full ${detailed ? "h-[22rem] sm:h-[25rem]" : "h-[18rem] sm:h-[20rem]"}`}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={points} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
                    <XAxis
                      dataKey="monthKey"
                      tickFormatter={formatTick}
                      tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: "var(--border)" }}
                      minTickGap={18}
                    />
                    <YAxis
                      allowDecimals={false}
                      tickFormatter={formatCount}
                      tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      width={48}
                    />
                    <Tooltip
                      labelFormatter={(label) => formatMonth(String(label), summary.currentMonthKey)}
                      formatter={(value, name) => [
                        `${Number(value ?? 0).toLocaleString()} grains`,
                        speciesTrendLabel(findSpecies(catalog, String(name) as SpeciesId)),
                      ]}
                      contentStyle={{
                        backgroundColor: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: "2px",
                        color: "var(--text)",
                        fontSize: "12px",
                      }}
                      labelStyle={{ color: "var(--text)", fontWeight: 600, marginBottom: 5 }}
                      itemStyle={{ color: "var(--text-muted)" }}
                      cursor={{ stroke: "var(--border-strong)", strokeDasharray: "3 3" }}
                    />
                    {selectedSpecies.map((species) => {
                      const dash = DASH_PATTERNS[[...CLASSIFIER_SPECIES_IDS].indexOf(species.id) % DASH_PATTERNS.length];
                      return (
                        <Line
                          key={species.id}
                          type="monotone"
                          dataKey={species.id}
                          name={species.id}
                          stroke={pollenTrendColor(species.id, species.color)}
                          strokeWidth={2}
                          strokeDasharray={dash || undefined}
                          dot={false}
                          activeDot={{ r: 4, strokeWidth: 1 }}
                          isAnimationActive={false}
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <ul aria-label="Chart legend" className="mt-2 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-3">
                {selectedSpecies.map((species) => {
                  const patternIndex = [...CLASSIFIER_SPECIES_IDS].indexOf(species.id);
                  const dash = DASH_PATTERNS[patternIndex % DASH_PATTERNS.length];
                  return (
                    <li key={species.id} className="flex min-w-0 max-w-64 items-start gap-2 text-[12px] text-text-muted">
                      <span
                        aria-hidden="true"
                        className="w-5 shrink-0 border-t-2"
                        style={{
                          borderColor: pollenTrendColor(species.id, species.color),
                          borderTopStyle: dash ? (patternIndex % DASH_PATTERNS.length === 4 ? "dotted" : "dashed") : "solid",
                        }}
                      />
                      <TrendSpeciesName species={species} />
                    </li>
                  );
                })}
              </ul>
              {detailed && (
                <div className="mt-5 border-t border-border pt-4">
                  <h3 className="t-plate-title text-text">Monthly Counts by Pollen Type</h3>
                  <div
                    className="focus-ring mt-3 max-w-full overflow-auto rounded-sm"
                    role="region"
                    aria-label="Monthly pollen grain counts, scroll horizontally for months"
                    tabIndex={0}
                  >
                    <table
                      className="w-full table-fixed border-separate border-spacing-0 text-left"
                      style={{ minWidth: `${200 + summary.monthlyGrainCounts.length * 80}px` }}
                    >
                      <caption className="sr-only">
                        Verified grain counts per selected pollen type and collection month.
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col" className="sticky top-0 left-0 z-20 w-48 border-r border-b border-border bg-surface px-3 py-2 text-[12px] font-medium text-text-muted">
                            Pollen Type
                          </th>
                          {summary.monthlyGrainCounts.map((month) => (
                            <th key={month.monthKey} scope="col" className="sticky top-0 z-10 border-b border-border bg-surface px-2 py-2 text-right text-[12px] font-medium text-text">
                              {formatTick(month.monthKey)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {selectedSpecies.map((species) => (
                          <tr key={species.id}>
                            <th scope="row" className="sticky left-0 z-10 border-r border-b border-border bg-surface px-3 py-2 font-normal">
                              <TrendSpeciesName species={species} />
                            </th>
                            {summary.monthlyGrainCounts.map((month) => (
                              <td key={month.monthKey} className="border-b border-border px-2 py-2 text-right text-[13px] tabular-nums text-text">
                                {month.series[species.id] === null ? "—" : (month.series[species.id] ?? 0).toLocaleString()}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}

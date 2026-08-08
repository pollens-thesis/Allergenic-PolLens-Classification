"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, MapPin, Microscope, X } from "lucide-react";
import {
  formatCollectedAt,
  getSpecies,
  getWeightedAvgConfidence,
  speciesCatalog,
  type Specimen,
  type SpeciesId,
} from "@/lib/data";
import { listReports } from "@/lib/store";
import {
  BOUNDARIES_URL,
  INTENSITY_RAMP,
  UNSAMPLED_FILL,
  aggregateBySite,
  centroid,
  describeTopPollen,
  fitProjection,
  intensityIndex,
  normalizeMunicipality,
  toPath,
  type Boundaries,
  type SiteStats,
} from "@/lib/geo";

const fieldClass =
  "focus-ring rounded-md border border-panel-line bg-white px-3 py-2 text-[13px] text-ink";

export default function PollenMap() {
  const [reports, setReports] = useState<Specimen[] | null>(null);
  const [boundaries, setBoundaries] = useState<Boundaries | null>(null);
  const [failed, setFailed] = useState(false);
  const [species, setSpecies] = useState<SpeciesId | "all">("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      listReports(),
      fetch(BOUNDARIES_URL).then((r) => {
        if (!r.ok) throw new Error(`boundaries ${r.status}`);
        return r.json() as Promise<Boundaries>;
      }),
    ])
      .then(([loadedReports, loadedBoundaries]) => {
        if (cancelled) return;
        setReports(loadedReports);
        setBoundaries(loadedBoundaries);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sites = useMemo(
    () => (reports ? aggregateBySite(reports, species) : new Map<string, SiteStats>()),
    [reports, species],
  );

  const projection = useMemo(
    () => (boundaries ? fitProjection(boundaries.features) : null),
    [boundaries],
  );

  const maxGrains = useMemo(
    () => Math.max(0, ...[...sites.values()].map((s) => s.totalGrains)),
    [sites],
  );

  /** Sites with data but no polygon — drawn as points. */
  const pointSites = useMemo(() => [...sites.values()].filter((s) => s.point), [sites]);

  const ranked = useMemo(
    () => [...sites.values()].sort((a, b) => b.totalGrains - a.totalGrains),
    [sites],
  );

  const selectedSite = selected ? (sites.get(selected) ?? null) : null;
  const selectedLabel =
    selectedSite?.label ??
    boundaries?.features.find((f) => normalizeMunicipality(f.properties.name) === selected)
      ?.properties.name ??
    null;

  if (failed) {
    return (
      <div className="rounded-lg border border-panel-line bg-white/60 px-6 py-16 text-center text-[13px] text-ink/55">
        Could not load the municipality boundaries.
      </div>
    );
  }

  if (!reports || !boundaries || !projection) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border border-panel-line bg-white/60 px-6 py-16 text-[13px] text-ink/45">
        <Loader2 size={16} strokeWidth={1.75} className="animate-spin" />
        Loading map…
      </div>
    );
  }

  const activeLabel =
    species === "all" ? "all pollen" : `${getSpecies(species).genus} pollen`;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
      {/* Map */}
      <div className="rounded-lg border border-panel-line bg-white/60 p-5 xl:col-span-3">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg text-ink" style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}>
              Quezon Province
            </h2>
            <p className="mt-0.5 text-[12.5px] text-ink/50">
              Shaded by grains of {activeLabel}. Select a town for its breakdown.
            </p>
          </div>
          <label className="shrink-0">
            <span className="sr-only">Pollen type</span>
            <select
              value={species}
              onChange={(e) => setSpecies(e.target.value as SpeciesId | "all")}
              className={fieldClass}
            >
              <option value="all">All pollen</option>
              {speciesCatalog.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.genus} ({s.commonName})
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="rounded-lg bg-[#faf7f0] p-2">
          <svg
            viewBox={`0 0 ${projection.width} ${projection.height}`}
            className="h-auto w-full"
            role="img"
            aria-label={`Map of Quezon Province shaded by ${activeLabel}`}
          >
            {boundaries.features.map((feature) => {
              const key = normalizeMunicipality(feature.properties.name);
              const site = sites.get(key);
              const grains = site?.totalGrains ?? 0;
              const sampled = site !== undefined;
              const isActive = selected === key || hovered === key;

              return (
                <path
                  key={feature.properties.psgc}
                  d={toPath(feature, projection)}
                  fill={sampled ? INTENSITY_RAMP[intensityIndex(grains, maxGrains)] : UNSAMPLED_FILL}
                  stroke={isActive ? "#23261f" : "#cfc9ba"}
                  strokeWidth={isActive ? 2.5 : 0.8}
                  className={sampled ? "cursor-pointer" : "cursor-default"}
                  onMouseEnter={() => setHovered(key)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => sampled && setSelected(key)}
                >
                  <title>
                    {feature.properties.name}
                    {sampled
                      ? ` — ${grains} ${grains === 1 ? "grain" : "grains"}, ${site.reportCount} ${site.reportCount === 1 ? "report" : "reports"}`
                      : " — not sampled"}
                  </title>
                </path>
              );
            })}

            {/* Sites with no polygon in the provincial dataset. */}
            {pointSites.map((site) => {
              const [x, y] = projection.project(site.point!.lon, site.point!.lat);
              const isActive = selected === site.key || hovered === site.key;
              return (
                <g
                  key={site.key}
                  className="cursor-pointer"
                  onMouseEnter={() => setHovered(site.key)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => setSelected(site.key)}
                >
                  <circle
                    cx={x}
                    cy={y}
                    r={isActive ? 13 : 10}
                    fill={INTENSITY_RAMP[intensityIndex(site.totalGrains, maxGrains)]}
                    stroke={isActive ? "#23261f" : "#8a8577"}
                    strokeWidth={isActive ? 2.5 : 1.5}
                  />
                  <title>
                    {site.label} — {site.totalGrains}{" "}
                    {site.totalGrains === 1 ? "grain" : "grains"}, {site.reportCount}{" "}
                    {site.reportCount === 1 ? "report" : "reports"}
                  </title>
                </g>
              );
            })}

            {/* Labels only for sampled places, so the map stays readable. */}
            {boundaries.features.map((feature) => {
              const key = normalizeMunicipality(feature.properties.name);
              if (!sites.has(key)) return null;
              const [x, y] = centroid(feature, projection);
              return (
                <text
                  key={`label-${feature.properties.psgc}`}
                  x={x}
                  y={y}
                  textAnchor="middle"
                  className="pointer-events-none"
                  style={{ fontFamily: "var(--font-mono)", fontSize: 13, fill: "#23261f" }}
                >
                  {feature.properties.name.replace(/^City of\s+/, "")}
                </text>
              );
            })}
            {pointSites.map((site) => {
              const [x, y] = projection.project(site.point!.lon, site.point!.lat);
              return (
                <text
                  key={`label-${site.key}`}
                  x={x}
                  y={y + 26}
                  textAnchor="middle"
                  className="pointer-events-none"
                  style={{ fontFamily: "var(--font-mono)", fontSize: 13, fill: "#23261f" }}
                >
                  {site.label}
                </text>
              );
            })}
          </svg>
        </div>

        {/* Legend */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11.5px] text-ink/55">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-4 rounded-sm border border-panel-line" style={{ background: UNSAMPLED_FILL }} />
            Not sampled
          </span>
          <span className="flex items-center gap-1.5">
            Fewer grains
            {INTENSITY_RAMP.map((colour) => (
              <span
                key={colour}
                className="h-3 w-4 rounded-sm border border-panel-line"
                style={{ background: colour }}
              />
            ))}
            More
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full border border-[#8a8577]" style={{ background: INTENSITY_RAMP[3] }} />
            Independent city (no provincial polygon)
          </span>
        </div>
      </div>

      {/* Selected town / ranking */}
      <div className="rounded-lg border border-panel-line bg-white/60 p-5 xl:col-span-2">
        {selectedSite && selectedLabel ? (
          <div>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div
                  className="text-[11px] tracking-widest text-ink/45 uppercase"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  Selected town
                </div>
                <h2
                  className="truncate text-xl text-ink"
                  style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}
                >
                  {selectedLabel}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Clear selection"
                className="focus-ring flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink/40 transition hover:bg-panel hover:text-ink"
              >
                <X size={14} strokeWidth={1.75} />
              </button>
            </div>

            <div className="mb-4 grid grid-cols-3 gap-3 rounded-md bg-panel/60 px-3 py-3 text-center">
              <div>
                <div className="text-[17px] text-ink" style={{ fontFamily: "var(--font-mono)" }}>
                  {selectedSite.totalGrains}
                </div>
                <div className="text-[11px] text-ink/45">Grains</div>
              </div>
              <div>
                <div className="text-[17px] text-ink" style={{ fontFamily: "var(--font-mono)" }}>
                  {selectedSite.reportCount}
                </div>
                <div className="text-[11px] text-ink/45">
                  {selectedSite.reportCount === 1 ? "Report" : "Reports"}
                </div>
              </div>
              <div>
                <div className="text-[17px] text-ink" style={{ fontFamily: "var(--font-mono)" }}>
                  {Math.round(getWeightedAvgConfidence(selectedSite.detections) * 100)}%
                </div>
                <div className="text-[11px] text-ink/45">Avg. conf.</div>
              </div>
            </div>

            <h3
              className="mb-2 text-[11px] tracking-[0.2em] text-ink/45 uppercase"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Most pollen detected here
            </h3>
            {selectedSite.detections.length === 0 ? (
              <p className="rounded-md border border-panel-line bg-white px-3 py-4 text-center text-[12.5px] text-ink/50">
                No {activeLabel} recorded at this site.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {selectedSite.detections.map((detection) => {
                  const s = getSpecies(detection.speciesId);
                  const share = selectedSite.totalGrains
                    ? detection.grainCount / selectedSite.totalGrains
                    : 0;
                  return (
                    <li key={detection.speciesId} className="rounded-md border border-panel-line bg-white px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            aria-hidden
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: s.color }}
                          />
                          <span className="truncate text-[13.5px] text-ink">{s.genus}</span>
                          <span className="truncate text-[12px] text-ink/50">{s.commonName}</span>
                        </span>
                        <span className="shrink-0 text-[13px] text-ink" style={{ fontFamily: "var(--font-mono)" }}>
                          {detection.grainCount}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-panel-line">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${share * 100}%`, backgroundColor: s.color }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {selectedSite.lastCollectedAt && (
              <p className="mt-3 text-[11.5px] text-ink/45">
                Last collected {formatCollectedAt(selectedSite.lastCollectedAt)}
              </p>
            )}
            <Link
              href={`/history?q=${encodeURIComponent(selectedLabel)}`}
              className="focus-ring mt-3 flex items-center justify-center gap-2 rounded-md border border-panel-line bg-white px-3 py-2 text-[13px] text-ink/70 transition hover:text-ink"
            >
              <Microscope size={14} strokeWidth={1.75} />
              View reports from {selectedLabel}
            </Link>
          </div>
        ) : (
          <div>
            <h2 className="text-lg text-ink" style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}>
              Hotzones
            </h2>
            <p className="mt-0.5 mb-4 text-[12.5px] text-ink/50">
              Sampled towns ranked by grains of {activeLabel}. Select one for its full breakdown.
            </p>

            {ranked.length === 0 ? (
              <p className="rounded-md border border-panel-line bg-white px-3 py-6 text-center text-[12.5px] text-ink/50">
                No reports yet — analyze a specimen to put a town on the map.
              </p>
            ) : (
              <ol className="flex flex-col gap-2">
                {ranked.map((site, index) => (
                  <li key={site.key}>
                    <button
                      type="button"
                      onClick={() => setSelected(site.key)}
                      onMouseEnter={() => setHovered(site.key)}
                      onMouseLeave={() => setHovered(null)}
                      className="focus-ring flex w-full items-center gap-3 rounded-md border border-panel-line bg-white px-3 py-2.5 text-left transition hover:border-ink/25"
                    >
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] text-ink/70"
                        style={{
                          background: INTENSITY_RAMP[intensityIndex(site.totalGrains, maxGrains)],
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <MapPin size={12} strokeWidth={1.75} className="shrink-0 text-ink/30" />
                          <span className="truncate text-[13.5px] text-ink">{site.label}</span>
                        </span>
                        <span className="mt-0.5 block truncate text-[11.5px] text-ink/50">
                          {describeTopPollen(site.detections)}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-[14px] text-ink" style={{ fontFamily: "var(--font-mono)" }}>
                          {site.totalGrains}
                        </span>
                        <span className="block text-[10.5px] text-ink/45">grains</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Loader2, MapPin, Microscope, X } from "lucide-react";
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
  INTENSITY_RAMP,
  PROVINCES_URL,
  UNSAMPLED_FILL,
  aggregate,
  centroid,
  describeTopPollen,
  featureKey,
  fitProjection,
  intensityIndex,
  municipalitiesUrl,
  toPath,
  type GeoCollection,
  type GeoFeature,
  type PlaceStats,
} from "@/lib/geo";

const fieldClass =
  "focus-ring rounded-md border border-panel-line bg-white px-3 py-2 text-[13px] text-ink";

type Scope =
  | { level: "country" }
  | { level: "province"; key: string; psgc: number; name: string };

export default function PollenMap() {
  const [reports, setReports] = useState<Specimen[] | null>(null);
  const [provinces, setProvinces] = useState<GeoCollection | null>(null);
  const [failed, setFailed] = useState(false);

  const [scope, setScope] = useState<Scope>({ level: "country" });
  // Keyed by the province it belongs to, so which province is loaded — and
  // therefore whether we are still waiting — is derived rather than tracked in
  // its own state that an effect would have to keep in sync.
  const [towns, setTowns] = useState<{ psgc: number; data: GeoCollection | null } | null>(null);

  const [species, setSpecies] = useState<SpeciesId | "all">("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      listReports(),
      fetch(PROVINCES_URL).then((r) => {
        if (!r.ok) throw new Error(`provinces ${r.status}`);
        return r.json() as Promise<GeoCollection>;
      }),
    ])
      .then(([loadedReports, loadedProvinces]) => {
        if (cancelled) return;
        setReports(loadedReports);
        setProvinces(loadedProvinces);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const provincePsgc = scope.level === "province" ? scope.psgc : null;

  // A province's towns are fetched only when it is opened — one ~40 KB file.
  useEffect(() => {
    if (provincePsgc === null) return;
    let cancelled = false;
    fetch(municipalitiesUrl(provincePsgc))
      .then((r) => (r.ok ? (r.json() as Promise<GeoCollection>) : null))
      .then((data) => !cancelled && setTowns({ psgc: provincePsgc, data }))
      .catch(() => !cancelled && setTowns({ psgc: provincePsgc, data: null }));
    return () => {
      cancelled = true;
    };
  }, [provincePsgc]);

  const loadedTowns = towns?.psgc === provincePsgc ? towns.data : null;
  const loadingTowns = provincePsgc !== null && towns?.psgc !== provincePsgc;

  const places = useMemo(() => {
    if (!reports) return new Map<string, PlaceStats>();
    return aggregate(
      reports,
      species,
      scope.level === "country" ? { level: "country" } : { level: "province", provinceKey: scope.key },
    );
  }, [reports, species, scope]);

  const features: GeoFeature[] = useMemo(() => {
    if (scope.level === "country") return provinces?.features ?? [];
    return loadedTowns?.features ?? [];
  }, [scope, provinces, loadedTowns]);

  const projection = useMemo(
    () => (features.length ? fitProjection(features) : null),
    [features],
  );

  const maxGrains = useMemo(
    () => Math.max(0, ...[...places.values()].map((p) => p.totalGrains)),
    [places],
  );

  const ranked = useMemo(
    () => [...places.values()].sort((a, b) => b.totalGrains - a.totalGrains),
    [places],
  );

  /** Sampled places with no polygon on the current view — drawn as points. */
  const pointPlaces = useMemo(() => ranked.filter((p) => p.point), [ranked]);

  /** Sampled places we cannot place at all, so the map never silently lies. */
  const unmapped = useMemo(() => {
    if (!projection) return [];
    const drawable = new Set(features.map(featureKey));
    return ranked.filter((p) => !drawable.has(p.key) && !p.point);
  }, [ranked, features, projection]);

  const selectedPlace = selected ? (places.get(selected) ?? null) : null;

  function openProvince(feature: GeoFeature) {
    setScope({
      level: "province",
      key: featureKey(feature),
      psgc: feature.properties.psgc,
      name: feature.properties.name,
    });
    setSelected(null);
  }

  function backToCountry() {
    setScope({ level: "country" });
    setSelected(null);
  }

  if (failed) {
    return (
      <div className="rounded-lg border border-panel-line bg-white/60 px-6 py-16 text-center text-[13px] text-ink/55">
        Could not load the boundary data.
      </div>
    );
  }

  if (!reports || !provinces || !projection) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border border-panel-line bg-white/60 px-6 py-16 text-[13px] text-ink/45">
        <Loader2 size={16} strokeWidth={1.75} className="animate-spin" />
        Loading map…
      </div>
    );
  }

  const activeLabel = species === "all" ? "all pollen" : `${getSpecies(species).genus} pollen`;
  const unitPlural = scope.level === "country" ? "provinces" : "towns";

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
      {/* Map */}
      <div className="rounded-lg border border-panel-line bg-white/60 p-5 xl:col-span-3">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {scope.level === "province" && (
              <button
                type="button"
                onClick={backToCountry}
                className="focus-ring mb-1 inline-flex items-center gap-1 rounded text-[12px] text-ink/55 transition hover:text-ink"
              >
                <ChevronLeft size={13} strokeWidth={1.75} />
                Philippines
              </button>
            )}
            <h2 className="text-lg text-ink" style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}>
              {scope.level === "country" ? "Philippines" : scope.name}
            </h2>
            <p className="mt-0.5 text-[12.5px] text-ink/50">
              {scope.level === "country"
                ? `Provinces shaded by grains of ${activeLabel}. Select one to see its towns.`
                : `Towns shaded by grains of ${activeLabel}.`}
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

        <div className="relative rounded-lg bg-[#faf7f0] p-2">
          {loadingTowns && (
            <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-lg bg-[#faf7f0]/80 text-[13px] text-ink/50">
              <Loader2 size={15} strokeWidth={1.75} className="animate-spin" />
              Loading towns…
            </div>
          )}
          <svg
            viewBox={`0 0 ${projection.width} ${projection.height}`}
            className="h-auto max-h-[70vh] w-full"
            role="img"
            aria-label={`Map of ${scope.level === "country" ? "the Philippines" : scope.name} shaded by ${activeLabel}`}
          >
            {features.map((feature) => {
              const key = featureKey(feature);
              const place = places.get(key);
              const grains = place?.totalGrains ?? 0;
              const sampled = place !== undefined;
              const isActive = selected === key || hovered === key;
              const clickable = scope.level === "country" || sampled;

              return (
                <path
                  key={feature.properties.psgc}
                  d={toPath(feature, projection)}
                  fill={sampled ? INTENSITY_RAMP[intensityIndex(grains, maxGrains)] : UNSAMPLED_FILL}
                  stroke={isActive ? "#23261f" : "#cfc9ba"}
                  strokeWidth={isActive ? 2 : 0.6}
                  className={clickable ? "cursor-pointer" : "cursor-default"}
                  onMouseEnter={() => setHovered(key)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => {
                    if (scope.level === "country") openProvince(feature);
                    else if (sampled) setSelected(key);
                  }}
                >
                  <title>
                    {feature.properties.name}
                    {sampled
                      ? ` — ${grains} ${grains === 1 ? "grain" : "grains"}, ${place.reportCount} ${place.reportCount === 1 ? "report" : "reports"}`
                      : " — not sampled"}
                  </title>
                </path>
              );
            })}

            {/* Sampled towns with no polygon in the source (Highly Urbanized
                Cities are the systematic case). */}
            {pointPlaces.map((place) => {
              const [x, y] = projection.project(place.point!.lon, place.point!.lat);
              const isActive = selected === place.key || hovered === place.key;
              return (
                <g
                  key={place.key}
                  className="cursor-pointer"
                  onMouseEnter={() => setHovered(place.key)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => setSelected(place.key)}
                >
                  <circle
                    cx={x}
                    cy={y}
                    r={isActive ? 13 : 10}
                    fill={INTENSITY_RAMP[intensityIndex(place.totalGrains, maxGrains)]}
                    stroke={isActive ? "#23261f" : "#8a8577"}
                    strokeWidth={isActive ? 2.5 : 1.5}
                  />
                  <title>
                    {place.label} — {place.totalGrains}{" "}
                    {place.totalGrains === 1 ? "grain" : "grains"}
                  </title>
                </g>
              );
            })}

            {/* Labels only for sampled places, so the map stays readable. */}
            {features.map((feature) => {
              const key = featureKey(feature);
              if (!places.has(key)) return null;
              const [x, y] = centroid(feature, projection);
              return (
                <text
                  key={`label-${feature.properties.psgc}`}
                  x={x}
                  y={y}
                  textAnchor="middle"
                  className="pointer-events-none"
                  style={{ fontFamily: "var(--font-mono)", fontSize: 14, fill: "#23261f" }}
                >
                  {feature.properties.name.replace(/^City of\s+/, "")}
                </text>
              );
            })}
            {pointPlaces.map((place) => {
              const [x, y] = projection.project(place.point!.lon, place.point!.lat);
              return (
                <text
                  key={`label-${place.key}`}
                  x={x}
                  y={y + 26}
                  textAnchor="middle"
                  className="pointer-events-none"
                  style={{ fontFamily: "var(--font-mono)", fontSize: 14, fill: "#23261f" }}
                >
                  {place.label}
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
          {pointPlaces.length > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full border border-[#8a8577]" style={{ background: INTENSITY_RAMP[3] }} />
              Independent city (no provincial polygon)
            </span>
          )}
        </div>

        {unmapped.length > 0 && (
          <p className="mt-2 text-[11.5px] text-ink/45">
            Not shown on this map: {unmapped.map((p) => p.label).join(", ")} — no boundary matched
            that name.
          </p>
        )}
      </div>

      {/* Selected place / ranking */}
      <div className="rounded-lg border border-panel-line bg-white/60 p-5 xl:col-span-2">
        {selectedPlace ? (
          <div>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div
                  className="text-[11px] tracking-widest text-ink/45 uppercase"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  Selected {scope.level === "country" ? "province" : "town"}
                </div>
                <h2
                  className="truncate text-xl text-ink"
                  style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}
                >
                  {selectedPlace.label}
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
                  {selectedPlace.totalGrains}
                </div>
                <div className="text-[11px] text-ink/45">Grains</div>
              </div>
              <div>
                <div className="text-[17px] text-ink" style={{ fontFamily: "var(--font-mono)" }}>
                  {selectedPlace.reportCount}
                </div>
                <div className="text-[11px] text-ink/45">
                  {selectedPlace.reportCount === 1 ? "Report" : "Reports"}
                </div>
              </div>
              <div>
                <div className="text-[17px] text-ink" style={{ fontFamily: "var(--font-mono)" }}>
                  {Math.round(getWeightedAvgConfidence(selectedPlace.detections) * 100)}%
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
            {selectedPlace.detections.length === 0 ? (
              <p className="rounded-md border border-panel-line bg-white px-3 py-4 text-center text-[12.5px] text-ink/50">
                No {activeLabel} recorded here.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {selectedPlace.detections.map((detection) => {
                  const s = getSpecies(detection.speciesId);
                  const share = selectedPlace.totalGrains
                    ? detection.grainCount / selectedPlace.totalGrains
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

            {selectedPlace.lastCollectedAt && (
              <p className="mt-3 text-[11.5px] text-ink/45">
                Last collected {formatCollectedAt(selectedPlace.lastCollectedAt)}
              </p>
            )}
            <Link
              href={`/history?q=${encodeURIComponent(selectedPlace.label)}`}
              className="focus-ring mt-3 flex items-center justify-center gap-2 rounded-md border border-panel-line bg-white px-3 py-2 text-[13px] text-ink/70 transition hover:text-ink"
            >
              <Microscope size={14} strokeWidth={1.75} />
              View reports from {selectedPlace.label}
            </Link>
          </div>
        ) : (
          <div>
            <h2 className="text-lg text-ink" style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}>
              Hotzones
            </h2>
            <p className="mt-0.5 mb-4 text-[12.5px] text-ink/50">
              Sampled {unitPlural} ranked by grains of {activeLabel}.
            </p>

            {ranked.length === 0 ? (
              <p className="rounded-md border border-panel-line bg-white px-3 py-6 text-center text-[12.5px] text-ink/50">
                {scope.level === "country"
                  ? "No reports yet — analyze a specimen to put a province on the map."
                  : `No reports from ${scope.name} yet.`}
              </p>
            ) : (
              <ol className="flex flex-col gap-2">
                {ranked.map((place, index) => (
                  <li key={place.key}>
                    <button
                      type="button"
                      onClick={() => {
                        if (scope.level === "country") {
                          const feature = provinces.features.find((f) => featureKey(f) === place.key);
                          if (feature) openProvince(feature);
                        } else {
                          setSelected(place.key);
                        }
                      }}
                      onMouseEnter={() => setHovered(place.key)}
                      onMouseLeave={() => setHovered(null)}
                      className="focus-ring flex w-full items-center gap-3 rounded-md border border-panel-line bg-white px-3 py-2.5 text-left transition hover:border-ink/25"
                    >
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] text-ink/70"
                        style={{
                          background: INTENSITY_RAMP[intensityIndex(place.totalGrains, maxGrains)],
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <MapPin size={12} strokeWidth={1.75} className="shrink-0 text-ink/30" />
                          <span className="truncate text-[13.5px] text-ink">{place.label}</span>
                        </span>
                        <span className="mt-0.5 block truncate text-[11.5px] text-ink/50">
                          {describeTopPollen(place.detections)}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-[14px] text-ink" style={{ fontFamily: "var(--font-mono)" }}>
                          {place.totalGrains}
                        </span>
                        <span className="block text-[10.5px] text-ink/45">grains</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            )}

            {scope.level === "country" && ranked.length > 0 && (
              <p className="mt-3 text-[11.5px] text-ink/45">
                Select a province to see which of its towns the pollen came from.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

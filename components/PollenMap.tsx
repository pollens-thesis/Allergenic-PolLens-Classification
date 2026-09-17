"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  FileDown,
  Loader2,
  MapPin,
  Maximize2,
  Microscope,
  Search,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  formatCollectedAt,
  getSpecies,
  getWeightedAvgConfidence,
  speciesCatalog,
  speciesLabel,
  type Specimen,
  type SpeciesId,
} from "@/lib/data";
import { listReports } from "@/lib/store";
import {
  PROVINCES_URL,
  REGIONS,
  UNSAMPLED_FILL,
  ZERO_FILL,
  aggregate,
  buildIntensityScale,
  centroid,
  describeTopPollen,
  displayName,
  featureBounds,
  featureKey,
  fitProjection,
  intensityFill,
  matchesQuery,
  municipalitiesUrl,
  reportsForPlace,
  toPath,
  unionBounds,
  type Bounds,
  type GeoCollection,
  type GeoFeature,
  type PlaceStats,
} from "@/lib/geo";
import { downloadLocationReportPdf } from "@/lib/pdf";
import { useMapZoom } from "./useMapZoom";
import { Button } from "./Button";

const fieldClass =
  "focus-ring rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text";

/** Place name → a filename fragment: "Lucena City" becomes "lucena-city". */
function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "location"
  );
}

/** Zoom past which unsampled places are labelled too — by then there is room. */
const LABEL_EVERYTHING_ZOOM = 2.5;

type Scope =
  | { level: "country" }
  | { level: "province"; key: string; psgc: number; name: string };

/** Everything drawable in the current view, sampled or not. */
type PlaceRow = {
  key: string;
  label: string;
  feature: GeoFeature | null;
  stats: PlaceStats | null;
  region?: number;
};

type Filters = {
  query: string;
  region: number | "all";
  /** "sampled" keeps the panel a ranking; "all" turns it into a gazetteer. */
  show: "sampled" | "all";
};

const NO_FILTERS: Filters = { query: "", region: "all", show: "sampled" };

// The region filter is offered on the country view only — municipality files
// carry no region code — so it must stop applying once you drill into towns.
function isFiltered(filters: Filters, countryScope: boolean): boolean {
  return (
    filters.query.trim() !== "" ||
    (countryScope && filters.region !== "all") ||
    filters.show !== "sampled"
  );
}

function selectRows(rows: PlaceRow[], filters: Filters, countryScope: boolean): PlaceRow[] {
  const byRegion = countryScope && filters.region !== "all" ? filters.region : null;
  return rows
    .filter(
      (row) =>
        matchesQuery(row.label, filters.query) &&
        (byRegion === null || row.region === byRegion) &&
        (filters.show === "all" || row.stats !== null),
    )
    .sort(
      (a, b) =>
        (b.stats?.totalGrains ?? 0) - (a.stats?.totalGrains ?? 0) ||
        a.label.localeCompare(b.label),
    );
}

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
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  /** Which report is being built, so only that button shows a spinner. */
  const [building, setBuilding] = useState<string | null>(null);

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

  const {
    svgRef,
    view,
    zoomBy,
    reset: resetZoom,
    fitTo,
    dragging,
    zoomedIn,
    atMaxZoom,
    handlers: zoomHandlers,
  } = useMapZoom(projection?.width ?? 1, projection?.height ?? 1);

  // Classes come from the distribution of the places actually in view, so the
  // shading re-scales when you drill into a province or switch taxon — a town's
  // 9 grains is a hot zone among towns even though it is nothing nationally.
  const scale = useMemo(
    () => buildIntensityScale([...places.values()].map((p) => p.totalGrains)),
    [places],
  );

  const ranked = useMemo(
    () => [...places.values()].sort((a, b) => b.totalGrains - a.totalGrains),
    [places],
  );

  /** Sampled places we cannot draw, so the map never silently lies. */
  const unmapped = useMemo(() => {
    if (!projection) return [];
    const drawable = new Set(features.map(featureKey));
    return ranked.filter((p) => !drawable.has(p.key));
  }, [ranked, features, projection]);

  // Path strings, label anchors and bounds are all derived from the geometry
  // alone, so they are computed once per projection rather than on every
  // render. Panning re-renders at pointer rate — without this, each frame would
  // re-walk every coordinate of all 88 provinces.
  const geometry = useMemo(() => {
    const paths = new Map<string, string>();
    const labelAt = new Map<string, [number, number]>();
    const bounds = new Map<string, Bounds>();
    if (!projection) return { paths, labelAt, bounds };
    for (const feature of features) {
      const key = featureKey(feature);
      paths.set(key, toPath(feature, projection));
      labelAt.set(key, centroid(feature, projection));
      bounds.set(key, featureBounds(feature, projection));
    }
    return { paths, labelAt, bounds };
  }, [features, projection]);

  const boundsFor = (row: PlaceRow): Bounds | null => geometry.bounds.get(row.key) ?? null;

  /** Every place in view: the boundaries, plus sampled places that have none. */
  const rows: PlaceRow[] = useMemo(() => {
    const fromFeatures = features.map((feature) => {
      const key = featureKey(feature);
      return {
        key,
        label: displayName(feature.properties.name),
        feature,
        stats: places.get(key) ?? null,
        region: feature.properties.region,
      };
    });
    const drawn = new Set(fromFeatures.map((row) => row.key));
    const extras = ranked
      .filter((place) => !drawn.has(place.key))
      .map((place) => ({ key: place.key, label: place.label, feature: null, stats: place }));
    return [...fromFeatures, ...extras];
  }, [features, places, ranked]);

  const countryScope = scope.level === "country";
  const matches = useMemo(
    () => selectRows(rows, filters, countryScope),
    [rows, filters, countryScope],
  );
  const filtersActive = isFiltered(filters, countryScope);
  const matchedKeys = useMemo(() => new Set(matches.map((row) => row.key)), [matches]);

  /** Places the search found that the "Sampled" filter is holding back. */
  const unsampledMatches = useMemo(() => {
    if (filters.show === "all") return 0;
    return selectRows(rows, { ...filters, show: "all" }, countryScope).length - matches.length;
  }, [matches, rows, filters, countryScope]);

  /** Narrowed by name or region — as opposed to merely widened to show all. */
  const searching = filters.query.trim() !== "" || (countryScope && filters.region !== "all");

  /**
   * Searching frames what it found.
   *
   * This runs from the control that changed rather than from an effect on the
   * filters, so it is the act of filtering that moves the map — changing the
   * pollen type, which rebuilds the same list, leaves a view the researcher
   * panned by hand exactly where it is.
   */
  function applyFilters(patch: Partial<Filters>) {
    const next = { ...filters, ...patch };
    setFilters(next);
    if (!projection) return;
    const bounds = isFiltered(next, countryScope)
      ? unionBounds(
          selectRows(rows, next, countryScope)
            .map(boundsFor)
            .filter((b): b is Bounds => b !== null),
        )
      : null;
    if (bounds) fitTo(bounds);
    else resetZoom();
  }

  const selectedPlace = selected ? (places.get(selected) ?? null) : null;

  function leaveScope() {
    setSelected(null);
    // The search box belongs to the view you typed it in: a province name is
    // not a town name, so carrying it inside would show an empty province.
    setFilters((f) => ({ ...f, query: "" }));
    resetZoom();
  }

  function openProvince(feature: GeoFeature) {
    setScope({
      level: "province",
      key: featureKey(feature),
      psgc: feature.properties.psgc,
      name: displayName(feature.properties.name),
    });
    leaveScope();
  }

  function backToCountry() {
    setScope({ level: "country" });
    leaveScope();
  }

  if (failed) {
    return (
      <div className="rounded-lg border border-border bg-surface px-6 py-16 text-center text-[13px] text-text-muted">
        Could not load the boundary data.
      </div>
    );
  }

  if (!reports || !provinces || !projection) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-6 py-16 text-[13px] text-text-muted">
        <Loader2 size={16} strokeWidth={1.75} className="animate-spin" />
        Loading map…
      </div>
    );
  }

  const activeLabel = species === "all" ? "all pollen" : `${getSpecies(species).scientificName} pollen`;
  const unitPlural = scope.level === "country" ? "provinces" : "towns";
  const unitSingular = scope.level === "country" ? "province" : "town";
  const speciesFilterLabel =
    species === "all" ? "All pollen" : speciesLabel(getSpecies(species));

  /**
   * How the current filter chose what it chose, for the report's scope line.
   * The Sampled/All toggle is deliberately not part of it: a report can only
   * cover places that have reports, so "including unsampled" would describe
   * the list on screen rather than the document.
   */
  const filterDescription = [
    filters.query.trim() ? `“${filters.query.trim()}”` : null,
    countryScope && filters.region !== "all"
      ? REGIONS.find((r) => r.code === filters.region)?.label
      : null,
  ]
    .filter(Boolean)
    .join(" and ");

  /**
   * Turn what the map is showing into a document: the selected place, or the
   * set the filters narrowed to, rolled up with the reports behind it.
   */
  async function generateReport(
    token: string,
    places: PlaceStats[],
    scopeLabel: string,
    selectionNote?: string,
  ) {
    if (!reports || places.length === 0) return;
    setBuilding(token);
    try {
      const scopeArg =
        scope.level === "country"
          ? ({ level: "country" } as const)
          : ({ level: "province", provinceKey: scope.key } as const);

      // A report can only belong to one place, but collecting per place and
      // de-duplicating keeps that an assumption the export doesn't rely on.
      const seen = new Set<string>();
      const included = places
        .flatMap((place) => reportsForPlace(reports, place.key, scopeArg))
        .filter((report) => !seen.has(report.sampleId) && seen.add(report.sampleId));

      await downloadLocationReportPdf({
        title: places.length === 1 ? places[0].label : countryScope ? "Philippines" : scope.name,
        scopeLabel,
        selectionNote,
        speciesLabel: speciesFilterLabel,
        places,
        reports: included,
        fileSlug: slugify(
          places.length === 1 ? places[0].label : countryScope ? "philippines" : scope.name,
        ),
      });
    } finally {
      setBuilding(null);
    }
  }

  /** Sampled places in the current filter — what a filtered report covers. */
  const filteredPlaces = matches
    .map((row) => row.stats)
    .filter((stats): stats is PlaceStats => stats !== null);

  /** Clicking a result: drill into a province, or frame and select a town. */
  function focusRow(row: PlaceRow) {
    if (scope.level === "country") {
      if (row.feature) openProvince(row.feature);
      return;
    }
    if (row.stats) setSelected(row.key);
    const bounds = boundsFor(row);
    if (bounds) fitTo(bounds);
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
      {/* Map */}
      <div className="rounded-lg border border-border bg-surface p-5 xl:col-span-3">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {scope.level === "province" && (
              <button
                type="button"
                onClick={backToCountry}
                className="focus-ring mb-1 inline-flex items-center gap-1 rounded text-[13px] text-text-muted transition hover:text-text"
              >
                <ChevronLeft size={13} strokeWidth={1.75} />
                Philippines
              </button>
            )}
            <h2 className="text-lg text-text" style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>
              {scope.level === "country" ? "Philippines" : scope.name}
            </h2>
            <p className="mt-0.5 text-[13px] text-text-muted">
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
                  {speciesLabel(s)}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Search and filters — they govern both the map shading and the list. */}
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search {unitPlural}</span>
            <Search
              size={14}
              strokeWidth={1.75}
              className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-text-faint"
            />
            <input
              type="text"
              value={filters.query}
              onChange={(e) => applyFilters({ query: e.target.value })}
              placeholder={`Search ${unitPlural}`}
              className="focus-ring w-full rounded-md border border-border bg-surface py-1.5 pr-8 pl-8 text-[13px] text-text placeholder:text-text-muted"
            />
            {filters.query && (
              <button
                type="button"
                onClick={() => applyFilters({ query: "" })}
                aria-label="Clear search"
                className="focus-ring absolute top-1/2 right-1.5 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-text-muted transition-[background-color,color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-surface-sunken hover:text-text active:scale-[0.9]"
              >
                <X size={13} strokeWidth={1.75} />
              </button>
            )}
          </label>

          {scope.level === "country" && (
            <label className="shrink-0">
              <span className="sr-only">Region</span>
              <select
                value={filters.region}
                onChange={(e) =>
                  applyFilters({ region: e.target.value === "all" ? "all" : Number(e.target.value) })
                }
                className="focus-ring rounded-md border border-border bg-surface px-2 py-1.5 text-[13px] text-text"
              >
                <option value="all">All regions</option>
                {REGIONS.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div
            className="flex shrink-0 gap-0.5 rounded-md border border-border bg-surface p-0.5"
            role="group"
            aria-label={`Which ${unitPlural} to show`}
          >
            {(["sampled", "all"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => applyFilters({ show: option })}
                aria-pressed={filters.show === option}
                className={`focus-ring rounded px-2.5 py-1 text-[13px] transition active:scale-[0.97] ${
                  filters.show === option ? "bg-text text-bg" : "text-text-muted hover:text-text"
                }`}
              >
                {option === "sampled" ? "Sampled" : "All"}
              </button>
            ))}
          </div>
        </div>

        <div className="relative overflow-hidden rounded-lg bg-surface-sunken p-2">
          {loadingTowns && (
            <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-lg bg-surface-sunken/80 text-[13px] text-text-muted">
              <Loader2 size={15} strokeWidth={1.75} className="animate-spin" />
              Loading towns…
            </div>
          )}

          {/* Zoom controls */}
          <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
            <button
              type="button"
              onClick={() => zoomBy(1.6)}
              disabled={atMaxZoom}
              aria-label="Zoom in"
              className="focus-ring flex h-10 w-10 items-center justify-center rounded-md border border-border bg-surface/90 text-text-muted transition-[color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:text-text active:scale-[0.97] disabled:opacity-35 disabled:active:scale-100 lg:h-8 lg:w-8"
            >
              <ZoomIn size={15} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={() => zoomBy(1 / 1.6)}
              disabled={!zoomedIn}
              aria-label="Zoom out"
              className="focus-ring flex h-10 w-10 items-center justify-center rounded-md border border-border bg-surface/90 text-text-muted transition-[color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:text-text active:scale-[0.97] disabled:opacity-35 disabled:active:scale-100 lg:h-8 lg:w-8"
            >
              <ZoomOut size={15} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={resetZoom}
              disabled={!zoomedIn}
              aria-label="Reset zoom"
              className="focus-ring flex h-10 w-10 items-center justify-center rounded-md border border-border bg-surface/90 text-text-muted transition-[color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:text-text active:scale-[0.97] disabled:opacity-35 disabled:active:scale-100 lg:h-8 lg:w-8"
            >
              <Maximize2 size={14} strokeWidth={1.75} />
            </button>
          </div>

          <svg
            ref={svgRef}
            viewBox={`0 0 ${projection.width} ${projection.height}`}
            className={`h-auto max-h-[70vh] w-full ${
              dragging ? "cursor-grabbing" : zoomedIn ? "cursor-grab" : ""
            }`}
            // Below fit there is nothing to pan, so the page keeps its vertical
            // scroll on touch; once zoomed in, the map takes the gesture.
            style={{ touchAction: zoomedIn ? "none" : "pan-y" }}
            role="img"
            aria-label={`Map of ${scope.level === "country" ? "the Philippines" : scope.name} shaded by ${activeLabel}`}
            {...zoomHandlers}
          >
            <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
              {features.map((feature) => {
                const key = featureKey(feature);
                const place = places.get(key);
                const grains = place?.totalGrains ?? 0;
                const sampled = place !== undefined;
                const isActive = selected === key || hovered === key;
                const clickable = scope.level === "country" || sampled;
                const dimmed = filtersActive && !matchedKeys.has(key);

                return (
                  <path
                    key={feature.properties.psgc}
                    d={geometry.paths.get(key)}
                    fill={intensityFill(scale, sampled ? grains : null)}
                    fillOpacity={dimmed ? 0.3 : 1}
                    stroke={isActive ? "var(--text)" : "var(--border-strong)"}
                    strokeOpacity={dimmed ? 0.3 : 1}
                    strokeWidth={isActive ? 2 : 0.6}
                    // Borders keep their on-screen width as the map is zoomed,
                    // rather than growing into slabs with the geometry.
                    vectorEffect="non-scaling-stroke"
                    className={clickable ? "cursor-pointer" : "cursor-default"}
                    onMouseEnter={() => setHovered(key)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => {
                      if (scope.level === "country") openProvince(feature);
                      else if (sampled) setSelected(key);
                    }}
                  >
                    <title>
                      {displayName(feature.properties.name)}
                      {sampled
                        ? ` — ${grains} ${grains === 1 ? "grain" : "grains"}, ${place.reportCount} ${place.reportCount === 1 ? "report" : "reports"}`
                        : " — not sampled"}
                    </title>
                  </path>
                );
              })}

              {/* Sampled places are always labelled; the rest once zoomed in. */}
              {features.map((feature) => {
                const key = featureKey(feature);
                const sampled = places.has(key);
                if (!sampled && view.k < LABEL_EVERYTHING_ZOOM) return null;
                if (filtersActive && !matchedKeys.has(key)) return null;
                const [x, y] = geometry.labelAt.get(key) ?? [0, 0];
                return (
                  <text
                    key={`label-${feature.properties.psgc}`}
                    x={x}
                    y={y}
                    textAnchor="middle"
                    className="pointer-events-none"
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontWeight: 500,
                      fontSize: 14 / view.k,
                      fill: "var(--text)",
                      fillOpacity: sampled ? 1 : 0.55,
                      // A halo drawn behind the glyphs, so a name stays
                      // readable where it crosses a hot fill or a circle.
                      paintOrder: "stroke",
                      stroke: "var(--surface-sunken)",
                      strokeWidth: 3 / view.k,
                      strokeLinejoin: "round",
                      strokeOpacity: 0.85,
                    }}
                  >
                    {displayName(feature.properties.name)}
                  </text>
                );
              })}
            </g>
          </svg>
        </div>

        {/* Legend — the classes are quantiles, so it states its own numbers
            rather than leaving "more" and "fewer" to be guessed at. */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px] text-text-muted">
          {scale.ranges.length > 0 && (
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-text-muted">Grains</span>
              {scale.ranges.map((range, index) => (
                <span key={range.to} className="flex items-center gap-1">
                  <span
                    className="h-3 w-4 rounded-sm border border-border"
                    style={{ background: scale.colors[index] }}
                  />
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
                    {range.from === range.to ? range.from : `${range.from}–${range.to}`}
                  </span>
                </span>
              ))}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-4 rounded-sm border border-border" style={{ background: ZERO_FILL }} />
            None found
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-4 rounded-sm border border-border" style={{ background: UNSAMPLED_FILL }} />
            Not sampled
          </span>
          <span className="text-text-muted">
            {zoomedIn
              ? `Zoomed ${view.k.toFixed(1)}× — drag to pan`
              : "Scroll or use the controls to zoom"}
          </span>
        </div>

        {unmapped.length > 0 && (
          <p className="mt-2 text-[12.5px] text-text-muted">
            Not shown on this map: {unmapped.map((p) => p.label).join(", ")} — no boundary matched
            that name.
          </p>
        )}
      </div>

      {/* Selected place / ranking */}
      <div className="rounded-lg border border-border bg-surface p-5 xl:col-span-2">
        {selectedPlace ? (
          <div>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div
                  className="text-[12px] tracking-widest text-text-muted uppercase"
                  style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}
                >
                  Selected {unitSingular}
                </div>
                <h2
                  className="truncate text-xl text-text"
                  style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
                >
                  {selectedPlace.label}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Clear selection"
                className="focus-ring flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-text-muted transition-[background-color,color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-surface-sunken hover:text-text active:scale-[0.9]"
              >
                <X size={14} strokeWidth={1.75} />
              </button>
            </div>

            <div className="mb-4 grid grid-cols-3 gap-3 rounded-md bg-surface-sunken px-3 py-3 text-center">
              <div>
                <div className="text-[17px] text-text" style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
                  {selectedPlace.totalGrains}
                </div>
                <div className="text-[12px] text-text-muted">Grains</div>
              </div>
              <div>
                <div className="text-[17px] text-text" style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
                  {selectedPlace.reportCount}
                </div>
                <div className="text-[12px] text-text-muted">
                  {selectedPlace.reportCount === 1 ? "Report" : "Reports"}
                </div>
              </div>
              <div>
                <div className="text-[17px] text-text" style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
                  {Math.round(getWeightedAvgConfidence(selectedPlace.detections) * 100)}%
                </div>
                <div className="text-[12px] text-text-muted">Avg. conf.</div>
              </div>
            </div>

            <h3
              className="mb-2 text-[12px] tracking-[0.2em] text-text-muted uppercase"
              style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}
            >
              Most pollen detected here
            </h3>
            {selectedPlace.detections.length === 0 ? (
              <p className="rounded-md border border-border bg-surface px-3 py-4 text-center text-[13px] text-text-muted">
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
                    <li key={detection.speciesId} className="rounded-md border border-border bg-surface px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            aria-hidden
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: s.color }}
                          />
                          <span className="truncate text-[13.5px] text-text">{s.scientificName}</span>
                          <span className="truncate text-[13px] text-text-muted">{s.commonName}</span>
                        </span>
                        <span className="shrink-0 text-[13px] text-text" style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
                          {detection.grainCount}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-border">
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
              <p className="mt-3 text-[12.5px] text-text-muted">
                Last collected {formatCollectedAt(selectedPlace.lastCollectedAt)}
              </p>
            )}
            <Button
              type="button"
              intent="accent"
              disabled={building !== null}
              onClick={() =>
                generateReport(
                  selectedPlace.key,
                  [selectedPlace],
                  countryScope ? "Province of the Philippines" : `Town in ${scope.name}`,
                )
              }
              className="mt-4 w-full"
            >
              {building === selectedPlace.key ? (
                <>
                  <Loader2 size={14} strokeWidth={1.75} className="animate-spin" />
                  Building report…
                </>
              ) : (
                <>
                  <FileDown size={14} strokeWidth={1.75} />
                  Generate report for {selectedPlace.label}
                </>
              )}
            </Button>
            <p className="mt-1.5 text-center text-[12px] text-text-muted">
              PDF · {selectedPlace.reportCount}{" "}
              {selectedPlace.reportCount === 1 ? "report" : "reports"} ·{" "}
              {species === "all" ? "all pollen" : getSpecies(species).scientificName}
            </p>

            <Link
              href={`/reports?q=${encodeURIComponent(selectedPlace.label)}`}
              className="focus-ring mt-2 flex items-center justify-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text-muted transition hover:text-text"
            >
              <Microscope size={14} strokeWidth={1.75} />
              View reports from {selectedPlace.label}
            </Link>
          </div>
        ) : (
          <div>
            <h2 className="text-lg text-text" style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>
              {filtersActive ? (scope.level === "country" ? "Provinces" : "Towns") : "Hotzones"}
            </h2>
            <p className="mt-0.5 mb-3 text-[13px] text-text-muted">
              {filtersActive
                ? `${matches.length} of ${rows.length} ${unitPlural}, ranked by grains of ${activeLabel}.`
                : `Sampled ${unitPlural} ranked by grains of ${activeLabel}.`}
            </p>

            {/* Filtering the map to a place is choosing a subject; this turns
                that choice into a document without having to select each place
                in turn. */}
            {filtersActive && filteredPlaces.length > 0 && (
              <Button
                type="button"
                intent="accent"
                disabled={building !== null}
                onClick={() =>
                  generateReport(
                    "filtered",
                    filteredPlaces,
                    filteredPlaces.length === 1
                      ? countryScope
                        ? "Province of the Philippines"
                        : `Town in ${scope.name}`
                      : countryScope
                        ? "Provinces of the Philippines"
                        : `Towns in ${scope.name}`,
                    filteredPlaces.length === 1
                      ? undefined
                      : `Covers ${filteredPlaces.length} sampled ${unitPlural}${
                          filterDescription ? ` matching ${filterDescription}` : ""
                        }, ranked by grains of ${activeLabel}.`,
                  )
                }
                className="mb-4 w-full"
              >
                {building === "filtered" ? (
                  <>
                    <Loader2 size={14} strokeWidth={1.75} className="animate-spin" />
                    Building report…
                  </>
                ) : (
                  <>
                    <FileDown size={14} strokeWidth={1.75} />
                    {filteredPlaces.length === 1
                      ? `Generate report for ${filteredPlaces[0].label}`
                      : `Generate report for these ${filteredPlaces.length} ${unitPlural}`}
                  </>
                )}
              </Button>
            )}

            {matches.length === 0 ? (
              <div className="rounded-md border border-border bg-surface px-3 py-6 text-center text-[13px] text-text-muted">
                {filtersActive ? (
                  <>
                    {/* A name that exists but has no reports is a different
                        answer from a name that matches nothing, and the map
                        should say which one it is. */}
                    <p>
                      No {unsampledMatches > 0 ? "sampled " : ""}
                      {unitPlural} match this search.
                    </p>
                    {unsampledMatches > 0 && (
                      <button
                        type="button"
                        onClick={() => applyFilters({ show: "all" })}
                        className="focus-ring mt-2 rounded text-text underline underline-offset-4 hover:opacity-70"
                      >
                        Show {unsampledMatches} unsampled{" "}
                        {unsampledMatches === 1 ? unitSingular : unitPlural}
                      </button>
                    )}
                  </>
                ) : scope.level === "country" ? (
                  "No reports yet — analyze a specimen to put a province on the map."
                ) : (
                  `No reports from ${scope.name} yet.`
                )}
              </div>
            ) : (
              // The inner scroll is a desktop affordance: beside a tall map it
              // keeps the ranking in view. Stacked under the map on a phone it
              // would be a scroll area inside a scrolling page, so the list
              // simply runs on.
              <ol className="flex flex-col gap-2 lg:max-h-[68vh] lg:overflow-y-auto">
                {matches.map((row, index) => (
                  <li key={row.key}>
                    <button
                      type="button"
                      onClick={() => focusRow(row)}
                      onMouseEnter={() => setHovered(row.key)}
                      onMouseLeave={() => setHovered(null)}
                      className="focus-ring flex w-full items-center gap-3 rounded-md border border-border bg-surface px-3 py-2.5 text-left transition hover:border-border-strong"
                    >
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-medium text-text"
                        style={{
                          background: row.stats
                            ? intensityFill(scale, row.stats.totalGrains)
                            : UNSAMPLED_FILL,
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <MapPin size={12} strokeWidth={1.75} className="shrink-0 text-text-faint" />
                          <span className="truncate text-[13.5px] text-text">{row.label}</span>
                        </span>
                        <span className="mt-0.5 block truncate text-[12.5px] text-text-muted">
                          {row.stats ? describeTopPollen(row.stats.detections) : "Not sampled"}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-[14px] text-text" style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
                          {row.stats ? row.stats.totalGrains : "—"}
                        </span>
                        <span className="block text-[11.5px] text-text-muted">grains</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            )}

            {searching && matches.length > 0 && unsampledMatches > 0 && (
              <p className="mt-3 text-[12.5px] text-text-muted">
                {unsampledMatches} more {unsampledMatches === 1 ? unitSingular : unitPlural} match
                the search but {unsampledMatches === 1 ? "has" : "have"} no reports yet.{" "}
                <button
                  type="button"
                  onClick={() => applyFilters({ show: "all" })}
                  className="focus-ring rounded text-text underline underline-offset-4 hover:opacity-70"
                >
                  Show {unsampledMatches === 1 ? "it" : "them"}
                </button>
              </p>
            )}

            {scope.level === "country" && matches.length > 0 && (
              <p className="mt-3 text-[12.5px] text-text-muted">
                Select a province to see which of its towns the pollen came from.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

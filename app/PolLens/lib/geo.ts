// ---------------------------------------------------------------------------
// GEOGRAPHY — turning a report's free-text location into a place on the map.
//
// No geo API is called at runtime. Boundaries ship with the app:
//
//   public/geo/provinces.json                 88 provinces/districts, ~260 KB
//   public/geo/municipalities/<psgc>.json     1,641 town boundaries across 88 files
//
// The country view always loads the provinces file; a province's towns are
// fetched only when you drill into it, so no page load ever pulls more than
// ~45 KB of town geometry. That keeps the map deterministic, offline-capable,
// rate-limit free and citable — a thesis figure should not depend on a
// third-party endpoint staying up.
//
// Source: faeldon/philippines-json-maps (2023, lowres) — MIT, built from PSA
// PSGC shapefiles. The eight BARMM SGA municipality shapes are reconstructed
// from NAMRIA 2023 barangay polygons. See docs/pollen-map.md for details.
// ---------------------------------------------------------------------------

import {
  aggregateSlideDetections,
  getSpecies,
  getTopDetection,
  speciesLabel,
  type Specimen,
  type SpeciesId,
  type SpecimenDetection,
} from "@/lib/data";

export const PROVINCES_URL = "/geo/provinces.json";
export const municipalitiesUrl = (provincePsgc: number) =>
  `/geo/municipalities/${provincePsgc}.json`;

export type GeoFeature = {
  type: "Feature";
  properties: { name: string; psgc: number; region?: number };
  geometry:
    | { type: "Polygon"; coordinates: number[][][] }
    | { type: "MultiPolygon"; coordinates: number[][][][] };
};

export type GeoCollection = { type: "FeatureCollection"; features: GeoFeature[] };

function normalize(text: string): string {
  return text
    .trim()
    .normalize("NFD")
    .replace(/\p{M}/gu, "") // accents fold, not vanish: "Parañaque" = "Paranaque"
    .toLowerCase()
    .replace(/^city of\s+/, "")
    .replace(/\s+city$/, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Metro Manila has no single boundary: PSGC splits it into four districts,
// each drawn as its own "province". A location written "Town, Metro Manila"
// is routed to the district that contains the town.
const NCR_DISTRICTS = {
  first: normalize("NCR, City of Manila, First District (Not a Province)"),
  second: normalize("NCR, Second District (Not a Province)"),
  third: normalize("NCR, Third District (Not a Province)"),
  fourth: normalize("NCR, Fourth District (Not a Province)"),
};
const NCR_TOWN_DISTRICT: Record<string, string> = Object.fromEntries(
  (
    [
      ["first", ["Manila"]],
      ["second", ["Mandaluyong", "Marikina", "Pasig", "San Juan", "Quezon"]],
      ["third", ["Caloocan", "Malabon", "Navotas", "Valenzuela"]],
      ["fourth", ["Las Piñas", "Makati", "Muntinlupa", "Parañaque", "Taguig", "Pasay", "Pateros"]],
    ] as const
  ).flatMap(([district, towns]) => towns.map((town) => [normalize(town), NCR_DISTRICTS[district]])),
);
const ISABELA_CITY = normalize("City of Isabela (Not a Province)");
const BARMM_SGA = normalize("BARMM Special Geographic Area");

/** Province names a researcher is likely to type that aren't the PSGC name. */
const PROVINCE_ALIASES: Record<string, string> = {
  "metro manila": "ncr",
  "national capital region": "ncr",
  "north cotabato": "cotabato",
  "special geographic area": BARMM_SGA,
  "barmm sga": BARMM_SGA,
  "sga": BARMM_SGA,
  // The place search's labels for the four NCR districts.
  "metro manila manila": NCR_DISTRICTS.first,
  "metro manila second district": NCR_DISTRICTS.second,
  "metro manila third district": NCR_DISTRICTS.third,
  "metro manila fourth district": NCR_DISTRICTS.fourth,
};

const SGA_TOWN_ALIASES: Record<string, string> = {
  [normalize("Kapalawan")]: "Kapalawan",
  [normalize("Carmen Cluster")]: "Pahamuddin",
  [normalize("Special Geographic Area - Carmen")]: "Pahamuddin",
  [normalize("Pahamuddin")]: "Pahamuddin",
  [normalize("Kabacan Cluster")]: "Old Kaabakan",
  [normalize("Special Geographic Area - Kabacan")]: "Old Kaabakan",
  [normalize("Old Kaabakan")]: "Old Kaabakan",
  [normalize("Midsayap Cluster I")]: "Kadayangan",
  [normalize("Special Geographic Area - Midsayap I")]: "Kadayangan",
  [normalize("Kadayangan")]: "Kadayangan",
  [normalize("Midsayap Cluster II")]: "Nabalawag",
  [normalize("Special Geographic Area - Midsayap II")]: "Nabalawag",
  [normalize("Nabalawag")]: "Nabalawag",
  [normalize("Pigcawayan Cluster")]: "Kapalawan",
  [normalize("Special Geographic Area - Pigcawayan")]: "Kapalawan",
  [normalize("Pikit Cluster I")]: "Malidegao",
  [normalize("Special Geographic Area - Pikit I")]: "Malidegao",
  [normalize("Malidegao")]: "Malidegao",
  [normalize("Pikit Cluster II")]: "Ligawasan",
  [normalize("Special Geographic Area - Pikit II")]: "Ligawasan",
  [normalize("Ligawasan")]: "Ligawasan",
  [normalize("Pikit Cluster III")]: "Tugunan",
  [normalize("Special Geographic Area - Pikit III")]: "Tugunan",
  [normalize("Tugunan")]: "Tugunan",
};

/** A province written by a researcher → the key of the boundary it names. */
function provinceKeyOf(province: string): string {
  // "Isabela City" must not collapse to "isabela" (the province in Region II).
  if (/^\s*(isabela\s+city|city\s+of\s+isabela)\s*$/i.test(province)) return ISABELA_CITY;
  const key = normalize(province);
  return PROVINCE_ALIASES[key] ?? key;
}

export type ParsedLocation = { town: string; townKey: string; province: string; provinceKey: string };

/**
 * "Lucban, Quezon" → town "Lucban" / province "Quezon". A single name
 * ("Quezon") is a province with no town — what the place search produces
 * when a province itself is picked.
 */
export function parseLocation(location: string): ParsedLocation {
  const parts = location.split(",").map((s) => s.trim()).filter(Boolean);
  let town = parts.length > 1 ? parts[0] : "";
  const province = parts.length > 1 ? parts[parts.length - 1] : (parts[0] ?? "");
  let provinceKey = provinceKeyOf(province);
  let townKey = normalize(town);

  const sgaTown = SGA_TOWN_ALIASES[townKey];
  if (sgaTown && (provinceKey === BARMM_SGA || provinceKey === "cotabato")) {
    // The 2024 SGA municipalities replaced interim cluster names. Older
    // reports may still say Cotabato; route these named places to their current
    // map unit so they remain visible at both country and town scope.
    town = sgaTown;
    townKey = normalize(sgaTown);
    provinceKey = BARMM_SGA;
  } else if (provinceKey === "davao del norte" && townKey === "san isidro") {
    // PSA renamed this municipality to Sawata in Q2 2026. Keep saved reports
    // under its current boundary.
    town = "Sawata";
    townKey = normalize(town);
  } else if (provinceKey === "misamis occidental" && townKey === "don victoriano chiongbian") {
    town = "Don Victoriano";
    townKey = normalize(town);
  }

  if (provinceKey === "ncr" && NCR_TOWN_DISTRICT[townKey]) provinceKey = NCR_TOWN_DISTRICT[townKey];
  return {
    town,
    townKey,
    province: provinceKey === BARMM_SGA ? "BARMM Special Geographic Area" : province,
    provinceKey,
  };
}

export function featureKey(feature: GeoFeature): string {
  return normalize(feature.properties.name);
}

/**
 * How a boundary's name is written on the map and in lists.
 *
 * PSGC names carry bookkeeping the reader does not need: NCR's districts and
 * Isabela City are tagged "(Not a Province)" because they sit in the province
 * slot without being one. Dropping it costs nothing — the key is derived from
 * the raw name, so matching is unaffected — and it stops four overlapping
 * labels from covering Metro Manila the moment you zoom in.
 */
export function displayName(name: string): string {
  // Not "Isabela": that is the province in Region II, a different place.
  if (/^City of Isabela\b/i.test(name)) return "Isabela City";
  return name.replace(/\s*\(Not a Province\)\s*$/i, "").replace(/^City of\s+/, "");
}

/** Town-level key for a report that names only its province. */
export const PROVINCE_WIDE_KEY = "(province-wide)";

export type PlaceStats = {
  key: string;
  label: string;
  reportCount: number;
  totalGrains: number;
  detections: SpecimenDetection[];
  lastCollectedAt: string | null;
  /** Province PSGC, set on province-level rows so the map can drill in. */
  psgc?: number;
};

function addTo(place: PlaceStats, detections: SpecimenDetection[], collectedAt: string) {
  place.reportCount += 1;
  for (const detection of detections) {
    const existing = place.detections.find((d) => d.speciesId === detection.speciesId);
    if (existing) {
      const grains = existing.grainCount + detection.grainCount;
      existing.avgConfidence =
        (existing.avgConfidence * existing.grainCount +
          detection.avgConfidence * detection.grainCount) /
        grains;
      existing.grainCount = grains;
    } else {
      place.detections.push({ ...detection });
    }
    place.totalGrains += detection.grainCount;
  }
  if (!place.lastCollectedAt || collectedAt > place.lastCollectedAt) {
    place.lastCollectedAt = collectedAt;
  }
}

/**
 * Roll reports up to provinces (country view) or to towns within one province.
 *
 * `speciesFilter` narrows the totals to one taxon, which is what turns the
 * choropleth from "where is there most pollen" into "where is there most
 * ragweed" — the per-pollen hotzone view.
 *
 * Province totals are derived from the province named in the location, so a
 * report collected in a Highly Urbanized City — which the PSA treats as
 * administratively independent — still colours the province around it.
 */
export function aggregate(
  reports: Specimen[],
  speciesFilter: SpeciesId | "all",
  scope: { level: "country" } | { level: "province"; provinceKey: string },
): Map<string, PlaceStats> {
  const places = new Map<string, PlaceStats>();

  for (const report of reports) {
    const parsed = parseLocation(report.location);
    if (scope.level === "province" && parsed.provinceKey !== scope.provinceKey) continue;

    const key = scope.level === "country" ? parsed.provinceKey : parsed.townKey || PROVINCE_WIDE_KEY;
    const label =
      scope.level === "country" ? parsed.province : parsed.town || "No town given";
    if (!key) continue;

    const all = aggregateSlideDetections(report.slides);
    const detections =
      speciesFilter === "all" ? all : all.filter((d) => d.speciesId === speciesFilter);
    // Filtering by one pollen: a report without any of it doesn't make the
    // place "sampled for it".
    if (speciesFilter !== "all" && detections.length === 0) continue;

    const place =
      places.get(key) ??
      ({
        key,
        label,
        reportCount: 0,
        totalGrains: 0,
        detections: [],
        lastCollectedAt: null,
      } satisfies PlaceStats);

    addTo(place, detections, report.collectedAt);
    places.set(key, place);
  }

  for (const place of places.values()) {
    place.detections.sort((a, b) => b.grainCount - a.grainCount);
  }
  return places;
}

export function describeTopPollen(detections: SpecimenDetection[]): string {
  const top = getTopDetection(detections);
  if (!top) return "None detected";
  return speciesLabel(getSpecies(top.speciesId));
}

// --- Search & regions ------------------------------------------------------

/**
 * Substring match on the same normalised form used to match reports to
 * boundaries, so searching behaves like the rest of the map: "tayabas" finds
 * "City of Tayabas", and accents or punctuation in either string are ignored.
 */
export function matchesQuery(name: string, query: string): boolean {
  const q = normalize(query);
  if (!q) return true;
  return normalize(name).includes(q);
}

/**
 * The 18 regions, in PSA order, keyed by the region PSGC carried on every
 * province feature. Towns do not carry one — municipality files were trimmed to
 * name and psgc — so this filter is offered on the country view only.
 */
export const REGIONS: { code: number; label: string }[] = [
  { code: 1300000000, label: "NCR" },
  { code: 1400000000, label: "CAR" },
  { code: 100000000, label: "Region I (Ilocos)" },
  { code: 200000000, label: "Region II (Cagayan Valley)" },
  { code: 300000000, label: "Region III (Central Luzon)" },
  { code: 400000000, label: "Region IV-A (CALABARZON)" },
  { code: 1700000000, label: "MIMAROPA" },
  { code: 500000000, label: "Region V (Bicol)" },
  { code: 600000000, label: "Region VI (Western Visayas)" },
  { code: 700000000, label: "Region VII (Central Visayas)" },
  { code: 1800000000, label: "Negros Island Region" },
  { code: 800000000, label: "Region VIII (Eastern Visayas)" },
  { code: 900000000, label: "Region IX (Zamboanga Peninsula)" },
  { code: 1000000000, label: "Region X (Northern Mindanao)" },
  { code: 1100000000, label: "Region XI (Davao)" },
  { code: 1200000000, label: "Region XII (SOCCSKSARGEN)" },
  { code: 1600000000, label: "Caraga" },
  { code: 1900000000, label: "BARMM" },
];

// --- Projection ------------------------------------------------------------

export type Projection = {
  project: (lon: number, lat: number) => [number, number];
  width: number;
  height: number;
};

/**
 * Equirectangular projection fitted to whatever is being drawn.
 *
 * Longitude is scaled by cos(mean latitude) so the country isn't stretched
 * sideways — around 12°N a degree of longitude is about 98% of a degree of
 * latitude. Good enough for the Philippines' span; a wider map would want a
 * conic projection.
 */
export function fitProjection(features: GeoFeature[], size = 1000): Projection {
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  const visit = (coords: unknown): void => {
    if (Array.isArray(coords) && typeof coords[0] === "number") {
      const [lon, lat] = coords as number[];
      minLon = Math.min(minLon, lon);
      maxLon = Math.max(maxLon, lon);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      return;
    }
    if (Array.isArray(coords)) coords.forEach(visit);
  };
  features.forEach((f) => visit(f.geometry.coordinates));

  const lonScale = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180));
  const spanX = (maxLon - minLon) * lonScale;
  const spanY = maxLat - minLat;
  const scale = size / Math.max(spanX, spanY);
  const width = spanX * scale;
  const height = spanY * scale;

  return {
    width,
    height,
    project: (lon, lat) => [
      (lon - minLon) * lonScale * scale,
      height - (lat - minLat) * scale, // SVG y grows downward
    ],
  };
}

export function toPath(feature: GeoFeature, projection: Projection): string {
  const rings: number[][][] =
    feature.geometry.type === "Polygon"
      ? feature.geometry.coordinates
      : feature.geometry.coordinates.flat();

  return rings
    .map((ring) => {
      const points = ring.map(([lon, lat]) => {
        const [x, y] = projection.project(lon, lat);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      });
      return `M${points.join("L")}Z`;
    })
    .join("");
}

/** Rough visual centre — good enough for placing a label. */
export function centroid(feature: GeoFeature, projection: Projection): [number, number] {
  const rings: number[][][] =
    feature.geometry.type === "Polygon"
      ? feature.geometry.coordinates
      : feature.geometry.coordinates.flat();

  // Use the largest ring so an outlying island doesn't drag the label off the
  // mainland part of the place.
  const largest = rings.reduce((a, b) => (b.length > a.length ? b : a), rings[0] ?? []);
  let sumX = 0;
  let sumY = 0;
  for (const [lon, lat] of largest) {
    const [x, y] = projection.project(lon, lat);
    sumX += x;
    sumY += y;
  }
  const n = largest.length || 1;
  return [sumX / n, sumY / n];
}

// --- Zoom & pan ------------------------------------------------------------
//
// The map is one SVG with a fitted viewBox, so zooming is a transform on the
// drawn group rather than a change of projection: `translate(x, y) scale(k)`
// applied to projected coordinates. Nothing is re-projected and no geometry is
// re-fetched, which is what makes zooming free — the province outlines are
// already at full source precision, they were just drawn small.

export type ViewTransform = { x: number; y: number; k: number };
export type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

export const IDENTITY_VIEW: ViewTransform = { x: 0, y: 0, k: 1 };
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 20;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Keep the drawing inside the frame: never zoomed out past fit, never panned so
 * far that the map leaves the viewport. At k = 1 the only legal offset is 0,
 * which is why dragging an unzoomed map does nothing.
 */
export function clampView(view: ViewTransform, width: number, height: number): ViewTransform {
  const k = clamp(view.k, MIN_ZOOM, MAX_ZOOM);
  return {
    k,
    x: clamp(view.x, width * (1 - k), 0),
    y: clamp(view.y, height * (1 - k), 0),
  };
}

/**
 * Scale about a fixed point — the cursor, or the pinch midpoint — so whatever
 * is under the pointer stays under it.
 */
export function zoomAtPoint(
  view: ViewTransform,
  factor: number,
  px: number,
  py: number,
  width: number,
  height: number,
): ViewTransform {
  const k = clamp(view.k * factor, MIN_ZOOM, MAX_ZOOM);
  return clampView(
    {
      k,
      x: px - ((px - view.x) / view.k) * k,
      y: py - ((py - view.y) / view.k) * k,
    },
    width,
    height,
  );
}

export function featureBounds(feature: GeoFeature, projection: Projection): Bounds {
  const rings: number[][][] =
    feature.geometry.type === "Polygon"
      ? feature.geometry.coordinates
      : feature.geometry.coordinates.flat();

  const bounds: Bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const ring of rings) {
    for (const [lon, lat] of ring) {
      const [x, y] = projection.project(lon, lat);
      bounds.minX = Math.min(bounds.minX, x);
      bounds.minY = Math.min(bounds.minY, y);
      bounds.maxX = Math.max(bounds.maxX, x);
      bounds.maxY = Math.max(bounds.maxY, y);
    }
  }
  return bounds;
}

/** Bounds of a place drawn as a point, padded so fitting one doesn't zoom to a dot. */
export function pointBounds(x: number, y: number, radius = 40): Bounds {
  return { minX: x - radius, minY: y - radius, maxX: x + radius, maxY: y + radius };
}

export function unionBounds(all: Bounds[]): Bounds | null {
  if (all.length === 0) return null;
  return all.reduce((a, b) => ({
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  }));
}

/** The view that frames `bounds`, with margin left around it. */
export function fitView(
  bounds: Bounds,
  width: number,
  height: number,
  margin = 0.78,
): ViewTransform {
  const spanX = Math.max(bounds.maxX - bounds.minX, 1);
  const spanY = Math.max(bounds.maxY - bounds.minY, 1);
  const k = clamp((Math.min(width / spanX, height / spanY) * margin), MIN_ZOOM, MAX_ZOOM);
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  return clampView({ k, x: width / 2 - cx * k, y: height / 2 - cy * k }, width, height);
}

// --- Colour ----------------------------------------------------------------

/**
 * ColorBrewer YlOrBr, four classes: pale yellow to burnt orange.
 *
 * A published sequential palette that ColorBrewer rates colour-blind safe and
 * print friendly. Its lightness falls steadily from class to class, so the
 * classes stay apart in greyscale print (the usual IEEE figure requirement) and
 * for red-green colour-blind readers; hue reinforces the count rather than
 * carrying it alone.
 */
export const INTENSITY_RAMP = ["#ffffd4", "#fed98e", "#fe9929", "#cc4c02"];

/** Sampled, but none of the selected taxon found here. Distinct from both the
 *  ramp and the unsampled fill: "we looked and found nothing" is its own answer. */
export const ZERO_FILL = "#e4e4e7";
export const UNSAMPLED_FILL = "#f4f4f5";

export type IntensityScale = {
  /** Upper bound of each class, ascending; `classOf` returns its index. */
  breaks: number[];
  classOf: (grains: number) => number;
  /** Inclusive range of each class, for a legend that states its numbers. */
  ranges: { from: number; to: number }[];
  /** The ramp entry for each class — see `rampColors`. */
  colors: string[];
};

/**
 * The ramp entries to use for `count` classes, spread across the full range.
 *
 * Taking the first `count` colours would shade a two-class map in the two
 * palest sands and leave its hot end unused. A single class is the hot end:
 * when one place is all the data there is, the map's job is to say "here",
 * and the lightest colour on the ramp says the opposite.
 */
function rampColors(count: number): string[] {
  if (count <= 0) return [];
  if (count === 1) return [INTENSITY_RAMP[INTENSITY_RAMP.length - 1]];
  return Array.from({ length: count }, (_, i) =>
    INTENSITY_RAMP[Math.round((i * (INTENSITY_RAMP.length - 1)) / (count - 1))],
  );
}

/**
 * Classify places by where they fall among *the other places*, not as a
 * fraction of the largest.
 *
 * Grain counts are heavily skewed — one busy site and a long tail — and
 * fraction-of-max bins put almost everything in the bottom class, which is
 * exactly the case where the map should be telling them apart. Quantiles fill
 * every class by construction, so the hot end stays legible however lopsided
 * the data is. Duplicate breaks are collapsed, so a dataset with three distinct
 * values gets three classes rather than four, one of which could never be used.
 */
export function buildIntensityScale(values: number[]): IntensityScale {
  const positive = values.filter((v) => v > 0).sort((a, b) => a - b);
  if (positive.length === 0) {
    return { breaks: [], classOf: () => -1, ranges: [], colors: [] };
  }

  const classes = Math.min(INTENSITY_RAMP.length, new Set(positive).size);
  const breaks: number[] = [];
  for (let i = 1; i <= classes; i++) {
    // Upper bound of class i: the value at the i/classes quantile.
    const index = Math.ceil((positive.length * i) / classes) - 1;
    const value = positive[Math.min(index, positive.length - 1)];
    if (breaks[breaks.length - 1] !== value) breaks.push(value);
  }

  const ranges = breaks.map((to, index) => ({
    from: index === 0 ? 1 : breaks[index - 1] + 1,
    to,
  }));

  return {
    breaks,
    ranges,
    colors: rampColors(breaks.length),
    classOf: (grains: number) => {
      if (grains <= 0) return -1; // sampled, nothing found — ZERO_FILL
      const index = breaks.findIndex((upper) => grains <= upper);
      return index === -1 ? breaks.length - 1 : index;
    },
  };
}

/** Fill for a place: unsampled, sampled-but-empty, or its intensity class. */
export function intensityFill(scale: IntensityScale, grains: number | null): string {
  if (grains === null) return UNSAMPLED_FILL;
  const index = scale.classOf(grains);
  return index < 0 ? ZERO_FILL : (scale.colors[index] ?? ZERO_FILL);
}

/** The reports behind one place on the map, newest collection first. */
export function reportsForPlace(
  reports: Specimen[],
  key: string,
  scope: { level: "country" } | { level: "province"; provinceKey: string },
): Specimen[] {
  return reports
    .filter((report) => {
      const parsed = parseLocation(report.location);
      if (scope.level === "country") return parsed.provinceKey === key;
      return parsed.provinceKey === scope.provinceKey && (parsed.townKey || PROVINCE_WIDE_KEY) === key;
    })
    .sort((a, b) => b.collectedAt.localeCompare(a.collectedAt));
}

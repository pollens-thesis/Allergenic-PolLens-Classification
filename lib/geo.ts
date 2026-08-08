// ---------------------------------------------------------------------------
// GEOGRAPHY — turning a report's free-text location into a place on the map.
//
// No geo API is called at runtime. Boundaries ship with the app:
//
//   public/geo/provinces.json                 88 provinces/districts, ~260 KB
//   public/geo/municipalities/<psgc>.json     1,613 towns across 88 files
//
// The country view always loads the provinces file; a province's towns are
// fetched only when you drill into it, so no page load ever pulls more than
// ~40 KB of town geometry. That keeps the map deterministic, offline-capable,
// rate-limit free and citable — a thesis figure should not depend on a
// third-party endpoint staying up.
//
// Source: faeldon/philippines-json-maps (2023, lowres) — MIT, built from PSA
// PSGC shapefiles. See docs/pollen-map.md for how the files were produced and
// what is missing from them.
// ---------------------------------------------------------------------------

import {
  aggregateSlideDetections,
  getSpecies,
  getTopDetection,
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

/**
 * Towns with no polygon in their province's file, placed by coordinate instead.
 *
 * Highly Urbanized Cities are the systematic case: the PSA treats them as
 * administratively independent of the province that surrounds them, so they are
 * absent from the province's municipality set. Lucena City is the one in this
 * dataset. Add an entry here (or record coordinates on the report) for any
 * other HUC that gets sampled — Davao, Cebu, Iloilo and Baguio are all missing
 * for the same reason.
 */
export const POINT_TOWNS: Record<string, { label: string; lon: number; lat: number }> = {
  lucena: { label: "Lucena City", lon: 121.617, lat: 13.9314 },
};

/** Province names a researcher is likely to type that aren't the PSGC name. */
const PROVINCE_ALIASES: Record<string, string> = {
  "metro manila": "ncr",
  "national capital region": "ncr",
};

function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/^city of\s+/, "")
    .replace(/\s+city$/, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export type ParsedLocation = { town: string; townKey: string; province: string; provinceKey: string };

/** "Lucban, Quezon" → town "Lucban" / province "Quezon". */
export function parseLocation(location: string): ParsedLocation {
  const parts = location.split(",").map((s) => s.trim()).filter(Boolean);
  const town = parts[0] ?? "";
  const province = parts.length > 1 ? parts[parts.length - 1] : "";
  const provinceKey = normalize(province);
  return {
    town,
    townKey: normalize(town),
    province,
    provinceKey: PROVINCE_ALIASES[provinceKey] ?? provinceKey,
  };
}

export function featureKey(feature: GeoFeature): string {
  return normalize(feature.properties.name);
}

export type PlaceStats = {
  key: string;
  label: string;
  reportCount: number;
  totalGrains: number;
  detections: SpecimenDetection[];
  lastCollectedAt: string | null;
  /** Province PSGC, set on province-level rows so the map can drill in. */
  psgc?: number;
  /** Set when a town has no polygon and must be drawn as a point. */
  point?: { lon: number; lat: number };
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
 * report collected in a Highly Urbanized City still colours the province around
 * it even though that city has no town polygon.
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

    const key = scope.level === "country" ? parsed.provinceKey : parsed.townKey;
    const label = scope.level === "country" ? parsed.province : parsed.town;
    if (!key) continue;

    const all = aggregateSlideDetections(report.slides);
    const detections =
      speciesFilter === "all" ? all : all.filter((d) => d.speciesId === speciesFilter);

    const place =
      places.get(key) ??
      ({
        key,
        label,
        reportCount: 0,
        totalGrains: 0,
        detections: [],
        lastCollectedAt: null,
        point: scope.level === "province" && POINT_TOWNS[key]
          ? { lon: POINT_TOWNS[key].lon, lat: POINT_TOWNS[key].lat }
          : undefined,
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
  const species = getSpecies(top.speciesId);
  return `${species.genus} (${species.commonName})`;
}

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

// --- Colour ----------------------------------------------------------------

/** Light to hot. Index 0 means "sampled but nothing of this taxon found". */
export const INTENSITY_RAMP = ["#e8e2d4", "#f0dcb4", "#e6c080", "#d69c4a", "#c2703d"];
export const UNSAMPLED_FILL = "#f3efe6";

export function intensityIndex(grains: number, max: number): number {
  if (grains <= 0 || max <= 0) return 0;
  const t = grains / max;
  if (t <= 0.25) return 1;
  if (t <= 0.5) return 2;
  if (t <= 0.75) return 3;
  return 4;
}

// ---------------------------------------------------------------------------
// GEOGRAPHY — turning a report's free-text location into a place on the map.
//
// No geo API is called at runtime. Municipality boundaries ship with the app as
// a single GeoJSON file (public/geo/quezon-municipalities.json, ~21 KB), which
// makes the map deterministic, offline-capable, rate-limit free, and citable in
// a thesis. See docs/pollen-map.md for where the data came from and how to
// extend it to another province.
// ---------------------------------------------------------------------------

import {
  aggregateSlideDetections,
  getSpecies,
  getTopDetection,
  type Specimen,
  type SpeciesId,
  type SpecimenDetection,
} from "@/lib/data";

export const BOUNDARIES_URL = "/geo/quezon-municipalities.json";

export type MunicipalityFeature = {
  type: "Feature";
  properties: { name: string; psgc: number };
  geometry:
    | { type: "Polygon"; coordinates: number[][][] }
    | { type: "MultiPolygon"; coordinates: number[][][][] };
};

export type Boundaries = {
  type: "FeatureCollection";
  features: MunicipalityFeature[];
};

/**
 * Sites that have no polygon in the provincial boundary file, mapped to a
 * point instead. Lucena City is the case that matters here: it is a Highly
 * Urbanized City, so the Philippine Statistics Authority treats it as
 * administratively separate from Quezon Province and it is absent from the
 * province's municipality set — even though it sits geographically inside it.
 */
export const POINT_SITES: Record<string, { label: string; lon: number; lat: number }> = {
  lucena: { label: "Lucena City", lon: 121.617, lat: 13.9314 },
};

/**
 * "Lucena City, Quezon" → "lucena". Drops the province, the "City of" prefix
 * and the " City" suffix so a typed location matches the boundary file's
 * naming ("City of Tayabas" vs a researcher typing "Tayabas").
 */
export function normalizeMunicipality(location: string): string {
  return location
    .split(",")[0]
    .trim()
    .toLowerCase()
    .replace(/^city of\s+/, "")
    .replace(/\s+city$/, "")
    .replace(/[^a-z\s-]/g, "")
    .trim();
}

export type SiteStats = {
  key: string; // normalized municipality name
  label: string; // display name, from the boundary file where possible
  reportCount: number;
  totalGrains: number;
  detections: SpecimenDetection[]; // combined across every report at this site
  lastCollectedAt: string | null;
  /** Set when the site has no polygon and must be drawn as a point. */
  point?: { lon: number; lat: number };
};

/**
 * Roll every report up to the site it was collected at.
 *
 * `speciesFilter` narrows the totals to one taxon, which is what turns the
 * choropleth from "where is there most pollen" into "where is there most
 * ragweed" — the per-pollen hotzone view.
 */
export function aggregateBySite(
  reports: Specimen[],
  speciesFilter: SpeciesId | "all" = "all",
): Map<string, SiteStats> {
  const sites = new Map<string, SiteStats>();

  for (const report of reports) {
    const key = normalizeMunicipality(report.location);
    if (!key) continue;

    const all = aggregateSlideDetections(report.slides);
    const detections = speciesFilter === "all" ? all : all.filter((d) => d.speciesId === speciesFilter);
    // A report with none of the filtered taxon still counts as a visit, but
    // contributes no grains — that distinction is what makes a zone "cold"
    // rather than "unsampled".
    const site = sites.get(key) ?? {
      key,
      label: report.location.split(",")[0].trim(),
      reportCount: 0,
      totalGrains: 0,
      detections: [],
      lastCollectedAt: null,
      point: POINT_SITES[key] ? { lon: POINT_SITES[key].lon, lat: POINT_SITES[key].lat } : undefined,
    };

    site.reportCount += 1;
    for (const detection of detections) {
      const existing = site.detections.find((d) => d.speciesId === detection.speciesId);
      if (existing) {
        const grains = existing.grainCount + detection.grainCount;
        existing.avgConfidence =
          (existing.avgConfidence * existing.grainCount +
            detection.avgConfidence * detection.grainCount) /
          grains;
        existing.grainCount = grains;
      } else {
        site.detections.push({ ...detection });
      }
      site.totalGrains += detection.grainCount;
    }

    if (!site.lastCollectedAt || report.collectedAt > site.lastCollectedAt) {
      site.lastCollectedAt = report.collectedAt;
    }
    sites.set(key, site);
  }

  for (const site of sites.values()) {
    site.detections.sort((a, b) => b.grainCount - a.grainCount);
  }
  return sites;
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
 * Equirectangular projection fitted to the data's bounds.
 *
 * Longitude is scaled by cos(mean latitude) so the province isn't stretched
 * sideways — at ~14°N a degree of longitude is about 97% of a degree of
 * latitude. Good enough for a single province; anything larger would want a
 * conic projection.
 */
export function fitProjection(features: MunicipalityFeature[], size = 1000): Projection {
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
      // SVG y grows downward; latitude grows upward.
      height - (lat - minLat) * scale,
    ],
  };
}

/** Builds the SVG path data for one municipality. */
export function toPath(feature: MunicipalityFeature, projection: Projection): string {
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

/** Rough visual centre of a feature — good enough for placing a label. */
export function centroid(feature: MunicipalityFeature, projection: Projection): [number, number] {
  const rings: number[][][] =
    feature.geometry.type === "Polygon"
      ? feature.geometry.coordinates
      : feature.geometry.coordinates.flat();

  // Use the largest ring so an island doesn't drag the label off the mainland.
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

/** Light to hot. Index 0 means "sampled but nothing found". */
export const INTENSITY_RAMP = ["#e8e2d4", "#f0dcb4", "#e6c080", "#d69c4a", "#c2703d"];
export const UNSAMPLED_FILL = "#f3efe6";

/** Bucket a site's grain count against the busiest site on the map. */
export function intensityIndex(grains: number, max: number): number {
  if (grains <= 0 || max <= 0) return 0;
  const t = grains / max;
  if (t <= 0.25) return 1;
  if (t <= 0.5) return 2;
  if (t <= 0.75) return 3;
  return 4;
}

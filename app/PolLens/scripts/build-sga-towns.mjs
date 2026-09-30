// ---------------------------------------------------------------------------
// Rebuild the eight BARMM Special Geographic Area municipality outlines.
//
// The 2023 NAMRIA boundary edition still calls these areas interim clusters.
// PSA's April 2024 PSGC update assigned their official municipality names and
// transferred Dunguan, Macabual and Panicupan between clusters. Rebuild the
// affected outlines from the cluster barangay polygons so the current map
// follows those transfers. Old Kaabakan keeps the Kabacan cluster outline:
// the 2023 barangay extract has no separate Pedtad polygon, but the PSA update
// transferred every barangay from that cluster without changing its boundary.
//
// Inputs are the 2023-10-24 NAMRIA-derived files published at:
// bendlikeabamboo/barangay-boundaries-repository, release v2026.4.13.0.
// The map-data guide cites the source and the PSA municipality creation notice.
//
// Usage from app/PolLens:
//   node scripts/build-sga-towns.mjs <barangays.geojson> <special_geographic_areas.geojson>
//   node scripts/build-sga-towns.mjs <barangays.geojson> <special_geographic_areas.geojson> --write
// ---------------------------------------------------------------------------

import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const write = args.includes("--write");
const [barangaysPath, specialAreasPath] = args.filter((arg) => arg !== "--write");
if (!barangaysPath || !specialAreasPath) {
  console.error(
    "usage: node scripts/build-sga-towns.mjs <barangays.geojson> <special_geographic_areas.geojson> [--write]",
  );
  process.exit(1);
}

const simplifyName = (name) =>
  String(name ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const clusterToTown = new Map([
  [simplifyName("Special Geographic Area - Carmen"), "Pahamuddin"],
  [simplifyName("Special Geographic Area - Kabacan"), "Old Kaabakan"],
  [simplifyName("Special Geographic Area - Midsayap I"), "Kadayangan"],
  [simplifyName("Special Geographic Area - Midsayap II"), "Nabalawag"],
  [simplifyName("Special Geographic Area - Pigcawayan"), "Kapalawan"],
  [simplifyName("Special Geographic Area - Pigkawayan"), "Kapalawan"],
  [simplifyName("Special Geographic Area - Pikit I"), "Malidegao"],
  [simplifyName("Special Geographic Area - Pikit II"), "Ligawasan"],
  [simplifyName("Special Geographic Area - Pikit III"), "Tugunan"],
]);

const targets = [
  { name: "Kapalawan", psgc: 1999901000, barangays: 12 },
  { name: "Old Kaabakan", psgc: 1999902000, barangays: 7 },
  { name: "Kadayangan", psgc: 1999903000, barangays: 7 },
  { name: "Nabalawag", psgc: 1999904000, barangays: 7 },
  { name: "Pahamuddin", psgc: 1999905000, barangays: 7 },
  { name: "Malidegao", psgc: 1999906000, barangays: 7 },
  { name: "Ligawasan", psgc: 1999907000, barangays: 7 },
  { name: "Tugunan", psgc: 1999908000, barangays: 9 },
];

// These barangays moved when the interim clusters became municipalities.
const transferTo = new Map([
  ["dunguan", "Nabalawag"],
  ["macabual", "Tugunan"],
  ["panicupan", "Tugunan"],
]);

const barangayCollection = JSON.parse(fs.readFileSync(barangaysPath, "utf8"));
const specialCollection = JSON.parse(fs.readFileSync(specialAreasPath, "utf8"));
const municipalityBarangays = new Map(targets.map((town) => [town.name, []]));
let sgaBarangayCount = 0;

for (const feature of barangayCollection.features ?? []) {
  const properties = feature.properties ?? {};
  if (properties.ADM2_EN !== "Special Geographic Area") continue;
  sgaBarangayCount += 1;
  const sourceTown = clusterToTown.get(simplifyName(properties.ADM3_EN));
  if (!sourceTown) {
    throw new Error(`Unrecognized SGA cluster: ${properties.ADM3_EN ?? "(missing name)"}`);
  }
  const targetTown = transferTo.get(simplifyName(properties.ADM4_EN)) ?? sourceTown;
  if (!feature.geometry) throw new Error(`Missing boundary for SGA barangay ${properties.ADM4_EN}`);
  municipalityBarangays.get(targetTown).push(feature);
}

if (sgaBarangayCount !== 62) {
  throw new Error(`Expected 62 SGA barangay polygons in the 2023 source; found ${sgaBarangayCount}`);
}

const ringsOf = (geometry) =>
  geometry.type === "Polygon" ? geometry.coordinates : geometry.coordinates.flat();
const pointKey = (point) => `${point[0]},${point[1]}`;

/** Dissolve a set of topologically tiled barangay polygons by cancelling shared edges. */
function dissolve(features) {
  const edges = new Map();
  for (const feature of features) {
    for (const ring of ringsOf(feature.geometry)) {
      for (let i = 0; i < ring.length - 1; i += 1) {
        edges.set(`${pointKey(ring[i])}|${pointKey(ring[i + 1])}`, [ring[i], ring[i + 1]]);
      }
    }
  }

  const boundary = new Map();
  for (const [from, to] of edges.values()) {
    if (edges.has(`${pointKey(to)}|${pointKey(from)}`)) continue;
    const start = pointKey(from);
    if (!boundary.has(start)) boundary.set(start, []);
    boundary.get(start).push(to);
  }

  const rings = [];
  for (const [start, firsts] of boundary) {
    while (firsts.length) {
      const ring = [start.split(",").map(Number)];
      let next = firsts.pop();
      while (next && pointKey(next) !== start) {
        ring.push(next);
        const outgoing = boundary.get(pointKey(next));
        next = outgoing?.length ? outgoing.pop() : null;
      }
      if (!next) throw new Error(`Open polygon ring while dissolving near ${start}`);
      ring.push(ring[0]);
      if (ring.length > 3) rings.push(ring);
    }
  }
  return rings;
}

function signedArea(ring) {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    sum += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return sum / 2;
}

function inside(point, ring) {
  let within = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (
      yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi
    ) {
      within = !within;
    }
  }
  return within;
}

function geometryFromRings(rings) {
  if (rings.length === 0) throw new Error("Barangay polygons did not form a closed boundary");
  const polygons = [];
  for (const ring of [...rings].sort((a, b) => Math.abs(signedArea(b)) - Math.abs(signedArea(a)))) {
    const host = polygons.find((polygon) => inside(ring[0], polygon[0]));
    if (host) host.push(ring);
    else polygons.push([ring]);
  }

  const round = (value) => Number(value.toFixed(4));
  const coordinates = polygons.map((polygon) =>
    polygon.map((ring) => ring.map(([lon, lat]) => [round(lon), round(lat)])),
  );
  return coordinates.length === 1
    ? { type: "Polygon", coordinates: coordinates[0] }
    : { type: "MultiPolygon", coordinates };
}

function roundGeometry(geometry) {
  const round = (value) => Number(value.toFixed(4));
  const visit = (coordinates) => {
    if (typeof coordinates[0] === "number") {
      return [round(coordinates[0]), round(coordinates[1])];
    }
    return coordinates.map(visit);
  };
  return { type: geometry.type, coordinates: visit(geometry.coordinates) };
}

const oldKaabakanOutline = (specialCollection.features ?? []).find(
  (feature) =>
    simplifyName(feature.properties?.ADM3_EN) ===
    simplifyName("Special Geographic Area - Kabacan"),
);
if (!oldKaabakanOutline?.geometry) {
  throw new Error("Could not find the former Kabacan cluster boundary for Old Kaabakan");
}

const features = targets.map((town) => {
  const sourceBarangays = municipalityBarangays.get(town.name);
  const expectedSourceBarangays = town.name === "Old Kaabakan" ? 6 : town.barangays;
  if (sourceBarangays.length !== expectedSourceBarangays) {
    throw new Error(
      `${town.name}: expected ${expectedSourceBarangays} source barangays, matched ${sourceBarangays.length}`,
    );
  }
  const geometry =
    town.name === "Old Kaabakan"
      ? roundGeometry(oldKaabakanOutline.geometry)
      : geometryFromRings(dissolve(sourceBarangays));
  return {
    type: "Feature",
    properties: { name: town.name, psgc: town.psgc },
    geometry,
  };
});

const collection = { type: "FeatureCollection", features };
const outputPath = path.join(process.cwd(), "public/geo/municipalities/1909900000.json");
if (write) {
  fs.writeFileSync(outputPath, JSON.stringify(collection));
  console.log(`Wrote ${features.length} town boundaries to ${outputPath}`);
} else {
  console.log(`Dry run: ${features.length} town boundaries are ready for ${outputPath}`);
  console.log("Pass --write to update the map data.");
}

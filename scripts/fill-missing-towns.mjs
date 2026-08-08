// ---------------------------------------------------------------------------
// Rebuild the towns that the province-level source leaves out.
//
// `municities-provdist-<prov>.json` — the file the shipped town data came from
// — is missing 29 of the country's 1,642 cities and municipalities. Two causes:
//
//   * Highly Urbanized Cities are administratively independent of the province
//     around them, so they appear in no province's town list. Lucena, Cebu,
//     Davao, Baguio and 12 others.
//   * Five ordinary towns carry a null geometry in that layer.
//
// The barangay layer has no such gaps: every municity has a file, and the
// barangays inside one tile it exactly. So a missing town's outline can be
// recovered by dissolving its barangays — dropping every edge that two
// barangays share and stitching what is left into rings. That keeps the result
// in the same edition, and therefore the same simplification, as its
// neighbours; a boundary lifted from another year would not line up.
//
// Names and parent provinces are not in the barangay layer. Names come from the
// 2019 municity layer, matched by position for the cities and by PSGC for the
// five towns; the parent province is whichever province polygon the outline
// falls inside. Both are printed for checking before anything is written.
//
// Usage: node scripts/fill-missing-towns.mjs <path-to-philippines-json-maps>
// ---------------------------------------------------------------------------

import fs from "node:fs";
import path from "node:path";

const CLONE = process.argv[2];
if (!CLONE) {
  console.error("usage: node scripts/fill-missing-towns.mjs <path-to-philippines-json-maps>");
  process.exit(1);
}
const BGY = path.join(CLONE, "2023/geojson/municities/lowres");
const NAMES_2019 = path.join(CLONE, "2019/geojson/municties/lowres");
const TOWNS = "public/geo/municipalities";

/** Town coordinates are rounded to 4 decimal places (~11 m), as shipped. */
const PRECISION = 4;
const round = (n) => Number(n.toFixed(PRECISION));

// --- dissolve --------------------------------------------------------------

const ringsOf = (geometry) =>
  geometry.type === "Polygon" ? geometry.coordinates : geometry.coordinates.flat();

const at = (p) => `${p[0]},${p[1]}`;

/**
 * Union a set of tiling polygons by cancelling shared edges.
 *
 * Two barangays that touch trace the same edge in opposite directions. Drop
 * every edge whose reverse also exists and only the outside survives, which is
 * exactly the municity's boundary. This relies on neighbours sharing vertices
 * exactly — true here, because the layer was simplified as one topology.
 */
function dissolve(features) {
  const edges = new Map();
  for (const f of features) {
    if (!f.geometry) continue;
    for (const ring of ringsOf(f.geometry)) {
      for (let i = 0; i < ring.length - 1; i++) {
        edges.set(`${at(ring[i])}|${at(ring[i + 1])}`, [ring[i], ring[i + 1]]);
      }
    }
  }

  const boundary = new Map();
  for (const [a, b] of edges.values()) {
    if (!edges.has(`${at(b)}|${at(a)}`)) {
      if (!boundary.has(at(a))) boundary.set(at(a), []);
      boundary.get(at(a)).push(b);
    }
  }

  // Walk the surviving edges into closed rings.
  const rings = [];
  for (const [start, firsts] of boundary) {
    while (firsts.length) {
      const ring = [start.split(",").map(Number)];
      let next = firsts.pop();
      while (next && at(next) !== start) {
        ring.push(next);
        const outgoing = boundary.get(at(next));
        next = outgoing && outgoing.length ? outgoing.pop() : null;
      }
      if (!next) break; // open chain: the topology was not clean
      ring.push(ring[0]);
      if (ring.length > 3) rings.push(ring);
    }
  }
  return rings;
}

const area = (ring) => {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return sum / 2;
};

function inside(point, ring) {
  let within = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > point[1] !== yj > point[1] &&
        point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) within = !within;
  }
  return within;
}

/** Nest the rings: each one is either an island or a hole in the island it sits in. */
function toGeometry(rings) {
  const sorted = [...rings].sort((a, b) => Math.abs(area(b)) - Math.abs(area(a)));
  const polygons = [];
  for (const ring of sorted) {
    const host = polygons.find((p) => inside(ring[0], p[0]));
    if (host) host.push(ring);
    else polygons.push([ring]);
  }
  const rounded = polygons.map((p) => p.map((r) => r.map(([x, y]) => [round(x), round(y)])));
  return rounded.length === 1
    ? { type: "Polygon", coordinates: rounded[0] }
    : { type: "MultiPolygon", coordinates: rounded };
}

// --- naming and placement --------------------------------------------------

function centre(geometry) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const ring of ringsOf(geometry)) {
    for (const [x, y] of ring) {
      x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
  }
  return [(x0 + x1) / 2, (y0 + y1) / 2];
}

const containsPoint = (point, geometry) => {
  let hit = false;
  for (const ring of ringsOf(geometry)) if (inside(point, ring)) hit = !hit;
  return hit;
};

/**
 * How many of `points` fall inside `host`.
 *
 * A bounding-box centre is not good enough to identify a place: Lapu-Lapu is an
 * island, Cagayan de Oro wraps a bay, and either can have its centre land in a
 * neighbour. Counting points is decisive where a single probe is a coin toss.
 *
 * The points to use are the barangay vertices, not the dissolved outline's. An
 * outline lies *on* the boundary it shares with its neighbours, where
 * point-in-polygon is a numerical toss-up between two editions of the same
 * border; the barangay interior gives a sample that is unambiguously inside.
 */
function overlap(points, host) {
  let count = 0;
  for (const point of points) if (containsPoint(point, host)) count++;
  return count;
}

/** Squared distance from a point to the nearest vertex of a geometry. */
function nearness(point, geometry) {
  let best = Infinity;
  for (const ring of ringsOf(geometry)) {
    for (const [x, y] of ring) {
      best = Math.min(best, (x - point[0]) ** 2 + (y - point[1]) ** 2);
    }
  }
  return best;
}

function bestBy(candidates, score) {
  let best = null;
  let bestScore = 0;
  for (const c of candidates) {
    const s = score(c);
    if (s > bestScore) { best = c; bestScore = s; }
  }
  return best;
}

const extent = (geometry) =>
  ringsOf(geometry).reduce((sum, ring) => sum + Math.abs(area(ring)), 0);

/**
 * The smallest candidate that still contains essentially the whole outline.
 *
 * Overlap alone cannot separate a city from the town that rings it: Baguio sits
 * entirely inside Tuba, so Tuba contains every one of Baguio's points and wins
 * on count. Of the candidates that contain the outline, the tightest fit is the
 * place itself.
 */
function tightestContaining(points, candidates) {
  const scored = candidates
    .map((c) => ({ c, hits: overlap(points, c.geometry) }))
    .filter((s) => s.hits > 0);
  if (!scored.length) return null;
  const most = Math.max(...scored.map((s) => s.hits));
  return scored
    .filter((s) => s.hits >= most * 0.9)
    .reduce((a, b) => (extent(b.c.geometry) < extent(a.c.geometry) ? b : a)).c;
}

/**
 * Pull a new outline onto its neighbours' vertices where the two nearly agree.
 *
 * The recovered boundary and the boundary of the town next to it describe the
 * same border, but they were simplified in different passes — the barangay
 * layer and the province layer — so they disagree by a hundred metres or so.
 * Left alone that shows as a hairline gap once the map is zoomed in. Snapping
 * to a neighbour's vertex when one is within `tolerance` closes the seam
 * without moving anything that is genuinely coastline: the open sea has no
 * neighbouring vertex to snap to.
 */
function snapToNeighbours(geometry, neighbours, tolerance = 0.01) {
  const targets = [];
  for (const n of neighbours) {
    if (!n.geometry) continue;
    for (const ring of ringsOf(n.geometry)) targets.push(...ring);
  }
  const limit = tolerance ** 2;
  let moved = 0;

  const snap = ([x, y]) => {
    let best = null;
    let bestDistance = limit;
    for (const [tx, ty] of targets) {
      const d = (tx - x) ** 2 + (ty - y) ** 2;
      if (d < bestDistance) { bestDistance = d; best = [tx, ty]; }
    }
    if (!best || (best[0] === x && best[1] === y)) return [x, y];
    moved++;
    return [round(best[0]), round(best[1])];
  };

  const rings = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  const snapped = rings.map((polygon) =>
    polygon.map((ring) => {
      const out = ring.slice(0, -1).map(snap);
      return [...out, out[0]];
    }),
  );
  return {
    geometry:
      geometry.type === "Polygon"
        ? { type: "Polygon", coordinates: snapped[0] }
        : { type: "MultiPolygon", coordinates: snapped },
    moved,
  };
}

/** 2023 widened the province field from two digits to three. */
const toOldPsgc = (psgc) => {
  const s = String(psgc).padStart(10, "0");
  return s.slice(0, 2) + s.slice(3);
};

// --- build -----------------------------------------------------------------

const provinces = JSON.parse(fs.readFileSync("public/geo/provinces.json")).features;

const shippedByProvince = new Map();
const shippedCodes = new Set();
for (const province of provinces) {
  const file = `${TOWNS}/${province.properties.psgc}.json`;
  const data = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file))
    : { type: "FeatureCollection", features: [] };
  shippedByProvince.set(province.properties.psgc, data);
  for (const f of data.features) shippedCodes.add(f.properties.psgc);
}

const named2019 = [];
for (const file of fs.readdirSync(NAMES_2019)) {
  for (const f of JSON.parse(fs.readFileSync(`${NAMES_2019}/${file}`)).features) {
    named2019.push({
      name: f.properties.ADM3_EN,
      psgc: f.properties.ADM3_PCODE.replace(/^PH/, ""),
      geometry: f.geometry,
    });
  }
}

const missing = fs
  .readdirSync(BGY)
  .map((f) => Number(f.match(/municity-(\d+)\./)[1]))
  .filter((code) => !shippedCodes.has(code));

console.log(`towns shipped: ${shippedCodes.size}   missing from the province layer: ${missing.length}\n`);

const added = [];
const skipped = [];
/** Only provinces that gained a town are rewritten, so the diff stays honest. */
const touched = new Set();

/**
 * BARMM's Special Geographic Area was formed in 2019 out of barangays that had
 * belonged to towns in Cotabato. Its municipalities therefore sit inside 2019
 * polygons that carry a different town's name, and any positional match would
 * confidently return the wrong one. There is no name source for them here, so
 * they are left out rather than guessed at.
 */
const BARMM_SGA = 1999900000;

for (const code of missing.sort((a, b) => a - b)) {
  const file = `${BGY}/bgysubmuns-municity-${code}.0.001.json`;
  if (!fs.existsSync(file)) {
    skipped.push({ code, why: "barangay file not checked out" });
    continue;
  }
  const barangays = JSON.parse(fs.readFileSync(file)).features;
  const parentPsgc = barangays[0]?.properties.adm2_psgc;
  if (parentPsgc === BARMM_SGA) {
    skipped.push({ code, why: "BARMM Special Geographic Area — no name source" });
    continue;
  }
  if (!barangays.some((b) => b.geometry)) {
    skipped.push({ code, why: "every barangay has a null geometry upstream" });
    continue;
  }

  const rings = dissolve(barangays);
  if (!rings.length) {
    skipped.push({ code, why: "barangays did not dissolve" });
    continue;
  }
  const geometry = toGeometry(rings);
  const point = centre(geometry);
  const probes = barangays
    .filter((b) => b.geometry)
    .flatMap((b) => ringsOf(b.geometry).flat());

  // Name: by PSGC where the code survived into 2023, by overlap for the cities
  // that were recoded when they became administratively independent.
  const match =
    named2019.find((n) => n.psgc === toOldPsgc(code)) ??
    tightestContaining(probes, named2019.filter((n) => n.geometry));
  if (!match) {
    skipped.push({ code, why: "no name in the 2019 layer" });
    continue;
  }

  // Province: the parent code where the source records one, otherwise whichever
  // province the outline sits in — or, for an island that sits in none, the
  // closest. Limasawa is off the coast of the province it belongs to.
  const province =
    provinces.find((p) => p.properties.psgc === parentPsgc) ??
    bestBy(provinces, (p) => overlap(probes, p.geometry)) ??
    provinces.reduce((a, b) => (nearness(point, b.geometry) < nearness(point, a.geometry) ? b : a));

  const target = shippedByProvince.get(province.properties.psgc);
  touched.add(province.properties.psgc);
  const fitted = snapToNeighbours(geometry, target.features);
  target.features.push({
    type: "Feature",
    properties: { name: match.name, psgc: code },
    geometry: fitted.geometry,
  });
  added.push({
    code,
    name: match.name,
    province: province.properties.name,
    rings: rings.length,
    snapped: fitted.moved,
  });
}

console.log(`added ${added.length}:`);
for (const a of added) {
  console.log(
    `   ${String(a.code).padStart(10)}  ${a.name.padEnd(24)} -> ${a.province.padEnd(20)} ${a.rings} ring(s), ${a.snapped} vertices snapped`,
  );
}
console.log(`\nskipped ${skipped.length}:`);
for (const s of skipped) console.log(`   ${String(s.code).padStart(10)}  ${s.why}`);

if (process.argv.includes("--write")) {
  for (const psgc of touched) {
    const data = shippedByProvince.get(psgc);
    data.features.sort((a, b) => a.properties.name.localeCompare(b.properties.name));
    fs.writeFileSync(`${TOWNS}/${psgc}.json`, JSON.stringify(data));
  }
  console.log(`\nwritten ${touched.size} province files.`);
} else {
  console.log("\ndry run — pass --write to update public/geo/municipalities");
}

// ---------------------------------------------------------------------------
// Build the place list behind the Analyze screen's location search.
//
// Reads the same PSGC boundary files the map draws (public/geo/provinces.json
// and public/geo/municipalities/<psgc>.json) and writes one small, flat list to
// public/geo/places.json: every province and every city/municipality, labelled
// "Town, Province" exactly the way lib/geo.ts's parseLocation reads locations —
// so anything picked from the search is guaranteed to land on the map.
//
// Each entry carries the centre of its boundary's bounding box, which is what
// the weather lookup is sent (coordinates always resolve; free-text names often
// don't). A bbox centre can fall just outside an oddly shaped town, but it is
// well inside the few-kilometre scale current weather is reported at.
//
// Usage: node scripts/build-places.mjs   (re-run whenever public/geo changes)
// ---------------------------------------------------------------------------

import fs from "node:fs";
import path from "node:path";

const GEO = path.join(process.cwd(), "public", "geo");

/** Province label as a researcher would write it (and as the map aliases it). */
function provinceLabel(name) {
  if (name.startsWith("NCR")) return "Metro Manila";
  return name.replace(/\s*\(Not a Province\)\s*$/i, "").replace(/^City of\s+(.+)$/, "$1 City");
}

/** "City of Tayabas" → "Tayabas City"; everything else unchanged. */
function townLabel(name) {
  return name.replace(/^City of\s+(.+)$/, "$1 City");
}

function centre(geometry) {
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
  const visit = (coords) => {
    if (typeof coords[0] === "number") {
      const [lon, lat] = coords;
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      return;
    }
    coords.forEach(visit);
  };
  visit(geometry.coordinates);
  const round = (n) => Math.round(n * 10000) / 10000;
  return { lat: round((minLat + maxLat) / 2), lon: round((minLon + maxLon) / 2) };
}

const provinces = JSON.parse(fs.readFileSync(path.join(GEO, "provinces.json"), "utf8"));
const places = [];
const seen = new Set();

for (const feature of provinces.features) {
  const province = provinceLabel(feature.properties.name);
  if (!feature.geometry) continue;

  if (!seen.has(province)) {
    seen.add(province);
    places.push({ label: province, town: "", province, kind: "province", ...centre(feature.geometry) });
  }

  const file = path.join(GEO, "municipalities", `${feature.properties.psgc}.json`);
  if (!fs.existsSync(file)) continue;
  const towns = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const town of towns.features) {
    if (!town.geometry) continue;
    const name = townLabel(town.properties.name);
    const label = `${name}, ${province}`;
    if (seen.has(label)) continue;
    seen.add(label);
    places.push({ label, town: name, province, kind: "town", ...centre(town.geometry) });
  }
}

places.sort((a, b) => a.label.localeCompare(b.label));
fs.writeFileSync(path.join(GEO, "places.json"), JSON.stringify(places));
console.log(
  `Wrote ${places.length} places (${places.filter((p) => p.kind === "town").length} towns, ` +
    `${places.filter((p) => p.kind === "province").length} provinces) to public/geo/places.json`,
);

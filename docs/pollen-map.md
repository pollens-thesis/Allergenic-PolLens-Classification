# Pollen map — boundary data

The map at `/map` shades Philippine provinces by how much pollen has been counted
in them, and drills into a province to shade its towns. This is where the
boundary data came from, what is missing from it, and how to regenerate it.

## Why no geo API

Nothing is fetched from a third party at runtime. The boundaries ship with the
app as static files under `public/geo/`:

| File | Contents | Size |
|---|---|---|
| `provinces.json` | 88 provinces and districts | ~260 KB |
| `municipalities/<psgc>.json` | one file per province, 1,613 towns total | ~650 KB across 88 files |

The country view always loads `provinces.json`. A province's towns are fetched
only when that province is opened, so no page load pulls more than about 40 KB
of town geometry (Palawan is the largest single file).

Shipping the data rather than calling a service was deliberate:

- **Reproducible and citable.** A thesis figure should not change because an
  upstream dataset was revised, or break because an endpoint was down.
- **No rate limits, keys, CORS or per-request attribution.** Nominatim asks for
  no more than one request a second; Overpass and the geoBoundaries API are fine
  for a one-off extract but poor on every page load.
- **Offline.** The rest of the app already works without a network. The map does
  too.

It also means no map library. With real polygons in hand, an inline SVG *is* a
map — there is no basemap to tile, nothing to lazy-load, and nothing that can
fail at runtime.

## Source

[`faeldon/philippines-json-maps`](https://github.com/faeldon/philippines-json-maps),
2023 edition, lowres. **MIT licensed**, generated from Philippine Statistics
Authority PSGC shapefiles (as of 31 December 2023) via
[`altcoder/philippines-psgc-shapefiles`](https://github.com/altcoder/philippines-psgc-shapefiles).

Path patterns on `raw.githubusercontent.com`, under `2023/geojson/`:

```
regions/lowres/provdists-region-<regionPsgc>.0.001.json     provinces in a region
provdists/lowres/municities-provdist-<provPsgc>.0.001.json  towns in a province
```

Region codes are the region number followed by eight zeros — `100000000` for
Region I through `1200000000` for Region XII, plus `1300000000` (NCR),
`1400000000` (CAR), `1600000000` (Caraga), `1700000000` (MIMAROPA) and
`1900000000` (BARMM). Seventeen in total.

## How the shipped files were produced

1. Fetch all 17 region files; merge their features into `provinces.json`.
2. For each of the 88 provinces, fetch its `municities-provdist-*` file.
3. Keep only `name` and `psgc` from the properties — the source also carries
   perimeter and area fields the map never reads.
4. Round coordinates: 3 decimal places (~110 m) for provinces, 4 (~11 m) for
   towns. At the zoom levels drawn, more precision is invisible and only costs
   bytes.

Rounding and property-trimming take the raw ~2.2 MB down to ~910 KB.

## What is missing from the source

Three gaps, all handled explicitly rather than silently:

**Highly Urbanized Cities have no polygon.** The PSA treats an HUC as
administratively independent of the province that surrounds it, so it appears in
neither the province list nor the province's town list. Lucena City is the case
that matters here — it is the busiest site in the seed data. Davao, Cebu,
Iloilo, Bacolod, Baguio and the rest are absent for the same reason. NCR cities
are unaffected, since NCR's districts decompose into cities normally.

These are drawn as points from `POINT_TOWNS` in `lib/geo.ts`. Add an entry there
for any other HUC that gets sampled:

```ts
export const POINT_TOWNS = {
  lucena: { label: "Lucena City", lon: 121.617, lat: 13.9314 },
};
```

Province-level totals are unaffected: they are derived from the province named
in the report's location, so a report collected in an HUC still colours the
province around it.

**Five towns ship without geometry** and are skipped: Pikit (Cotabato),
Kalayaan (Palawan), City of San Pedro (Laguna), Jala-Jala (Rizal) and Limasawa
(Southern Leyte).

**One province entry has no name.** PSGC `1909900000` is BARMM's Special
Geographic Area — the barangays transferred from Cotabato in 2019. It is
labelled explicitly in the build step, and its town file is empty.

Any sampled place that matches no polygon and has no point entry is listed under
the map as "not shown", so a missing boundary never reads as a missing hotzone.

## Matching a report to a place

`location` is free text of the form `"Town, Province"`. `parseLocation` in
`lib/geo.ts` splits it, and both halves are normalised the same way as the
boundary names: lowercased, `"City of "` prefix and `" City"` suffix stripped,
punctuation removed. That is what lets a researcher type `Tayabas` and match the
dataset's `City of Tayabas`.

`PROVINCE_ALIASES` covers names people type that are not the PSGC name — today
just `"Metro Manila"` and `"National Capital Region"` → `NCR`.

## Extending or replacing the data

To move to a different administrative level, or to refresh against a newer PSGC
release, refetch with the path patterns above and apply the same trimming. The
map itself is level-agnostic: it draws whatever `GeoFeature[]` it is handed and
keys places by normalised name, so only the files and the fetch URLs change.

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
| `municipalities/<psgc>.json` | one file per province, 1,633 towns total | ~860 KB across 88 files |

The country view always loads `provinces.json`. A province's towns are fetched
only when that province is opened, so no page load pulls more than about 45 KB
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

Rounding and property-trimming take the raw ~2.2 MB down to ~1.1 MB.

## The gap in the province layer, and how it was filled

The province-level source is incomplete. `municities-provdist-<prov>.json`
covers 1,613 of the country's 1,642 cities and municipalities; 29 are absent,
for two reasons:

**Highly Urbanized Cities are not in any province's town list.** The PSA treats
an HUC as administratively independent of the province around it, so it belongs
to no province's set. Sixteen are missing this way — Lucena, Cebu City,
Lapu-Lapu, Mandaue, Bacolod, Iloilo City, Baguio, Cagayan de Oro, Iligan,
Zamboanga City, Butuan, Tacloban, General Santos, Angeles, Olongapo and Puerto
Princesa. (Not every HUC: Davao City ships in the province layer as
`City of Davao`. NCR is unaffected — its districts decompose into cities
normally.)

**Five ordinary towns carry a null geometry** in that layer: Pikit, Kalayaan,
City of San Pedro, Jala-Jala and Limasawa.

**The remaining eight** are the municipalities of BARMM's Special Geographic
Area, PSGC `1909900000` — the barangays transferred from Cotabato in 2019.

### Recovering them from the barangay layer

The barangay layer has no such gap: every one of the 1,642 municities has a
file, and the barangays inside one tile it exactly. So a missing town's outline
can be recovered by dissolving its barangays — dropping every edge that two of
them share and stitching what is left into rings. `scripts/fill-missing-towns.mjs`
does this, and running it is what took the shipped set from 1,613 towns to
1,633:

```
node scripts/fill-missing-towns.mjs <path-to-philippines-json-maps> --write
```

It prints every name and parent province it derives, and writes nothing without
`--write`, because both are inferred rather than given:

- **Names** are not in the barangay layer. They come from the 2019 municity
  layer — by PSGC for the five ordinary towns, whose codes survived, and by
  overlap for the cities, which were recoded when they became independent. The
  overlap is measured against barangay vertices rather than the dissolved
  outline: an outline lies *on* the border it shares with its neighbours, where
  point-in-polygon between two editions is a coin toss. Where one candidate
  encloses another — Baguio City sits entirely inside Tuba — the tightest fit
  wins.
- **Parent provinces** come from the source's own parent code where it records
  one, and otherwise from which province the outline sits in. Limasawa sits in
  none, being an island off the coast of Southern Leyte, so it falls back to the
  nearest.

The recovered outline and its neighbours describe the same border but were
simplified in different passes, so they disagree by roughly a hundred metres —
a hairline gap once the map is zoomed in. Each new outline is therefore snapped
onto a neighbour's vertex wherever one is within ~1 km. Coastline is untouched:
the open sea has no neighbouring vertex to snap to.

### What is still missing

**Kalayaan (Palawan)** has a null geometry in every layer of both editions — the
Spratly claim has no polygon to recover. **The eight BARMM Special Geographic
Area municipalities** dissolve cleanly but cannot be named: they were carved out
of Cotabato towns in 2019, so they sit inside 2019 polygons carrying a different
town's name, and any positional match would confidently return the wrong one.
The script skips both rather than guessing, and says so when it runs.

Any sampled place that matches no polygon is listed under the map as "not
shown", so a missing boundary never reads as a missing hotzone.

## Matching a report to a place

`location` is free text of the form `"Town, Province"`. `parseLocation` in
`lib/geo.ts` splits it, and both halves are normalised the same way as the
boundary names: lowercased, `"City of "` prefix and `" City"` suffix stripped,
punctuation removed. That is what lets a researcher type `Tayabas` and match the
dataset's `City of Tayabas`.

`PROVINCE_ALIASES` covers names people type that are not the PSGC name — today
just `"Metro Manila"` and `"National Capital Region"` → `NCR`.

## Zoom and pan

Zooming is a transform on the drawn group — `translate(x, y) scale(k)` — not a
change of projection. Nothing is re-projected and no geometry is re-fetched:
the outlines are already at full source precision, they were just drawn small.
The maths lives in `lib/geo.ts` (`clampView`, `zoomAtPoint`, `fitView`) and the
gesture handling in `components/useMapZoom.ts`.

Four details are deliberate:

- **Pointer coordinates go through `getScreenCTM()`,** not the element's
  bounding rect. The SVG is capped at `max-h-[70vh]`, so a tall map is
  letterboxed inside its box and a rect-relative calculation drifts.
- **Move and release are tracked on the window, not by capturing the pointer.**
  Capturing retargets the following `click` to the SVG itself, which would break
  selecting a province by clicking its outline. A drag that travels more than a
  few units swallows its own click, so panning never selects.
- **Borders use `vector-effect="non-scaling-stroke"`** and labels divide their
  font size by `k`, so both keep their on-screen size at any zoom.
- **`touch-action` is `pan-y` until zoomed in, then `none`.** At fit there is
  nothing to pan, so the page keeps its vertical scroll and the map is not a
  scroll trap on a phone; once zoomed, the map takes the gesture.

Path strings, label anchors and bounds are memoised per projection. Panning
re-renders at pointer rate, and without that every frame would re-walk every
coordinate of all 88 provinces.

## Search and filters

Three controls narrow both the shading and the ranked list: a name search, a
region dropdown, and a Sampled/All toggle. `selectRows` in
`components/PollenMap.tsx` is the single pure function they all feed.

- **Search** matches on the same normalised form used to match reports to
  boundaries, so it behaves like the rest of the map — `tayabas` finds
  `City of Tayabas`.
- **Region** is offered on the country view only. Municipality files were
  trimmed to `name` and `psgc`, so towns carry no region code; the filter stops
  applying once you drill in.
- **Sampled/All** decides whether the panel is a ranking of hotzones or a
  gazetteer of every boundary. It defaults to Sampled.

Filtering frames what it found: the map fits to the bounds of the matches, and
non-matches are dimmed rather than hidden, so a result keeps its context. This
runs from the control that changed rather than from an effect on the filters —
changing the pollen type rebuilds the same list, and a view panned by hand
should stay where it is.

Because Sampled is the default, searching a real province with no reports would
otherwise read as "no such place". It does not: the empty state says *no
sampled* provinces match and offers to show the unsampled ones, and a search
with some sampled hits still reports how many more matched without reports.

## Extending or replacing the data

To move to a different administrative level, or to refresh against a newer PSGC
release, refetch with the path patterns above and apply the same trimming. The
map itself is level-agnostic: it draws whatever `GeoFeature[]` it is handed and
keys places by normalised name, so only the files and the fetch URLs change.

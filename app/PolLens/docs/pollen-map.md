# Pollen map — boundary data

The map at `/map` shades Philippine provinces by how much pollen has been counted
in them, and drills into a province to shade its towns. This is where the
boundary data came from, what is missing from it, and how to regenerate it.

## Why no geo API

Nothing is fetched from a third party at runtime. The boundaries ship with the
app as static files under `public/geo/`:

| File | Contents | Size |
|---|---|---|
| `provinces.json` | 82 provinces, 4 NCR districts, Isabela City and BARMM SGA | ~260 KB |
| `municipalities/<psgc>.json` | one file per province, 1,641 town boundaries | ~700 KB across 88 files |

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
The eight BARMM Special Geographic Area town boundaries use the 2023-10-24
barangay polygons from [`bendlikeabamboo/barangay-boundaries-repository`](https://github.com/bendlikeabamboo/barangay-boundaries-repository),
derived from NAMRIA's 2023-11-06 boundaries. Their official names and the
barangay transfers follow PSA's
[2024 creation notice](https://psa.gov.ph/content/eight-new-municipalities-bangsamoro-autonomous-region-muslim-mindanao).

Path patterns on `raw.githubusercontent.com`, under `2023/geojson/`:

```
regions/lowres/provdists-region-<regionPsgc>.0.001.json     provinces in a region
provdists/lowres/municities-provdist-<provPsgc>.0.001.json  towns in a province
```

Region codes are the region number followed by eight zeros — `100000000` for
Region I through `1200000000` for Region XII, plus `1300000000` (NCR),
`1400000000` (CAR), `1600000000` (Caraga), `1700000000` (MIMAROPA),
`1800000000` (Negros Island Region) and `1900000000` (BARMM). The 2023
geometry source has 17 region files; the two Negros province features now carry
the current NIR code.

## How the shipped files were produced

1. Fetch the 17 region files in the 2023 source; merge their features into
   `provinces.json`.
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
1,633 before the BARMM municipalities were added:

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

### BARMM Special Geographic Area towns

The PSA renamed the eight interim clusters as municipalities in 2024 and
transferred Dunguan, Macabual and Panicupan between them. Their boundaries are
generated by `scripts/build-sga-towns.mjs` from the 2023 NAMRIA-derived barangay
and special-area GeoJSON files. The script dissolves barangay polygons using
the post-transfer municipality assignments. Old Kaabakan uses its unchanged
Kabacan cluster outline because the 2023 extract has no separate Pedtad
barangay polygon.

Download the two inputs from release `v2026.4.13.0` and rebuild with:

```sh
curl -L --fail -o /tmp/psgc-barangays.geojson https://github.com/bendlikeabamboo/barangay-boundaries-repository/releases/download/v2026.4.13.0/barangays.geojson
curl -L --fail -o /tmp/psgc-special-geographic-areas.geojson https://github.com/bendlikeabamboo/barangay-boundaries-repository/releases/download/v2026.4.13.0/special_geographic_areas.geojson
node scripts/build-sga-towns.mjs /tmp/psgc-barangays.geojson /tmp/psgc-special-geographic-areas.geojson --write
node scripts/build-places.mjs
```

### Welding the seam

A recovered outline and its neighbour's describe the same border, but they were
simplified in different passes — the barangay layer and the province layer — so
they disagree by up to a kilometre. Left alone that shows as a white wedge
between the two once the map is zoomed in. Closing it takes two passes, because
the boundaries diverge in both directions:

1. **Each outline vertex is projected onto the nearest point of the neighbour's
   edge**, landing it *on* that segment. Snapping vertex-to-vertex is not
   enough: between two matched corners the neighbour draws one straight segment
   while the recovered outline wanders through several of its own, and the space
   between them stays open.
2. **The neighbour's own corners are inserted**, between any two points already
   on their border. Otherwise a boundary that bows away between two matched
   points gets its corner cut off by our straight segment, and the space it cuts
   stays empty. Requiring both ends to be on the border keeps this to the shared
   edge and off the coast.

After both passes the two boundaries run through the same points along their
shared border, and the seam closes.

**Which gaps may be closed is decided by the province outline, not by distance.**
A gap is welded only when the ground between the two boundaries is inside the
province — that is, when it is land. Distance cannot tell a border from a
strait: the channel between Lapu-Lapu and Mandaue is 600 m across, narrower than
several of Cagayan de Oro's genuine land seams. The province outline knows the
difference, because its edge is the coast and Mactan is a separate ring of it.
So Metro Cebu keeps its channel while Cagayan de Oro gets welded shut, and
coastline everywhere is left alone.

### What is still missing

**Kalayaan (Palawan)** has no boundary in the available editions, so that town
still cannot be drawn. The eight BARMM Special Geographic Area towns now have
current names and boundaries. Old Kaabakan uses its unchanged former cluster
outline because the source is missing a separate Pedtad polygon.

At country scope, every finalized report whose province matches one of the 88
map units is represented on the province map, even if the town boundary is
missing. The map counts finalized reports whose province matches no country
boundary. At town scope, sampled places without a matching polygon are listed
as not shown.

## Matching a report to a place

`location` is free text of the form `"Town, Province"`. `parseLocation` in
`lib/geo.ts` splits it, and both halves are normalised the same way as the
boundary names: lowercased, `"City of "` prefix and `" City"` suffix stripped,
punctuation removed. That is what lets a researcher type `Tayabas` and match the
dataset's `City of Tayabas`.

`PROVINCE_ALIASES` covers common variants including Metro Manila, North
Cotabato, and BARMM's Special Geographic Area. Former SGA cluster names and the
two municipality names changed in Q2 2026 resolve to their current boundaries.

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

## Reading the hot zones

**Quantile classes, not fraction-of-max.** Grain counts are heavily
skewed: one busy site and a long tail. Binning at quarters of the largest value
puts nearly everything in the bottom class, which is exactly the case where the
map should be telling places apart. `buildIntensityScale` in `lib/geo.ts`
classifies each place by where it falls *among the others*, so every class is
populated by construction. Duplicate breaks collapse, so three distinct values
give three classes rather than four with one unusable. Classes are computed from
the places currently in view, which is why the shading re-scales when you drill
into a province or switch taxon — a town's 9 grains is a hot zone among towns.

Fewer classes than ramp steps take colours spread across the whole ramp rather
than the first *n*, and a lone class takes the hot end: when one place is all the
data there is, the map's job is to say *here*, and the palest yellow says the
opposite. The legend states its own numeric breaks, since a quantile scale's
classes are not guessable from "fewer" and "more".

**The ramp is ColorBrewer YlOrBr, four classes** (`#ffffd4`, `#fed98e`,
`#fe9929`, `#cc4c02`), set in `INTENSITY_RAMP` in `lib/geo.ts`. It was chosen on
2026-09-30 from published scientific palettes (Viridis, Cividis, Magma, Inferno,
YlOrBr, Oranges) because IEEE figure practice asks for figures that read in
greyscale print and do not rely on red against green. IEEE publishes no heatmap
palette of its own; ColorBrewer rates YlOrBr colour-blind safe and print
friendly, and its lightness falls steadily from class to class. Ranking badges in
the side list switch to white text on dark fills (`readableOn` in
`PollenMap.tsx`) so the numbers stay legible on the darkest class.

Fill is the only encoding. Graduated circles over each centroid were tried —
they state magnitude independently of how large a polygon happens to be — but
with the classes fixed the shading already separates the places, and the circles
only crowded the towns they sat on.

Three fills are distinct on purpose: **not sampled**, **sampled but none of this
taxon found**, and the intensity classes. "We looked and found nothing" is a
different answer from "nobody has looked", and the map should not merge them.
Labels carry a parchment halo (`paint-order: stroke`) so a name stays readable
where it crosses a hot fill.

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

## Generating a location report

Filtering the map to a place is choosing a subject, so the map can hand that
choice straight to a document. Two entry points, one builder
(`downloadLocationReportPdf` in `lib/pdf.ts`):

- **A selected place** — "Generate Report for Lucban" in the detail panel.
- **The filtered set** — "Generate Report for These 5 Towns" above the ranked
  list, so a search does not have to be walked place by place.

Where a specimen report answers *what was on this slide*, a location report
answers *what has been found at this place*: the rolled-up reading, a stacked
composition bar, the ranked places when it covers several, and the individual
records behind the figures so the numbers can be traced back. The pollen-type
filter carries into it and is stated in the scope block — a Ragweed report says
so rather than looking like an undercount of everything.

Only sampled places are included, whatever the Sampled/All toggle says: a report
can only cover places that have reports. Places sampled with none of the selected
taxon *are* included, at zero — "we looked for ragweed here and found none" is a
finding.

## Extending or replacing the data

To move to a different administrative level, or to refresh against a newer PSGC
release, refetch with the path patterns above and apply the same trimming. The
map itself is level-agnostic: it draws whatever `GeoFeature[]` it is handed and
keys places by normalised name, so only the files and the fetch URLs change.

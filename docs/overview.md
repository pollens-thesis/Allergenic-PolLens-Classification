# PolLens — current state

A research console for identifying airborne pollen allergens from microscope
imagery. A researcher uploads slide photographs, the app counts and classifies
the grains on them, and the readings accumulate into a searchable history and a
map of where each pollen type is turning up.

This document describes what exists **today**. Where something is a stand-in for
a real service, it says so and points at the seam where the real one plugs in.

**Status: working front end, no backend.** Every screen is built and usable end
to end, and nothing is fetched from a third party at runtime. What is not real
yet: the detection model, the sign-in provider, and the server that would hold
reports for more than one browser. Each is isolated behind one module.

---

## Contents

- [Running it](#running-it)
- [The screens](#the-screens)
- [The data model](#the-data-model)
- [Where the seams are](#where-the-seams-are)
- [Shipped data](#shipped-data)
- [Design system](#design-system)
- [Project layout](#project-layout)
- [What is not built yet](#what-is-not-built-yet)
- [Further reading](#further-reading)

---

## Running it

```bash
npm install
npm run dev     # http://localhost:3000
```

```bash
npm run build   # production build
npm start       # serve the production build
npm run lint    # eslint
npx tsc --noEmit  # typecheck
```

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4.
Runtime dependencies are only `recharts` (the dashboard chart), `jspdf` (report
PDFs) and `lucide-react` (icons). There is no map library, no state manager, no
component library, and no data-fetching library.

> **This is not the Next.js you may know.** The version in `node_modules` has
> breaking changes against older releases. Read the relevant guide in
> `node_modules/next/dist/docs/` before writing code against it.

---

## The screens

| Route | What it is |
|---|---|
| `/` | Sign-in. Darkfield hero on the left, account chooser on the right. |
| `/dashboard` | Stat tiles, a 12-month pollen chart, and the full report table. |
| `/upload` | **Analyze specimen** — the working screen. Upload slides, describe the collection, run the analysis. |
| `/upload/result` | The reading the analysis produced: pollen detected, the slide, the details entered — plus notes, and the button that saves it as a report. |
| `/reports` | **Report** — every saved report, searchable and filterable by status. |
| `/reports/[sampleId]` | One report in full: slides, images, readings, notes, conditions, PDF export. |
| `/map` | Choropleth of the Philippines, shaded by grains counted. |
| `/dataset` | **Dead link.** Allergen reference — planned, not built. |

Navigation is a pinned sidebar; the account card at the bottom is also the link
to Settings, which has no nav entry of its own.

### Analyze specimen

The screen the app exists for.

- **A report is a batch, not a slide.** One collection session produces several
  slides, so a report holds `slides[]`, each with its own image, readings and
  note. Location, time and weather belong to the session; readings belong to the
  slide. Analysing five images and saving once produces one report with five
  slides.
- Drag-and-drop or browse, multiple files at once. Each slide is analysed in
  turn so progress is visible as results land.
- **Analysis and review are two screens.** `/upload` is where the batch is
  assembled and described; pressing *Analyze specimen* runs the readings and
  opens `/upload/result`, which is where the researcher reads them, writes the
  notes and saves. Nothing is a report until *Save report* is pressed there.
- The hand-off is a **draft** in IndexedDB, not a URL parameter — it carries the
  images themselves, and a draft survives a refresh of the result page. Edits
  made on that page (notes, and any correction to the collection details) are
  written back to the draft as they are typed, so a reload returns to the work
  rather than to the raw reading. Saving or discarding clears it; one draft
  exists at a time, and `/upload` says so if one is waiting.
- Collection time is recorded separately from analysis time — a slide is often
  read days after it was collected, and the map and the report list care about
  the former.
- Weather at collection is recorded per session, entered by hand.
- The researcher name defaults to the signed-in account, and is editable per
  batch.

### Report

The table searches sample id, location, pollen and date, and filters by status
(Completed / Processing / Needs review). A report page shows every slide with
its image, per-species grain counts and confidence, the note, and the conditions
at collection. Export is per-report PDF, or bulk JSON/CSV from Settings.

### Pollen map

All 88 provinces, shaded by grains counted; open one to see its towns. Filter by
pollen type to turn "where is there most pollen" into "where is there most
ragweed". Wheel/drag/pinch zoom with `+`/`−`/reset controls, a name search, a
region filter and a Sampled/All toggle — searching frames what it found and dims
the rest. See [`pollen-map.md`](./pollen-map.md) for the boundary data.

### Settings

Three sections: **Profile** (read-only, derived from the account), **Data &
storage** (counts, JSON/CSV export, clear local reports) and **Account** (sign
out). There are no analysis defaults and no editable profile fields — see below.

---

## The data model

Everything on every screen derives from `specimens` in `lib/data.ts`. Edit that
one array and the dashboard, reports, map and reference all stay consistent.

```ts
type Specimen = {          // one collection session = one report
  sampleId: string;
  collectedAt: string;     // "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm"
  location: string;        // free text, "Town, Province"
  slides: SpecimenSlide[]; // a batch, not a single reading
  weather: WeatherConditions | null;
  researcher: string;
  status: "Completed" | "Processing" | "Needs review";
};

type SpecimenSlide = {
  id: string;
  fileName: string;
  detections: SpecimenDetection[];  // one row per pollen type, richest first
  notes: string;
};

type SpecimenDetection = {
  speciesId: SpeciesId;
  grainCount: number;
  avgConfidence: number;
};
```

**Two detection shapes, on purpose.** A detection model reports one box per
grain, so its raw output is a flat `GrainPrediction[]`. The UI and the saved
record want one row per species, so `aggregateGrainPredictions` collapses the
list. Keeping both shapes means real model output can replace the mock without
touching a component — only the source of the predictions changes.

Combining slides is weighted by grain count, not by slide, so a report's average
confidence reflects grains rather than how the batch happened to be split.

Eight species ship in `speciesCatalog` — Poaceae, Betula, Alnus, Corylus,
Quercus, Ambrosia, Pinus, Artemisia — each with a genus, common name, code,
season, risk level and a colour used consistently across charts, badges and the
map.

Fourteen seed reports ship with the app, all from Quezon province. They are
treated as read-only history and always appear alongside anything saved locally.

---

## Where the seams are

Every external dependency is one module. Each is already `async` and returns
domain objects, so swapping in a real backend means replacing function bodies,
not touching components.

| Module | Today | Becomes |
|---|---|---|
| `lib/analysis.ts` | Deterministic mock detections | Roboflow inference |
| `lib/store.ts` | IndexedDB | `GET`/`POST /api/reports` |
| `lib/settings.ts` | localStorage | Session from the ID token |
| `lib/account.ts` | Derived from the email | Same, or Google's `hd` claim |

### Inference — `lib/analysis.ts`

`analyzeSpecimen(file)` returns detections after a short delay. The mock is
**seeded from the file itself**, so re-analysing the same image gives the same
reading — a thesis figure stays reproducible, and a demo doesn't change under
you. It generates raw per-grain predictions and runs them through the same
aggregation the real model output will use.

`fetchWeather(location)` returns `null` today, which is what keeps the
conditions fields manually entered. The Analyze screen already handles both.

### Persistence — `lib/store.ts`

Reports and their slide images live in IndexedDB (three stores: `reports`,
`images`, and `drafts` for the analysis that has been run but not saved yet),
so a saved report survives a refresh. Images are stored as blobs alongside
their slide.

**This is per-browser.** Reports saved on one machine are not visible on
another, and clearing site data deletes them. Settings has JSON/CSV export for
exactly this reason.

### Account — `lib/account.ts` and `lib/settings.ts`

The console is opened by an institution — a department or laboratory mailbox —
not by a person. So the profile is **read off the credential** rather than typed
beside it. The only stored field is the address; the name, institution and
avatar initials are all derived:

| Signed in as | Filed under |
|---|---|
| `pollen.lab@mseuf.edu.ph` | **MSEUF** |
| `research@bio.mseuf.edu.ph` | **MSEUF** — subdomains resolve to the same institution |
| `juan.delacruz2021@mseuf.edu.ph` | **MSEUF** — a trailing student number is not part of a name |
| `team@pollenlab.org` | **Pollenlab** |
| `n.elma@gmail.com` | **N Elma** — a public mail host says nothing about where you work |

A short all-letter domain label stays an acronym, because a Philippine
university is known by its initials rather than its spelled-out name.

This keeps one fact in one place: a name typed into a form can disagree with the
account that saved the report; a derived one cannot.

**Sign-in is a stand-in.** There is no provider wired up. The Google button
opens a mock account chooser that asks for the address — because the profile is
derived from it, signing in with nothing would leave the console with no idea
who saved a report. Signing out clears the stored account.

---

## Shipped data

Nothing is fetched from a third party at runtime. Boundaries, reports, images
and settings are all local, so the app works offline and a figure cannot break
because someone's endpoint went down.

| File | Contents | Size |
|---|---|---|
| `public/geo/provinces.json` | 88 provinces and districts | ~260 KB |
| `public/geo/municipalities/<psgc>.json` | 1,633 towns, one file per province | ~860 KB total |

The country view loads the provinces file; a province's towns are fetched only
when it is opened, so no page load pulls more than about 45 KB of town geometry.

With real polygons in hand an inline SVG *is* a map — there is no basemap to
tile, nothing to lazy-load, and nothing that can fail at runtime.

`scripts/fill-missing-towns.mjs` regenerates the 20 towns the upstream province
layer omits. See [`pollen-map.md`](./pollen-map.md).

---

## Design system

A herbarium specimen card: cream panels, botanical ink, a darkfield-microscopy
green for the sidebar and hero.

Tokens live in `app/globals.css` — `--panel`, `--ink`, `--field`, `--pollen`,
`--anther`, plus per-species line colours. Three fonts: **Fraunces** (display),
**Inter** (body), **IBM Plex Mono** (labels, figures, ids).

Two rules worth knowing before changing colours or type:

- **`--anther-ink`, `--leaf-ink` and `--ember-ink` exist for text.** The display
  accents are tuned to be read as *colour* — a chart line, a progress bar, a
  tinted badge — and land around 2.8:1 on these surfaces. The `-ink` variants
  are the same hues at a weight you can actually read.
- **Tailwind v4 mixes opacity in oklab**, so an opacity step lands lighter than
  plain alpha compositing predicts. `text-ink/60` computes to 3.9:1, not the 4.1
  the arithmetic gives. Measure in the browser, not on paper.

The whole app passes **WCAG AA** contrast — a DOM-level audit over all seven
pages reports zero text below the threshold. Nothing carrying words sits below
65% ink; nothing meant to be read is under 11.5px. `antialiased` is deliberately
absent from `<html>`: it thins every stroke on macOS.

---

## Project layout

```
app/                    routes; each page is a thin shell around a workspace component
  globals.css           design tokens and the base layer
  layout.tsx            fonts and the page shell
components/             all UI; workspaces hold the state for their screen
  AnalyzeWorkspace.tsx  upload and describe a batch, then run the analysis
  AnalysisResultWorkspace.tsx  the reading, the notes, and saving it as a report
  PollenMap.tsx         the map, its zoom/pan and its filters
  ReportsWorkspace.tsx  the saved-report list behind /reports and the dashboard
  ReportDetail.tsx      a full saved report
  useMapZoom.ts         wheel / drag / pinch zoom for an SVG map
lib/
  data.ts               types, species catalog, seed reports — the source of truth
  analysis.ts           inference seam (mock today)
  store.ts              persistence seam (IndexedDB today)
  account.ts            identity derived from the signed-in address
  settings.ts           the stored account
  geo.ts                projection, matching, zoom maths, colour ramp
  pdf.ts                per-report PDF
  export.ts             bulk JSON/CSV
docs/                   this file, the map's data notes, the reference-page plan
public/geo/             shipped boundary data
scripts/                one-off data build scripts
```

Pages are server components that render a client "workspace" holding the state
for that screen. There is no global store: what is shared between screens is
either derived from `lib/data.ts` or read through `useSettings()`.

---

## What is not built yet

**No trained model.** `lib/analysis.ts` returns deterministic mock detections.
The Roboflow dataset and model are the missing piece; the seam is ready for
them.

**`/dataset` — Allergen reference.** A dead link in the sidebar. The plan is
written in [`allergen-reference-plan.md`](./allergen-reference-plan.md) and is
unbuilt. Phase 1 needs no model and no dataset — it only needs the botanical
fields authored.

**Sign-in is mock.** No provider, no session, no server-side authorisation.
Anyone who can reach the URL can reach every screen.

**Reports are per-browser.** No server, so nothing is shared between machines or
users, and there is no backup other than the export buttons.

**Two places on the map have no polygon.** Kalayaan has a null geometry in every
layer of the upstream source, and the eight BARMM Special Geographic Area
municipalities can be drawn but not reliably named. Both are reported rather
than guessed at.

**No automated tests.** Verification has been typecheck, lint, production build,
and driving the real app in a browser.

---

## Further reading

- [`pollen-map.md`](./pollen-map.md) — where the boundary data came from, what
  is missing from it, how the gaps were recovered, and how zoom/search work.
- [`allergen-reference-plan.md`](./allergen-reference-plan.md) — the plan for
  the unbuilt `/dataset` page.
- `AGENTS.md` — conventions for anyone (or anything) writing code here.

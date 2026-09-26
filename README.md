# PolLens

A research console for identifying airborne pollen allergens from microscope
imagery. Upload slide photographs, count and classify the grains on them, and
build a searchable set of reports and a map of where each pollen type is turning
up.

Thesis project. Next.js 16 · React 19 · TypeScript · Tailwind CSS v4.

## Running it

```bash
npm install
npm run dev     # http://localhost:3000
```

```bash
npm run build   # production build
npm start       # serve it
npm run lint    # eslint
npx tsc --noEmit  # typecheck
```

## The screens

| Route | What it is |
|---|---|
| `/` | Sign-in — Google or Microsoft (work/school); only allowlisted accounts get in. |
| `/dashboard` | Stat tiles, a 12-month grain-count chart, and recent reports. |
| `/upload` | **Analyze Specimen** — assemble a batch of slides, describe the collection, run the analysis; lists your pending analyses to resume. |
| `/upload/result?report=…` | A **Pending** report: the reading beside each slide, notes, collection details (autosaved) — and **Generate Report**, which completes it. |
| `/reports` | **Reports** — every report (shared across researchers), filterable by status/location/date, PDF and Excel export. |
| `/reports/[sampleId]` | One report in full; its creator can flag it for review, mark it completed, or delete it. |
| `/map` | **Pollen Map** — the Philippines shaded by grains counted in completed reports, drilling into a province's towns. |
| `/dataset` | **Allergen Reference** — a searchable 6 × 4 atlas of the 23 species (photo, names, risk, code, grains in finalized reports); each card opens the full record. |
| `/settings` | Profile, Excel/CSV/JSON export, sign out. |

## What it does

**A report is a batch, not a slide.** One collection session produces several
slides, each with its own image, reading and note; the location, time and
weather belong to the session. Analysing five images and saving once produces
one report with five slides.

**Analysis and review are two screens, with the report on the server in
between.** `/upload` assembles and describes the batch; *Analyze Specimen* runs
each slide through the detection proxy and stores the batch as a **Pending**
report. `/upload/result` reviews it — notes and corrections autosave — and
*Generate Report* marks it **Completed**. A pending analysis can be resumed from
any device; a completed one can be flagged **Needs Review** by its creator.

**Every grain is boxed.** Detections keep each grain's position, so selecting a
pollen type draws that type's grains on the slide in its own colour and fades
the rest — on the report page and before saving alike. Boxes are stored as
fractions of the image, so they land correctly at any size and in the PDF.

**Two kinds of PDF.** A *specimen report* covers one saved record — masthead,
figures, composition, and a page per slide with its boxed image, table and note.
A *summary report* answers "what has been found here": generated from a place on
the map, or from reports ticked in the report list, it rolls them into one
reading with the records behind it.

**The map shows where, not just how much.** Provinces and towns are shaded by
quantile classes computed from the places in view, so the classes stay populated
however skewed the counts are, and the legend states its numeric breaks. Filter
by pollen type to turn "where is there most pollen" into "where is there most
ragweed".

**It works on a phone.** Every screen is usable down to 360px: the pinned rail
becomes a bar and a drawer, and the report table becomes cards rather than seven
columns scrolled sideways.

## Documentation

- **[AGENTS.md](AGENTS.md)** — start here: the agent/teammate brief (rules the UI
  must keep, how to run and verify, open tasks, what was delivered).
- [PRODUCT.md](PRODUCT.md) and [DESIGN.md](DESIGN.md) — product context and the
  current visual system ("Pollen Atlas Plates").
- **[docs/overview.md](docs/overview.md)** — what the app does today, the data
  model, where the seams to a real backend are, and what is still unbuilt.
- [docs/pollen-map.md](docs/pollen-map.md) — the shipped boundary data: where it
  came from, what was missing, how the hot zones are shaded, and how zoom and
  search work.
- [docs/allergen-reference-plan.md](docs/allergen-reference-plan.md) — the
  original plan for `/dataset` (superseded by the species atlas; see AGENTS.md).
- [docs/design-system.md](docs/design-system.md) — the earlier laboratory UI
  rationale (superseded by DESIGN.md; the legibility reasoning still applies).

## Status

Everything runs against the Django API in `../../api` (see the root repo's
`docs/deployment.md` for hosting). As of 2026-09-24:

- **Reports** live on the server and are shared by every signed-in researcher;
  only a report's creator (or staff) can edit, re-status or delete it.
- **Detection** goes through the API's Roboflow proxy. Until the trained model
  is deployed the API answers with a built-in sample reading, and the UI says
  so on every analysis that used it.
- **Sign-in** is real (Google, and Microsoft work/school accounts) and limited
  by a server-side allowlist; sessions renew automatically.
- **Species metadata** (common name, season, allergenic risk) is still being
  collected — the UI shows "Not Assessed" rather than a made-up level.

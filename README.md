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
| `/` | Sign-in. |
| `/dashboard` | Stat tiles, a 12-month pollen chart, and the report list. |
| `/upload` | **Analyze specimen** — assemble a batch of slides, describe the collection, run the analysis. |
| `/upload/result` | The reading it produced: pollen detected, the slide, the details entered — plus notes, and the button that saves it as a report. |
| `/reports` | **Report** — every saved report, filterable and exportable. |
| `/reports/[sampleId]` | One report in full: collection details, combined results, every slide. |
| `/map` | **Pollen map** — the Philippines shaded by grains counted, drilling into a province's towns. |
| `/settings` | Profile, local data, export, sign out. |
| `/dataset` | **Dead link.** Allergen reference — planned, not built. |

## What it does

**A report is a batch, not a slide.** One collection session produces several
slides, each with its own image, reading and note; the location, time and
weather belong to the session. Analysing five images and saving once produces
one report with five slides.

**Analysis and review are two screens.** `/upload` assembles and describes the
batch; pressing *Analyze specimen* runs the readings and opens `/upload/result`,
where they are reviewed, annotated and saved. The hand-off is a draft in
IndexedDB, so it survives a refresh, and edits are written back as they are
typed.

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

- **[docs/overview.md](docs/overview.md)** — what the app does today, the data
  model, where the seams to a real backend are, and what is still unbuilt.
  Start here.
- [docs/pollen-map.md](docs/pollen-map.md) — the shipped boundary data: where it
  came from, what was missing, how the hot zones are shaded, and how zoom and
  search work.
- [docs/allergen-reference-plan.md](docs/allergen-reference-plan.md) — the plan
  for the unbuilt `/dataset` page.
- [AGENTS.md](AGENTS.md) — conventions for anyone writing code here.

## Status

The front end is complete and usable end to end. Nothing is fetched from a third
party at runtime, so it works offline and a figure cannot break because someone
else's endpoint went down.

What is not real yet, each isolated behind a single module:

| Not real | Today | Where it plugs in |
|---|---|---|
| The detection model | Deterministic mock readings, seeded from the file so the same image always gives the same result | `lib/analysis.ts` |
| The server | Reports and their images live in the browser's IndexedDB, so they do not travel between machines | `lib/store.ts` |
| Sign-in | A stand-in chooser; no provider, no session | `components/SignInForm.tsx` |

Report status is also decorative: every saved report is stamped `Completed`, and
the `Processing` and `Needs review` records are seed data. See the overview for
the migration path and the full list of what is unbuilt.

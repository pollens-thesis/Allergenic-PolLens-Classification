# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

---

# PolLens frontend — agent brief

PolLens is a research console for identifying airborne allergenic pollen in
microscope slide images. This folder is the Next.js frontend, inside the
single project repo `pollens-thesis/Allergenic-PolLens-Classification` (the Django API is the
sibling folder `api/`). Read the root `AGENTS.md` for the layout; there are
no submodules and nothing to "bump".

Live: https://pollens-theta.vercel.app · API: https://pollens-api.onrender.com
(Render free tier — the first request after idle takes about a minute).

## Read these first (they are the authority)

| File | What it decides |
|---|---|
| `PRODUCT.md` | Who uses PolLens, its purpose, constraints, product principles, open adviser decisions |
| `DESIGN.md` + `.impeccable/design.json` | The visual system ("Laboratory Console"): palette, type roles, components, named rules |
| `.impeccable/surfaces/app-app-layout-tsx.md` | The direction contract the current look was built from |
| `../../docs/system-spec.md` (root repo) | Paper vs. frontend reconciliation; what's decided and what's still open |
| `README.md` | Screens and how the app works |

Precedence (from the root): for **implementation** (API contracts, fields,
flows) the frontend code is authoritative; for **scope, objectives,
terminology** the thesis paper is. Don't "correct" the frontend to match the
paper — flag conflicts in `docs/system-spec.md` instead.

## Rules the UI must keep

- **Nothing invented.** No made-up data, counts, claims or placeholder results.
  Risk levels stay "Not assessed" until UPLB supplies them; species text is
  botanical only and marked for UPLB verification.
- **Sample detections are labelled everywhere.** Until the trained model is
  deployed, the server returns a built-in sample reading. Reports with
  `sampleDetections` show a "Sample" stamp and notes on dashboard/map/PDF/CSV.
  Never drop these labels.
- **Finalized = Completed + Needs Review.** Pending analyses are excluded from
  dashboard figures, the chart, the map and exports (with a note saying so).
- **One oxide accent** (`--accent`) for the page's primary action, plate/figure
  numbers and focus — never decoration. Button intents (`components/Button.tsx`):
  `accent` primary; `caution` (red outline) leaving/removing — Sign Out,
  Discard, Delete, Flag for Review; `confirm` (green) Mark Completed; `resume`
  (ochre) Resume Analysis; `secondary` neutral; `destructive` final confirms.
- **Type roles:** IBM Plex Sans for interface text and headings; IBM Plex Mono
  only for IDs, codes and figures; Source Serif 4 italic for scientific names
  via `components/SpeciesName.tsx` / `.t-binomial`. Sizes follow `DESIGN.md`.
- **Unicode text:** Preserve characters such as ñ, accented vowels and combining
  marks in names, locations, botanical text and exports. Decode JWT payloads as
  UTF-8 and refresh cached profile names from `/me/`. Accent folding is for
  search matching only; never display or save the folded text.
- **Copy:** short labels and task guidance. Keep required sample, status,
  missing-data, export and recovery messages visible; put secondary metrics and
  explanations behind a clearly named disclosure.
- **Status is never colour alone** — stamps are dashed (Pending), solid
  (Completed), hatched (Needs Review).
- **Copy:** Title Case for buttons and headings, American spelling
  ("Analyzed"), "slide" inside pages (nav/page title "Analyze Specimen" stays,
  matching the paper), "save" = persist, "generate" = complete a report.
  Errors say what failed and how to recover; no HTTP codes or env-var names.
- **Keep every piece of information** when restyling or re-laying out a page.
- **Light theme** — chosen for bright bench light (adviser still to confirm vs.
  the paper's dark theme).

## Run it

```bash
npm install
cp .env.example .env.local      # then fill the values (ask the project owner privately)
npm run dev                     # http://localhost:3000
```

`NEXT_PUBLIC_API_BASE_URL` points at the API: `http://localhost:8000` with the
local Django server (`api/`, see `api/CLAUDE.md`), or the Render URL. The
Google/Microsoft client IDs are public values but still live only in
`.env.local` / Vercel settings. **Never commit `.env*` files** (they are
gitignored; only `.env.example` is tracked).

## Where things are

- `app/(app)/layout.tsx` — the signed-in shell (rail/mobile bar + main);
  `components/PageFrame.tsx` — one `PageHeader`/`PageBody` for every page.
- `lib/api.ts` (session-aware fetch), `lib/session.ts`, `lib/auth.ts`,
  `lib/microsoft.ts` — sign-in and JWT refresh.
- `lib/store.ts` — every report call to the API (list/get/create/update/delete).
- `components/AnalyzeWorkspace.tsx` → `components/AnalysisResultWorkspace.tsx`
  — analyze a batch, then review and Generate Report (serialized autosave).
- `components/ReportsTable.tsx`, `components/ReportDetail.tsx` — reports.
- `components/PollenMap.tsx` + `lib/geo.ts` — choropleth over PSGC boundaries
  (`public/geo/`, rebuilt by `scripts/build-places.mjs`).
- `components/AllergenReference.tsx` — the species atlas (grid, search,
  record dialog; photos in `public/species/`, credits from the API).
- `lib/pdf.ts`, `lib/export.ts` — PDF and Excel/CSV/JSON exports.
- `lib/species-catalog.ts` — live species from the API, with the bundled
  fallback in `lib/data.ts`.

## Before you push

```bash
npx tsc --noEmit
npm run lint
npm run build
```

Check the pages you touched at desktop and ~390px wide. Optional design scan
(if the Impeccable skill is available): `impeccable detect --json app components`
— known, deliberate exceptions: the 10.5px grain-box labels (`GrainOverlay`)
and 11px sign-in grain tags (`PollenField`).

## Deploying

Vercel builds this folder (Root Directory `app/PolLens`) from the `master`
branch of the project repo: a push to `master` deploys to production. Work on
a branch and merge (or open a pull request) when it's ready.

## Backend contract

The API lives in `api/` of the same repo. Don't guess fields — they are
documented in `api/CLAUDE.md` and `docs/system-spec.md`. If the frontend needs
something new from the API, agree it with the backend owner (0ban4) and deploy
the backend change first.

## Open tasks (frontend)

1. **Unplaced reports on the map** — at country scope, reports whose location
   isn't a recognized town/province are skipped silently; add a note
   ("N reports aren't on the map…").
2. **Power-user and help affordances** (from the Sept 18 critique): keyboard
   shortcuts, a small help/about entry. Low priority.
3. **Adviser/UPLB data** — species season and allergenic risk; UPLB to verify
   the species reference text (editable in Django admin → Species, not in code).
4. **Adviser decisions** still open are listed in `PRODUCT.md` and
   `docs/system-spec.md` (architecture sign-off, map pins vs. choropleth,
   theme, archive, system-info display, evaluation targets).
5. **Open sign-in (planned, not built)** — the owner plans to let any Google
   account sign in. It's a backend switch first (adviser item 12 in
   `docs/system-spec.md`); when it lands, sign-in page copy that says who may
   sign in, and the "not authorised" message, may need updating. Don't change
   them before the backend does.

## Delivered in the Sept 25–26 session (verified)

| Requirement | Status | Frontend commit |
|---|---|---|
| Show the signed-in person's real name; weather for the collection date/time (Open-Meteo); place search on the Pollen Map | Done | `173733e` |
| QA pass: result lifecycle (no lost edits, failed Generate can't complete a report), map matching (Metro Manila, Isabela City, province-only), search, dashboard, exports | Done | `2389c40` |
| Layout: one shell and page frame on every page, nothing removed | Done | `b76e721` |
| `PRODUCT.md` (Impeccable init) | Done | `cae1ac1` |
| "Pollen Atlas Plates" restyle, independent finish review (ship), `DESIGN.md` | Done | `8889ddc`, `a8608ca` |
| Polish + typeset + clarify (type roles, serif binomials, sample labels everywhere, clearer copy) | Done | `4ec43aa` |
| Colorized action buttons by consequence (incl. Sign Out) | Done | `3ba3bc0` |
| Allergen Reference as a 6 × 4 searchable species atlas with photos and full records | Done | `2d4d62d` (+ backend `7d17cdb`) |

## Delivered Sept 27 (local changes)

| Requirement | Status | Frontend commit |
|---|---|---|
| Laboratory Console redesign: IBM Plex interface/readout typography, concise task copy, compact panels, research dashboard with collection, species, location and recent report context | Done | working tree |
| Weather defaults to “Not recorded”; measurements stay blank until entered, and missing weather is omitted from saved reports | Done | working tree |

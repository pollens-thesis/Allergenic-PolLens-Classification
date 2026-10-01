# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **UPLB allergen researchers** (Dra. Fajardo's group) — the long-term users. They receive
  the system under the MSEUF–UPLB MOA and use it for ongoing allergen research: analyzing
  microscope slides from air-sampling collections and building a record of which allergenic
  pollen appears where and when.
- **The MSEUF thesis team** — analyze slides during development and evaluation.
- **The thesis panel and evaluators** — try the system during the defense and the
  ISO/IEC 25010 evaluation.

Primary setting: a lab computer next to the microscope (desktop). Phones must work, but they
are not the main place the work happens.

## Product Purpose

PolLens identifies and counts airborne allergenic pollen grains in microscope slide images,
stores each collection session as a report, and shows where each pollen type turns up across
the Philippines.

Success means both, with handover first: a strong thesis defense, but above all a tool the
UPLB group keeps using after handover because its counts and records can be trusted.

## Positioning

A detection model trained on an authenticated allergenic pollen dataset from UPLB, wrapped in
a research workflow: batch analysis of a collection session → review and correction →
generated report → a shared corpus mapped by Philippine province and town (PSGC boundaries).
It classifies only pollen of clinical (allergenic) significance in that dataset. It is not a
general-purpose botanical classifier.

## Operating Context

- A **report is one collection session**. It holds several slides, each with its own image,
  detections and note. Location, date/time, researcher and weather belong to the session.
- Lifecycle: analyze on `/upload` → stored as **Pending** → reviewed on `/upload/result`
  (notes and corrections autosave) → **Generate Report** → **Needs Review** → **Completed**
  after sign-off. A completed report can be flagged **Needs Review** again. "Finalised" means
  Completed + Needs Review for dashboard, chart and map counts; only Completed reports are
  exportable.
- Reports are a shared corpus: every signed-in researcher reads every report, and only the
  creator (or staff) edits, reviews or deletes it.
- Outputs researchers take away: a per-report PDF (with the boxed slide images), summary PDFs
  by place or selection, and Excel/CSV/JSON exports.
- Sign-in uses Google or Microsoft (work/school) accounts. Access is limited to allowlisted
  domains (up.edu.ph, mseuf.edu.ph) and individually added researchers.

## Capabilities and Constraints

- Detection runs through the backend's Roboflow proxy. **The model is live** (a two-stage
  Roboflow Workflow since 2026-10-01; the classifier still needs retraining, issue #31).
  If the server's mock switch is on it returns a built-in sample reading, and the UI must
  label that as sample detections, never as results; reports saved that way keep the label.
- Weather for the collection date and time comes from Open-Meteo, pre-filled and always
  editable by the researcher.
- The map is a choropleth over static PSGC boundaries, not tile maps with pins. Location
  entry is a search over the same place list, so saved locations always land on the map.
- Uploads are JPEG/PNG up to 25 MB per slide (iPhone "JPEG"s, which are MPO files, are accepted).
- Stack: Next.js 16 frontend on Vercel, and a Django REST API on Render (free tier; it sleeps
  when idle). Data is in Neon Postgres and slide images in private Cloudflare R2.
- The thesis paper is authoritative for scope, objectives and terminology. The frontend code
  is authoritative for implementation. Conflicts are recorded in `docs/system-spec.md` in the
  root repo.
- **Open decisions (with the adviser, not settled):** architecture sign-off (Render + Vercel
  vs. the paper's all-on-Vercel); map pins vs. choropleth; the paper's dark theme vs. the
  current light UI; an archive with year-over-year comparison; a system-information display;
  evaluation targets (accuracy/F1, which architectures, comparison with expert
  palynologists); per-species metadata (common name, season, allergenic risk).

## Brand Commitments

- Name: **PolLens**.
- Voice: plain, precise research language. Labels name what they count ("grains counted",
  not concentrations). Controls use Title Case. Spelling is American ("Analyzed").

## Evidence on Hand

- The 23-species allergen catalog (Allergen Reference), backed by the UPLB dataset.
- No validated accuracy figures, real detection results, testimonials or usage data exist
  yet. Do not invent them. Allergenic risk levels read "Not Assessed" until species metadata
  is supplied.

## Product Principles

1. **Trust over polish.** Never show made-up or placeholder data as results. Sample readings,
   unassessed risk and missing values are labeled as such.
2. **The slide is the evidence.** Every count stays traceable to the boxed grains on the image
   it came from.
3. **Built for the lab session.** Optimize for a researcher working through a batch at a desk.
   Phones are a secondary but supported view.
4. **The record outlives the thesis.** Choices should favor what UPLB can keep running and
   trust after handover.
5. **Nothing silently dropped.** Filters, exports and maps say what they left out and why.

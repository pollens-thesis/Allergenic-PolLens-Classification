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

PolleRgies identifies and counts airborne allergenic pollen grains in microscope slide images,
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
  detections and note. Location, collection date and researcher belong to the session.
- Collection time is not collected or returned. Other researchers can view shared reports,
  but only the report owner sees the researcher's name.
- Lifecycle: analyze on `/upload` → stored as **Pending** → reviewed on `/upload/result`
  (notes and corrections autosave) → **Generate Report** → **Needs Review** → **Completed**
  after sign-off. A completed report can be flagged **Needs Review** again. "Finalised" means
  Completed + Needs Review for dashboard, chart and map counts; only Completed reports are
  exportable.
- Reports are a shared corpus: every signed-in researcher reads every report, and only the
  creator (or staff) edits, reviews or deletes it.
- Outputs researchers take away: a per-report PDF (with the boxed slide images), summary PDFs
  by place or selection, and Excel/CSV/JSON exports.
- Appearance defaults to light and an expanded desktop sidebar. Researchers can
  choose dark mode and collapse the desktop sidebar to an icon rail; phones retain
  labelled drawer navigation. These preferences stay in the current browser,
  independent of sign-in, and do not alter specimen evidence or data colours.
- Sign-in uses Google or Microsoft (work/school) accounts, open to anyone (2026-10-16). Roles:
  user, verifier (approves or declines other people's reports) and admin (appoints verifiers,
  blocks accounts). A report is shared on the map, dashboard and trends only once a verifier
  has approved it; its owner always sees it. Only admins and the owner see the researcher name.

## Capabilities and Constraints

- Detection runs through the backend's Roboflow proxy. **The model is live** (a two-stage
  Roboflow Workflow since 2026-10-01; the classifier still needs retraining, issue #31).
  If the server's mock switch is on it returns a built-in sample reading, and the UI must
  label that as sample detections, never as results; reports saved that way keep the label.
  Owners and staff can annotate sample reports while they are in Needs Review, but those
  annotations are review-only and marked ineligible for model training.
- Weather conditions are outside the current collection workflow.
- The map is a choropleth over static PSGC boundaries, not tile maps with pins. Location
  entry is a search over the same place list, so saved locations always land on the map.
- Uploads are JPEG/PNG up to 25 MB per slide (iPhone "JPEG"s, which are MPO files, are accepted).
- Stack: Next.js 16 frontend on Vercel, and a Django REST API on Render (free tier; it sleeps
  when idle). Data is in Neon Postgres and slide images in private Cloudflare R2.
- The thesis paper is authoritative for scope, objectives and terminology. The frontend code
  is authoritative for implementation. Conflicts are recorded in `docs/system-spec.md` in the
  root repo.
- **Open decisions (with the adviser, not settled):** architecture sign-off (Render + Vercel
  vs. the paper's all-on-Vercel); map pins vs. choropleth; reconciling the paper's theme
  descriptions with the user-approved (2026-10-13) light-default UI and optional dark
  mode (built, without implying adviser sign-off); an archive with year-over-year comparison; a system-information display;
  evaluation targets (accuracy/F1, which architectures, comparison with expert
  palynologists); per-species metadata (common name, season, allergenic risk).

## Brand Commitments

- Name: **PolleRgies**.
- Descriptor: **Allergenic Pollen Identification in the Philippines**.
- Logo: the **P** and **R** carry the Rx-inspired identity, with a small crossed
  stroke on the **R**; a microscope lens forms the pollen “o”.
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

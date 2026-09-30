# Dashboard increment — local implementation

Status: Implemented and verified locally, 2026-09-28. Pushed in PR #17 on
2026-09-28; the PR is open and awaiting review. It is not merged or deployed.

## Purpose

Give a researcher a quick view of the latest collection
records, the pollen types with the highest saved grain counts, and the conditions
recorded during collection. Keep the existing Laboratory Console visual system.

## Confirmed scope and implemented choices

Confirmed: retain Collection Conditions, show at most five Recent Collections,
and add Top Pollen Counts. The latest local follow-up removes the Needs Review
and Pending cards because status controls are available on Reports.

The proposal's two choices are implemented in the local increment:

- Top Pollen Counts ranks the top five species by total grains counted across
  all matching finalized slides, rather than by collection occurrence.
- Pollen Occurrence by Location and Pollen Occurrence Over Time are no longer
  rendered on the dashboard. Reports and Pollen Map remain entry points for
  inspecting records and geography; no replacement occurrence view was added.

## Layout and behavior

Local follow-up (2026-09-28): 6 Months is now the default, and the descriptive
subtitle beneath each dashboard card heading is removed. Sample labels, grain
units, recorded-measurement coverage, missing-data notes and recovery messages
remain available.

Further local follow-up (2026-09-28): Location and Period appear before the
selected scope's figures. Only grains counted, pollen types and average model
confidence remain in the summary. Needs Review and Pending are separate compact
status cards. Collection/slide/location totals, the visible date window, Count
Details, Needs Attention heading and the finalized-totals explanation are removed.

Latest local follow-up (2026-09-28): remove the Needs Review and Pending cards.
The three pollen figures now span the full width below the filters; status
controls remain available on Reports.

- Keep Dashboard and Analyze Slides in the existing page header.
- Place Location and 6/12 Months first, followed by a compact summary of grains
  counted, pollen types and average model confidence. Confidence is unavailable
  when there are no counted grains; show a dash rather than an invented zero.
- Let the three-figure summary span the available width. Analysis status
  controls remain on Reports.
- On wide desktops, place Recent Collections in the wider left column and Top
  Pollen Counts in the right column. Place Collection Conditions beneath them,
  with its three measurements arranged across the available width.
- On narrow screens, use the reading order Filters → Pollen Summary → Recent Collections → Top Pollen Counts → Collection Conditions. Stack
  the condition measurements and wrap scientific names; no horizontal table is
  required.

Recent Collections shows up to five finalized collections directly, with no
“Show More” disclosure. Sort by collection date/time descending, then creation
time descending, retaining a stable identifier tie-break. Keep the sample ID,
location, collection date/time, top species, slide and grain counts, status, and
sample stamp readable on phones as well as desktops. Each record opens its
report; All Reports keeps the selected location, dates, and finalized status.

Top Pollen Counts is a ranked list of up to five species with positive counts.
Each row shows its scientific name, species code, a simple horizontal comparison
bar, and an exact grain count. Bars share a zero origin and scale to the largest
displayed count; numbers remain the primary evidence. Use the live species
catalog for names and colors. Rank by grains descending with a stable species-ID
tie-break. If fewer than five species have counts, show only those species.
Selecting a row opens the supporting finalized reports with species, location,
and inclusive dates preserved. Say “Grains counted on slides”; do not imply
airborne concentration, allergenic risk, seasonality, or weather causation.

Collection Conditions retains recorded temperature, humidity, and wind-speed
ranges, each measurement's recorded-collection count, and the weather-condition
breakdown. Per-measurement coverage shows how many collections have readings. It summarizes saved conditions
within the filters, not current weather. Do not stretch this surface to match
an unrelated card's height.

## Data rules and states

- All sections share the existing exact location scope and collection-date
  window. Defaults are All Locations and 6 Months.
- Finalized means Completed + Needs Review. Pending never contributes to grain totals, recent finalized collections, or
  collection conditions. Needs Review counts remain included and identifiable.
- Compute Top Pollen Counts across every slide of every included finalized
  collection, not merely the five recent records. Sum saved detection
  `grainCount` values by species; this is separate from occurrence counts.
- Keep the sample warning visible. Mark the ranking as Sample when sample
  detections contribute, and identify affected rows. Retain sample stamps on
  recent records. Sample counts remain explicitly illustrative.
- Loading uses neutral placeholders, without invented numbers. Fetch failures
  show an unavailable state and the existing Try Again action.
- Distinguish no finalized collections, collections with no positive pollen
  counts, and weather not recorded. Missing measurements are never zero;
  recorded zero readings remain valid. Zero pollen counts stay visible.
- Keep keyboard focus visible, status text and patterns, at least 44px control
  targets, and wrapped scientific names.

## Implementation record

1. The original plan left the grain-count ranking and occurrence-view removal
   proposed. The subsequent local implementation request proceeded with those
   choices, as recorded above.
2. Extended `lib/dashboard.ts` with grain totals by species and contributing
   sample metadata; capped `recentCollections` at five. Preserved the existing
   finalized, date, location, weather, and attention rules.
3. Added Top Pollen Counts using `SpeciesName`, sample/status primitives, the
   live catalog, and existing report-filter URL helpers.
4. Recomposed `DashboardWorkspace`, simplified `DashboardStats`, exposed five
   rows in `DashboardRecentCollections`, and adapted
   `DashboardCollectionConditions` to the full-width desktop / stacked mobile
   layout.
5. Updated README, dashboard-specific design guidance, the sidecar example and
   shared system-spec notes. Other pages and report drilldown behavior remain
   within the previous working-tree scope.

The existing reports API already supplies species-level grain counts and saved
weather. This increment required frontend work only; no new API endpoint.
The previous dashboard increment's staged and unstaged work was preserved on
the current branch. A separate branch/PR relationship remains future repository
work outside the user's local-only request.

## Acceptance and validation

The local increment met the following checks:

- Five matching recent finalized collections are visible when five exist;
  smaller result sets show their actual size and never filler records.
- Top counts include older matching collections and repeated species across
  slides, exclude Pending/out-of-scope records and zero-count taxa, and handle
  ties deterministically. Supporting-report links preserve all filters.
- Changing location or period updates every section together. Sample labels
  remain visible and missing weather remains distinct from zero values.
- Populated desktop at 1440px and mobile at 390px were visually inspected, with
  the attention queue near the top and metadata readable. Long-name wrapping,
  empty/loading/unavailable states and focus treatments were reviewed in source;
  aggregation tests cover empty results.
- Aggregation and five-record-limit checks pass in `npm run test:dashboard`
  (15/15 tests). `npx tsc --noEmit`, `npm run lint`, and `npm run build` pass.
  The scoped design detector reports no findings.

Desktop (1440px) and mobile (390px) captures were validated at
`.impeccable/review/desktop.png` and `.impeccable/review/mobile.png`. The finish
review cleared the implemented local scope without UI or data defects. Live
browser checks also confirmed that Lucban scopes all sections to one collection,
the Imperata count opens its exact supporting finalized report, and Six Months
updates counts, the attention queue and weather coverage together. The dashboard
was restored to All Locations / 12 Months after the initial verification. The
latest follow-up was inspected at desktop (1440px) and phone (390px) widths with
All Locations / 6 Months selected; type, lint and production-build checks pass.
The latest layout removes the status cards and shows the three pollen figures
across the available width.

## Tracking

The branch is `feat/16-dashboard-location-coverage`; PR #17 links issue #16,
requests review from the API owner, and has both its PR and issue board status
set to Review. GitHub shows the preview deployment as Ready and 2/2 checks
passing. No merge or production deployment has taken place; release follows
the workflow in `CONTRIBUTING.md`.

---
version: 1
slug: "components-dashboard-workspace-tsx"
primary_target: "components/DashboardWorkspace.tsx"
related_targets:
  - "components/DashboardStats.tsx"
  - "components/DashboardRecentCollections.tsx"
  - "components/DashboardTopPollenCounts.tsx"
  - "components/DashboardCollectionConditions.tsx"
---

Visitor mode: Operate. Scope: `/dashboard` only.

## Direction contract

THESIS: A compact pollen summary that lets researchers open their five most
recent finalized collections, compare the five
largest saved species grain counts, and read recorded collection conditions.

OWN-WORLD: Inherit the current Laboratory Console tokens, shared card treatment,
type roles, light theme, oxide primary action, patterned status stamps, and data
palette. This is a dashboard composition change within the existing system.

FIRST VIEWPORT: Shared exact-location and 6/12-month filters appear first, then
grains counted, pollen types and average model confidence in a compact summary.
The summary spans the available width; Needs Review and Pending controls remain
on Reports. Recent Collections
occupies the wider desktop column alongside Top Pollen Counts. Defaults are All
Locations and 6 Months; card headings have no descriptive subtitles. Collection
Conditions follows across the full width. Mobile stacks those sections in that
order with readable scientific names and no horizontal tables.

SIGNATURE INTERACTION: A species grain-count row opens supporting finalized
reports with the same inclusive collection dates, exact location and species.

DATA TRUTH: Top counts sum all matching finalized slides, not just recent
records. Pending is excluded from research figures. Needs Review remains
included. Samples stay labeled at collection, ranking and contributing-species
levels. Missing measurements remain distinct from recorded zero values. No
concentration, risk, seasonality, or causal weather claims.

LOCAL DELIVERY: The user requested local implementation. No push, PR, merge or
deployment is included in this increment. Preserve the previous working-tree
changes on the current branch.

Validation evidence: `.impeccable/review/desktop.png` (1440px viewport) and
`.impeccable/review/mobile.png` (390px viewport), both full-page captures from
the signed-in local dashboard. No generated assets or approved image comp.

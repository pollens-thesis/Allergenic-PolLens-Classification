---
version: 1
slug: "app-app-layout-tsx"
primary_target: "app/(app)/layout.tsx"
related_targets: []
---

Scope: every signed-in page (the (app) shell) plus sign-in. Visitor mode: Operate.

## Direction contract
THESIS: PolLens as a living reference atlas — each slide a numbered plate with a caption, each report an atlas entry. Refuses the clinical SaaS dashboard (soft cards, blue accent, stat tiles).
OWN-WORLD: plate paper #fafaf7, ink #171717, caption grey #6b6b66, hairline rules #d9d8d2, one oxide accent #8c2f1b reserved for plate/figure numbers and the primary action; the 23 species colours stay as the data palette. Square-cornered plates with hairline frames, no soft shadows; captions under a thin rule. Source Serif 4 for titles and captions, Atkinson Hyperlegible for UI, Atkinson Hyperlegible Mono tabular for IDs and figures; small-caps plate labels.
STORY: a researcher reads every count against the plate it came from and trusts it, because nothing is decorative or invented.
FIRST VIEWPORT: result page — the slide set as Plate N with hairline frame, figure number and caption line (file, grains, dominant species); detections read as the plate's key beside it; serif page title above.
FORM: IMPECCABLE'S PICK (Pollen Atlas Plates), rank 1 of the grounded list; seed d7b2f5e0.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Constraints: light default (bright bench light), with user-selectable dark mode approved 2026-10-13; keep the layout pass and every piece of information; no fake scale bars or magnification (images carry no calibration).

## Appearance and navigation extension (2026-10-13)
The original direction above is historical. This extension keeps the established Laboratory Console identity recorded in DESIGN.md; it narrowly supersedes the light-only constraint, without replacing the visual world or resolving unrelated historical drift.

- Desktop (`lg`, 1024px+) uses a 240px expanded sidebar or an 80px icon rail. The toggle stays visible; links, Help & About, theme and account controls retain accessible names and title hints. The toggle announces its action and expanded state; active navigation keeps `aria-current`.
- Mobile keeps the 56px header, compact theme control and fully labelled 17rem drawer (max 85vw). Stored desktop collapse never changes mobile navigation labels.
- Theme controls appear in the desktop rail, mobile header, Account & Settings → Appearance, and on sign-in. The labelled sidebar control in Appearance is desktop-only.
- Default: light theme and expanded desktop sidebar. `pollens.appearance.v1` stores theme and desktop collapse locally per browser, separately from authentication, with same-page and cross-tab synchronization. Blocked storage falls back to current-page memory. The early root script restores both before the first content paint.
- Dark mode maps the same semantic roles through the `dark-*` tokens in DESIGN.md and the sidecar. Native controls, toasts, cards and sign-in surfaces follow the chosen theme. Specimen pixels, catalog photos, species colours, map data fills and the neutral #2a2a28 viewer surround stay fixed. Map badge text uses constant dark ink on light fills and white on dark fills.
- This is the user's feature decision, not adviser sign-off on the paper's theme descriptions.

## Dark refinement (2026-10-13)
The user-requested refinement keeps the Laboratory Console identity, light default, saved appearance behaviour and 240px/80px desktop navigation. The current dark palette uses a deeper charcoal page, lifted work panels, darker navigation and recessed fields. Separate semantic roles for navigation, hover, fields, selected controls and neutral actions are recorded in DESIGN.md and the sidecar; light aliases preserve incumbent visuals.

Dashboard period, Reports status and Pollen Map visibility selections use subdued charcoal fills with a 1px inset outline. Neutral filled actions use a related fill and distinct hover. Active section links use an oxide wash with a 38% oxide inset outline. Enabled neutral-border editable fields have a darker fill and clearer boundary; invalid/error and disabled states keep their own treatments. Shared hover surfaces and text are tuned for readability: measured minima (rounded to two decimals) are 5.11:1 for foregrounds, 3.61:1 for field borders against panels, 3.51:1 for the selected outline against its fill, and 6.25:1 for filled action labels.

Specimen pixels, catalog photos, scientific data palettes, map fills and the #2a2a28 viewer surround remain fixed. This is a refinement of the established world, with earlier historical decisions and adviser reconciliation preserved. FINISH still requires independent review and documentation of the shipped result.

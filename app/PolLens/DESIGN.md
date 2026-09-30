---
name: PolLens
description: A palynology research console set as a living reference atlas; every slide a numbered plate, every report an atlas entry.
colors:
  page-grey: "#ecebe6"
  plate-paper: "#fafaf7"
  well: "#f1f0eb"
  hairline: "#d9d8d2"
  hairline-strong: "#b3b1a8"
  ink: "#171717"
  caption-grey: "#4d4c47"
  faint-grey: "#5f5e59"
  oxide: "#8c2f1b"
  oxide-hover: "#742617"
  oxide-active: "#5e1f13"
  oxide-wash: "#8c2f1b17"
  on-oxide: "#ffffff"
  status-green: "#1f6a3a"
  status-green-wash: "#1f6a3a14"
  status-ochre: "#8a5a00"
  status-ochre-wash: "#8a5a0014"
  status-red: "#b3261e"
  status-red-wash: "#b3261e14"
  viewer-surround: "#2a2a28"
  frontispiece-paper: "#e3e1da"
  frontispiece-paper-deep: "#d9d7cf"
  frontispiece-grain: "#8c2f1b"
  frontispiece-grain-soft: "#9c4a33"
typography:
  display:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "2.75rem"
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "1.65rem"
    fontWeight: 600
    letterSpacing: "-0.025em"
  figure:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "1.75rem"
    fontWeight: 600
    fontFeature: "lnum, tnum"
  title:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    letterSpacing: "-0.025em"
  binomial:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "15.5px"
    fontWeight: 600
  caption:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
  plate-label:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "12px"
    fontWeight: 500
  body:
    fontFamily: "IBM Plex Sans, system-ui, Segoe UI, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    fontFeature: "tnum"
  body-small:
    fontFamily: "IBM Plex Sans, system-ui, Segoe UI, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 400
  mono:
    fontFamily: "IBM Plex Mono, ui-monospace, Consolas, monospace"
    fontSize: "12.5px"
    fontWeight: 500
rounded:
  sm: "1px"
  md: "2px"
  lg: "2px"
  xl: "3px"
spacing:
  gutter-mobile: "16px"
  gutter-tablet: "24px"
  gutter-desktop: "40px"
  plate-padding: "16px"
  plate-gap: "16px"
  width-wide: "1440px"
  width-medium: "1024px"
  width-narrow: "768px"
components:
  button-accent:
    backgroundColor: "{colors.oxide}"
    textColor: "{colors.on-oxide}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    typography: "{typography.body}"
  button-accent-hover:
    backgroundColor: "{colors.oxide-hover}"
  button-accent-active:
    backgroundColor: "{colors.oxide-active}"
  button-secondary:
    backgroundColor: "{colors.plate-paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-secondary-hover:
    backgroundColor: "{colors.well}"
  button-ink:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.page-grey}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-destructive:
    backgroundColor: "{colors.status-red}"
    textColor: "{colors.on-oxide}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-caution:
    backgroundColor: "{colors.plate-paper}"
    textColor: "{colors.status-red}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-confirm:
    backgroundColor: "{colors.plate-paper}"
    textColor: "{colors.status-green}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-resume:
    backgroundColor: "{colors.plate-paper}"
    textColor: "{colors.status-ochre}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-sm:
    padding: "6px 12px"
  plate:
    backgroundColor: "{colors.plate-paper}"
    rounded: "{rounded.lg}"
    padding: "{spacing.plate-padding}"
  stat-well:
    backgroundColor: "{colors.well}"
    rounded: "{rounded.md}"
    padding: "12px"
  input-field:
    backgroundColor: "{colors.plate-paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    typography: "{typography.body-small}"
  nav-item:
    textColor: "{colors.caption-grey}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
  nav-item-active:
    backgroundColor: "{colors.well}"
    textColor: "{colors.ink}"
  status-stamp-completed:
    backgroundColor: "{colors.status-green-wash}"
    textColor: "{colors.status-green}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  status-stamp-pending:
    textColor: "{colors.status-ochre}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  status-stamp-needs-review:
    textColor: "{colors.status-red}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
---

# Design System: PolLens Laboratory Console

## Overview

**Creative North Star: "The Laboratory Console"**

PolLens is a focused workspace for examining microscope slides and maintaining research records. It should feel precise, legible and calm at a bright lab bench. Short labels and a clear task hierarchy keep attention on the slide, its detections and the collection details. The warm grey page, paper surfaces, hairline rules and oxide action colour remain; species colours stay attached to data.

IBM Plex Sans carries the interface and IBM Plex Mono marks IDs, codes and figures. Source Serif 4 italic distinguishes scientific names from surrounding controls. Work surfaces use generous paper cards with a quiet shadow, while controls, data rows and microscope plates retain compact geometry. Information stays grouped by task. Required sample, status, missing-data and recovery messages remain visible.

Do not invent measurements, model performance, calibration marks or instrument readouts. The interface should show only what the image or report supports.

**Key Characteristics:**
- Warm grey page, plate-paper cards, hairline frames and restrained card shadows.
- One oxide accent for plate/figure numbers, the primary action and focus.
- IBM Plex Sans for the interface; IBM Plex Mono for IDs, codes and figures; Source Serif 4 italic for scientific names.
- Short page titles, compact controls and secondary details behind clear disclosures.
- Rounded work cards (20px); controls, stamps and embedded data marks keep compact corners (1–3px).
- Status stamps that differ by pattern (dashed, solid, hatched) as well as by colour.
- Species colours and the map ramp are data, never decoration.

## Colors

A near-achromatic warm paper palette with one oxide accent. Status colours are muted and each one is paired with a pattern. Saturated colour is left to the data.

### Primary
- **Oxide** (#8c2f1b): plate and figure numbers ("Slide 1", "Slide 2 of 3"), the primary action on a page (Download PDF, Save, Analyze), inline text actions, the focus outline, the selected detection row's border, and the `accent-color` of native checkboxes. It darkens to **Oxide Hover** (#742617) and **Oxide Active** (#5e1f13). **Oxide Wash** (#8c2f1b, ~9%) fills a selected key row. Text on oxide is white.

### Neutral
- **Page Grey** (#ecebe6): the page behind every plate, and the translucent sticky page header (85% with backdrop blur).
- **Plate Paper** (#fafaf7): every plate, input, table row, the sidebar rail and the mobile bar.
- **Well** (#f1f0eb): sunken strips inside a plate (stat/summary strips, the active nav item, hover fills).
- **Hairline** (#d9d8d2): plate frames, rules, table dividers and the 1px gaps of the ruled stat plate.
- **Hairline Strong** (#b3b1a8): hover, active and selected borders, and the scrollbar thumb.
- **Ink** (#171717): all primary text and headings, and the ink button.
- **Caption Grey** (#4d4c47): secondary text, descriptions and caption labels.
- **Faint Grey** (#5f5e59): tertiary text, counts inside chips and quiet icons. It still passes AA on every surface.
- **Placeholder Grey** (#6d6c66): empty-field hints, visibly lighter than entered ink text while keeping AA contrast on plate paper and wells.
- **Viewer Surround** (#2a2a28): the neutral, unsaturated dark field behind slide images, so the surround does not shift how the stain reads.

### Status
- **Status Green** (#1f6a3a, wash #1f6a3a14): Completed.
- **Status Ochre** (#8a5a00, wash #8a5a0014): Pending and warnings. It is deliberately not the accent.
- **Status Red** (#b3261e, wash #b3261e14): Needs Review, destructive actions and errors.

### Frontispiece (sign-in only)
- **Frontispiece Paper** (#e3e1da) and **Deep** (#d9d7cf) set the sign-in plate. **Frontispiece Grain** (#8c2f1b) and **Grain Soft** (#9c4a33) draw its illustrated pollen grains. These tokens do not appear inside the signed-in console.

### Data palettes (not UI colours)
- **Slide overlay palette** (Okabe–Ito without black): #E69F00, #56B4E9, #009E73, #F0E442, #0072B2, #D55E00, #CC79A7. Colours are assigned per report in order of abundance, so every type on a slide gets a distinct colour and keeps it across slides. Every box also carries its species code.
- **Catalog series colours** (charts): #2a78d6, #eb6834, #1baf7a, #eda100, #e87ba4, #008300, #4a3aa7, #e34948, #0891b2. These are nine hues cycled across the 23 taxa. Chart legends always name the taxon.
- **Map intensity ramp** (quantile classes, ColorBrewer YlOrBr, pale yellow to burnt orange): #ffffd4, #fed98e, #fe9929, #cc4c02. Sampled-but-zero areas use #e4e4e7 and unsampled areas use #f4f4f5, so "we looked and found nothing" differs from "no data".

### Named Rules
**The One Oxide Rule.** Oxide marks a plate or figure number, the page's primary action, an inline text action, a selection, or focus. It does nothing else. It never tints a heading word, an icon or a background for mood.

**The Data Is Not Decoration Rule.** Species colours and the map ramp only encode data. They never style chrome, and chrome colours never stand in for a species. Wherever a data colour appears, a code, name or number says the same thing.

## Typography

**Interface:** IBM Plex Sans (system UI fallback), 14px body text and 13px dense labels.
**Identifiers:** IBM Plex Mono for sample IDs, species codes and aligned figures.
**Taxonomy:** Source Serif 4 italic for scientific names only.

Use a compact, practical hierarchy: page titles at 26px, section titles at 16px, and body copy at 14px. Field labels use sentence case at 13px. Plate labels are concise and use Plex Mono at 12px. Numbers use tabular figures. The root page does not apply font smoothing that thins small strokes on light surfaces.

Copy should name the task or data directly. Keep essential status, sample, missing-data, export and recovery information in view; place secondary metrics or longer explanations in an explicitly labeled disclosure.

### Named Rules
**The Plain Label Rule.** Labels use sentence case and name the field or value directly. Use oxide only for the primary action, focus and concise slide references.

**The Mono Means Identifier Rule.** The mono face is for things you would copy, compare or count: IDs, species codes, counts and figures. It is not for prose, buttons or headings. The PolLens wordmark (mono, uppercase, 0.18em tracking) is an identity asset and sets no precedent.

## Layout

The signed-in console is a two-column shell. A pinned plate-paper rail sits on the left from `lg` (1024px) up, and a content column sits to its right. Below `lg` the rail becomes a fixed 56px plate-paper bar with a right-hand drawer (17rem, max 85vw) that shows the same nav labels, never an icon-only tab bar.

Every page uses one page frame. A compact full-bleed header with a hairline bottom rule, sticky from `lg` up, holds the h1 and an optional back link or useful description. The body sits below it. Header and body share one of three left-aligned measures: **wide** for workspaces, tables and the map, **medium** for a single reference table, and **narrow** for settings and single-column forms. Gutters step 16 → 24 → 40px. Header padding is 16–20px; body vertical padding is 20–24px.

Inside the body, standalone work surfaces use the shared `card-panel` treatment and 16–20px task-specific padding. The result view pairs the slide (3fr, sticky on `xl`) with its key (2fr). Report detail groups each slide with its detections and notes. Tables, embedded data rows and fields stay compact while preserving comfortable targets.

## Elevation & Depth

Depth stays quiet: page grey behind, plate paper on top, sunken wells inside, and a 1px hairline frame around each card. Shared cards use a 20px radius and a subtle two-layer shadow; hover strengthens the border and lifts the shadow slightly. Embedded rows, inputs, chips and the slide image frame keep their compact geometry. Avoid glows and decorative gradients. The only blur is the sticky page header's translucent page-grey band, which keeps content legible as it scrolls under.

### Named Rules
**The Quiet Card Rule.** Use `card-panel` for a standalone work surface, with a 20px radius, hairline frame and restrained shadow. Use `card-well` for a secondary inset summary. Keep controls, rows, species marks and the microscope image frame compact; card styling should clarify hierarchy, not decorate data.

## Shapes

Standalone cards use a 20px radius. Controls, fields, buttons and compact data rows use 1–3px corners; the corners of microscope image frames remain restrained so the imagery stays central. Circles are reserved for the wordmark's ring-and-dot, avatar initials and legend dots. Species swatches are 2px-cornered squares. Secondary summaries use a softly rounded `card-well` inside their parent card.

## Components

### Buttons
Quiet and exact, with no gradient and no shadow.
- **Shape:** square-cut (2px). Medium weight. 14px text at 8px × 16px, or 12.5px at 6px × 12px for small.
- **Accent (primary action):** oxide with white text, darkening on hover and on press. One per view: the action the page exists for.
- **Secondary:** plate paper, ink text and a hairline frame. Hover raises the border to Hairline Strong and fills with Well. This is the default for neutral actions (Export Excel/CSV/JSON, Try Again, Keep Analysis).
- **Consequence outlines (caution / confirm / resume):** plate paper with text and a 40% frame in a status hue, filling with that hue's wash on hover. The colour says what the action does to the record, in the same hue as the stamp it leads to: **caution** (status red) for leaving or removing (Sign Out, Discard, Delete, Flag for Review), **confirm** (status green) for Mark Completed, **resume** (status ochre) for Resume Analysis. Each keeps its label and icon, so colour is never the only cue.
- **Destructive:** status red with white text. Hover drops to 90% opacity.
- **Ink / Ghost:** an ink button (ink ground, page-grey text) and a ghost button (caption-grey text that fills with Well on hover) exist in the primitive for rare use.
- **Motion:** colour transitions at 120ms on `cubic-bezier(0.16, 1, 0.3, 1)`, and a 0.97 press scale. Disabled buttons drop to 50% opacity.
- **Focus:** a 2px oxide outline, offset 3px, on every interactive element.

### Chips (species filters)
- **Style:** a hairline frame on half-transparent plate paper, 12.5px text, a 2px-cornered species swatch, the mono species code, then the count in faint grey.
- **State:** the selected chip takes a Hairline Strong border and ink text over a plate-paper highlight that slides between chips on a spring. "All Types" leads the row.

### Cards / Containers (work cards + plates)
- **Corner Style:** 20px for standalone work cards; 2px for the nested microscope image frame and compact data surfaces.
- **Background:** plate paper on page grey. Wells inside use Well.
- **Shadow Strategy:** subtle two-layer shadow on standalone cards, slightly deeper on interactive hover (see Elevation & Depth).
- **Border:** a 1px hairline.
- **Internal Padding:** 16–20px by default. The plate title uses IBM Plex Sans and sits on a baseline row with its mono slide label at the right.
- **Dashboard:** shared Location and Period controls come first. A full-width compact summary shows grains counted, pollen types and average model confidence. Analysis status controls remain on Reports. Recent Collections sits in the wider left column beside Top Pollen Counts; the paired cards stretch to the same height and align their headers. Collection Conditions follows across the full width. Phones stack these sections in the same reading order.

### Inputs / Fields
- **Style:** full-width plate paper, a 1px hairline frame, 2px corners, 8px × 12px padding, medium-weight ink for entered/selected values, and regular-weight placeholder-grey hints. The label sits above in 12.5px caption grey or as a caption label.
- **Focus:** the shared 2px oxide outline at a 3px offset.
- **Native controls:** checkboxes and radios take `accent-color` oxide.

### Navigation
- **Rail:** plate paper with a hairline right border. The wordmark sits at the top, then 13.5px medium nav items with 16px line icons (1.75 stroke). The account card is pinned to the foot under a hairline rule and is the only way into Settings.
- **States:** the default item is caption grey. Hover and active fill with Well and turn ink. The active state also carries `aria-current` and holds across a section's sub-pages.
- **Mobile:** a fixed bar and a drawer that springs in from the right. The drawer can be dragged or Escaped closed, and page scroll locks while it is open.

### Status Stamps
Never colour alone. Each status is a 1px-cornered stamp with its own pattern, so the three read apart in greyscale, in print and for colour-blind readers.
- **Pending:** a dashed ochre outline with no fill. It is not yet signed off.
- **Completed:** a solid green outline on a green wash.
- **Needs Review:** a red outline over a 135° hatch of red wash (4px bands).
- Always labelled in words, at 12px medium.

### Specimen Plate (signature)
The slide image sits on the viewer surround inside a hairline-framed plate. Below it, a hairline-ruled caption strip gives the oxide plate label, the file name, the grain count and the dominant species in serif italic, with a mono "n/N shown" readout and a Labels toggle at the right. A small dark "Open Inspector" tab at the top right opens the full-screen inspector. Clicking the image does the same. The plate shows only what the image carries: no scale bar, no magnification and no calibrated units.

### Key Row (signature)
One detection per row, sitting beside the plate as its key. Each row has a species swatch, the serif-italic binomial, the mono code, and the risk badge. The mono count and "grains" are right-aligned with a confidence bar. The selected row takes an oxide border on an oxide wash, and selecting a row boxes that type on the plate.

### Species Card (Allergen Reference)
The Allergen Reference is an atlas of plates: a searchable grid, 6 across from `xl` (6 × 4 for the 23 species), 4 at `lg`, 3 at `sm`, 2 on phones. Each card is a hairline plate: a 4:3 photo over the **binomial** (serif italic 600, 16px, the primary) and the **plant names** below it (English · Filipino, 13px caption grey, the secondary), the risk stamp, and a footer rule with the species swatch and mono code on the left and the grain count on the right. The whole card is the button; it opens the full record in a dialog (photo with its credit line, plate-label code, binomial title, names, family, description, a ruled grid of readings, where it grows in the Philippines, and the source line). Search matches scientific name, English and Filipino names and code, accent- and case-insensitively. Photos are freely licensed (Wikimedia Commons) and always credited; a missing photo shows a "No photo yet" plate, never a stand-in.

### Dashboard Metrics
The dashboard leads with an exact-location select and a 6/12-month switch, defaulting to 6 Months. The selected scope's grains counted, pollen types and average model confidence appear immediately below in a compact three-column summary. Confidence shows a dash when there are no counted grains. The summary spans the available width; Needs Review and Pending controls remain on Reports. Collection/slide/location totals, the visible date window, Count Details and the Needs Attention heading are removed. Card headings lead directly into their data without descriptive subtitles. From wide desktop sizes, Recent Collections occupies the wider left column beside Top Pollen Counts; Collection Conditions spans the full width below. Phones stack these sections in that order.

Recent Collections shows up to five finalized records directly. Sample ID, location, collection date/time, top species, slide and grain counts, status and sample stamps stay readable on phones. Each row opens its report; All Reports retains the selected location, inclusive dates and finalized status.

Top Pollen Counts ranks up to five species by summed positive grain counts across every slide in every matching finalized collection, including older records outside the recent five. Scientific names wrap in serif italic; mono species codes and exact counts accompany species-colour comparison bars scaled to the largest displayed count. Each row opens supporting reports with species, exact location, finalized status and inclusive dates preserved. The dashboard no longer renders the location or monthly occurrence views.

Collection Conditions shows ranges of saved temperature, humidity and wind measurements, each with its recorded-collection count; weather-condition counts remain in a named disclosure. Missing measurements are excluded and labelled “Not recorded”; recorded zero remains a valid reading. Finalized means Completed + Needs Review, while Pending is excluded from dashboard figures. All controls have at least 44px touch targets and mobile pages never depend on horizontal tables. Sample readings keep the overall warning, recent-record stamps, and ranking/row stamps wherever sample grain counts contribute. Counts and saved conditions do not claim seasonality, airborne concentration, risk or weather causation.

## Do's and Don'ts

### Do:
- **Do** keep the page grey (#ecebe6), plates on plate paper (#fafaf7) and frames at a 1px hairline (#d9d8d2).
- **Do** spend oxide (#8c2f1b) only on plate/figure numbers, the one primary action, inline text actions, selection and focus.
- **Do** use concise Plex Mono slide references ("Slide 2 of 3") and sentence-case Plex Sans field labels.
- **Do** set scientific names in serif italic, followed by the mono species code.
- **Do** set IDs, species codes, counts and figures in IBM Plex Mono with tabular numerals.
- **Do** give every status a stamp pattern and a word as well as a colour.
- **Do** caption each specimen plate under a hairline rule with file, grain count and dominant species.
- **Do** keep the viewer surround a neutral dark (#2a2a28) so slide colour reads true.
- **Do** keep the theme light. The console is used under bright bench light.

### Don't:
- **Don't** use soft drop shadows, glows or floating rounded cards. Separate with hairlines and wells.
- **Don't** round plates, buttons or fields beyond 3px.
- **Don't** use species colours or the map ramp for chrome, emphasis or mood, and don't let colour be the only carrier of a species, status or class.
- **Don't** colour a headline word, an icon or a background in oxide for emphasis.
- **Don't** set labels as tracked uppercase sans, or put a decorative label line above a heading.
- **Don't** use the mono face for prose, buttons or section headings.
- **Don't** draw scale bars, magnification readouts or calibrated units on slide images. The images carry no calibration.
- **Don't** add icons to stat figures or show placeholder numbers while data is loading.
- **Don't** introduce a dark theme or a second accent colour.

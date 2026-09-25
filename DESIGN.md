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
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "3.4rem"
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "1.875rem"
    fontWeight: 600
    letterSpacing: "-0.025em"
  figure:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "2.25rem"
    fontWeight: 600
    fontFeature: "lnum, tnum"
  title:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "1.125rem"
    fontWeight: 600
    letterSpacing: "-0.025em"
  binomial:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "15.5px"
    fontWeight: 600
  caption:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "14px"
    fontWeight: 400
  plate-label:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "15px"
    letterSpacing: "0.06em"
    fontFeature: "all-small-caps"
  body:
    fontFamily: "Atkinson Hyperlegible Next, system-ui, Segoe UI, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    fontFeature: "tnum"
  body-small:
    fontFamily: "Atkinson Hyperlegible Next, system-ui, Segoe UI, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 400
  mono:
    fontFamily: "Atkinson Hyperlegible Mono, ui-monospace, Consolas, monospace"
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
  plate-padding: "20px"
  plate-gap: "24px"
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

# Design System: PolLens

## Overview

**Creative North Star: "The Pollen Atlas Plates"**

PolLens reads like a palynology reference atlas that is still being written. Each analysed slide is a numbered plate in a hairline frame with a serif caption beneath a thin rule. Each report is an atlas entry, and the detections sit beside the plate as its key. The page is a quiet warm grey. Plates are off-white paper. Type is ink. The only chromatic voice in the chrome is one oxide red, and it is kept for plate and figure numbers, the primary action and focus. Strong colour elsewhere is data: the species palette on slides and charts, and the intensity ramp on the map.

The world is light because the work happens under bright bench light, next to a microscope. Density is that of a working console, not a brochure. Tables, key rows and measurement grids are tight, set in a legibility-tested sans with tabular figures. The journal serif carries titles, captions, scientific names and plate labels, so the atlas voice shows up wherever something is being named. It stays out of controls and running text.

Nothing is decorative or invented. A researcher reads every count against the plate it came from. The system rejects the clinical SaaS dashboard look: soft rounded cards, a blue accent, iconified stat tiles and drop shadows. It also adds no instrument furniture that the data cannot back, such as scale bars or magnification readouts.

**Key Characteristics:**
- Warm grey page, plate-paper panels, hairline frames and no soft shadows.
- One oxide accent for plate/figure numbers, the primary action and focus.
- Source Serif 4 for titles, captions, binomials and small-caps labels. Atkinson Hyperlegible Next for UI. Atkinson Hyperlegible Mono for IDs, codes and figures.
- Square-cut corners (1–3px).
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
- **Faint Grey** (#5f5e59): tertiary text, placeholders, counts inside chips and quiet icons. It still passes AA on every surface.
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
- **Map intensity ramp** (quantile classes, light to dark): #cdeeee, #8fd4d4, #45abab, #0e6f6f. Sampled-but-zero areas use #e4e4e7 and unsampled areas use #f4f4f5, so "we looked and found nothing" differs from "no data".

### Named Rules
**The One Oxide Rule.** Oxide marks a plate or figure number, the page's primary action, an inline text action, a selection, or focus. It does nothing else. It never tints a heading word, an icon or a background for mood.

**The Data Is Not Decoration Rule.** Species colours and the map ramp only encode data. They never style chrome, and chrome colours never stand in for a species. Wherever a data colour appears, a code, name or number says the same thing.

## Typography

**Display Font:** Source Serif 4 (with Georgia, serif), loaded in normal and italic with optical sizes
**Body Font:** Atkinson Hyperlegible Next (with system-ui, Segoe UI, Arial, sans-serif)
**Label/Mono Font:** Atkinson Hyperlegible Mono (with ui-monospace, Consolas, monospace)

**Character:** a journal serif that names things, next to a sans built by the Braille Institute to keep 0/O, 1/l/I, 5/S and 8/B apart, which is what sample IDs and species codes are made of. The body sets `tabular-nums` globally, so readings line up in columns and don't jitter as they change. There is no `antialiased` smoothing, because thinned strokes hurt small text on a light ground.

### Hierarchy
- **Display** (serif 600, up to 3.4rem, line-height 1.08, tight tracking): the sign-in frontispiece headline only.
- **Headline** (serif 600, 1.875rem, tight tracking): every page's h1 in the page header. A page titled by an identifier (a sample ID such as PLN-2026-0027) sets it in the mono face instead.
- **Figure** (serif 600, 2.25rem, lining tabular numerals): the headline numbers in the ruled stat plate.
- **Title** (serif 600, 1.125rem): the heading of each plate ("Results", "Specimen Image", "Collection Details"). h1–h3 all take the serif at -0.01em tracking.
- **Binomial** (serif italic 600, 15.5px): scientific names in key rows. Always italic, always serif, with the species code following it in mono as its key mark.
- **Caption** (serif 400, 14px): the figure caption strip under a plate. It gives file, grain count and dominant species, and the species is in italic.
- **Plate label** (serif small caps, all-small-caps, 0.06em tracking, 15–16px, oxide): "Slide N" plate and figure numbers.
- **Caption label** (the same small caps, in caption grey, 14.5–15px): field and section labels inside plates (DATE COLLECTED, RESEARCHER'S NOTE, stat labels).
- **Body** (Atkinson 400, 14px; 13px in dense rows and fields): all UI text. Descriptions cap at `max-w-prose`.
- **Mono** (Atkinson Mono 500, 11.5–14px): sample IDs, species codes, grain counts, shown/total readouts and dates on report rows.

### Named Rules
**The Small-Caps Label Rule.** Labels are serif small caps, never tracked uppercase sans. Oxide small caps number a plate. Grey small caps name a field. A label names real content directly beneath it. It is never a decorative line above a heading.

**The Mono Means Identifier Rule.** The mono face is for things you would copy, compare or count: IDs, species codes, counts and figures. It is not for prose, buttons or headings. The PolLens wordmark (mono, uppercase, 0.18em tracking) is an identity asset and sets no precedent.

## Layout

The signed-in console is a two-column shell. A pinned plate-paper rail sits on the left from `lg` (1024px) up, and a content column sits to its right. Below `lg` the rail becomes a fixed 56px plate-paper bar with a right-hand drawer (17rem, max 85vw) that shows the same nav labels, never an icon-only tab bar.

Every page uses one page frame. A full-bleed header band with a hairline bottom rule, sticky from `lg` up, holds the h1 and an optional back link and description. The body sits below it. Header and body share one of three left-aligned measures: **wide** for workspaces, tables and the map, **medium** for a single reference table, and **narrow** for settings and single-column forms. Gutters step 16 → 24 → 40px. Header padding is 24/20px, rising to 32/24px, and body vertical padding is 24–32px.

Inside the body, content is stacked plates 24px apart, each padded 20px. The result view pairs the plate (3fr, sticky on `xl`) with its key (2fr). Report detail repeats slide sections divided by hairline rules. Rows are compact (key rows 10px × 12px, fields 8px × 12px).

## Elevation & Depth

The system is flat. Depth is carried by tone and line: page grey behind, plate paper on top, sunken wells inside, and a 1px hairline frame around everything. Hover raises a border to Hairline Strong. It never raises a shadow. The only blur is the sticky page header's translucent page-grey band, which keeps content legible as it scrolls under.

### Named Rules
**The Hairline Plate Rule.** A panel is a square-cut plate with a 1px hairline frame on plate paper. There are no soft drop shadows, glows or floating cards. If something needs separating, give it a rule or a well.

## Shapes

Plates are cut square. Radii are the barest softening that keeps edges from aliasing: 1px for stamps and small marks, 2px for plates, buttons, fields and chips, and 3px at most. Circles are reserved for the wordmark's ring-and-dot, avatar initials and legend dots. Species swatches are 2px-cornered squares. The ruled stat plate is one hairline frame split into cells by 1px gaps that show the hairline through, like a ruled table in print.

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

### Cards / Containers (plates)
- **Corner Style:** 2px.
- **Background:** plate paper on page grey. Wells inside use Well.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** a 1px hairline.
- **Internal Padding:** 20px. The plate title (serif) sits on a baseline row with its oxide plate label at the right.

### Inputs / Fields
- **Style:** full-width plate paper, a 1px hairline frame, 2px corners, 8px × 12px padding, 13px ink text and faint-grey placeholders. The label sits above in 12.5px caption grey or as a caption label.
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

### Ruled Stat Plate
Four figures (two on narrow screens) in one hairline frame, divided by 1px rules. Each cell has a grey small-caps label, a serif lining figure and a 13px sublabel. There are no icons. Values count up between real values only, never on first load, and show dashes rather than invented numbers while loading or on failure.

## Do's and Don'ts

### Do:
- **Do** keep the page grey (#ecebe6), plates on plate paper (#fafaf7) and frames at a 1px hairline (#d9d8d2).
- **Do** spend oxide (#8c2f1b) only on plate/figure numbers, the one primary action, inline text actions, selection and focus.
- **Do** number plates in oxide serif small caps ("Slide 2 of 3") and label fields in grey serif small caps.
- **Do** set scientific names in serif italic, followed by the mono species code.
- **Do** set IDs, species codes, counts and figures in Atkinson Hyperlegible Mono with tabular numerals.
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

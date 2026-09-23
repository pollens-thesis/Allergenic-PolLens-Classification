# PolLens Design System — Laboratory Rationale

PolLens is used every day in a palynology laboratory: researchers read microscope
slides, check what the detection model found, and record reports. The interface
follows established practice from laboratory, microscopy and control-room software,
and from published legibility and colour research, not from consumer-app trends.
This note records each decision and its source, so it can be cited in the thesis
write-up and so later changes keep the reasoning.

## 1. Layout: viewer plus inspector

**Decision.** Analyzed slides open in a full-screen **Specimen Inspector**
(`components/SpecimenInspector.tsx`):

- **Right:** the image, on a neutral dark surround, with zoom, pan and a box-label toggle.
- **Left:** the detections, the selected grain's measurements, and the Pollen Reference entry for the selected type.

**Basis.** This is the standard arrangement in microscopy and digital-pathology
viewers such as QuPath, Aperio ImageScope and ZEISS ZEN: a large image canvas, an
object/class list in a side panel, and a toolbar. In QuPath, classes carry
user-settable colours and annotation names can be toggled on the image
([QuPath docs: Annotating images](https://qupath.readthedocs.io/en/stable/docs/starting/annotating.html)).

## 2. Colour: neutral interface, colour reserved for meaning

**Decision.**

- A cool neutral-gray canvas (`--bg #eef0f2`) with white work panels.
- One teal accent (`--accent`), used only for actions, focus and selection.
- Status colours (success, processing, danger) kept apart from the species palette.
- Tokens are defined in `app/globals.css`.

**Basis.**

- **ISA-101 "high-performance HMI"** is the control-room display standard. Most of the display is neutral gray, and saturated colour is reserved for abnormal states, so colour always means something ([control.com, "Going Gray"](https://control.com/technical-articles/going-gray/); [HMI Library, ISA-101](https://hmilibrary.com/standards/isa-101)).
- In PolLens, keeping the interface neutral means the only strong colour on screen is the species boxes on a slide.
- Usability evaluations of laboratory information systems report "consistency and standards" as the most frequently violated heuristic ([J Med Syst 2014](https://link.springer.com/article/10.1007/s10916-014-0035-z)). That argues for one restrained, consistent visual language over decorative variety.

**Contrast.** All text colours pass WCAG AA (4.5:1 or better) on every surface they
are used on. The checked ratios are in the comments in `app/globals.css`.

## 3. The image surround

**Decision.** Slides sit on `--viewer-bg #2a2c2f`, a neutral, unsaturated dark
gray, both in the inspector and behind the inline previews.

**Basis.**

- Colour consistency matters for reading stained or pollen specimens. Reviews of colour in digital pathology find that colour inconsistency affects diagnostic accuracy and agreement between readers more than brightness does ([Colour in Digital Pathology: A Review](https://www.researchgate.net/publication/307948932_Colour_in_Digital_Pathology_A_Review); [Color Management in Digital Pathology, PMC4334042](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4334042/)).
- Surrounding colour and luminance contrast shift how saturated a region appears ([JOV](https://jov.arvojournals.org/article.aspx?articleid=2553876)).
- A neutral surround avoids tinting the slide.
- No published study settles dark versus light specifically. A dark neutral surround matches the viewers above and keeps the page chrome from competing with the image.

## 4. Species overlay colours

**Decision.** Boxes use the **Okabe–Ito** colour-blind-safe palette, without black
(`lib/slide-colors.ts`):

- **Per report:** colours are assigned in order of abundance, so the types on a slide always get distinct colours.
- **Across slides:** a type keeps its colour on every slide of the report.
- **Labels:** every box can carry a label with its species code and confidence, so colour is never the only cue. Labels are on by default in the inspector.
- **Halo:** a 1px dark halo keeps light colours visible on pale slides.

**Basis.**

- The Okabe & Ito (2008) "Color Universal Design" palette stays distinguishable under the common colour-vision deficiencies.
- Only a handful of colours can be told apart quickly and reliably (Healey, 1996). With more categories than that, redundant text coding is the accepted fix.
- The catalog's own `Species.color` repeats 9 hues across 23 species, so it could not guarantee distinct colours on one slide. It is still used for charts and the map.

**Roboflow.** The hosted detection API returns only `class`, `confidence`, a box,
`class_id` and `detection_id`, with no colour
([Roboflow Serverless API](https://docs.roboflow.com/deployment/roboflow-cloud/serverless-api)).
Its only colour output is a pre-rendered annotated image, and that would make
per-grain selection impossible. So boxes are drawn client-side from the JSON.

## 5. Typography

**Decision.**

- **Atkinson Hyperlegible Next** for all interface text and headings.
- **Atkinson Hyperlegible Mono** for sample IDs, species codes and numbers.
- Tabular numerals app-wide (`font-variant-numeric: tabular-nums` on `body`).
- Both typefaces are loaded with `next/font/google` in `app/layout.tsx`.

**Basis.**

- **Atkinson Hyperlegible** was designed by the Braille Institute and tested with low-vision readers. It deliberately differentiates easily confused characters: 0/O, 1/l/I, 5/S, 8/B. Those are exactly the characters in IDs such as `PLN-2026-0134`, codes such as `IMPE`, and readings such as `81%` ([Braille Institute](https://www.brailleinstitute.org/about-us/news/braille-institute-launches-enhanced-atkinson-hyperlegible-font-to-make-reading-easier/)).
- **Open letterforms:** Sawyer, Dobres, Chahine & Reimer (2020, *Ergonomics*) found typefaces with open letterforms more legible at a glance than closed, "technical" ones such as DIN or Eurostile ([PubMed 32089101](https://pubmed.ncbi.nlm.nih.gov/32089101/)). That argues against a condensed "instrument" font.
- **Mono sibling:** using the same superfamily for data keeps text and figures reading as one system.
- **Tabular figures:** these keep values aligned in columns and stop them shifting as they update. This is standard typographic practice for data tables ([MDN, font-variant-numeric](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/font-variant-numeric)).
- **Earlier fonts:** IBM Plex Serif headings and Inter were replaced. A serif display face is uncommon in laboratory software.

## 6. Text case

Page titles, headings, navigation, tabs, table headers, stat labels and buttons use
**Title Case**. Body copy, descriptions and helper text stay in sentence case.
Scientific names keep botanical convention (italic, genus capitalised) regardless.

## 7. Shape and density

**Decision.**

- **Corners:** smaller radii (`--radius-md 4px`, `--radius-lg 6px`).
- **Rules and shadows:** 1px borders instead of shadows.
- **Density:** compact controls (13px base text in forms and tables).

**Basis.** This is the density of instrument and LIMS software, where many values
are compared at once. It is also consistent with the ISA-101 preference for
flat, low-decoration displays.

## 8. Data entry that protects data quality

**Location.** The location field (`components/LocationSearch.tsx`) suggests places
from the Philippine Standard Geographic Code (PSGC) list the map is drawn from
(`public/geo/places.json`, built by `scripts/build-places.mjs`):

- **Why a fixed list:** every chosen place is spelled the way the map matches it.
- **Free text:** still allowed, with a warning that it won't be plotted.

**Weather.** Weather is pre-filled from OpenWeather using the chosen place's
coordinates.

- **Labelled source:** it is always labelled as auto-filled current conditions.
- **Override:** any manual change is marked "Edited by researcher" and is never silently overwritten.

This keeps a clear record of where each value came from, which is a basic
expectation for laboratory records.

# PolLens UI Reference Study

Reviewed September 27, 2026. This is a design study for the next iteration, not a change to product scope or API contracts.

## References

The observations below come from official product documentation and screenshots. The PolLens adaptations are design recommendations.

| Reference | Observed pattern | Proposed adaptation for PolLens |
|---|---|---|
| [QuPath viewer](https://qupath.readthedocs.io/en/stable/docs/starting/viewing.html) · [screenshot](https://qupath.readthedocs.io/en/stable/_images/multiview.jpg) | The image occupies most of the workspace. Compact toolbars, an active-view boundary, and direct pan/zoom controls support inspection. | Make the slide the dominant part of Review Analysis. Group zoom, fit, labels and inspector actions in one restrained toolbar. Link the selected detection row to its boxes. |
| [napari viewer tour](https://napari.org/stable/getting_started/viewer.html) · [annotated screenshot](https://napari.org/stable/_images/Viewer-with-arrows.png) | A central canvas sits beside a layer list and controls for the selected layer. Viewer controls and status have distinct places. | Keep species/detection selection beside the image. Show the controls and details relevant to that selection. Keep box visibility and selection state clear. |
| [Benchling Inventory](https://www.benchling.com/inventory) · [sample record screenshot](https://images.ctfassets.net/kzeezny59h5p/7tWmIR5fbG0Pr2NZTmQjH2/d9095b30c68ad27b33c3b4df5f73d95f/Inventory_01.png) | The sample identifier leads the record. Labels, values, units and linked records organize the content into readable groups. | Give each report a concise identity line: sample ID, status, collection date and location. Use field/value groups for researcher and weather, with editing available where needed. |
| [OMERO image viewing](https://www.openmicroscopy.org/omero/features/view/) | Thumbnail browsing, previews and full image viewing support different levels of inspection. | Distinguish the report archive from the slide workspace. Use tables for finding reports and a thumbnail rail for moving among slides within a report. |
| [ZEISS ZEN core](https://www.zeiss.com/microscopy/us/products/software/zen-core.html) · [routine workflow brochure](https://asset-downloads.zeiss.com/catalogs/download/mic/5a635cc4-ac71-4490-a763-11716acc908e/EN_product-info_ZEN-core_routine.pdf) | Configurable workbenches expose functions needed for the task. Guided jobs organize acquisition, analysis and reporting into consecutive steps. | Clarify PolLens's existing sequence—Slides, Review, Report—with a small stage indicator and one prominent next action. Do not add stages or controls without corresponding functionality. |

## Recommended direction

Use QuPath as the main reference for image inspection and Benchling for records. Adapt their organization to PolLens's smaller feature set and browser environment. Desktop microscopy applications contain many specialist controls; PolLens should expose only the tools its workflow needs.

The current IBM Plex Sans and Mono direction fits this proposal. Keep sans text for the interface, mono for identifiers and aligned figures, and serif italic for scientific names. Typography should make the hierarchy legible; it cannot replace a task-specific layout.

## Implemented — September 27, 2026

Review Analysis now gives the slide more of the workspace, uses slide previews for report navigation, and keeps detections with their slide note in one review rail. Selecting a detection still highlights its boxes. Report identity, sample warnings, save feedback, every detection value and collection field, and the existing review actions remain in place.

The dashboard now leads with four essential views: finalized collections, slides, pollen grains and the Needs Review/Pending queue. The collection-site count sits next to the 6/12-month collection-date selector, which is aligned with the “Collection Overview” heading above the figures it filters. Completed and Needs Review count toward finalized totals; Pending remains separate. The monthly grain chart and top pollen types summarize analysis, while recent collections provide direct access to records. A month without collections is shown as missing observation data, not zero pollen.

Reports retains the searchable, filterable, exportable full report table. The dashboard adds a short recent collection list with sample and status labels; location rows open the matching filtered reports. Sample warnings label illustrative detections, and every dashboard count comes from the same report response.

## Next design passes

1. **Collection details:** present a compact field/value group. Keep required fields, missing values, weather provenance and save feedback explicit.
2. **Reports:** treat the table as the main surface. Align identifiers, dates and numeric values; keep filters together and row actions predictable.

Avoid repeating one card layout across every screen, putting a framed card around each field, adding decorative technical labels, or making every heading and action compete at the same visual weight. Use real specimen content, task order, selection and data relationships to give PolLens its identity.

The next review should compare a populated report, an empty state, a failed request and a narrow screen. Preserve sample warnings, statuses, all report fields and existing save/generate behavior throughout.

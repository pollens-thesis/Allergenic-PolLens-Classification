# Researcher review and annotations

The report review tools let the report owner check model output while a report
is in **Needs Review**. This supports review of YOLO26 detections and EfficientNet
labels before a report is completed.

## Review a slide

1. Open a report marked **Needs Review** and scroll to **Slide Images**.
2. In **Researcher Annotations**, keep **Select / move** active and click a box
   on the slide to select it. Click it again or click outside the editor to
   dismiss its controls.
3. Drag the selected box to move it. Drag a corner handle to resize it. Use the
   **Researcher label** menu to choose the corrected species.
4. Choose **Confirm changes** to save the label or box change. Choose
   **Cancel changes** to discard the current unsaved edit.

To remove a false positive, select its box and choose **Remove as Non-pollen**.
The box is removed from the reviewed pollen overlay and count. The original
model result is retained for audit and the detection can be restored from its
model-box entry.

To add pollen that the model missed, choose **Draw missed pollen**, drag a box
around the grain, choose its species, then choose **Confirm changes**. The
missed grain is added to reviewed counts without a model confidence score.
Uncertain labels are recorded for review and do not replace the model class.

Slide notes are edited separately with **Add note** or **Edit note**. Save the
note to persist it, or cancel to discard the draft.

## How reviewed results are counted

- **Model** shows the original model detections.
- **Reviewed pollen** excludes boxes marked non-pollen and includes manually
  added missed pollen.
- Model confidence averages include retained model detections only. Manually
  added grains do not receive a fabricated confidence score.
- Original detections remain available alongside researcher annotations so
  the team can inspect both the model output and the reviewed result.
- Annotation controls are read-only for sample reports and reports the
  signed-in user cannot edit.
- Label choices follow the 15 species in the current training dataset. The
  Allergen Reference uses the same species set and the familiar research names.

## Local validation

Start the API and Next.js app using their local setup guides, then sign in and
open a non-sample report in **Needs Review**. Test label correction, moving and
resizing a box, cancelling an edit, removing and restoring a false positive,
drawing and removing a missed grain, and saving a slide note. Confirm the model
and reviewed counts change as described above and that sample reports do not
allow saving annotations.

Run the API checks from `api/`:

```bash
DETECTION_MOCK=false python manage.py test
python manage.py makemigrations --check --dry-run
python manage.py check
```

Run the frontend checks from `app/PolLens/`:

```bash
npx tsc --noEmit
npm run lint
npm run build
```

The API stores an annotation through
`PUT /api/v1/reports/<sampleId>/annotations/<annotationId>/` and removes it
through the matching `DELETE` route. Box coordinates are normalized to the
slide image (0–1); only an authenticated report owner can change annotations.

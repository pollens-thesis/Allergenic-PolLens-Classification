# White-box test cases (TC-WB-01 … 08)

Revised 2026-10-21 (issue #81). The cases describe the code paths PolLens really has;
the proposal's original table assumed a serverless design with image compression.
Run the automated checks from `api/` with `python manage.py test` (set `DATABASE_NAME=`
and `DATABASE_URL=` empty to use SQLite instead of the `.env` Postgres).

| TC ID | Module | Internal Logic / Branch Tested | Expected Internal Execution Path |
|---|---|---|---|
| TC-WB-01 | Slide Analysis Loop | The loop sends slides for detection one at a time. | The next slide is sent only after the previous one returns. If one slide fails, the loop marks it and continues. |
| TC-WB-02 | Report ID Generation | Saving a batch creates one report ID. | All slides in the batch share one ID (e.g. PLN-2026-0001). The next batch gets the next number. |
| TC-WB-03 | Upload Validation | The image is checked before detection runs. | A wrong file type or a file that is too large is rejected (400/413) and the model is not called. |
| TC-WB-04 | Database Connection | Choosing how database connections are reused. | A direct connection is kept open and reused. A pooled (Neon) connection is closed after each request, so the pool is never used up. |
| TC-WB-05 | Report Save Transaction | An error happens partway through saving a report. | The whole save is undone (no partial rows), the error is logged, and the user gets an error message. |
| TC-WB-06 | Confidence Threshold | Detections are filtered by confidence (0.25). | Detections below 0.25 are dropped. Detections at or above 0.25 are kept and saved. |
| TC-WB-07 | File Size Check | A selected file is larger than 25 MB. | That file is skipped with a message. The other files are still added. |
| TC-WB-08 | Empty Detection Result | The model finds no pollen on a slide. | No detections are saved, no error occurs, and the screen shows "No pollen grains detected on this slide." |

## How each case is checked

- **TC-WB-01** (manual): add 3 slides and watch DevTools → Network; the `/detect/` requests do not overlap. Code: `components/AnalyzeWorkspace.tsx` (the `for…of` loop with `await`).
- **TC-WB-02**: `WhiteBoxTests.test_batch_gets_a_single_sample_id_shared_by_every_slide`, `test_next_batch_gets_the_next_sample_id`.
- **TC-WB-03**: `DetectImageValidationTests`, `QARegressionTests` (pixel limit, decompression bomb); `npx tsc --noEmit` for the typed request.
- **TC-WB-04**: `config.tests.DatabaseUrlTests`.
- **TC-WB-05**: `WhiteBoxTests.test_failed_insert_rolls_back_the_whole_report`.
- **TC-WB-06**: `reports/inference/test_yolo26.py` (the threshold reaches the detector), `test_yolo26_api.py`.
- **TC-WB-07**: server side `DetectImageValidationTests`; browser side is a manual check: select 3 files with one over 25 MB, and two are added with a message naming the third. Code: `handleFiles` in `AnalyzeWorkspace.tsx`.
- **TC-WB-08**: `WhiteBoxTests.test_slide_with_no_detections_is_saved_with_no_rows`, `services/inference/test_app.py::test_no_boxes_returns_empty_predictions`, `test_yolo26_api.py`.

## Results (2026-10-20)

- `python manage.py test` in `api/`: 219 tests, all passed (includes the four new `WhiteBoxTests`).
- `npx tsc --noEmit` in `app/PolLens/`: no errors.
- `services/inference/test_app.py` was **not run** (pytest is not installed in the API virtualenv).
- TC-WB-01 and the browser half of TC-WB-07 are manual checks and are **not yet recorded as run**.

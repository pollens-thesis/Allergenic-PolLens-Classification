# White-box test cases (TC-WB-01 … 08)

Revised 2026-10-20 (issue #81). The proposal's table was written before
development and described a serverless API with client-side Canvas compression.
PolLens is a Next.js frontend, a Django API (Render, Neon Postgres behind
PgBouncer) and a YOLO26 + EfficientNet service on Modal. The cases below test
the branches that actually exist. Where the proposal's behaviour was never
built, the case now says what the system does instead.

Run the automated ones from `api/`: `python manage.py test` (set
`DATABASE_NAME=` and `DATABASE_URL=` empty to use SQLite instead of the `.env`
Postgres).

| TC ID | Module | Internal logic / branch tested | Expected internal execution path | Evidence |
|---|---|---|---|---|
| TC-WB-01 | Client-side detection loop (`components/AnalyzeWorkspace.tsx:312-331`) | Sequential loop: `for…of` awaits `analyzeSpecimen(file)` before the next slide. No compression step exists; the original file is uploaded. | Slide *n+1* is not sent until the response for slide *n* has resolved or failed. A failed slide is marked as an error and does not stop the loop. | **Manual:** add 3 slides, watch DevTools → Network: the `/detect/` requests do not overlap. |
| TC-WB-02 | Report creation (`reports/models.py` `next_sample_id`, `reports/serializers.py`) | Batch identifier: one batch is one `Report`; the server assigns one `sample_id` (row-locked counter) and every slide hangs off that report. (The browser's per-image `crypto.randomUUID()` is only a list key and is never sent.) | A create with *N* slides yields one `PLN-<year>-NNNN` id and slide ids `…-S1 … -SN`; the next batch gets the next number. | `WhiteBoxTests.test_batch_gets_a_single_sample_id_shared_by_every_slide`, `test_next_batch_gets_the_next_sample_id` |
| TC-WB-03 | Request construction / validation (`lib/analysis.ts:143`, `reports/images.py` `check_slide_image`) | Type contract: the request is typed `FormData` and the response is typed `DetectResponse` (checked by the TypeScript compiler). The server then validates the image (format, 25 MB, 60 MP) before any inference; the client drops unknown classes and zero-area boxes. | A build with a type error fails; an invalid image is rejected with 400/413 before the model runs. | `npx tsc --noEmit` (clean); `DetectImageValidationTests`, `QARegressionTests` (pixel limit, decompression bomb) |
| TC-WB-04 | Database connection setup (`config/dburl.py:30-42`) | Connection branch: a direct host reuses connections (`CONN_MAX_AGE=600`, health checks on); a Neon `-pooler` host gets `CONN_MAX_AGE=0`, health checks off and no server-side cursors, so PgBouncer does the pooling. | The settings dict for each host type has exactly those values; the pool is never exhausted by Django-held connections. | `config.tests.DatabaseUrlTests` |
| TC-WB-05 | Report creation transaction (`reports/serializers.py:155-195`) | `transaction.atomic()` around Report, Slides, Detections and Grains. A failure midway rolls everything back, Django logs the error, the client gets 500. | After a failed insert there are 0 Report, Slide, Detection and Grain rows, and an ERROR is logged on `django.request`. | `WhiteBoxTests.test_failed_insert_rolls_back_the_whole_report` |
| TC-WB-06 | Detection confidence threshold (`reports/inference/yolo26.py:85-93`, `services/inference/app.py:32,121`) | `YOLO26_CONFIDENCE` (default 0.25) is passed to the detector as `conf`; boxes below it are never returned, boxes at or above it are. Values outside (0, 1] are rejected at start-up. Non-pollen boxes are skipped. | Returned boxes all have confidence ≥ threshold; the saved grains are exactly those returned. | `test_yolo26.py` (`conf` reaches `predict()`, invalid threshold, non-pollen skipped), `test_yolo26_api.py` |
| TC-WB-07 | File size gate (`AnalyzeWorkspace.tsx:229-242`, `reports/images.py:32`) | Size branch: a file over 25 MB is skipped with the message "Not added: x is over 25 MB" and the other files in the selection are kept. The server enforces the same limit (413) on detect and on create. | Valid files are added; oversize files are listed as not added; no exception stops the batch. | Server side: `DetectImageValidationTests`, `QARegressionTests` (size set to 10 bytes). **Manual** for the client: select 3 files, one 26 MB; two are added and the message names the third. |
| TC-WB-08 | Empty detection result (`services/inference/app.py:123`, `reports/views.py:297`, `reports/serializers.py:83`) | Zero-target branch: an empty `predictions` list is a valid 200 response; the report saves with no Detection/Grain rows, and the UI says "No pollen grains detected on this slide." (There is no separate "No Allergen Detected" status; the report keeps its normal `Pending` status.) | No coordinate rows are inserted, nothing throws, the slide is stored. | `WhiteBoxTests.test_slide_with_no_detections_is_saved_with_no_rows`, `services/inference/test_app.py::test_no_boxes_returns_empty_predictions`, `test_yolo26_api.py` |

## Results (2026-10-20)

- `python manage.py test` in `api/`: 219 tests, all passed (includes the four new `WhiteBoxTests`).
- `npx tsc --noEmit` in `app/PolLens/`: no errors.
- `services/inference/test_app.py` was **not run** in this session (pytest is not installed in the API virtualenv).
- TC-WB-01 and the client half of TC-WB-07 are manual checks and are **not yet recorded as run**.

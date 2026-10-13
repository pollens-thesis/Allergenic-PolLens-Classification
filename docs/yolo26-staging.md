# YOLO26 + EfficientNet staging and deployment

> **Status 2026-10-14:** this describes the in-process path
> (`DETECTION_BACKEND=yolo26`, models loaded inside the Render service), which
> needs more memory than the free plan offers and is **not deployed**. Production
> hosts the same models on Modal and the API calls them with
> `DETECTION_BACKEND=remote`: see [inference-modal.md](inference-modal.md). The
> artifact and checksum steps below still apply to the weights. References to
> Roboflow as "the default" are historical.

The selected private Colab notebook is `PolLens_YOLO_Detection_v12.ipynb`.
Its exported `best.pt` is a two-class **detector**: class 0 `Pollen`, class 1
`non-pollen`. Only class 0 may become a crop for the species classifier.
Detection confidence is not species confidence.

The checkpoint is stored outside the public Git history in
`docs/private/model-artifacts/yolo26l-detection-v12/`, with its original ZIP
and `manifest.json`. The ZIP SHA-256 is
`1a6e627ea132def714a4dde4882eadf5faae76cdeb00075598c71de87383c0a6`;
the `best.pt` member SHA-256 is
`3295126e47fc7c8b4814fd44f1882063a035b2ab746ab75f89cf48cb19bfbfad`.
The verified local checkpoint is extracted at
`docs/private/model-artifacts/yolo26l-detection-v12/weights/yolo26l_v12_best.pt`;
the root `.gitignore` excludes the entire `docs/private/` directory.
The artifact contains `data.yaml`, the held-out test metrics, and the weights.
The source dataset is Detection v12 (CC BY 4.0); retain attribution with any
redistribution.

At confidence 0.25 on 45 held-out test images (118 pollen ground-truth boxes),
the notebook records pollen precision 0.876, recall 0.898, and 15 false pollen
boxes. This threshold is an initial measurement point, not a deployment choice.
The training set has 4,213 pollen versus 147,811 non-pollen boxes, so pollen
recall and false pollen detections remain key release measurements.

`api/reports/inference/yolo26.py` verifies the class mapping and returns
oriented-image pixel boxes for pollen only. The opt-in local pipeline runs
YOLO26, then classifies its padded pollen crops with the Colab-trained local
EfficientNet-B0 ONNX model. The classifier uses 10% padding on each box edge,
RGB, bilinear 224×224 resizing, ImageNet normalization, and softmax. It returns
the top species and probability in the existing species-plus-box API shape.
The app already normalizes scientific names such as `Imperata cylindrica` to
its species IDs. The Roboflow Workflow remains the default; select the local
pipeline with `DETECTION_BACKEND=yolo26` and `ROBOFLOW_MOCK=false`.

Both models were trained from the current dataset of 15 pollen species.
YOLO26 detects `Pollen` and `non-pollen`; EfficientNet-B0 classifies each
pollen crop into one of the 15 species. PolLens currently has a 23-species
catalog, so eight catalog entries are outside the models' training scope. The
classifier always selects one of its 15 classes; the current API has no `not
sure` or top-three output, so low confidence does not suppress a prediction.
Its documented accuracy is about 0.71 on photos from a different capture date
and 0.85 on photos from the same date, with one physical slide per species;
accuracy on new slides has not been measured. It has not yet been evaluated
end-to-end with YOLO26 crops. Treat output as experimental until that
evaluation is recorded.

For local testing, install `api/requirements-ml.txt` in the API virtual
environment and set these values in the untracked `api/.env`. Keep both model
files under `docs/private/model-artifacts/`; they are ignored by Git.

```dotenv
DETECTION_BACKEND=yolo26
ROBOFLOW_MOCK=false
YOLO26_WEIGHTS_PATH=/absolute/path/to/best.pt
YOLO26_CLASSIFIER_WEIGHTS_PATH=/absolute/path/to/efficientnet_b0_pollen15.onnx
YOLO26_CONFIDENCE=0.25
YOLO26_IMAGE_SIZE=640
YOLO26_DEVICE=cpu
```

`YOLO26_CLASSIFIER_WEIGHTS_PATH` must point to the ONNX file, with
`class_names.json` beside it. The Roboflow API key is not used by this local
two-model path. Keep the Roboflow Workflow as the default while running the
local comparison. There is no automatic switch back to the Roboflow detector
if the selected YOLO26 pipeline fails; the API returns an error so the caller
can retry or report the failure.

## Private model bundle and Render staging

The API has a separate staging deployment path. The production
`api/render.yaml` keeps the current free plan, Roboflow default, and normal
dependency build when this PR merges. The staging Blueprint is
`api/render.yolo26-staging.yaml`; it uses one Gunicorn worker, downloads the
private bundle at startup, and loads both models before serving requests. It
starts at Render's 2 GB (`1c-2g`) plan, currently $25/month according to
[Render pricing](https://render.com/pricing). The local process
peaked around 950 MB; confirm memory and latency in staging before selecting
the production plan. Running staging and a paid production service at once
temporarily bills both services.

Create a versioned private ZIP and checksum locally from `api/`:

```bash
python3 -m scripts.package_yolo26_artifacts \
  --detector ../docs/private/model-artifacts/yolo26l-detection-v12/weights/yolo26l_v12_best.pt \
  --classifier ../docs/private/model-artifacts/efficientnet-b0-pollen15/efficientnet_b0_pollen15.onnx \
  --class-names ../docs/private/model-artifacts/efficientnet-b0-pollen15/class_names.json \
  --output ../docs/private/model-artifacts/releases/pollens-yolo26l-v12-efficientnet-b0-pollen15-v1.zip
```

The packager checks that the classifier has exactly 15 unique classes and
writes a manifest containing per-file SHA-256 hashes. The ZIP and its
`.sha256` sidecar stay under the ignored `docs/private/model-artifacts/`
directory. Upload the ZIP to a private R2/S3-compatible model bucket. Use a
write credential only for that upload; configure the staging service with a
separate read-only bucket token. In the Render Dashboard, supply the staging
database, staging slide-image bucket, allowed frontend origin, and the model
bucket settings shown in the staging Blueprint. Set
`YOLO26_ARTIFACTS_BUNDLE_SHA256` to the digest in the sidecar.

The model start command downloads the ZIP to the configured model paths,
checks the bundle hash and every member hash, and fails startup if a file is
missing or invalid. It then loads the classifier and detector during Gunicorn
worker startup. The production build does not install the optional runtime
until its Render environment opts in.

To use the Blueprint later, select `api/render.yolo26-staging.yaml` in Render
and connect it to a reviewed commit that contains these files. Opening a PR
does not create a Render service or upload the private model bundle.

Before any production cutover, run end-to-end classification on YOLO26 crops
from held-out slides, test full-size images and concurrent requests on the
staging service, and review memory, latency, and failure logs. Keep the
Roboflow workflow configured through the initial rollout. Roll back by setting
`DETECTION_BACKEND=roboflow` and redeploying. Do not enable
`ROBOFLOW_MOCK=true` for the local model path because the mock response takes
precedence over the selected backend.

## Production cutover and rollback

The production Blueprint still defaults to Roboflow. Its start command uses
`./start_yolo26.sh`, which preserves the current Roboflow worker and timeout
settings by default and selects the one-worker, model-warmed YOLO26 path only
when `DETECTION_BACKEND=yolo26`. The same setting is the operator's rollback
switch; inference errors do not silently fall back to Roboflow.

Do not point staging at production data. First deploy the separate staging
Blueprint and verify the pipeline there. The private model bundle must be
uploaded separately; the public Git branch contains only code and templates.

For an in-place production cutover, keep the existing `pollens-api` URL,
production database, and production slide-image bucket. Back up the production
database and record the current Render deployment before changing the service.
Upload the versioned model ZIP to a private model-artifacts bucket using a
separate upload credential. Configure Render with a read-only credential for
that bucket and the bundle SHA-256. The current local release is
`pollens-yolo26l-v12-efficientnet-b0-pollen15-v1.zip`, SHA-256
`273e3de4d53877d74f1de3ab0a695a3661ffd69d7bf332b08b4deb340cc36c78`.

On the production service, configure these values for the cutover:

```text
DETECTION_BACKEND=yolo26
ROBOFLOW_MOCK=false
INSTALL_ML_DEPENDENCIES=true
YOLO26_WEIGHTS_PATH=/tmp/pollens-models/yolo26l_v12_best.pt
YOLO26_CLASSIFIER_WEIGHTS_PATH=/tmp/pollens-models/efficientnet_b0_pollen15.onnx
YOLO26_CONFIDENCE=0.25
YOLO26_IMAGE_SIZE=640
YOLO26_DEVICE=cpu
YOLO26_ARTIFACTS_OBJECT_KEY=pollens/models/pollens-yolo26l-v12-efficientnet-b0-pollen15-v1.zip
YOLO26_ARTIFACTS_BUNDLE_SHA256=<verified bundle SHA-256>
YOLO26_ARTIFACTS_ENDPOINT_URL=<private model bucket endpoint>
YOLO26_ARTIFACTS_BUCKET=<private model bucket name>
YOLO26_ARTIFACTS_ACCESS_KEY_ID=<read-only model bucket credential>
YOLO26_ARTIFACTS_SECRET_ACCESS_KEY=<read-only model bucket credential>
```

The production Blueprint does not declare the new model settings. Enter them
in the Render Dashboard after staging passes. For an existing Blueprint,
new `sync: false` entries would not prompt during a sync anyway. Do not paste
the local `.env` file into Render because it also contains development
configuration. Set `PYTHON_VERSION=3.12.14` and
`INSTALL_ML_DEPENDENCIES=true`, then choose **Save, rebuild, and deploy** to
install the ML runtime. Keep `DETECTION_BACKEND=roboflow` during that build;
switch it to `yolo26` only after the bundle and credentials are in place.

Keep production `DATABASE_URL` and `AWS_STORAGE_*` unchanged; those point to
the live database and slide-image storage, not the model bucket. Keep the
existing `ROBOFLOW_*` credentials and workflow configuration during the
rollback window. The optional model runtime is installed on the next build,
and the launcher downloads and verifies the bundle before serving requests.
The free production plan has only 512 MB and cannot hold the locally measured
model process. Use the staging measurements to choose a paid production plan;
2 GB (`1c-2g`, currently $25/month) is the initial pilot candidate. The
same API URL means the frontend needs no configuration change for an in-place
cutover. Increase the plan if metrics show insufficient memory headroom or
request latency.

After deployment, require a successful model warm start, `/healthz/` returning
200, and authenticated image-analysis and report-save smoke checks. Review
latency, memory, API errors, and the bundle hash in startup logs. Keep the
initial rollout limited to users who can review species labels: the app's
catalog has 23 species while these models support 15, and the planned
annotation feature is not yet available.

To roll back, set `DETECTION_BACKEND=roboflow` and redeploy or restart the
existing service. Keep `ROBOFLOW_MOCK=false`, the Roboflow workflow credentials,
and the provider-aware start command. The launcher skips model download and
uses the existing two-worker Roboflow path. Confirm an authenticated detection
request succeeds and returns `mock: false`. Rollback affects new requests
only; reports already saved with YOLO26 predictions are not rewritten. Record
the cutover time and model bundle hash so saved results can be traced to the
active release. Save and deploy the changed environment; a service restart
alone uses the environment from its current deployment. The already-built
YOLO26 image can serve Roboflow, so the rollback does not require rebuilding.

Do not remove Roboflow credentials or code until the rollback window closes
and the YOLO26 + EfficientNet release has been accepted. Remove the Roboflow
provider in a later cleanup change after the replacement is stable.

## Local measurement

Install `api/requirements-ml.txt` into the local API virtual environment; the
normal Render build does not install it. From `api/`, run:

```bash
python -m scripts.benchmark_yolo26 \
  --manifest ../docs/private/model-artifacts/yolo26l-detection-v12/manifest.json \
  --image /path/to/representative/slide.jpg \
  --synthetic-12mp
```

The script verifies both hashes before loading the model, then reports model
load time, per-image latency, box count, and peak process memory. The enlarged
12 MP image probes processing cost only; it is not an accuracy sample. A local
CPU measurement does not establish Render capacity or latency. Before cutover,
benchmark the full detector-plus-classifier pipeline on the intended service
with real full-resolution images and concurrent requests.

### Initial local CPU measurement (2026-10-10)

On an arm64 Mac with Python 3.12.14, Ultralytics 8.4.174, and CPU inference at
confidence 0.25, checkpoint load took 22.0 s. The first 640×640 image took
3.64 s (including runtime warm-up); the second took 0.18 s. Peak process RSS
was about 757 MB. A synthetic 4032×3024 image took 0.18 s after warm-up and
raised peak RSS to about 950 MB. These numbers are from one process with two
CPU threads and cannot be used as a Render sizing guarantee. In particular,
the current two-worker Gunicorn configuration would load separate model copies
if this were embedded in Django; measure that configuration before deployment.

### Validation split run (2026-10-10)

The checkpoint was evaluated locally on all 77 validation images at 640×640.
The standard Ultralytics metrics for pollen (class 0; 197 boxes) were precision
0.886, recall 0.910, mAP50 0.941, and mAP50–95 0.732. These precision/recall
values are at the validator's best-F1 operating point, not at confidence 0.25.
Both classes together scored mAP50 0.897 and mAP50–95 0.641. The test split was
not read or used in this run.

At confidence 0.25 and a one-to-one match requirement of IoU ≥ 0.50, the pollen
detector produced 179 true positives, 27 unmatched predictions, and 18 missed
labels. That gives precision 0.869, recall 0.909, and 0.351 unmatched pollen
predictions per validation image. A validation-only confidence sweep found its
highest F1 at 0.35 (precision 0.897, recall 0.888, F1 0.893); the F1 difference
from 0.25 was small. Keep 0.25 for the next detector-to-classifier integration
pass because it retains more pollen recall, then assess with the classifier and
review workflow before any deployment decision.

There were disagreements with labels in 21 images. They are not expert
adjudications and must not be treated as confirmed model errors or used as new
training labels. The largest were
IMG_9407 (7 unmatched predictions and 7 misses), IMG_3223 (6 unmatched
predictions), and IMG_3221 (2 misses). Visual review shows many disagreements
around dense debris, overlapping structures, or low-contrast grains. These are
label-versus-prediction mismatches only; leave their status unresolved until
the project has a way to collect trusted annotations.

Detailed metrics, the threshold sweep, Ultralytics plots, per-image counts, and
annotated validation images are stored locally under
`docs/private/model-artifacts/yolo26l-detection-v12/validation/` (ignored by
Git). The downloaded Roboflow `data.yaml` had paths that did not match its
current folder layout; validation used a temporary corrected YAML, leaving the
source dataset unchanged.

# Roboflow pipeline: YOLOv11 detect → ResNet-34 classify

The detection model is a two-stage **Roboflow Workflow**: a YOLOv11 detector
finds every pollen grain (one class, `pollen`), each box is cropped, and a
ResNet-34 classifier names the species. The backend calls the Workflow through
`POST /api/v1/reports/detect/` (`reports.views._roboflow_workflow`); the
frontend contract does not change (`{image, predictions:[{class, confidence, x,
y, width, height}]}`), so nothing in `app/PolLens/` is touched.

Written against Roboflow's docs as of 2026-09-30
(<https://docs.roboflow.com/models/supported-models>: YOLO11 detection and
ResNet 18/34/50/101 classification can both be trained on Roboflow and run on
the Serverless API).

## 1. Check the classification classes

The classifier's class names **are** the species slugs the frontend uses
(`amaranthus_spinosus`, …; the 23 in `api/reports/migrations/0004_seed_species.py`).
Compare them with the project's class list. If any differ, either remap them in
the dataset version (Preprocessing → **Modify Classes**) or add an alias in
`toSpeciesId()` in `app/PolLens/lib/analysis.ts` (frontend owner). Anything
outside the catalog is dropped by the frontend with a console warning.

## 2. Generate a version of each project

| | Detection project (`pollen`) | Classification project (species) |
|---|---|---|
| Split | Train/Valid/Test, e.g. 70/20/10 | same |
| Preprocessing | Auto-Orient, Resize 640×640 | Auto-Orient, Resize 224×224 |
| Augmentation | flips, 90° rotations, small brightness/blur | flips, 90° rotations, small brightness |

Pollen grains have no orientation, so flips and rotations are safe. Record
both version numbers; the paper reports them.

If the classification set is ever rebuilt from the detection set, use
**Isolate Objects** (turns a detection dataset into a classification dataset by
cropping each box) after **Modify Classes** where needed.

## 3. Train

- **Detector:** Train → architecture **YOLOv11** (size S or M) → COCO public
  checkpoint. Report mAP@50, mAP@50–95, precision, recall.
- **Classifier:** Train → **ResNet**, size **34** → ImageNet checkpoint (the only
  one offered for classification). Report top-1 accuracy, confusion matrix,
  per-class F1.

Both train on Roboflow, so no weight upload is needed. (If you ever train
elsewhere: YOLOv11 must use `ultralytics<=8.3.40`; see
<https://docs.roboflow.com/models/model-weights/upload-custom-weights>.)

## 4. Build the Workflow

Roboflow → Workflows → Create → name it `pollen-detect-classify`, open the JSON
editor and paste the definition below, replacing the two model IDs
(`<project>/<version>`, from each model's Deploy page).

```json
{
  "version": "1.0",
  "inputs": [{ "type": "WorkflowImage", "name": "image" }],
  "steps": [
    {
      "type": "roboflow_core/roboflow_object_detection_model@v3",
      "name": "grain_detector",
      "images": "$inputs.image",
      "model_id": "<detection-project>/<version>",
      "confidence_mode": "custom",
      "custom_confidence": 0.4
    },
    {
      "type": "roboflow_core/dynamic_crop@v1",
      "name": "grain_crops",
      "images": "$inputs.image",
      "predictions": "$steps.grain_detector.predictions"
    },
    {
      "type": "roboflow_core/roboflow_classification_model@v3",
      "name": "species_classifier",
      "images": "$steps.grain_crops.crops",
      "model_id": "<classification-project>/<version>"
    },
    {
      "type": "roboflow_core/detections_classes_replacement@v1",
      "name": "species_boxes",
      "object_detection_predictions": "$steps.grain_detector.predictions",
      "classification_predictions": "$steps.species_classifier.predictions"
    }
  ],
  "outputs": [
    {
      "type": "JsonField",
      "name": "predictions",
      "selector": "$steps.species_boxes.predictions"
    }
  ]
}
```

Notes:

- The **only** output is `predictions`. Do not add visualization outputs: the
  response is capped at 6 MB and the backend reads `outputs[0].predictions`.
- Detections Classes Replacement puts the classifier's top class **and its
  confidence** on each box, so the `confidence` the app shows is the species
  confidence, not the "is it a grain" confidence.
- A box the classifier returns nothing for is **dropped**. To keep it as
  "unknown" instead, add `"fallback_class_name": "unknown"` to that step (the
  frontend drops unknown classes with a warning, so the grain simply isn't
  counted).
- If the editor rejects a block identifier, add the block from the UI and read
  the identifier from the JSON it produces; versions (`@v3`) change over time.

## 5. Test and deploy

1. In the Workflow editor run it on a real slide image; check that boxes land
   on grains and classes are species slugs.
2. **Deploy Workflow** → copy the **workspace name** and **workflow ID**.
3. Set the backend environment (local `api/.env` and Render → Environment):

   ```
   ROBOFLOW_API_KEY=<private API key>
   ROBOFLOW_WORKSPACE=<workspace name>
   ROBOFLOW_WORKFLOW_ID=pollen-detect-classify
   ROBOFLOW_MOCK=false
   ```

   `ROBOFLOW_WORKFLOW_ID` takes precedence over `ROBOFLOW_MODEL_ID`/
   `ROBOFLOW_MODEL_VERSION` (the single-model path, still supported).
4. Smoke test: sign in, upload a slide on Analyze; the "sample detections"
   warning disappears (`mock: false`).

## Cost and limits

Each model step in a Workflow bills at that model's rate (YOLO11 about 0.19–0.25
credits per 1,000 images, ResNet about 0.06); the Workflow logic itself is not
billed. Requests that fail with 5xx/429 aren't billed. The proxy times out
after 30 s and answers 502 on any upstream failure.

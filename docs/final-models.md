# Final models selected on 2026-10-13

The system's selected models are the user-supplied
`pollens_yolo26l_v12_2026-10-12_best.pt` detector and
`efficientnet_b0_pollen15.onnx` classifier. The classifier's PyTorch weights
and `class_names.json` are retained with the same private release. The backend
uses ONNX Runtime for classification.

The local `api/.env` selects `DETECTION_BACKEND=yolo26` and
`ROBOFLOW_MOCK=false`. Exact copies of the uploaded files, a SHA-256 manifest,
and the local verification result live in the ignored
`docs/private/model-artifacts/final-models-2026-10-13/` directory. Model files
and real environment configuration must remain outside public Git history.

The detector identifies `Pollen` and `non-pollen`. Only pollen boxes enter the
classifier, with 10% crop padding, RGB conversion, bilinear resizing to
224 by 224 pixels, ImageNet normalization, and softmax. Returned confidence
is the classifier's species probability. Image orientation is applied before
either model runs. The API preserves the frontend's existing pixel-centred
box and species-name contract.

The classifier covers 15 of the catalog's 23 species. It always chooses a
known class; this integration does not implement an unknown-species or
low-confidence rejection rule. A successful local inference verifies runtime
integration, not accuracy on new slides.

## Setting up another environment

Install the normal backend dependencies and `api/requirements-ml.txt`. Store
the private release on the target machine and configure these environment keys:

```dotenv
DETECTION_BACKEND=yolo26
ROBOFLOW_MOCK=false
YOLO26_WEIGHTS_PATH=/absolute/private/path/pollens_yolo26l_v12_2026-10-12_best.pt
YOLO26_CLASSIFIER_WEIGHTS_PATH=/absolute/private/path/efficientnet_b0_pollen15.onnx
YOLO26_WEIGHTS_SHA256=91b6d3fe54500a102e025735055418117e811c0cbda14d3a2a5e087c1bcaf484
YOLO26_CLASSIFIER_SHA256=db5dddb47e1bdec7a2bc421c13171d249a222504378afebb8eb5fdec1ff739ee
YOLO26_CLASS_NAMES_SHA256=c33c88a14822e036a7b2f88e46c859da092050aae61cc0c01efaa366b7b43f7c
YOLO26_CONFIDENCE=0.25
YOLO26_IMAGE_SIZE=640
YOLO26_DEVICE=cpu
```

Place `class_names.json` beside the ONNX model and set its manifest checksum.
The backend checks pinned artifacts before loading them. Missing or mismatched
files produce a configuration error rather than using different weights.
Loaded models are cached per process; restart the API after changing model
paths, files, checksums, or provider settings.

The Roboflow provider remains available for environments configured with
`DETECTION_BACKEND=roboflow`. No automatic fallback occurs when local inference
fails. These local changes do not change the hosted Render deployment.

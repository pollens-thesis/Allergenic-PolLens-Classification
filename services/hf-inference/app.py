"""PolLens inference service: YOLO26 pollen detector + EfficientNet-B0 species classifier.

Runs on a private Hugging Face Docker Space. The Django API's /detect/ proxy
calls POST /detect and passes the body straight through, so the response must
match the app's provider-independent shape:
{"image": {"width", "height"}, "predictions": [{"class", "confidence",
"x", "y", "width", "height"}]} (pixel coordinates, box centre-based).

The Space is private, so Hugging Face checks the bearer token before a request
reaches this app; there is no separate auth here.
"""

import io
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse
from PIL import Image, ImageOps

logger = logging.getLogger('pollens.inference')

MODELS_DIR = Path(os.environ.get('MODELS_DIR', Path(__file__).parent / 'models'))
DETECTOR_FILE = 'yolo26l_v12_best.pt'
CLASSIFIER_FILE = 'efficientnet_b0_pollen15.onnx'

# Same defaults as api/config/settings.py.
CONFIDENCE = float(os.environ.get('YOLO26_CONFIDENCE', '0.25'))
IMAGE_SIZE = int(os.environ.get('YOLO26_IMAGE_SIZE', '640'))
# Same limits the API enforces on uploads (MAX_SLIDE_IMAGE_BYTES / _PIXELS).
MAX_IMAGE_BYTES = 25 * 1024 * 1024
MAX_IMAGE_PIXELS = 60_000_000

# Filled at startup; tests replace these with stubs.
models = {'detector': None, 'classifier': None}


def _detail(message, status):
    return JSONResponse({'detail': message}, status_code=status)


def load_models():
    """Load each model on its own so a missing file degrades /detect to 503
    instead of crashing the container (the Space then still builds and
    /healthz can say which half is missing)."""
    try:
        from inference.efficientnet_classifier import EfficientNetB0Classifier

        models['classifier'] = EfficientNetB0Classifier(MODELS_DIR / CLASSIFIER_FILE)
    except Exception:
        logger.exception('Classifier failed to load')
    try:
        from inference.yolo26 import YOLO26PollenDetector

        models['detector'] = YOLO26PollenDetector(MODELS_DIR / DETECTOR_FILE)
    except Exception:
        logger.exception('Detector failed to load')


@asynccontextmanager
async def lifespan(_app):
    load_models()
    yield


app = FastAPI(title='PolLens inference', docs_url=None, redoc_url=None, lifespan=lifespan)


@app.get('/healthz')
def healthz():
    return {
        'status': 'ok',
        'detector': models['detector'] is not None,
        'classifier': models['classifier'] is not None,
    }


@app.post('/detect')
async def detect(image: UploadFile = File(...)):
    detector, classifier = models['detector'], models['classifier']
    if detector is None or classifier is None:
        return _detail('Models are not loaded.', 503)

    data = await image.read(MAX_IMAGE_BYTES + 1)
    if len(data) > MAX_IMAGE_BYTES:
        return _detail('Image is too large.', 413)
    try:
        with Image.open(io.BytesIO(data)) as source:
            if source.width * source.height > MAX_IMAGE_PIXELS:
                return _detail('Image has too many pixels.', 400)
            pil = ImageOps.exif_transpose(source).convert('RGB')
    except (OSError, ValueError, Image.DecompressionBombError):
        return _detail('The file is not a readable image.', 400)

    try:
        result = detector.detect_image(
            pil, confidence=CONFIDENCE, image_size=IMAGE_SIZE, device='cpu',
        )
        if not result.pollen_boxes:
            labels = []
        else:
            labels = classifier.classify(pil, result.pollen_boxes)
        if len(labels) != len(result.pollen_boxes):
            raise RuntimeError('classifier returned a different number of labels than boxes')
    except Exception:
        logger.exception('Inference failed')
        return _detail('Inference failed.', 502)

    return {
        'image': {'width': result.image_width, 'height': result.image_height},
        'predictions': [
            {
                'class': label,
                'confidence': score,
                'x': box.x,
                'y': box.y,
                'width': box.width,
                'height': box.height,
            }
            for box, (label, score) in zip(result.pollen_boxes, labels)
        ],
    }

"""Modal deployment of the PolLens inference service.

    modal deploy services/inference/modal_app.py

Serves app.py (FastAPI: GET /healthz, POST /detect) from a serverless container
that scales to zero. Weights live in the private Modal Volume `pollens-models`
(filled by upload_models.py); the bearer token is the Modal Secret
`pollens-inference` (INFERENCE_TOKEN). The two inference modules are copied from
api/reports/inference/ so they stay the single source of truth.
"""

from pathlib import Path

import modal

HERE = Path(__file__).resolve().parent
INFERENCE_SRC = HERE.parents[1] / 'api' / 'reports' / 'inference'

MODELS_DIR = '/models'

# Memory snapshots make a cold start restore already-loaded models instead of
# re-importing ultralytics and re-reading the weights. If a deploy fails or the
# restored container misbehaves, set this to False (slower cold starts, same API).
SNAPSHOT = True

image = (
    modal.Image.debian_slim(python_version='3.12')
    # OpenCV (pulled in by ultralytics) needs these at import time.
    .apt_install('libgl1', 'libglib2.0-0')
    .pip_install_from_requirements(str(HERE / 'requirements.txt'))
    .env({'MODELS_DIR': MODELS_DIR, 'YOLO_CONFIG_DIR': '/tmp/ultralytics'})
    .add_local_file(HERE / 'app.py', '/root/app.py')
    .add_local_file(INFERENCE_SRC / 'yolo26.py', '/root/inference/yolo26.py')
    .add_local_file(INFERENCE_SRC / 'efficientnet_classifier.py', '/root/inference/efficientnet_classifier.py')
)

models = modal.Volume.from_name('pollens-models', create_if_missing=True)

app = modal.App('pollens-inference', image=image)

with image.imports():
    import app as service


@app.cls(
    cpu=1.0,
    memory=2048,
    volumes={MODELS_DIR: models},
    secrets=[modal.Secret.from_name('pollens-inference')],
    # Stay warm 5 min after a request, then scale to zero (no idle cost). Not
    # min_containers=1: always-on would cost more than the monthly free credit.
    scaledown_window=300,
    timeout=300,
    enable_memory_snapshot=SNAPSHOT,
)
class Inference:
    @modal.enter(snap=SNAPSHOT)
    def load(self):
        service.load_models()

    @modal.asgi_app()
    def web(self):
        return service.app

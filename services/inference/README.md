# PolLens inference service

FastAPI service that finds pollen grains with a YOLO26-L detector and names the
species of each crop with an EfficientNet-B0 classifier. Deployed on Modal; see
[`docs/inference-modal.md`](../../docs/inference-modal.md).

- `GET /healthz` — `{"status", "detector", "classifier"}`
- `POST /detect` — bearer token + multipart `image`; returns
  `{"image": {"width", "height"}, "predictions": [{"class", "confidence", "x", "y", "width", "height"}]}`

Files: `app.py` (service), `modal_app.py` (Modal definition), `upload_models.py`
(weights to the Modal Volume), `test_app.py`. The model weights are private and
never committed.

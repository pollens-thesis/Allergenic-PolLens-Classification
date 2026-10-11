---
title: PolLens Inference
emoji: 🔬
colorFrom: yellow
colorTo: green
sdk: docker
app_port: 7860
pinned: false
---

# PolLens inference

Private inference service for PolLens: a YOLO26-L detector finds pollen grains,
and an EfficientNet-B0 classifier names the species of each crop.

- `GET /healthz` — `{"status", "detector", "classifier"}`
- `POST /detect` — multipart `image`; returns
  `{"image": {"width", "height"}, "predictions": [{"class", "confidence", "x", "y", "width", "height"}]}`

The model weights live only in this Space repository, never in the public
GitHub repo. This folder is published by `services/hf-inference/deploy.py` in
[the PolLens repo](https://github.com/pollens-thesis/Allergenic-PolLens-Classification);
see `docs/hf-inference.md` there.

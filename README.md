# PolLens

PolLens is a research console for reviewing allergenic pollen in microscope
slide images. This public repository contains the web app and API. It does not
contain the thesis's private datasets, model weights, credentials, or reports.

## Repository layout

| Path | Purpose |
| --- | --- |
| `api/` | Django REST API, report storage, and model inference |
| `app/PolLens/` | Next.js researcher interface |
| `docs/` | Shared system and deployment documentation |

Local research files belong in the gitignored `docs/private/` directory. Keep
trained weights, validation images, historical experiments, and private thesis
documents there; do not add them to a pull request. The frontend's setup guide
is [app/PolLens/README.md](app/PolLens/README.md), and the general deployment
guide is [docs/deployment.md](docs/deployment.md).

## YOLO26 and EfficientNet migration

The API can use the Colab-trained YOLO26-L Detection v12 model to locate pollen
grains and an EfficientNet-B0 ONNX model to classify each pollen crop. YOLO26's
two classes are `Pollen` and `non-pollen`; only `Pollen` boxes go to the
classifier. The classifier names one of 15 trained species. The wider PolLens
catalog still has 23 species, so results need researcher review.

Since 2026-10-14 production runs these models on **Modal's free plan**
(`services/inference/`, `DETECTION_BACKEND=remote`): the Render API stays on its
free plan and sends each slide to the Modal service, which holds the private
weights. See [docs/inference-modal.md](docs/inference-modal.md) for the
deploy, token and region settings. Model files and secrets are never committed
to this public repository.

The earlier Roboflow Workflow is retired and kept only as a rollback
(`DETECTION_BACKEND=roboflow`) until its code and credentials are removed
(issue #48). The in-process alternative (`DETECTION_BACKEND=yolo26`,
[docs/yolo26-staging.md](docs/yolo26-staging.md)) needs more memory than the free
plan offers and is not used.

## Researcher review

Reports in Needs Review include tools for correcting labels and boxes, removing
non-pollen detections, and adding missed pollen. See
[docs/researcher-review.md](docs/researcher-review.md) for the workflow,
annotation behavior, and local validation steps.

## Local development

Configure `api/.env` from [api/.env.example](api/.env.example) and
`app/PolLens/.env.local` from
[app/PolLens/.env.example](app/PolLens/.env.example). Keep these files local.
The optional model packages are in `api/requirements-ml.txt`; the normal API
requirements are in `api/requirements.txt`. Windows startup commands are in
[run-pollens.txt](run-pollens.txt). See [CONTRIBUTING.md](CONTRIBUTING.md) for
the issue, review, and merge workflow.

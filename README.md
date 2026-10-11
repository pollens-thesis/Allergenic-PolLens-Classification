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

Merging the model code keeps production on its current Roboflow Workflow. The
existing `api/render.yaml` stays on the free plan and uses Roboflow by default.
The optional model dependencies, private weights, paid compute plan, and
`DETECTION_BACKEND=yolo26` are enabled by the Render operator after staging
checks. Model files and secrets are never committed to this public repository.

The operator should follow [docs/yolo26-staging.md](docs/yolo26-staging.md) for
the artifact checksum, separate staging service, Render settings, smoke tests,
production cutover, and rollback. The previous Roboflow credentials remain
available during the rollback window. To return new requests to the previous
provider, set `DETECTION_BACKEND=roboflow` and deploy that environment change.

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

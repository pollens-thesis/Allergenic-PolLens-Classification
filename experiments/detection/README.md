# Local YOLO11 pollen detection experiment

This experiment trains COCO-pretrained YOLO11n and YOLO11s on the corrected
Roboflow Detection v3 export. It runs on an Apple Silicon Mac with PyTorch MPS
and saves every checkpoint and metric locally. The dataset and outputs are
private and excluded from this public repository.

## Setup

From the repository root:

```bash
/opt/homebrew/bin/python3.12 -m venv .venv-ml
.venv-ml/bin/python -m pip install -r experiments/detection/requirements.txt
.venv-ml/bin/python experiments/detection/train_local.py \
  --dataset /Users/nino/Downloads/Detection \
  --output ml-runs/detection-v3 --audit-only
```

Run a one-epoch hardware check before the thesis runs:

```bash
.venv-ml/bin/python experiments/detection/train_local.py \
  --dataset /Users/nino/Downloads/Detection \
  --output ml-runs/detection-v3-smoke --smoke
```

Then run the two full experiments. Keep this command running while training;
the Mac must stay awake and connected when pretrained weights first download.

```bash
.venv-ml/bin/python experiments/detection/train_local.py \
  --dataset /Users/nino/Downloads/Detection \
  --output ml-runs/detection-v3
```

Training uses 640-pixel input, up to 80 epochs, patience 15, batch 8, two
workers, seed 42, saved checkpoints, and no additional image augmentation.
Both models use AdamW with a 0.002 initial learning rate and 0.9 momentum.
The Roboflow export already contains three augmented train images per apparent
source photo. On MPS, Ultralytics automatic batch sizing is unavailable and
mixed precision is skipped. Ultralytics may reduce the effective worker count
on MPS; inspect each run's `args.yaml`. PyTorch warns that some MPS operations
do not have deterministic implementations, so the seed supports repeatability
but does not guarantee identical reruns. If memory is insufficient, start **both** full
runs in a new output directory with `--batch 4`; don't compare runs made with
different settings as a controlled model-size experiment.

If training is interrupted, rerun the same command with `--resume`. Existing
completed training and evaluation files are reused. A changed dataset,
software version, or experiment setting requires a new output directory.

## Results and limits

`dataset_audit.json` records counts, annotation checks, and a SHA-256 dataset
fingerprint. `run_metadata.json` records the installed software and settings.
`requirements-freeze.txt` captures the full installed Python environment.
The runner makes a private copy at `OUTPUT/dataset` so Ultralytics cache files
do not change the source export. Each model folder has
`weights/best.pt`, `weights/last.pt`, training logs,
validation and test metrics and plots, a fixed-confidence error count, and up
to five marked missed-grain examples. `summary.csv` compares models. The
operating point uses confidence 0.40 and an IoU 0.50 match, matching the
deployed detector confidence; it is separate from the standard mAP analysis.

Detection v3 contains 876 train, 77 validation, and 45 test images, with only
one physical microscope slide per species. The exported split can test held-out
**images from those slides**, but cannot measure generalization to unseen
physical slides. Detection v3 also differs from Detection v1 used for the
previously reported Roboflow YOLO11n result, so this is a new baseline. Do not
tune on test results or describe them as independent-slide performance.

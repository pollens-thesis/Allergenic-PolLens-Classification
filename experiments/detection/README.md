# Local YOLO11 pollen detection experiment

This experiment trains COCO-pretrained **YOLO11n** and **YOLO11s** on the
unaugmented Roboflow **Detection v4** export. It uses the same train, validation,
and test images for both models. The dataset, checkpoints, and results stay on
private storage and are excluded from the public repository.

## Google Colab + Drive

Open [colab_detection_v4.ipynb](colab_detection_v4.ipynb) in Google Colab from
the GitHub branch. Upload the private `Detection-2.zip` archive to
`MyDrive/PolLens/datasets/` (or change `DATASET_SOURCE` in the notebook to your
Drive folder or ZIP). Select a GPU runtime and run the notebook cells in order.
It clones this repository, records the exact Git commit, checks the export,
stages the full-resolution images on Colab's local disk for training speed,
then saves checkpoints and results to `MyDrive/PolLens/experiments/`.

After a Colab interruption, rerun with the same `OUTPUT_ROOT` and
`STAGE_DIR`, and set `RESUME = True`. The notebook checks that the code and
dataset match the original run. Colab uses its CUDA-enabled PyTorch build,
automatic GPU batch sizing, and mixed precision. The installed versions and
resolved training settings are saved with the results.

The notebook's default `REPO_REF` is the experiment branch; update it to the
merged commit or branch when the work is merged into `master`.

## Mac CPU alternative

From the repository root, using Python 3.12:

```bash
/opt/homebrew/bin/python3.12 -m venv .venv-ml
.venv-ml/bin/python -m pip install -r experiments/detection/requirements.txt
.venv-ml/bin/python experiments/detection/train_local.py \
  --dataset /Users/nino/Downloads/Detection-2 \
  --output ml-runs/detection-v4 --audit-only
```

Run a short CPU hardware check, then the full two-model experiment in a **new**
output directory:

```bash
.venv-ml/bin/python experiments/detection/train_local.py \
  --dataset /Users/nino/Downloads/Detection-2 \
  --output ml-runs/detection-v4-smoke --smoke
.venv-ml/bin/python experiments/detection/train_local.py \
  --dataset /Users/nino/Downloads/Detection-2 \
  --output ml-runs/detection-v4
```

The default is **CPU**. The earlier v3 run crashed at epoch 7 inside
PyTorch's MPS `unique` operation, so this pinned setup does not use MPS for
thesis training or evaluation. Keep the Mac awake while a full run is active.

Both models use 640-pixel input, batch 8, AdamW (initial learning rate 0.002,
momentum 0.9), seed 42, up to 80 epochs, and early stopping patience 15.
Only the training loader applies mild brightness/saturation, rotation,
translation, scale, and flip augmentation. Validation and test images remain
untouched. The exact requested and effective settings are saved in
`run_metadata.json` and each model's `args.yaml`.

If training stops, rerun the same full command with `--resume`. A changed
dataset, software version, batch size, or other setting requires a new output
directory. Do not use the test split to tune the models.

## Outputs

The runner audits labels and split membership, computes a SHA-256 dataset
fingerprint, and copies the dataset into `OUTPUT/dataset` so Ultralytics cache
files do not alter the source export. It records the installed Python packages
in `requirements-freeze.txt`. Each model folder saves `best.pt`, `last.pt`,
training logs, validation and test plots and metrics, per-image errors at
confidence 0.40, and five marked error examples. `summary.csv` compares the
models on the same exported splits. The fixed-confidence error counts use IoU
0.50 to match predictions to labels and are separate from mAP.

## Interpretation

Detection v4 has **292 train**, **77 validation**, and **45 test** images, with
737, 208, and 135 labeled pollen boxes respectively. Most photos are
4032×3024 pixels. The apparent source filenames and exact image bytes do not
cross exported splits. However, the team has **one physical microscope slide
per species**, so these metrics measure held-out photos from known slides, not
generalization to unseen physical slides. Detection v4 also differs from the
September 17 Detection v1 behind the reported Roboflow YOLO11n result; it is
a new baseline rather than an exact reproduction.

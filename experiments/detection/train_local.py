"""Reproducible local YOLO11n/YOLO11s experiment on PolLens Detection v4."""

from __future__ import annotations

import argparse
import ast
import csv
import hashlib
import json
import math
import os
import platform
import re
import shutil
import subprocess
import sys
import time
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path


SPLITS = ("train", "valid", "test")
IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png"}
MODELS = ("yolo11n", "yolo11s")
SCOPE = "exported image split; one physical slide per species, so not an independent-slide test"


def write_json(path: Path, value: dict) -> None:
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n")


def source_stem(image: Path) -> str:
    return image.stem.split(".rf.", 1)[0]


def dataset_fingerprint(root: Path) -> str:
    digest = hashlib.sha256()
    for path in sorted(p for p in root.rglob("*") if p.is_file()
                       and p.name != ".DS_Store" and p.suffix != ".cache"):
        digest.update(str(path.relative_to(root)).encode())
        with path.open("rb") as stream:
            for block in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(block)
    return digest.hexdigest()


def audit_dataset(root: Path) -> dict:
    yaml_path = root / "data.yaml"
    if not yaml_path.is_file():
        raise FileNotFoundError(f"Missing {yaml_path}")
    raw = yaml_path.read_text()
    version = re.search(r"(?m)^\s+version:\s*(\d+)\s*$", raw)
    nc = re.search(r"(?m)^nc:\s*(\d+)\s*$", raw)
    names = re.search(r"(?m)^names:\s*(\[[^\n]+\])\s*$", raw)
    if not version or int(version.group(1)) != 4:
        raise ValueError("Expected unaugmented Roboflow Detection v4")
    if not nc or int(nc.group(1)) != 1 or not names or ast.literal_eval(names.group(1)) != ["Pollen"]:
        raise ValueError("Expected one detection class: Pollen")

    summary: dict[str, dict[str, int]] = {}
    source_splits: dict[str, set[str]] = defaultdict(set)
    image_hash_splits: dict[str, set[str]] = defaultdict(set)
    for split in SPLITS:
        image_dir, label_dir = root / split / "images", root / split / "labels"
        if not image_dir.is_dir() or not label_dir.is_dir():
            raise FileNotFoundError(f"Missing images or labels for {split}")
        images = sorted(p for p in image_dir.iterdir() if p.is_file() and p.suffix.lower() in IMAGE_SUFFIXES)
        labels = {p.stem for p in label_dir.glob("*.txt")}
        if labels != {p.stem for p in images}:
            raise ValueError(f"Image/label mismatch in {split}")
        boxes = 0
        for image in images:
            source_splits[source_stem(image)].add(split)
            image_hash_splits[hashlib.sha256(image.read_bytes()).hexdigest()].add(split)
            for line in (label_dir / f"{image.stem}.txt").read_text().splitlines():
                if not line.strip():
                    continue
                fields = line.split()
                if len(fields) != 5:
                    raise ValueError(f"Invalid YOLO row in {split}/{image.stem}.txt: {line}")
                cls, x, y, w, h = map(float, fields)
                if (not all(map(math.isfinite, (cls, x, y, w, h))) or cls != 0
                        or w <= 0 or h <= 0
                        or not (0 <= x - w / 2 <= x + w / 2 <= 1)
                        or not (0 <= y - h / 2 <= y + h / 2 <= 1)):
                    raise ValueError(f"Invalid box in {split}/{image.stem}.txt: {line}")
                boxes += 1
        summary[split] = {"images": len(images), "boxes": boxes}

    expected = {"train": 292, "valid": 77, "test": 45}
    if {s: summary[s]["images"] for s in SPLITS} != expected:
        raise ValueError(f"Unexpected Detection v4 split counts: {summary}")
    if any(len(v) > 1 for v in source_splits.values()):
        raise ValueError("Apparent source filename occurs across exported splits")
    if any(len(v) > 1 for v in image_hash_splits.values()):
        raise ValueError("Exact duplicate image occurs across exported splits")
    return {
        "roboflow_version": 4,
        "classes": ["Pollen"],
        "splits": summary,
        "apparent_source_photos": len(source_splits),
        "source_filename_overlap_across_splits": 0,
        "exact_image_overlap_across_splits": 0,
        "dataset_sha256": dataset_fingerprint(root),
        "evaluation_scope": SCOPE,
    }


def preserve_or_write(path: Path, value: dict, keys: tuple[str, ...]) -> None:
    if path.exists():
        previous = json.loads(path.read_text())
        for key in keys:
            if previous.get(key) != value.get(key):
                raise ValueError(f"{path} already belongs to a different {key}; choose a new output directory")
    else:
        write_json(path, value)


def stage_dataset(source: Path, staged: Path, fingerprint: str) -> Path:
    """Keep Ultralytics label caches in a writable stage, away from the source."""
    if source == staged:
        if dataset_fingerprint(staged) != fingerprint:
            raise ValueError(f"Dataset changed while staging: {staged}")
        return staged
    if not staged.exists():
        shutil.copytree(source, staged, ignore=shutil.ignore_patterns("*.cache", ".DS_Store"))
    if dataset_fingerprint(staged) != fingerprint:
        raise ValueError(f"Incomplete or different staged dataset at {staged}; choose a new output directory")
    return staged


def metric_summary(metrics, model: str, split: str) -> dict:
    precision, recall = float(metrics.box.mp), float(metrics.box.mr)
    return {
        "model": model,
        "split": split,
        "evaluation_scope": SCOPE,
        "precision": precision,
        "recall": recall,
        "f1_from_precision_recall": 2 * precision * recall / (precision + recall) if precision + recall else 0.0,
        "map50": float(metrics.box.map50),
        "map50_95": float(metrics.box.map),
        "inference_ms_per_image": float(metrics.speed.get("inference", 0)),
    }


def iou(a, b) -> float:
    left, top, right, bottom = max(a[0], b[0]), max(a[1], b[1]), min(a[2], b[2]), min(a[3], b[3])
    intersection = max(0, right - left) * max(0, bottom - top)
    area_a = max(0, a[2] - a[0]) * max(0, a[3] - a[1])
    area_b = max(0, b[2] - b[0]) * max(0, b[3] - b[1])
    return intersection / (area_a + area_b - intersection) if area_a + area_b > intersection else 0.0


def ground_truth_boxes(label: Path, width: int, height: int) -> list[tuple[float, ...]]:
    boxes = []
    for line in label.read_text().splitlines():
        if line.strip():
            _, x, y, w, h = map(float, line.split())
            boxes.append(((x - w / 2) * width, (y - h / 2) * height,
                          (x + w / 2) * width, (y + h / 2) * height))
    return boxes


def fixed_threshold_errors(model, model_dir: Path, dataset: Path, device: str) -> None:
    from PIL import Image, ImageDraw

    csv_path = model_dir / "per_image_errors.csv"
    summary_path = model_dir / "operating_point_0_40.json"
    if csv_path.exists() and summary_path.exists():
        return
    records, visuals, inference_times = [], [], []
    images = sorted(p for p in (dataset / "test" / "images").iterdir()
                    if p.is_file() and p.suffix.lower() in IMAGE_SUFFIXES)
    for image_path in images:
        with Image.open(image_path) as image:
            truth = ground_truth_boxes(dataset / "test" / "labels" / f"{image_path.stem}.txt", *image.size)
        prediction = model.predict(source=str(image_path), imgsz=640, conf=0.40,
                                   iou=0.70, device=device, verbose=False)[0]
        boxes = prediction.boxes.xyxy.cpu().tolist()
        scores = prediction.boxes.conf.cpu().tolist()
        inference_times.append(float(prediction.speed.get("inference", 0)))
        matched_truth, matched_predictions = set(), set()
        for index in sorted(range(len(boxes)), key=lambda j: scores[j], reverse=True):
            choices = [(iou(boxes[index], target), j) for j, target in enumerate(truth)
                       if j not in matched_truth]
            if choices:
                best_iou, match = max(choices)
                if best_iou >= 0.50:
                    matched_truth.add(match)
                    matched_predictions.add(index)
        tp = len(matched_truth)
        row = {"image": image_path.name, "ground_truth": len(truth),
               "predictions": len(boxes), "tp": tp,
               "fp": len(boxes) - tp, "fn": len(truth) - tp}
        records.append(row)
        visuals.append((row, image_path, truth, boxes, matched_truth, matched_predictions))

    with csv_path.open("w", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(records[0]))
        writer.writeheader()
        writer.writerows(records)
    tp, fp, fn = (sum(row[key] for row in records) for key in ("tp", "fp", "fn"))
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    write_json(summary_path, {
        "confidence_threshold": 0.40, "matching_iou": 0.50, "nms_iou": 0.70,
        "tp": tp, "fp": fp, "fn": fn, "precision": precision, "recall": recall,
        "f1": 2 * precision * recall / (precision + recall) if precision + recall else 0.0,
        "mean_detector_inference_ms_per_image": sum(inference_times) / len(inference_times),
    })
    examples = model_dir / "error_examples"
    examples.mkdir(exist_ok=True)
    for row, image_path, truth, boxes, matched_truth, matched_predictions in sorted(
            visuals, key=lambda item: (-item[0]["fn"], -item[0]["fp"], item[0]["image"]))[:5]:
        with Image.open(image_path) as original:
            canvas = original.convert("RGB")
        draw = ImageDraw.Draw(canvas)
        for index, box in enumerate(truth):
            draw.rectangle(box, outline="lime" if index in matched_truth else "red", width=3)
        for index, box in enumerate(boxes):
            draw.rectangle(box, outline="cyan" if index in matched_predictions else "yellow", width=2)
        draw.rectangle((0, 0, 225, 20), fill="black")
        draw.text((4, 3), f"TP {row['tp']}  FP {row['fp']}  FN {row['fn']}", fill="white")
        canvas.save(examples / f"{image_path.stem}.png")


def make_summary(output: Path) -> None:
    rows = []
    for name in MODELS:
        model_dir = output / name
        val = json.loads((model_dir / "validation_metrics.json").read_text())
        test = json.loads((model_dir / "test_metrics.json").read_text())
        fixed = json.loads((model_dir / "operating_point_0_40.json").read_text())
        row = {"model": name}
        for prefix, metrics in (("val", val), ("test", test)):
            for key in ("precision", "recall", "f1_from_precision_recall", "map50", "map50_95", "inference_ms_per_image"):
                row[f"{prefix}_{key}"] = metrics[key]
        for key in ("precision", "recall", "f1", "tp", "fp", "fn"):
            row[f"test_conf_0_40_{key}"] = fixed[key]
        rows.append(row)
    with (output / "summary.csv").open("w", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", type=Path, required=True, help="Unmodified Roboflow Detection v4 folder")
    parser.add_argument("--output", type=Path, required=True, help="Experiment output folder")
    parser.add_argument("--stage-dir", type=Path, help="Fast local dataset copy (defaults to OUTPUT/dataset)")
    parser.add_argument("--audit-only", action="store_true")
    parser.add_argument("--smoke", action="store_true", help="One-epoch 10%%-data check; no test evaluation")
    parser.add_argument("--resume", action="store_true", help="Resume an interrupted training run")
    parser.add_argument("--batch", type=int, help="Defaults to 8 on CPU or auto sizing on CUDA")
    parser.add_argument("--workers", type=int, default=2)
    parser.add_argument("--device", choices=("cpu", "cuda"), default="cpu")
    args = parser.parse_args()
    batch = args.batch if args.batch is not None else (-1 if args.device == "cuda" else 8)
    if batch < 1 and not (batch == -1 and args.device == "cuda"):
        parser.error("--batch must be positive, or -1 for CUDA automatic sizing")
    if args.workers < 0:
        parser.error("--workers cannot be negative")
    if args.audit_only and args.smoke:
        parser.error("--audit-only and --smoke cannot be combined")
    dataset = args.dataset.expanduser().resolve()
    output = args.output.expanduser().resolve()
    staged_path = (args.stage_dir.expanduser().resolve() if args.stage_dir
                   else output / "dataset")
    if staged_path == output or output.is_relative_to(staged_path):
        parser.error("--stage-dir must be outside --output or a subdirectory of it")
    audit = audit_dataset(dataset)
    output.mkdir(parents=True, exist_ok=True)
    preserve_or_write(output / "dataset_audit.json", audit, ("dataset_sha256",))
    print(json.dumps(audit, indent=2), flush=True)
    if args.audit_only:
        return

    import torch
    import ultralytics
    from ultralytics import YOLO

    if args.device == "cuda" and not torch.cuda.is_available():
        raise RuntimeError("CUDA is unavailable. Select a GPU runtime in Colab.")
    train_device = 0 if args.device == "cuda" else "cpu"
    data_yaml = output / "data_local.yaml"
    train_kwargs = {
        "imgsz": 640, "epochs": 1 if args.smoke else 80,
        "patience": 15, "batch": batch, "workers": args.workers,
        "amp": args.device == "cuda", "seed": 42, "deterministic": True,
        "pretrained": True, "device": train_device, "save": True,
        "save_period": -1, "plots": True, "optimizer": "AdamW",
        "lr0": 0.002, "momentum": 0.9, "cache": False,
        # V4 has original images. Augmentation is applied only to the train loader.
        "hsv_h": 0.0, "hsv_s": 0.10, "hsv_v": 0.15,
        "degrees": 15.0, "translate": 0.05, "scale": 0.25,
        "shear": 0.0, "perspective": 0.0, "flipud": 0.5,
        "fliplr": 0.5, "mosaic": 0.0, "mixup": 0.0, "copy_paste": 0.0,
    }
    if args.smoke:
        train_kwargs["fraction"] = 0.1
    metadata = {
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "dataset_sha256": audit["dataset_sha256"], "dataset_version": 4,
        "evaluation_scope": SCOPE,
        "models": [MODELS[0]] if args.smoke else list(MODELS),
        "smoke": args.smoke, "train_kwargs": train_kwargs,
        "ultralytics_version": ultralytics.__version__,
        "torch_version": torch.__version__, "python_version": platform.python_version(),
        "platform": platform.platform(), "device": args.device,
    }
    preserve_or_write(output / "run_metadata.json", metadata,
                      ("dataset_sha256", "models", "smoke", "train_kwargs", "ultralytics_version", "torch_version"))
    freeze_path = output / "requirements-freeze.txt"
    if not freeze_path.exists():
        frozen = subprocess.run([sys.executable, "-m", "pip", "freeze"],
                                capture_output=True, text=True, check=True)
        freeze_path.write_text(frozen.stdout)
    staged = stage_dataset(dataset, staged_path, audit["dataset_sha256"])
    data_yaml.write_text(json.dumps({"path": str(staged), "train": "train/images",
                                     "val": "valid/images", "test": "test/images",
                                     "nc": 1, "names": {0: "Pollen"}}, indent=2) + "\n")
    os.chdir(output)  # Keep downloaded pretrained weights in the ignored output.

    for name in metadata["models"]:
        model_dir = output / name
        last, best = model_dir / "weights" / "last.pt", model_dir / "weights" / "best.pt"
        complete = model_dir / "training_complete.json"
        if complete.exists():
            if not best.exists():
                raise FileNotFoundError(f"Completion marker exists but {best} is missing")
            print(f"Training already complete: {name}", flush=True)
            continue
        start = time.perf_counter()
        if last.exists():
            if not args.resume:
                raise RuntimeError(f"Partial run at {last}; rerun with --resume")
            print(f"Resuming {name}", flush=True)
            YOLO(str(last)).train(resume=True, data=str(data_yaml))
        else:
            print(f"Training {name} on {args.device}", flush=True)
            YOLO(f"{name}.pt").train(data=str(data_yaml), project=str(output),
                                      name=name, exist_ok=True, **train_kwargs)
        if not best.exists():
            raise FileNotFoundError(f"Training did not produce {best}")
        write_json(complete, {"completed_utc": datetime.now(timezone.utc).isoformat(),
                              "elapsed_minutes": (time.perf_counter() - start) / 60})
    if args.smoke:
        print("Smoke test complete. Use a new output directory for the full runs.")
        return

    for name in MODELS:
        model_dir = output / name
        model = YOLO(str(model_dir / "weights" / "best.pt"))
        for split, filename in (("val", "validation_metrics.json"), ("test", "test_metrics.json")):
            path = model_dir / filename
            if path.exists():
                continue
            metrics = model.val(data=str(data_yaml), split=split, imgsz=640,
                                batch=8, conf=0.001, iou=0.7,
                                augment=False, device=train_device, workers=args.workers,
                                plots=True, project=str(model_dir),
                                name=f"{split}_evaluation", exist_ok=True)
            write_json(path, metric_summary(metrics, name, split))
        fixed_threshold_errors(model, model_dir, staged, train_device)
    make_summary(output)
    print(f"Finished. Comparison: {output / 'summary.csv'}")


if __name__ == "__main__":
    main()

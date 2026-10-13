"""Upload the private model weights to the Modal Volume `pollens-models`.

    python services/inference/upload_models.py [--skip-detector] [--dry-run]

Checks the detector's SHA-256, then runs `modal volume put` for each file. The
weights go to the Modal Volume only; they are never committed to GitHub. Needs
`pip install modal` and `modal setup` first.
"""

import argparse
import hashlib
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PRIVATE = ROOT / 'docs' / 'private'
VOLUME = 'pollens-models'

CLASSIFIER_DIR = PRIVATE / 'finalized model' / 'classification'
DETECTOR_PATH = (
    PRIVATE / 'finalized model' / 'detection' / 'pollens_yolo26l_v12_2026-10-12_best.pt'
)
DETECTOR_SHA256 = '91b6d3fe54500a102e025735055418117e811c0cbda14d3a2a5e087c1bcaf484'


def sha256(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b''):
            digest.update(chunk)
    return digest.hexdigest()


def collect(skip_detector):
    """(local path, name in the volume) for every file to upload."""
    files = []
    for name in ('efficientnet_b0_pollen15.onnx', 'class_names.json'):
        source = CLASSIFIER_DIR / name
        if not source.is_file():
            sys.exit(f'Missing classifier file: {source}')
        files.append((source, name))

    if skip_detector:
        print('Skipping the detector: /detect returns 503 until it is uploaded.')
        return files
    if not DETECTOR_PATH.is_file():
        sys.exit(f'Detector weights not found at {DETECTOR_PATH}. Get yolo26l_v12_best.pt '
                 'from the team, or pass --skip-detector.')
    actual = sha256(DETECTOR_PATH)
    if actual != DETECTOR_SHA256:
        sys.exit(f'Detector SHA-256 mismatch: expected {DETECTOR_SHA256}, got {actual}')
    files.append((DETECTOR_PATH, 'yolo26l_v12_best.pt'))
    return files


def main():
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    parser.add_argument('--skip-detector', action='store_true')
    parser.add_argument('--dry-run', action='store_true', help='check files, do not upload')
    args = parser.parse_args()

    files = collect(args.skip_detector)
    if not args.dry_run:
        # `volume put` fails on a missing volume. Creating one that exists just
        # errors, which is fine, so the exit status is ignored.
        subprocess.run(
            [sys.executable, '-m', 'modal', 'volume', 'create', VOLUME],
            check=False, capture_output=True,
        )
    for source, name in files:
        size = source.stat().st_size / 1e6
        if args.dry_run:
            print(f'would upload {name} ({size:.1f} MB)')
            continue
        print(f'uploading {name} ({size:.1f} MB)')
        subprocess.run(
            [sys.executable, '-m', 'modal', 'volume', 'put', '--force', VOLUME, str(source), f'/{name}'],
            check=True,
        )


if __name__ == '__main__':
    main()

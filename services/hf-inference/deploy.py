"""Publish the inference service to a private Hugging Face Docker Space.

    python services/hf-inference/deploy.py --repo-id pollens-thesis/pollens-inference

Stages app files, the two inference modules (copied from api/reports/inference/
so they stay the single source of truth) and the private weights from
docs/private/ into a temp folder, checks every weight's SHA-256, then creates
the Space (private, Docker SDK) and uploads the folder. Weights go to the Space
repo only; they are never committed to GitHub. Needs `hf auth login` first.
"""

import argparse
import hashlib
import shutil
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
INFERENCE_SRC = ROOT / 'api' / 'reports' / 'inference'
PRIVATE = ROOT / 'docs' / 'private'

APP_FILES = ('app.py', 'Dockerfile', 'README.md', 'requirements.txt')
INFERENCE_MODULES = ('yolo26.py', 'efficientnet_classifier.py')

CLASSIFIER_DIR = PRIVATE / 'finalized model' / 'classification'
DETECTOR_PATH = (
    PRIVATE / 'model-artifacts' / 'yolo26l-detection-v12' / 'weights' / 'yolo26l_v12_best.pt'
)
# (source, name inside models/, expected SHA-256 or None when not pinned yet)
DETECTOR_SHA256 = '3295126e47fc7c8b4814fd44f1882063a035b2ab746ab75f89cf48cb19bfbfad'


def sha256(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b''):
            digest.update(chunk)
    return digest.hexdigest()


def stage(target, skip_detector):
    for name in APP_FILES:
        shutil.copy2(HERE / name, target / name)

    package = target / 'inference'
    package.mkdir()
    (package / '__init__.py').write_text('', encoding='utf-8')
    for name in INFERENCE_MODULES:
        shutil.copy2(INFERENCE_SRC / name, package / name)

    models = target / 'models'
    models.mkdir()
    for source, name in (
        (CLASSIFIER_DIR / 'efficientnet_b0_pollen15.onnx', 'efficientnet_b0_pollen15.onnx'),
        (CLASSIFIER_DIR / 'class_names.json', 'class_names.json'),
    ):
        if not source.is_file():
            sys.exit(f'Missing classifier file: {source}')
        shutil.copy2(source, models / name)
        print(f'staged {name} ({source.stat().st_size / 1e6:.1f} MB)')

    if skip_detector:
        print('Skipping the detector: /detect will return 503 until it is uploaded.')
        return
    if not DETECTOR_PATH.is_file():
        sys.exit(f'Detector weights not found at {DETECTOR_PATH}. Get yolo26l_v12_best.pt '
                 'from the team, or pass --skip-detector.')
    actual = sha256(DETECTOR_PATH)
    if actual != DETECTOR_SHA256:
        sys.exit(f'Detector SHA-256 mismatch: expected {DETECTOR_SHA256}, got {actual}')
    shutil.copy2(DETECTOR_PATH, models / 'yolo26l_v12_best.pt')
    print(f'staged yolo26l_v12_best.pt ({DETECTOR_PATH.stat().st_size / 1e6:.1f} MB, hash ok)')


def main():
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    parser.add_argument('--repo-id', required=True, help='e.g. pollens-thesis/pollens-inference')
    parser.add_argument('--skip-detector', action='store_true')
    parser.add_argument('--dry-run', action='store_true', help='stage and check, do not upload')
    args = parser.parse_args()

    with tempfile.TemporaryDirectory(prefix='pollens-space-') as tmp:
        target = Path(tmp)
        stage(target, args.skip_detector)
        if args.dry_run:
            print('dry run, staged:', *sorted(str(p.relative_to(target)) for p in target.rglob('*') if p.is_file()), sep='\n  ')
            return

        from huggingface_hub import HfApi

        api = HfApi()
        api.create_repo(
            args.repo_id, repo_type='space', space_sdk='docker', private=True, exist_ok=True,
        )
        api.upload_folder(
            repo_id=args.repo_id, repo_type='space', folder_path=str(target),
            commit_message='Deploy PolLens inference service',
        )
        print(f'Uploaded. Build logs: https://huggingface.co/spaces/{args.repo_id}')


if __name__ == '__main__':
    main()

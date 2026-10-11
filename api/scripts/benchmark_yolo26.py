"""Measure the staging detector on CPU without changing the live API.

Run from api/: python -m scripts.benchmark_yolo26 --manifest PATH --image PATH
"""

import argparse
import hashlib
import json
import platform
import resource
import sys
import tempfile
import time
import zipfile
from pathlib import Path

from PIL import Image

from reports.inference.yolo26 import YOLO26PollenDetector


def sha256_file(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def peak_rss_mb():
    peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return peak / (1024 * 1024) if sys.platform == 'darwin' else peak / 1024


def run(manifest_path, images, *, device, confidence, make_large):
    manifest_path = Path(manifest_path)
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    archive = manifest_path.parent / manifest['archive']
    actual_hash = sha256_file(archive)
    if actual_hash != manifest['archive_sha256']:
        raise ValueError('Artifact archive checksum does not match the manifest')
    if manifest['class_names'] != {'0': 'Pollen', '1': 'non-pollen'}:
        raise ValueError('Artifact class mapping is not Detection v12')

    with tempfile.TemporaryDirectory() as directory:
        weights = Path(directory) / 'yolo26l_v12_best.pt'
        with zipfile.ZipFile(archive) as bundle:
            with bundle.open(manifest['weight_member']) as source, weights.open('wb') as target:
                for chunk in iter(lambda: source.read(1024 * 1024), b''):
                    target.write(chunk)
        if sha256_file(weights) != manifest['weight_sha256']:
            raise ValueError('Checkpoint checksum does not match the manifest')

        start = time.perf_counter()
        detector = YOLO26PollenDetector(weights)
        load_seconds = time.perf_counter() - start
        samples = list(map(Path, images))
        if make_large:
            # Performance probe only: enlarged pixels do not test model accuracy.
            large = Path(directory) / 'synthetic_12mp.jpg'
            with Image.open(samples[0]) as original:
                original.convert('RGB').resize((4032, 3024)).save(large, quality=90)
            samples.append(large)

        measurements = []
        for sample in samples:
            start = time.perf_counter()
            result = detector.detect(sample, confidence=confidence, device=device)
            measurements.append({
                'image': sample.name,
                'size': [result.image_width, result.image_height],
                'pollen_boxes': len(result.pollen_boxes),
                'seconds': round(time.perf_counter() - start, 3),
                'peak_process_rss_mb': round(peak_rss_mb(), 1),
            })
    return {
        'model_id': manifest['model_id'],
        'archive_sha256': actual_hash,
        'device': device,
        'confidence': confidence,
        'platform': platform.platform(),
        'python': platform.python_version(),
        'ultralytics': __import__('ultralytics').__version__,
        'torch': __import__('torch').__version__,
        'model_load_seconds': round(load_seconds, 3),
        'measurements': measurements,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', required=True)
    parser.add_argument('--image', action='append', required=True)
    parser.add_argument('--device', default='cpu')
    parser.add_argument('--confidence', type=float, default=0.25)
    parser.add_argument('--synthetic-12mp', action='store_true')
    args = parser.parse_args()
    print(json.dumps(run(
        args.manifest, args.image, device=args.device,
        confidence=args.confidence, make_large=args.synthetic_12mp,
    ), indent=2))


if __name__ == '__main__':
    main()

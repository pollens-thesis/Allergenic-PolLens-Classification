"""Create a deterministic, hash-manifested bundle for the private model store."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import stat
from zipfile import ZIP_STORED, ZipFile, ZipInfo


DETECTOR_FILE = 'yolo26l_v12_best.pt'
CLASSIFIER_FILE = 'efficientnet_b0_pollen15.onnx'
CLASS_NAMES_FILE = 'class_names.json'
MODEL_FILES = (DETECTOR_FILE, CLASSIFIER_FILE, CLASS_NAMES_FILE)
DETECTOR_CLASSES = ['Pollen', 'non-pollen']


def sha256_file(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def _write_member(bundle, name, data):
    info = ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
    info.compress_type = ZIP_STORED
    info.external_attr = (stat.S_IFREG | 0o600) << 16
    bundle.writestr(info, data)


def package(detector_path, classifier_path, class_names_path, output_path):
    sources = {
        DETECTOR_FILE: Path(detector_path).expanduser().resolve(),
        CLASSIFIER_FILE: Path(classifier_path).expanduser().resolve(),
        CLASS_NAMES_FILE: Path(class_names_path).expanduser().resolve(),
    }
    for name, path in sources.items():
        if not path.is_file():
            raise ValueError(f'{name} is not a regular file: {path}')

    try:
        class_names = json.loads(sources[CLASS_NAMES_FILE].read_text(encoding='utf-8'))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError('Classifier class_names.json could not be read') from exc
    if (
        not isinstance(class_names, list)
        or len(class_names) != 15
        or not all(isinstance(name, str) and name.strip() for name in class_names)
        or len(set(class_names)) != 15
    ):
        raise ValueError('Expected exactly 15 unique classifier species names')

    manifest = {
        'schema_version': 1,
        'release': 'pollens-yolo26l-v12-efficientnet-b0-pollen15-v1',
        'dataset_species_count': 15,
        'detection': {
            'architecture': 'YOLO26-L',
            'checkpoint': 'Detection v12',
            'class_names': DETECTOR_CLASSES,
            'pollen_class_id': 0,
            'file': DETECTOR_FILE,
        },
        'classification': {
            'architecture': 'EfficientNet-B0',
            'class_count': 15,
            'class_names_file': CLASS_NAMES_FILE,
            'class_names': class_names,
            'file': CLASSIFIER_FILE,
        },
        'files': {name: sha256_file(path) for name, path in sources.items()},
    }

    output = Path(output_path).expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary_output = output.with_name(f'.{output.name}.tmp')
    try:
        with ZipFile(temporary_output, 'w', compression=ZIP_STORED) as bundle:
            for name in MODEL_FILES:
                _write_member(bundle, name, sources[name].read_bytes())
            _write_member(
                bundle,
                'manifest.json',
                (json.dumps(manifest, indent=2, sort_keys=True) + '\n').encode('utf-8'),
            )
        os.replace(temporary_output, output)
    finally:
        temporary_output.unlink(missing_ok=True)

    bundle_digest = sha256_file(output)
    checksum_path = output.with_suffix(output.suffix + '.sha256')
    checksum_tmp = checksum_path.with_name(f'.{checksum_path.name}.tmp')
    try:
        checksum_tmp.write_text(f'{bundle_digest}  {output.name}\n', encoding='ascii')
        os.replace(checksum_tmp, checksum_path)
    finally:
        checksum_tmp.unlink(missing_ok=True)
    return output, checksum_path, bundle_digest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--detector', required=True, help='YOLO26 .pt checkpoint path')
    parser.add_argument('--classifier', required=True, help='EfficientNet-B0 ONNX path')
    parser.add_argument('--class-names', required=True, help='Classifier class_names.json path')
    parser.add_argument('--output', required=True, help='Private output ZIP path')
    args = parser.parse_args()

    output, checksum_path, digest = package(
        args.detector, args.classifier, args.class_names, args.output,
    )
    print(f'Bundle: {output}')
    print(f'Checksum: {checksum_path}')
    print(f'SHA-256: {digest}')


if __name__ == '__main__':
    main()

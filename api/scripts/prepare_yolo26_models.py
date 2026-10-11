"""Fetch and verify the private YOLO26 + EfficientNet release bundle."""

import hashlib
import json
import os
from pathlib import Path
import re
import tempfile
from zipfile import ZIP_STORED, BadZipFile, ZipFile

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

from django.conf import settings


DETECTOR_FILE = 'yolo26l_v12_best.pt'
CLASSIFIER_FILE = 'efficientnet_b0_pollen15.onnx'
CLASS_NAMES_FILE = 'class_names.json'
MANIFEST_FILE = 'manifest.json'
MODEL_FILES = (DETECTOR_FILE, CLASSIFIER_FILE, CLASS_NAMES_FILE)
BUNDLE_FILES = frozenset((*MODEL_FILES, MANIFEST_FILE))
SHA256_RE = re.compile(r'^[0-9a-f]{64}$')
MAX_MEMBER_BYTES = {
    DETECTOR_FILE: 256 * 1024 * 1024,
    CLASSIFIER_FILE: 256 * 1024 * 1024,
    CLASS_NAMES_FILE: 1024 * 1024,
    MANIFEST_FILE: 64 * 1024,
}


class ModelBundleError(RuntimeError):
    """The configured private model bundle is missing or invalid."""


def _sha256(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def _required_env(name):
    value = os.environ.get(name, '').strip()
    if not value:
        raise ModelBundleError(f'{name} must be configured for YOLO26 staging')
    return value


def _artifact_paths():
    detector = Path(settings.YOLO26_WEIGHTS_PATH).expanduser()
    classifier = Path(settings.YOLO26_CLASSIFIER_WEIGHTS_PATH).expanduser()
    if detector.name != DETECTOR_FILE or classifier.name != CLASSIFIER_FILE:
        raise ModelBundleError(
            'YOLO26 model paths must use the filenames from the packaged model release'
        )
    detector_parent = detector.parent.resolve()
    classifier_parent = classifier.parent.resolve()
    if detector_parent != classifier_parent:
        raise ModelBundleError('Both model paths must be in the same artifact directory')
    return detector_parent, {
        DETECTOR_FILE: detector_parent / DETECTOR_FILE,
        CLASSIFIER_FILE: detector_parent / CLASSIFIER_FILE,
        CLASS_NAMES_FILE: detector_parent / CLASS_NAMES_FILE,
    }


def _validate_manifest(manifest):
    if not isinstance(manifest, dict) or manifest.get('schema_version') != 1:
        raise ModelBundleError('Model bundle manifest has an unsupported schema')
    files = manifest.get('files')
    if not isinstance(files, dict) or set(files) != set(MODEL_FILES):
        raise ModelBundleError('Model bundle manifest has an unexpected file list')
    if not all(isinstance(files[name], str) and SHA256_RE.fullmatch(files[name]) for name in MODEL_FILES):
        raise ModelBundleError('Model bundle manifest has an invalid file checksum')
    detection = manifest.get('detection')
    if (
        not isinstance(detection, dict)
        or detection.get('architecture') != 'YOLO26-L'
        or detection.get('class_names') != ['Pollen', 'non-pollen']
        or detection.get('pollen_class_id') != 0
    ):
        raise ModelBundleError('Model bundle detector metadata does not match YOLO26 Detection v12')
    classification = manifest.get('classification')
    class_names = classification.get('class_names') if isinstance(classification, dict) else None
    if (
        not isinstance(classification, dict)
        or classification.get('architecture') != 'EfficientNet-B0'
        or classification.get('class_count') != 15
        or not isinstance(class_names, list)
        or len(class_names) != 15
        or not all(isinstance(name, str) and name.strip() for name in class_names)
        or len(set(class_names)) != 15
    ):
        raise ModelBundleError('Model bundle classifier metadata must describe 15 unique species')
    return manifest


def _installed_bundle_is_valid(directory, targets, bundle_sha256):
    marker = directory / '.bundle.sha256'
    manifest_path = directory / MANIFEST_FILE
    try:
        if marker.read_text(encoding='ascii').strip() != bundle_sha256:
            return False
        manifest = _validate_manifest(json.loads(manifest_path.read_text(encoding='utf-8')))
        if any(not targets[name].is_file() for name in MODEL_FILES):
            return False
        if any(_sha256(targets[name]) != manifest['files'][name] for name in MODEL_FILES):
            return False
        class_names = json.loads(targets[CLASS_NAMES_FILE].read_text(encoding='utf-8'))
        return class_names == manifest['classification']['class_names']
    except (OSError, UnicodeDecodeError, json.JSONDecodeError, ModelBundleError):
        return False


def _download_bundle(bundle_path):
    try:
        import boto3
        from botocore.config import Config
    except ImportError as exc:
        raise ModelBundleError('boto3 is required to download the private model bundle') from exc

    endpoint_url = _required_env('YOLO26_ARTIFACTS_ENDPOINT_URL')
    bucket = _required_env('YOLO26_ARTIFACTS_BUCKET')
    object_key = _required_env('YOLO26_ARTIFACTS_OBJECT_KEY')
    access_key = _required_env('YOLO26_ARTIFACTS_ACCESS_KEY_ID')
    secret_key = _required_env('YOLO26_ARTIFACTS_SECRET_ACCESS_KEY')
    expected_bundle_sha = _required_env('YOLO26_ARTIFACTS_BUNDLE_SHA256').lower()
    if not SHA256_RE.fullmatch(expected_bundle_sha):
        raise ModelBundleError('YOLO26_ARTIFACTS_BUNDLE_SHA256 must be a SHA-256 hex digest')
    if not endpoint_url.startswith('https://'):
        raise ModelBundleError('YOLO26_ARTIFACTS_ENDPOINT_URL must use HTTPS')

    client = boto3.client(
        's3',
        endpoint_url=endpoint_url,
        region_name='auto',
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        config=Config(signature_version='s3v4', retries={'max_attempts': 3, 'mode': 'standard'}),
    )
    try:
        client.download_file(bucket, object_key, str(bundle_path))
    except Exception as exc:  # boto3/botocore use their own exception types.
        raise ModelBundleError('Could not download the configured model bundle') from exc
    actual_bundle_sha = _sha256(bundle_path)
    if actual_bundle_sha != expected_bundle_sha:
        raise ModelBundleError('Downloaded model bundle checksum does not match configuration')
    return expected_bundle_sha


def prepare_models():
    directory, targets = _artifact_paths()
    directory.mkdir(parents=True, exist_ok=True)
    expected_sha = _required_env('YOLO26_ARTIFACTS_BUNDLE_SHA256').lower()
    if not SHA256_RE.fullmatch(expected_sha):
        raise ModelBundleError('YOLO26_ARTIFACTS_BUNDLE_SHA256 must be a SHA-256 hex digest')
    if _installed_bundle_is_valid(directory, targets, expected_sha):
        print(f'Private model release is already verified: {expected_sha[:12]}')
        return

    with tempfile.TemporaryDirectory(prefix='.yolo26-release-', dir=directory) as temp_name:
        temporary_dir = Path(temp_name)
        bundle_path = temporary_dir / 'models.zip'
        _download_bundle(bundle_path)
        staged = {}
        try:
            with ZipFile(bundle_path) as bundle:
                members = bundle.infolist()
                names = [member.filename for member in members]
                if len(names) != len(set(names)) or set(names) != BUNDLE_FILES:
                    raise ModelBundleError('Model bundle contains an unexpected file list')
                for member in members:
                    if member.is_dir() or member.compress_type != ZIP_STORED:
                        raise ModelBundleError('Model bundle must contain flat, uncompressed files')
                    if member.file_size > MAX_MEMBER_BYTES.get(member.filename, 0):
                        raise ModelBundleError(f'Model bundle member is too large: {member.filename}')
                manifest_bytes = bundle.read(MANIFEST_FILE)
                try:
                    manifest = _validate_manifest(json.loads(manifest_bytes.decode('utf-8')))
                except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                    raise ModelBundleError('Model bundle manifest is not valid JSON') from exc

                for name in MODEL_FILES:
                    staged_path = temporary_dir / name
                    digest = hashlib.sha256()
                    with bundle.open(name) as source, staged_path.open('xb') as destination:
                        while chunk := source.read(1024 * 1024):
                            digest.update(chunk)
                            destination.write(chunk)
                    if digest.hexdigest() != manifest['files'][name]:
                        raise ModelBundleError(f'Model bundle checksum mismatch: {name}')
                    staged[name] = staged_path
        except BadZipFile as exc:
            raise ModelBundleError('Downloaded model bundle is not a valid ZIP file') from exc

        try:
            class_names = json.loads(staged[CLASS_NAMES_FILE].read_text(encoding='utf-8'))
        except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ModelBundleError('Packaged classifier class names could not be read') from exc
        if class_names != manifest['classification']['class_names']:
            raise ModelBundleError('Classifier class_names.json does not match its release manifest')

        for name in MODEL_FILES:
            os.replace(staged[name], targets[name])
        manifest_path = directory / MANIFEST_FILE
        manifest_tmp = directory / f'.{MANIFEST_FILE}.tmp'
        manifest_tmp.write_bytes(manifest_bytes)
        os.replace(manifest_tmp, manifest_path)
        marker = directory / '.bundle.sha256'
        marker_tmp = directory / '.bundle.sha256.tmp'
        marker_tmp.write_text(expected_sha + '\n', encoding='ascii')
        os.replace(marker_tmp, marker)

    print(f'Fetched and verified private model release: {expected_sha[:12]}')


if __name__ == '__main__':
    try:
        prepare_models()
    except ModelBundleError as exc:
        raise SystemExit(f'YOLO26 model preparation failed: {exc}') from exc

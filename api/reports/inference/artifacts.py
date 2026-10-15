"""Verify selected private model artifacts before loading their runtimes."""

import hashlib
from pathlib import Path


def verify_artifact(path, expected_sha256):
    if not expected_sha256:
        return
    try:
        with Path(path).open('rb') as artifact:
            actual = hashlib.file_digest(artifact, 'sha256').hexdigest()
    except OSError as exc:
        raise ValueError('Selected model artifact is unavailable') from exc
    if actual != expected_sha256.lower():
        raise ValueError('Selected model artifact does not match its release checksum')

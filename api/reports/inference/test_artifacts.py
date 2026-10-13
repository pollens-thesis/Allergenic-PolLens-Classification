import hashlib
import tempfile
from pathlib import Path
from unittest import TestCase

from .artifacts import verify_artifact


class ArtifactIntegrityTests(TestCase):
    def test_replaced_weights_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'best.pt'
            path.write_bytes(b'final model')
            expected = hashlib.sha256(path.read_bytes()).hexdigest()
            verify_artifact(path, expected)
            path.write_bytes(b'other model')
            with self.assertRaisesRegex(ValueError, 'release checksum'):
                verify_artifact(path, expected)

    def test_missing_pinned_weights_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(ValueError, 'unavailable'):
                verify_artifact(Path(directory) / 'missing.pt', '0' * 64)

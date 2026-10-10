"""Preprocessing contract tests that do not require ONNX Runtime."""

import unittest

from PIL import Image

from .efficientnet_classifier import ClassifierOutputError, crop_box_with_padding
from .yolo26 import PollenBox


class CropPreprocessingTests(unittest.TestCase):
    def test_crop_adds_ten_percent_context_on_each_edge(self):
        image = Image.new('RGB', (100, 80))
        box = PollenBox(confidence=0.9, x=20, y=30, width=10, height=20)

        crop = crop_box_with_padding(image, box)

        self.assertEqual(crop.size, (12, 24))

    def test_crop_padding_is_clipped_at_image_edges(self):
        image = Image.new('RGB', (100, 80))
        box = PollenBox(confidence=0.9, x=2, y=2, width=10, height=10)

        crop = crop_box_with_padding(image, box)

        self.assertEqual(crop.size, (8, 8))

    def test_invalid_or_negative_padding_is_rejected(self):
        image = Image.new('RGB', (100, 80))
        box = PollenBox(confidence=0.9, x=20, y=30, width=10, height=20)

        with self.assertRaises(ClassifierOutputError):
            crop_box_with_padding(image, box, padding=-0.1)


if __name__ == '__main__':
    unittest.main()

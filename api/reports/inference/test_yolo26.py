"""Contract checks for the staging detector, without loading ML packages."""

import tempfile
import unittest
from pathlib import Path

from PIL import Image

from .yolo26 import DetectorConfigurationError, DetectorOutputError, YOLO26PollenDetector


class FakeTensor:
    def __init__(self, values):
        self.values = values

    def tolist(self):
        return self.values


class FakeBoxes:
    def __init__(self, classes, scores, xywh):
        self.cls = FakeTensor(classes)
        self.conf = FakeTensor(scores)
        self.xywh = FakeTensor(xywh)


class FakeResult:
    def __init__(self, boxes):
        self.boxes = boxes


class FakeModel:
    names = {0: 'Pollen', 1: 'non-pollen'}

    def __init__(self, boxes):
        self.boxes = boxes
        self.calls = []

    def predict(self, **kwargs):
        self.calls.append(kwargs)
        return [FakeResult(self.boxes)]


class YOLO26PollenDetectorTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.weights = self.root / 'best.pt'
        self.weights.touch()
        self.image = self.root / 'slide.png'
        Image.new('RGB', (100, 80), 'white').save(self.image)

    def detector(self, boxes, model=None):
        model = model or FakeModel(boxes)
        return YOLO26PollenDetector(self.weights, model_factory=lambda _: model), model

    def test_only_pollen_boxes_leave_staging_adapter(self):
        boxes = FakeBoxes([0.0, 1.0, 0.0], [0.9, 0.99, 0.7], [
            [20, 30, 10, 20], [70, 60, 10, 10], [98, 78, 10, 10],
        ])
        detector, model = self.detector(boxes)

        result = detector.detect(self.image)

        self.assertEqual(result.as_dict(), {
            'image': {'width': 100, 'height': 80},
            'pollen_boxes': [
                {'confidence': 0.9, 'x': 20, 'y': 30, 'width': 10, 'height': 20},
                {'confidence': 0.7, 'x': 96.5, 'y': 76.5, 'width': 7, 'height': 7},
            ],
        })
        self.assertEqual(model.calls[0]['conf'], 0.25)
        self.assertEqual(model.calls[0]['imgsz'], 640)
        self.assertEqual(model.calls[0]['device'], 'cpu')

    def test_empty_pollen_result_is_valid(self):
        detector, _ = self.detector(FakeBoxes([1.0], [0.8], [[50, 40, 10, 10]]))
        self.assertEqual(detector.detect(self.image).pollen_boxes, ())

    def test_wrong_class_mapping_is_rejected_before_inference(self):
        model = FakeModel(FakeBoxes([], [], []))
        model.names = {0: 'non-pollen', 1: 'Pollen'}
        with self.assertRaises(DetectorConfigurationError):
            self.detector(model.boxes, model=model)

    def test_malformed_model_output_is_rejected(self):
        detector, _ = self.detector(FakeBoxes([0.0], [float('nan')], [[20, 30, 10, 20]]))
        with self.assertRaises(DetectorOutputError):
            detector.detect(self.image)

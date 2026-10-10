"""Staging adapter for the Colab-trained YOLO26-L Detection v12 checkpoint.

This detector only locates pollen. The local transition pipeline must classify
each pollen crop before translating its output to the report API contract.
"""

from dataclasses import asdict, dataclass
from math import isfinite
from pathlib import Path

from PIL import Image, ImageOps


POLLEN_CLASS_ID = 0
EXPECTED_CLASSES = ('Pollen', 'non-pollen')


class DetectorConfigurationError(ValueError):
    """The weights or their class mapping do not match Detection v12."""


class DetectorOutputError(ValueError):
    """The runtime returned a malformed detection result."""


@dataclass(frozen=True)
class PollenBox:
    confidence: float
    x: float
    y: float
    width: float
    height: float

    def as_dict(self):
        return asdict(self)


@dataclass(frozen=True)
class PollenDetection:
    image_width: int
    image_height: int
    pollen_boxes: tuple[PollenBox, ...]

    def as_dict(self):
        return {
            'image': {'width': self.image_width, 'height': self.image_height},
            'pollen_boxes': [box.as_dict() for box in self.pollen_boxes],
        }


def _class_names(names):
    if isinstance(names, dict):
        if len(names) != len(EXPECTED_CLASSES):
            return ()
        return tuple(names.get(index) for index in range(len(EXPECTED_CLASSES)))
    return tuple(names) if isinstance(names, (list, tuple)) else ()


class YOLO26PollenDetector:
    def __init__(self, weights_path, *, model_factory=None):
        path = Path(weights_path)
        if not path.is_file():
            raise DetectorConfigurationError(f'Detector weights not found: {path}')
        if model_factory is None:
            # Optional dependency: the current Render build and public API do
            # not install or load the staging detector.
            from ultralytics import YOLO

            model_factory = YOLO
        self._model = model_factory(str(path))
        if _class_names(self._model.names) != EXPECTED_CLASSES:
            raise DetectorConfigurationError(
                f'Expected Detection v12 classes {EXPECTED_CLASSES}, got {self._model.names!r}'
            )

    def detect(self, image_path, *, confidence=0.25, image_size=640, device='cpu'):
        with Image.open(image_path) as source:
            image = ImageOps.exif_transpose(source).convert('RGB')
            return self.detect_image(
                image, confidence=confidence, image_size=image_size, device=device,
            )

    def detect_image(self, image, *, confidence=0.25, image_size=640, device='cpu'):
        """Run inference on an already oriented PIL image."""
        if not 0 < confidence <= 1:
            raise ValueError('confidence must be greater than 0 and at most 1')
        if image_size <= 0:
            raise ValueError('image_size must be positive')

        image = image.convert('RGB')
        width, height = image.size
        results = self._model.predict(
            source=image, conf=confidence, imgsz=image_size,
            device=device, verbose=False,
        )
        if len(results) != 1 or results[0].boxes is None:
            raise DetectorOutputError('Expected one image with a boxes result')

        boxes = results[0].boxes
        classes = boxes.cls.tolist()
        scores = boxes.conf.tolist()
        coordinates = boxes.xywh.tolist()
        if len(classes) != len(scores) or len(classes) != len(coordinates):
            raise DetectorOutputError('Detection arrays have different lengths')

        pollen_boxes = []
        for class_id, score, xywh in zip(classes, scores, coordinates):
            if class_id not in (0, 1):
                raise DetectorOutputError(f'Unexpected detector class: {class_id}')
            if not isfinite(score) or not 0 <= score <= 1:
                raise DetectorOutputError('Invalid detector confidence')
            if class_id != POLLEN_CLASS_ID:
                continue
            if len(xywh) != 4 or not all(isfinite(value) for value in xywh):
                raise DetectorOutputError('Invalid detector box')
            x, y, box_width, box_height = xywh
            if box_width <= 0 or box_height <= 0:
                raise DetectorOutputError('Detector box has no area')
            left = max(0.0, x - box_width / 2)
            top = max(0.0, y - box_height / 2)
            right = min(float(width), x + box_width / 2)
            bottom = min(float(height), y + box_height / 2)
            if right <= left or bottom <= top:
                raise DetectorOutputError('Detector box lies outside the image')
            pollen_boxes.append(PollenBox(
                confidence=float(score),
                x=(left + right) / 2,
                y=(top + bottom) / 2,
                width=right - left,
                height=bottom - top,
            ))
        return PollenDetection(width, height, tuple(pollen_boxes))

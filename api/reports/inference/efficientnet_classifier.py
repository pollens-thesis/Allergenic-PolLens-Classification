"""CPU inference for the Colab-trained EfficientNet-B0 pollen classifier."""

import json
from math import isfinite
from pathlib import Path

from PIL import Image


IMAGE_SIZE = 224
CROP_PADDING = 0.10
MAX_BATCH_SIZE = 32
MEAN = (0.485, 0.456, 0.406)
STD = (0.229, 0.224, 0.225)


class ClassifierConfigurationError(ValueError):
    """The ONNX runtime, weights, or class metadata is unavailable."""


class ClassifierOutputError(ValueError):
    """The ONNX model returned invalid logits or probabilities."""


def crop_box_with_padding(image, box, padding=CROP_PADDING):
    """Crop a detector box with the 10% per-side context used in training."""
    values = (box.x, box.y, box.width, box.height, padding)
    if (
        not all(isfinite(value) for value in values)
        or box.width <= 0
        or box.height <= 0
        or padding < 0
    ):
        raise ClassifierOutputError('Detector returned an invalid classifier box')

    x0 = box.x - box.width / 2
    y0 = box.y - box.height / 2
    x1 = box.x + box.width / 2
    y1 = box.y + box.height / 2
    left = int(max(0, x0 - box.width * padding))
    top = int(max(0, y0 - box.height * padding))
    right = int(min(image.width, x1 + box.width * padding))
    bottom = int(min(image.height, y1 + box.height * padding))
    if right <= left or bottom <= top:
        raise ClassifierOutputError('Detector returned a box without crop area')
    return image.crop((left, top, right, bottom)).convert('RGB')


class EfficientNetB0Classifier:
    """Load one ONNX session and classify a batch of pollen crops on CPU."""

    def __init__(self, weights_path, *, session_factory=None):
        self.weights_path = Path(weights_path).expanduser()
        classes_path = self.weights_path.with_name('class_names.json')
        if not self.weights_path.is_file():
            raise ClassifierConfigurationError('Classifier ONNX weights were not found')
        if not classes_path.is_file():
            raise ClassifierConfigurationError('Classifier class_names.json was not found beside the weights')

        try:
            classes = json.loads(classes_path.read_text(encoding='utf-8'))
        except (OSError, ValueError) as exc:
            raise ClassifierConfigurationError('Classifier class metadata could not be read') from exc
        if (
            not isinstance(classes, list)
            or len(classes) != 15
            or not all(isinstance(name, str) and name.strip() for name in classes)
            or len(set(classes)) != len(classes)
        ):
            raise ClassifierConfigurationError('Expected 15 unique classifier class names')
        self.classes = tuple(classes)

        try:
            import numpy as np
            if session_factory is None:
                import onnxruntime as ort
                session_factory = ort.InferenceSession
        except ImportError as exc:
            raise ClassifierConfigurationError(
                'Install the optional ONNX Runtime dependencies for local classification'
            ) from exc
        self._np = np

        try:
            self._session = session_factory(
                str(self.weights_path), providers=['CPUExecutionProvider'],
            )
            inputs = self._session.get_inputs()
            outputs = self._session.get_outputs()
            if not inputs or not outputs:
                raise ValueError('Classifier graph has no input or output')
            self._input_name = inputs[0].name
            self._output_name = outputs[0].name
            input_shape = inputs[0].shape
            if (
                input_shape is None
                or len(input_shape) != 4
                or (isinstance(input_shape[1], int) and input_shape[1] != 3)
                or (isinstance(input_shape[2], int) and input_shape[2] != IMAGE_SIZE)
                or (isinstance(input_shape[3], int) and input_shape[3] != IMAGE_SIZE)
            ):
                raise ValueError(f'Unexpected classifier input shape: {input_shape!r}')
        except ClassifierConfigurationError:
            raise
        except Exception as exc:  # ONNX Runtime uses its own exception classes.
            raise ClassifierConfigurationError('Classifier ONNX model could not be loaded') from exc

    def classify(self, image, boxes):
        """Return `(scientific_name, top_probability)` for each pollen box."""
        if not boxes:
            return []

        np = self._np
        mean = np.asarray(MEAN, dtype=np.float32).reshape(1, 1, 3)
        std = np.asarray(STD, dtype=np.float32).reshape(1, 1, 3)
        predictions = []
        for start in range(0, len(boxes), MAX_BATCH_SIZE):
            batch_boxes = boxes[start:start + MAX_BATCH_SIZE]
            tensors = []
            for box in batch_boxes:
                crop = crop_box_with_padding(image, box)
                pixels = np.asarray(
                    crop.resize((IMAGE_SIZE, IMAGE_SIZE), Image.Resampling.BILINEAR),
                    dtype=np.float32,
                ) / 255.0
                tensors.append(((pixels - mean) / std).transpose(2, 0, 1))
            batch = np.stack(tensors, axis=0).astype(np.float32, copy=False)

            try:
                outputs = self._session.run([self._output_name], {self._input_name: batch})
            except Exception as exc:  # ONNX Runtime uses its own exception classes.
                raise ClassifierOutputError('Classifier inference failed') from exc
            if not outputs:
                raise ClassifierOutputError('Classifier returned no logits')
            logits = np.asarray(outputs[0])
            if logits.shape != (len(batch_boxes), len(self.classes)) or not np.isfinite(logits).all():
                raise ClassifierOutputError('Classifier returned invalid logits')

            shifted = logits - logits.max(axis=1, keepdims=True)
            exp_logits = np.exp(shifted)
            probabilities = exp_logits / exp_logits.sum(axis=1, keepdims=True)
            if not np.isfinite(probabilities).all():
                raise ClassifierOutputError('Classifier returned invalid probabilities')

            indices = probabilities.argmax(axis=1)
            predictions.extend(
                (self.classes[int(index)], float(probabilities[row, index]))
                for row, index in enumerate(indices)
            )
        return predictions

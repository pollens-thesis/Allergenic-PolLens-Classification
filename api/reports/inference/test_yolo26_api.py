"""API contract tests for the local YOLO26 + EfficientNet pipeline."""

import io
from unittest.mock import patch

from PIL import Image
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User

from .yolo26 import PollenBox, PollenDetection


class FakeDetector:
    def __init__(self, result):
        self.result = result
        self.calls = []

    def detect_image(self, image, **kwargs):
        self.calls.append((image.copy(), kwargs))
        return self.result


class FakeClassifier:
    def __init__(self, labels=None, error=None):
        self.labels = labels or []
        self.error = error
        self.calls = []

    def classify(self, image, boxes):
        self.calls.append((image.copy(), boxes))
        if self.error:
            raise self.error
        return self.labels


@override_settings(
    DETECTION_BACKEND='yolo26',
    DETECTION_MOCK=False,
    YOLO26_WEIGHTS_PATH='/private/test/best.pt',
    YOLO26_CLASSIFIER_WEIGHTS_PATH='/private/test/efficientnet.onnx',
    YOLO26_CONFIDENCE=0.25,
    YOLO26_IMAGE_SIZE=640,
    YOLO26_DEVICE='cpu',
)
class YOLO26DetectViewTests(APITestCase):
    url = '/api/v1/reports/detect/'

    def setUp(self):
        user = User.objects.create(email='researcher@up.edu.ph', institution='up.edu.ph')
        self.client.force_authenticate(user=user)

    @staticmethod
    def upload_image(size=(100, 80)):
        buffer = io.BytesIO()
        Image.new('RGB', size, color='white').save(buffer, format='PNG')
        return SimpleUploadedFile('slide.png', buffer.getvalue(), content_type='image/png')

    @patch('reports.views._yolo26_classifier')
    @patch('reports.views._yolo26_detector')
    def test_returns_species_labeled_yolo_boxes_in_existing_contract(
        self, detector_factory, classifier_factory,
    ):
        box = PollenBox(confidence=0.91, x=20, y=30, width=10, height=20)
        detector = FakeDetector(PollenDetection(100, 80, (box,)))
        classifier = FakeClassifier([('Imperata cylindrica', 0.83)])
        detector_factory.return_value = detector
        classifier_factory.return_value = classifier

        response = self.client.post(self.url, {'image': self.upload_image()}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data, {
            'image': {'width': 100, 'height': 80},
            'predictions': [{
                'class': 'Imperata cylindrica', 'confidence': 0.83,
                'x': 20, 'y': 30, 'width': 10, 'height': 20,
            }],
            'mock': False,
        })
        self.assertEqual(detector.calls[0][1], {
            'confidence': 0.25, 'image_size': 640, 'device': 'cpu',
        })
        self.assertEqual(classifier.calls[0][0].size, (100, 80))
        self.assertEqual(classifier.calls[0][1], (box,))

    @patch('reports.views._yolo26_classifier')
    @patch('reports.views._yolo26_detector')
    def test_empty_detector_result_returns_no_species_or_classifier_call(
        self, detector_factory, classifier_factory,
    ):
        detector_factory.return_value = FakeDetector(PollenDetection(100, 80, ()))
        classifier = FakeClassifier()
        classifier_factory.return_value = classifier

        response = self.client.post(self.url, {'image': self.upload_image()}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data['predictions'], [])
        self.assertEqual(classifier.calls, [])

    @patch('reports.views._yolo26_classifier')
    @patch('reports.views._yolo26_detector')
    def test_classifier_failure_fails_the_whole_image_request(
        self, detector_factory, classifier_factory,
    ):
        from .efficientnet_classifier import ClassifierOutputError

        detector_factory.return_value = FakeDetector(PollenDetection(100, 80, (
            PollenBox(confidence=0.91, x=20, y=30, width=10, height=20),
        )))
        classifier_factory.return_value = FakeClassifier(error=ClassifierOutputError('bad logits'))

        response = self.client.post(self.url, {'image': self.upload_image()}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertEqual(response.data, {'detail': 'Detection service is unavailable.'})

    @override_settings(YOLO26_CLASSIFIER_WEIGHTS_PATH='')
    @patch('reports.views._yolo26_classifier')
    @patch('reports.views._yolo26_detector')
    def test_missing_classifier_path_fails_closed_before_loading_models(
        self, detector_factory, classifier_factory,
    ):
        response = self.client.post(self.url, {'image': self.upload_image()}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        detector_factory.assert_not_called()
        classifier_factory.assert_not_called()


@override_settings(DETECTION_BACKEND='unknown', DETECTION_MOCK=False)
class UnknownDetectionBackendTests(APITestCase):
    url = '/api/v1/reports/detect/'

    def setUp(self):
        user = User.objects.create(email='researcher@up.edu.ph', institution='up.edu.ph')
        self.client.force_authenticate(user=user)

    def test_unknown_backend_fails_closed(self):
        buffer = io.BytesIO()
        Image.new('RGB', (10, 10), color='white').save(buffer, format='PNG')
        upload = SimpleUploadedFile('slide.png', buffer.getvalue(), content_type='image/png')

        response = self.client.post(self.url, {'image': upload}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)


@override_settings(DETECTION_BACKEND='yolo26', DETECTION_MOCK=True)
class MockModePrecedenceTests(APITestCase):
    url = '/api/v1/reports/detect/'

    def setUp(self):
        user = User.objects.create(email='researcher@up.edu.ph', institution='up.edu.ph')
        self.client.force_authenticate(user=user)

    @patch('reports.views._yolo26_classifier')
    @patch('reports.views._yolo26_detector')
    def test_demo_mock_still_wins_over_yolo26_backend(self, detector_factory, classifier_factory):
        buffer = io.BytesIO()
        Image.new('RGB', (100, 80), color='white').save(buffer, format='PNG')
        upload = SimpleUploadedFile('slide.png', buffer.getvalue(), content_type='image/png')

        response = self.client.post(self.url, {'image': upload}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertIs(response.data['mock'], True)
        detector_factory.assert_not_called()
        classifier_factory.assert_not_called()

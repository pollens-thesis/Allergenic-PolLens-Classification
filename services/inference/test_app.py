"""Tests with stub models, so they need only fastapi, httpx, pillow and pytest."""

import io
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from PIL import Image

import app as service


class StubDetector:
    def detect_image(self, image, *, confidence, image_size, device):
        boxes = (
            SimpleNamespace(x=50.0, y=40.0, width=20.0, height=18.0, confidence=0.9),
            SimpleNamespace(x=10.0, y=12.0, width=8.0, height=8.0, confidence=0.5),
        )
        return SimpleNamespace(image_width=image.width, image_height=image.height, pollen_boxes=boxes)


class StubClassifier:
    def classify(self, image, boxes):
        return [('Sorghum halepense', 0.8), ('Imperata cylindrica', 0.6)][: len(boxes)]


def jpeg_bytes(size=(120, 90)):
    buffer = io.BytesIO()
    Image.new('RGB', size, 'white').save(buffer, 'JPEG')
    return buffer.getvalue()


TOKEN = 'test-token'
AUTH = {'Authorization': f'Bearer {TOKEN}'}


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv('INFERENCE_TOKEN', TOKEN)
    monkeypatch.setitem(service.models, 'detector', StubDetector())
    monkeypatch.setitem(service.models, 'classifier', StubClassifier())
    return TestClient(service.app)


def post(client, data, name='slide.jpg', headers=AUTH):
    return client.post('/detect', files={'image': (name, data, 'image/jpeg')}, headers=headers)


def test_401_without_a_token(client):
    response = post(client, jpeg_bytes(), headers={})
    assert response.status_code == 401
    assert response.json() == {'detail': 'Invalid or missing token.'}


def test_401_with_a_wrong_token(client):
    assert post(client, jpeg_bytes(), headers={'Authorization': 'Bearer nope'}).status_code == 401


def test_401_with_a_non_bearer_scheme(client):
    assert post(client, jpeg_bytes(), headers={'Authorization': f'Basic {TOKEN}'}).status_code == 401


def test_503_when_the_server_has_no_token(client, monkeypatch):
    monkeypatch.delenv('INFERENCE_TOKEN')
    response = post(client, jpeg_bytes())
    assert response.status_code == 503
    assert response.json() == {'detail': 'Service token is not configured.'}


def test_detect_returns_api_shape(client):
    response = post(client, jpeg_bytes())
    assert response.status_code == 200
    assert response.json() == {
        'image': {'width': 120, 'height': 90},
        'predictions': [
            {'class': 'Sorghum halepense', 'confidence': 0.8, 'x': 50.0, 'y': 40.0, 'width': 20.0, 'height': 18.0},
            {'class': 'Imperata cylindrica', 'confidence': 0.6, 'x': 10.0, 'y': 12.0, 'width': 8.0, 'height': 8.0},
        ],
    }


def test_no_boxes_returns_empty_predictions(client, monkeypatch):
    class Empty:
        def detect_image(self, image, **kwargs):
            return SimpleNamespace(image_width=image.width, image_height=image.height, pollen_boxes=())

    monkeypatch.setitem(service.models, 'detector', Empty())
    response = post(client, jpeg_bytes())
    assert response.status_code == 200
    assert response.json()['predictions'] == []


def test_503_when_a_model_is_missing(client, monkeypatch):
    monkeypatch.setitem(service.models, 'detector', None)
    assert post(client, jpeg_bytes()).status_code == 503


def test_400_for_a_non_image(client):
    response = post(client, b'not an image')
    assert response.status_code == 400
    assert 'detail' in response.json()


def test_502_when_inference_raises(client, monkeypatch):
    class Broken:
        def detect_image(self, *args, **kwargs):
            raise RuntimeError('boom')

    monkeypatch.setitem(service.models, 'detector', Broken())
    assert post(client, jpeg_bytes()).status_code == 502


def test_502_when_label_count_differs(client, monkeypatch):
    class Short:
        def classify(self, image, boxes):
            return [('Sorghum halepense', 0.8)]

    monkeypatch.setitem(service.models, 'classifier', Short())
    assert post(client, jpeg_bytes()).status_code == 502


def test_healthz_is_open_and_reports_model_state(client, monkeypatch):
    assert client.get('/healthz').json() == {'status': 'ok', 'detector': True, 'classifier': True}
    monkeypatch.setitem(service.models, 'classifier', None)
    assert client.get('/healthz').json()['classifier'] is False

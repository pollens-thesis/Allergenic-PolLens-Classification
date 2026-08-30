import io
import json

from PIL import Image
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User

from .models import Detection, Grain, Report, Slide


def make_test_image(name='slide.png'):
    buffer = io.BytesIO()
    Image.new('RGB', (4, 4), color='white').save(buffer, format='PNG')
    buffer.seek(0)
    return SimpleUploadedFile(name, buffer.read(), content_type='image/png')


def make_slide_payload(**overrides):
    slide = {
        'fileName': 'slide-1.png',
        'detections': [
            {'speciesId': 'poaceae', 'grainCount': 3, 'avgConfidence': 0.9},
        ],
        'grains': [
            {
                'speciesId': 'poaceae', 'confidence': 0.9,
                'box': {'x': 0.1, 'y': 0.1, 'width': 0.2, 'height': 0.2},
            },
        ],
        'notes': 'looks fine',
    }
    slide.update(overrides)
    return slide


def make_report_payload(**overrides):
    payload = {
        'collectedAt': '2026-07-26',
        'location': 'UPLB Campus',
        'researcher': 'Dr. Santos',
        'weather': json.dumps({
            'condition': 'Sunny', 'temperatureC': 30.5, 'humidityPct': 60, 'windKph': 5,
        }),
        'slides': json.dumps([make_slide_payload()]),
    }
    payload.update(overrides)
    return payload


class ReportListCreateViewTests(APITestCase):
    url = '/api/v1/reports/'

    def setUp(self):
        self.user = User.objects.create(email='researcher@up.edu.ph', institution='up.edu.ph')

    def test_requires_authentication(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_empty_returns_empty_array(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

    def test_create_persists_report_with_slide_and_image(self):
        self.client.force_authenticate(user=self.user)
        payload = make_report_payload()
        payload['0'] = make_test_image()

        response = self.client.post(self.url, payload, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        sample_id = response.data['sampleId']
        self.assertRegex(sample_id, r'^PLN-\d{4}-0001$')
        self.assertEqual(response.data['slides'][0]['id'], f'{sample_id}-S1')
        self.assertTrue(response.data['slides'][0]['image_url'].startswith('http'))
        self.assertEqual(response.data['slides'][0]['grains'][0]['id'], 'G1')
        self.assertEqual(response.data['weather']['condition'], 'Sunny')
        self.assertEqual(response.data['status'], 'Completed')

        self.assertEqual(Report.objects.count(), 1)
        self.assertEqual(Slide.objects.count(), 1)
        self.assertEqual(Detection.objects.count(), 1)
        self.assertEqual(Grain.objects.count(), 1)

    def test_create_without_weather_returns_null_weather(self):
        self.client.force_authenticate(user=self.user)
        payload = make_report_payload()
        del payload['weather']
        payload['0'] = make_test_image()

        response = self.client.post(self.url, payload, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertIsNone(response.data['weather'])
        self.assertIsNone(Report.objects.get().weather_condition)

    def test_create_missing_slide_image_returns_400(self):
        self.client.force_authenticate(user=self.user)
        payload = make_report_payload()

        response = self.client.post(self.url, payload, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Report.objects.count(), 0)

    def test_create_invalid_species_id_returns_400(self):
        self.client.force_authenticate(user=self.user)
        payload = make_report_payload(
            slides=json.dumps([make_slide_payload(
                detections=[{'speciesId': 'not-a-species', 'grainCount': 1, 'avgConfidence': 0.5}],
            )]),
        )
        payload['0'] = make_test_image()

        response = self.client.post(self.url, payload, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_empty_slides_returns_400(self):
        self.client.force_authenticate(user=self.user)
        payload = make_report_payload(slides=json.dumps([]))

        response = self.client.post(self.url, payload, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_sample_ids_increment_across_requests(self):
        self.client.force_authenticate(user=self.user)

        first = make_report_payload()
        first['0'] = make_test_image()
        first_response = self.client.post(self.url, first, format='multipart')

        second = make_report_payload()
        second['0'] = make_test_image()
        second_response = self.client.post(self.url, second, format='multipart')

        self.assertTrue(first_response.data['sampleId'].endswith('-0001'))
        self.assertTrue(second_response.data['sampleId'].endswith('-0002'))

    def test_list_returns_created_reports(self):
        self.client.force_authenticate(user=self.user)
        payload = make_report_payload()
        payload['0'] = make_test_image()
        self.client.post(self.url, payload, format='multipart')

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)


class ReportDetailViewTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create(email='researcher@up.edu.ph', institution='up.edu.ph')

    def test_requires_authentication(self):
        response = self.client.get('/api/v1/reports/PLN-2026-0001/')

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_returns_report_by_sample_id(self):
        self.client.force_authenticate(user=self.user)
        payload = make_report_payload()
        payload['0'] = make_test_image()
        created = self.client.post('/api/v1/reports/', payload, format='multipart')
        sample_id = created.data['sampleId']

        response = self.client.get(f'/api/v1/reports/{sample_id}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['sampleId'], sample_id)
        self.assertEqual(len(response.data['slides']), 1)
        self.assertEqual(len(response.data['slides'][0]['grains']), 1)

    def test_unknown_sample_id_returns_404(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get('/api/v1/reports/PLN-2026-9999/')

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(response.data, {'detail': 'Report not found.'})

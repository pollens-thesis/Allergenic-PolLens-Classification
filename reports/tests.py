import calendar
import io
import json
from unittest.mock import Mock, patch

import requests
from PIL import Image
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User

from .models import Detection, Grain, Report, Slide, next_sample_id
from .views import all_species_ids


def make_test_image(name='slide.png'):
    buffer = io.BytesIO()
    Image.new('RGB', (4, 4), color='white').save(buffer, format='PNG')
    buffer.seek(0)
    return SimpleUploadedFile(name, buffer.read(), content_type='image/png')


def make_slide_payload(**overrides):
    slide = {
        'fileName': 'slide-1.png',
        'detections': [
            {'speciesId': 'amaranthus_spinosus', 'grainCount': 3, 'avgConfidence': 0.9},
        ],
        'grains': [
            {
                'speciesId': 'amaranthus_spinosus', 'confidence': 0.9,
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

    def test_create_invalid_grain_species_id_returns_400(self):
        self.client.force_authenticate(user=self.user)
        payload = make_report_payload(
            slides=json.dumps([make_slide_payload(
                grains=[{
                    'speciesId': 'not-a-species', 'confidence': 0.5,
                    'box': {'x': 0.1, 'y': 0.1, 'width': 0.2, 'height': 0.2},
                }],
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


def make_report(location='UPLB Campus', status='Completed', collected_at='2026-07-26', species_id='amaranthus_spinosus'):
    report = Report.objects.create(
        sample_id=next_sample_id(),
        collected_at=collected_at,
        location=location,
        researcher='Dr. Santos',
        status=status,
    )
    slide = Slide.objects.create(
        report=report, number=1, file_name='slide-1.png', image=make_test_image(),
    )
    Detection.objects.create(slide=slide, species_id=species_id, grain_count=3, avg_confidence=0.9)
    return report


class ReportListFilterTests(APITestCase):
    url = '/api/v1/reports/'

    def setUp(self):
        self.user = User.objects.create(email='researcher@up.edu.ph', institution='up.edu.ph')
        self.client.force_authenticate(user=self.user)

    def test_filters_by_status(self):
        make_report(status='Completed')
        make_report(status='Processing')

        response = self.client.get(self.url, {'status': 'Processing'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['status'], 'Processing')

    def test_status_all_returns_everything(self):
        make_report(status='Completed')
        make_report(status='Processing')

        response = self.client.get(self.url, {'status': 'All'})

        self.assertEqual(len(response.data), 2)

    def test_invalid_status_returns_400(self):
        response = self.client.get(self.url, {'status': 'bogus'})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_filters_by_location_exact_match(self):
        make_report(location='UPLB Campus')
        make_report(location='Lucena City, Quezon')

        response = self.client.get(self.url, {'location': 'Lucena City, Quezon'})

        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['location'], 'Lucena City, Quezon')

    def test_location_all_returns_everything(self):
        make_report(location='UPLB Campus')
        make_report(location='Lucena City, Quezon')

        response = self.client.get(self.url, {'location': 'all'})

        self.assertEqual(len(response.data), 2)

    def test_filters_by_date_range_inclusive(self):
        make_report(collected_at='2026-07-20')
        make_report(collected_at='2026-07-26')
        make_report(collected_at='2026-08-01')

        response = self.client.get(self.url, {'from': '2026-07-21', 'to': '2026-07-31'})

        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['collectedAt'], '2026-07-26')

    def test_date_range_upper_bound_includes_same_day_with_time_suffix(self):
        make_report(collected_at='2026-07-26T14:30')

        response = self.client.get(self.url, {'to': '2026-07-26'})

        self.assertEqual(len(response.data), 1)

    def test_invalid_date_returns_400(self):
        response = self.client.get(self.url, {'from': 'not-a-date'})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_search_matches_sample_id(self):
        report = make_report()

        response = self.client.get(self.url, {'q': report.sample_id[-4:]})

        self.assertEqual(len(response.data), 1)

    def test_search_matches_location(self):
        make_report(location='Lucena City, Quezon')
        make_report(location='UPLB Campus')

        response = self.client.get(self.url, {'q': 'lucena'})

        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['location'], 'Lucena City, Quezon')

    def test_search_matches_species(self):
        make_report(species_id='amaranthus_spinosus')
        make_report(species_id='axonopus_compressus')

        response = self.client.get(self.url, {'q': 'axonopus'})

        self.assertEqual(len(response.data), 1)

    def test_search_matches_collected_at(self):
        make_report(collected_at='2026-07-26')
        make_report(collected_at='2026-08-01')

        response = self.client.get(self.url, {'q': '2026-07'})

        self.assertEqual(len(response.data), 1)

    def test_search_does_not_duplicate_report_with_multiple_detections(self):
        report = make_report(species_id='amaranthus_spinosus')
        slide = report.slides.get()
        Detection.objects.create(slide=slide, species_id='axonopus_compressus', grain_count=1, avg_confidence=0.5)

        response = self.client.get(self.url, {'q': report.location})

        self.assertEqual(len(response.data), 1)

    def test_combined_filters_are_anded(self):
        make_report(location='UPLB Campus', status='Completed', collected_at='2026-07-26')
        make_report(location='UPLB Campus', status='Processing', collected_at='2026-07-26')

        response = self.client.get(self.url, {'location': 'UPLB Campus', 'status': 'Completed'})

        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['status'], 'Completed')


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


def month_key(offset):
    """'YYYY-MM-DD' (day 15) for `offset` calendar months before the current one."""
    year, month = timezone.now().year, timezone.now().month
    for _ in range(offset):
        month -= 1
        if month == 0:
            month, year = 12, year - 1
    return f'{year:04d}-{month:02d}-15'


class ReportMonthlyCountsViewTests(APITestCase):
    url = '/api/v1/reports/monthly-counts/'

    def setUp(self):
        self.user = User.objects.create(email='researcher@up.edu.ph', institution='up.edu.ph')

    def test_requires_authentication(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_empty_state_returns_twelve_months_all_zero(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 12)
        for entry in response.data:
            self.assertEqual(set(entry['series']), set(all_species_ids()))
            for count in entry['series'].values():
                self.assertEqual(count, 0)
        self.assertEqual(response.data[-1]['month'], calendar.month_abbr[timezone.now().month])

    def test_current_month_report_is_counted_by_species(self):
        self.client.force_authenticate(user=self.user)
        make_report(collected_at=month_key(0), species_id='axonopus_compressus')

        response = self.client.get(self.url)

        self.assertEqual(response.data[-1]['series']['axonopus_compressus'], 3)
        self.assertEqual(response.data[-1]['series']['amaranthus_spinosus'], 0)

    def test_reports_in_different_months_are_bucketed_separately(self):
        self.client.force_authenticate(user=self.user)
        make_report(collected_at=month_key(0), species_id='amaranthus_spinosus')
        make_report(collected_at=month_key(1), species_id='amaranthus_spinosus')

        response = self.client.get(self.url)

        self.assertEqual(response.data[-1]['series']['amaranthus_spinosus'], 3)
        self.assertEqual(response.data[-2]['series']['amaranthus_spinosus'], 3)
        self.assertEqual(response.data[-3]['series']['amaranthus_spinosus'], 0)

    def test_report_older_than_window_is_excluded(self):
        self.client.force_authenticate(user=self.user)
        make_report(collected_at=month_key(12), species_id='amaranthus_spinosus')

        response = self.client.get(self.url)

        for entry in response.data:
            self.assertEqual(entry['series']['amaranthus_spinosus'], 0)

    def test_every_catalog_species_appears_in_series(self):
        self.client.force_authenticate(user=self.user)
        make_report(collected_at=month_key(0), species_id='mangifera_indica')

        response = self.client.get(self.url)

        # All 23 species are always present (zero-filled), not just ones with data.
        self.assertEqual(set(response.data[-1]['series']), set(all_species_ids()))
        self.assertEqual(response.data[-1]['series']['mangifera_indica'], 3)


class SpeciesListViewTests(APITestCase):
    url = '/api/v1/reports/species/'

    def setUp(self):
        self.user = User.objects.create(email='researcher@up.edu.ph', institution='up.edu.ph')

    def test_requires_authentication(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_returns_all_species_in_curated_order(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = all_species_ids()
        self.assertEqual(len(response.data), len(ids))
        self.assertEqual([row['id'] for row in response.data], ids)
        self.assertEqual(response.data[0]['id'], 'amaranthus_spinosus')
        self.assertEqual(response.data[-1]['id'], 'mangifera_indica')

    def test_species_shape_is_camelcase(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get(self.url)

        first = response.data[0]
        self.assertEqual(
            set(first), {'id', 'scientificName', 'commonName', 'code', 'season', 'riskLevel', 'color'},
        )
        self.assertEqual(first['scientificName'], 'Amaranthus spinosus')
        self.assertEqual(first['code'], 'AMAR')


@override_settings(
    ROBOFLOW_API_KEY='test-key', ROBOFLOW_MODEL_ID='workspace/model', ROBOFLOW_MODEL_VERSION='1',
    ROBOFLOW_MOCK=False,
)
class DetectViewTests(APITestCase):
    url = '/api/v1/reports/detect/'

    def setUp(self):
        self.user = User.objects.create(email='researcher@up.edu.ph', institution='up.edu.ph')

    def test_requires_authentication(self):
        response = self.client.post(self.url, {'image': make_test_image()}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_missing_image_returns_400(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(self.url, {}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @override_settings(ROBOFLOW_API_KEY='')
    def test_not_configured_returns_503(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(self.url, {'image': make_test_image()}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)

    @patch('reports.views.requests.post')
    def test_successful_detection_passes_through_predictions(self, mock_post):
        mock_post.return_value = Mock(status_code=200, json=lambda: {
            'inference_id': 'f00d', 'time': 0.05,
            'image': {'width': 640, 'height': 480},
            'predictions': [
                {
                    'class': 'amaranthus_spinosus', 'confidence': 0.92,
                    'x': 50.0, 'y': 60.0, 'width': 20.0, 'height': 20.0,
                    'class_id': 3, 'detection_id': 'abc123',
                },
            ],
        })
        self.client.force_authenticate(user=self.user)

        response = self.client.post(self.url, {'image': make_test_image()}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data, {
            'image': {'width': 640, 'height': 480},
            'predictions': [
                {
                    'class': 'amaranthus_spinosus', 'confidence': 0.92,
                    'x': 50.0, 'y': 60.0, 'width': 20.0, 'height': 20.0,
                },
            ],
        })
        called_url = mock_post.call_args.args[0]
        self.assertEqual(called_url, 'https://detect.roboflow.com/workspace/model/1')
        self.assertEqual(mock_post.call_args.kwargs['params'], {'api_key': 'test-key'})

    @patch('reports.views.requests.post')
    def test_upstream_error_status_returns_502(self, mock_post):
        mock_post.return_value = Mock(status_code=500, json=lambda: {})
        self.client.force_authenticate(user=self.user)

        response = self.client.post(self.url, {'image': make_test_image()}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)

    @patch('reports.views.requests.post')
    def test_upstream_connection_error_returns_502(self, mock_post):
        mock_post.side_effect = requests.ConnectionError('boom')
        self.client.force_authenticate(user=self.user)

        response = self.client.post(self.url, {'image': make_test_image()}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)



@override_settings(
    ROBOFLOW_MOCK=True, ROBOFLOW_API_KEY='', ROBOFLOW_MODEL_ID='', ROBOFLOW_MODEL_VERSION='',
)
class DetectViewMockModeTests(APITestCase):
    url = '/api/v1/reports/detect/'

    def setUp(self):
        self.user = User.objects.create(email='researcher@up.edu.ph', institution='up.edu.ph')
        self.client.force_authenticate(user=self.user)

    def post_image(self, size=(800, 600)):
        buffer = io.BytesIO()
        Image.new('RGB', size, color='white').save(buffer, format='PNG')
        upload = SimpleUploadedFile('slide.png', buffer.getvalue(), content_type='image/png')
        return self.client.post(self.url, {'image': upload}, format='multipart')

    @patch('reports.views.requests.post')
    def test_serves_roboflow_shape_without_credentials_or_network(self, mock_post):
        response = self.post_image()

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        mock_post.assert_not_called()
        self.assertEqual(set(response.data), {'image', 'predictions'})
        self.assertTrue(response.data['predictions'])
        for p in response.data['predictions']:
            self.assertEqual(set(p), {'class', 'confidence', 'x', 'y', 'width', 'height'})
            self.assertTrue(0 <= p['confidence'] <= 1)

    def test_boxes_are_rescaled_to_the_uploaded_image(self):
        response = self.post_image(size=(800, 600))

        self.assertEqual(response.data['image'], {'width': 800, 'height': 600})
        for p in response.data['predictions']:
            self.assertGreaterEqual(p['x'] - p['width'] / 2, 0)
            self.assertGreaterEqual(p['y'] - p['height'] / 2, 0)
            self.assertLessEqual(p['x'] + p['width'] / 2, 800)
            self.assertLessEqual(p['y'] + p['height'] / 2, 600)

    def test_every_class_is_a_catalog_species(self):
        response = self.post_image()

        classes = {p['class'] for p in response.data['predictions']}
        self.assertTrue(classes <= set(all_species_ids()))

    def test_still_requires_an_image(self):
        response = self.client.post(self.url, {}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

def make_openweather_payload(**overrides):
    payload = {
        'weather': [{'main': 'Clear', 'description': 'clear sky'}],
        'main': {'temp': 30.5, 'humidity': 60},
        'wind': {'speed': 3.5},
        'clouds': {'all': 10},
    }
    payload.update(overrides)
    return payload


@override_settings(OPENWEATHER_API_KEY='test-key')
class WeatherViewTests(APITestCase):
    url = '/api/v1/reports/weather/'

    def setUp(self):
        self.user = User.objects.create(email='researcher@up.edu.ph', institution='up.edu.ph')

    def test_requires_authentication(self):
        response = self.client.get(self.url, {'location': 'Los Baños, Laguna'})

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_missing_location_returns_400(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @override_settings(OPENWEATHER_API_KEY='')
    def test_not_configured_returns_503(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get(self.url, {'location': 'Los Baños, Laguna'})

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)

    @patch('reports.views.requests.get')
    def test_location_not_found_returns_404(self, mock_get):
        mock_get.return_value = Mock(status_code=404, json=lambda: {'cod': '404', 'message': 'city not found'})
        self.client.force_authenticate(user=self.user)

        response = self.client.get(self.url, {'location': 'Nowhere, Nowhere'})

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    @patch('reports.views.requests.get')
    def test_upstream_error_status_returns_502(self, mock_get):
        mock_get.return_value = Mock(status_code=500, json=lambda: {})
        self.client.force_authenticate(user=self.user)

        response = self.client.get(self.url, {'location': 'Los Baños, Laguna'})

        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)

    @patch('reports.views.requests.get')
    def test_upstream_connection_error_returns_502(self, mock_get):
        mock_get.side_effect = requests.ConnectionError('boom')
        self.client.force_authenticate(user=self.user)

        response = self.client.get(self.url, {'location': 'Los Baños, Laguna'})

        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)

    @patch('reports.views.requests.get')
    def test_clear_sky_maps_to_sunny(self, mock_get):
        mock_get.return_value = Mock(status_code=200, json=lambda: make_openweather_payload())
        self.client.force_authenticate(user=self.user)

        response = self.client.get(self.url, {'location': 'Los Baños, Laguna'})

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data, {
            'condition': 'Sunny', 'temperatureC': 30.5, 'humidityPct': 60, 'windKph': 12.6,
        })
        self.assertEqual(mock_get.call_args.kwargs['params']['q'], 'Los Baños, Laguna')

    @patch('reports.views.requests.get')
    def test_light_clouds_map_to_partly_cloudy(self, mock_get):
        mock_get.return_value = Mock(status_code=200, json=lambda: make_openweather_payload(
            weather=[{'main': 'Clouds', 'description': 'few clouds'}], clouds={'all': 20},
        ))
        self.client.force_authenticate(user=self.user)

        response = self.client.get(self.url, {'location': 'Los Baños, Laguna'})

        self.assertEqual(response.data['condition'], 'Partly cloudy')

    @patch('reports.views.requests.get')
    def test_heavy_clouds_map_to_overcast(self, mock_get):
        mock_get.return_value = Mock(status_code=200, json=lambda: make_openweather_payload(
            weather=[{'main': 'Clouds', 'description': 'overcast clouds'}], clouds={'all': 90},
        ))
        self.client.force_authenticate(user=self.user)

        response = self.client.get(self.url, {'location': 'Los Baños, Laguna'})

        self.assertEqual(response.data['condition'], 'Overcast')

    @patch('reports.views.requests.get')
    def test_rain_maps_to_rainy(self, mock_get):
        mock_get.return_value = Mock(status_code=200, json=lambda: make_openweather_payload(
            weather=[{'main': 'Rain', 'description': 'moderate rain'}],
        ))
        self.client.force_authenticate(user=self.user)

        response = self.client.get(self.url, {'location': 'Los Baños, Laguna'})

        self.assertEqual(response.data['condition'], 'Rainy')

    @patch('reports.views.requests.get')
    def test_high_wind_overrides_sky_condition(self, mock_get):
        mock_get.return_value = Mock(status_code=200, json=lambda: make_openweather_payload(
            weather=[{'main': 'Clear', 'description': 'clear sky'}], wind={'speed': 10.0},
        ))
        self.client.force_authenticate(user=self.user)

        response = self.client.get(self.url, {'location': 'Los Baños, Laguna'})

        self.assertEqual(response.data['condition'], 'Windy')
        self.assertEqual(response.data['windKph'], 36.0)

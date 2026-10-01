import base64
import calendar
import datetime
import io
import json
import tempfile
import zoneinfo
from unittest.mock import Mock, patch

import requests
from PIL import Image
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User
from rest_framework_simplejwt.tokens import RefreshToken

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
        payload['reportName'] = 'Morning Lucban collection'
        payload['0'] = make_test_image()

        response = self.client.post(self.url, payload, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        sample_id = response.data['sampleId']
        self.assertRegex(sample_id, r'^PLN-\d{4}-0001$')
        self.assertEqual(response.data['reportName'], 'Morning Lucban collection')
        self.assertEqual(response.data['slides'][0]['id'], f'{sample_id}-S1')
        self.assertTrue(response.data['slides'][0]['image_url'].startswith('http'))
        self.assertEqual(response.data['slides'][0]['grains'][0]['id'], 'G1')
        self.assertEqual(response.data['weather']['condition'], 'Sunny')
        self.assertEqual(response.data['status'], 'Pending')

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
        self.assertEqual(response.data['reportName'], '')
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
        make_report(status='Pending')

        response = self.client.get(self.url, {'status': 'Pending'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['status'], 'Pending')

    def test_status_all_returns_everything(self):
        make_report(status='Completed')
        make_report(status='Pending')

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

    def test_search_matches_report_name(self):
        report = make_report()
        report.report_name = 'Lucban morning survey'
        report.save(update_fields=['report_name'])

        response = self.client.get(self.url, {'q': 'morning survey'})

        self.assertEqual([item['sampleId'] for item in response.data], [report.sample_id])

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
        make_report(location='UPLB Campus', status='Pending', collected_at='2026-07-26')

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
            set(first),
            {
                'id', 'scientificName', 'commonName', 'code', 'season', 'riskLevel', 'color',
                'filipinoName', 'family', 'growthForm', 'description', 'distribution', 'pollination',
                'infoSource', 'photoUrl', 'photoCredit', 'photoLicense', 'photoSource',
            },
        )
        self.assertEqual(first['scientificName'], 'Amaranthus spinosus')
        self.assertEqual(first['code'], 'AMAR')


@override_settings(
    ROBOFLOW_API_KEY='test-key', ROBOFLOW_MODEL_ID='workspace/model', ROBOFLOW_MODEL_VERSION='1',
    ROBOFLOW_WORKSPACE='', ROBOFLOW_WORKFLOW_ID='', ROBOFLOW_MOCK=False,
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
            'mock': False,
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
    ROBOFLOW_API_KEY='test-key', ROBOFLOW_WORKSPACE='my-workspace',
    ROBOFLOW_WORKFLOW_ID='pollen-detect-classify', ROBOFLOW_MODEL_ID='', ROBOFLOW_MODEL_VERSION='',
    ROBOFLOW_MOCK=False,
)
class DetectViewWorkflowTests(APITestCase):
    """Two-stage YOLOv11 -> ResNet-34 Roboflow Workflow mode."""
    url = '/api/v1/reports/detect/'

    def setUp(self):
        self.user = User.objects.create(email='researcher@up.edu.ph', institution='up.edu.ph')
        self.client.force_authenticate(user=self.user)

    def post_image(self):
        return self.client.post(self.url, {'image': make_test_image()}, format='multipart')

    @staticmethod
    def workflow_response(outputs):
        return Mock(status_code=200, json=lambda: {'outputs': outputs, 'profiler_trace': []})

    @patch('reports.views.requests.post')
    def test_unwraps_workflow_output_and_strips_extra_fields(self, mock_post):
        mock_post.return_value = self.workflow_response([{
            'predictions': {
                'image': {'width': 640, 'height': 480},
                'predictions': [{
                    'class': 'imperata_cylindrica', 'confidence': 0.87,
                    'x': 50.0, 'y': 60.0, 'width': 20.0, 'height': 20.0,
                    'class_id': 11, 'detection_id': 'abc', 'parent_id': 'image',
                }],
            },
        }])

        response = self.post_image()

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data, {
            'mock': False,
            'image': {'width': 640, 'height': 480},
            'predictions': [{
                'class': 'imperata_cylindrica', 'confidence': 0.87,
                'x': 50.0, 'y': 60.0, 'width': 20.0, 'height': 20.0,
            }],
        })

    @patch('reports.views.requests.post')
    def test_calls_the_workflow_endpoint_with_bearer_key_and_base64_image(self, mock_post):
        mock_post.return_value = self.workflow_response(
            [{'predictions': {'image': {'width': 1, 'height': 1}, 'predictions': []}}],
        )

        self.post_image()

        self.assertEqual(
            mock_post.call_args.args[0],
            'https://serverless.roboflow.com/infer/workflows/my-workspace/pollen-detect-classify',
        )
        self.assertEqual(
            mock_post.call_args.kwargs['headers'], {'Authorization': 'Bearer test-key'},
        )
        sent = mock_post.call_args.kwargs['json']['inputs']['image']
        self.assertEqual(sent['type'], 'base64')
        self.assertTrue(base64.b64decode(sent['value']).startswith(b'\x89PNG'))

    @patch('reports.views.requests.post')
    def test_workflow_takes_precedence_over_single_model(self, mock_post):
        mock_post.return_value = self.workflow_response(
            [{'predictions': {'image': {'width': 1, 'height': 1}, 'predictions': []}}],
        )

        with self.settings(ROBOFLOW_MODEL_ID='workspace/model', ROBOFLOW_MODEL_VERSION='1'):
            self.post_image()

        self.assertIn('serverless.roboflow.com/infer/workflows', mock_post.call_args.args[0])

    @patch('reports.views.requests.post')
    def test_malformed_workflow_output_returns_502(self, mock_post):
        for outputs in ([], [{}], [{'predictions': 'nope'}], None):
            with self.subTest(outputs=outputs):
                mock_post.return_value = self.workflow_response(outputs)

                response = self.post_image()

                self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)

    @patch('reports.views.requests.post')
    def test_upstream_error_status_returns_502(self, mock_post):
        mock_post.return_value = Mock(status_code=500, json=lambda: {})

        self.assertEqual(self.post_image().status_code, status.HTTP_502_BAD_GATEWAY)

    @patch('reports.views.requests.post')
    def test_upstream_connection_error_returns_502(self, mock_post):
        mock_post.side_effect = requests.ConnectionError('boom')

        self.assertEqual(self.post_image().status_code, status.HTTP_502_BAD_GATEWAY)

    @override_settings(ROBOFLOW_WORKSPACE='')
    def test_workflow_without_workspace_returns_503(self):
        self.assertEqual(self.post_image().status_code, status.HTTP_503_SERVICE_UNAVAILABLE)

    @override_settings(ROBOFLOW_API_KEY='')
    def test_workflow_without_api_key_returns_503(self):
        self.assertEqual(self.post_image().status_code, status.HTTP_503_SERVICE_UNAVAILABLE)

    @override_settings(ROBOFLOW_MOCK=True)
    @patch('reports.views.requests.post')
    def test_mock_mode_wins_over_the_workflow(self, mock_post):
        response = self.post_image()

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertIs(response.data['mock'], True)
        mock_post.assert_not_called()


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
        self.assertEqual(set(response.data), {'image', 'predictions', 'mock'})
        self.assertIs(response.data['mock'], True)
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

def make_open_meteo_payload(day='2026-09-20', **hour12):
    hours = [f'{day}T{h:02d}:00' for h in range(24)]
    row = {'temperature_2m': 29.4, 'relative_humidity_2m': 71, 'wind_speed_10m': 8.3,
           'weather_code': 0, 'cloud_cover': 5}
    row.update(hour12)
    hourly = {'time': hours}
    for field, value in row.items():
        values = [None] * 24
        values[12] = value
        values[9] = 99  # a different hour, to prove the right one is picked
        hourly[field] = values
    return {'hourly': hourly}


FROZEN_NOW = timezone.make_aware(datetime.datetime(2026, 9, 25, 10, 0), datetime.timezone.utc)


@patch('reports.views.timezone.now', lambda: FROZEN_NOW)
class WeatherViewTests(APITestCase):
    url = '/api/v1/reports/weather/'

    def setUp(self):
        self.user = User.objects.create(email='researcher@up.edu.ph', institution='up.edu.ph')
        self.client.force_authenticate(user=self.user)

    def get(self, **params):
        return self.client.get(self.url, {'lat': '13.95', 'lon': '121.42', **params})

    def test_requires_authentication(self):
        self.client.force_authenticate(user=None)
        self.assertEqual(self.get().status_code, status.HTTP_401_UNAUTHORIZED)

    def test_coordinates_are_required(self):
        self.assertEqual(self.client.get(self.url, {'location': 'Candelaria, Quezon'}).status_code, 400)
        self.assertEqual(self.client.get(self.url, {'lat': 'north', 'lon': '1'}).status_code, 400)
        self.assertEqual(self.client.get(self.url, {'lat': '95', 'lon': '121'}).status_code, 400)

    def test_bad_date_or_time_is_400(self):
        self.assertEqual(self.get(date='20-09-2026').status_code, 400)
        self.assertEqual(self.get(date='2026-09-20', time='25:00').status_code, 400)

    def test_far_future_is_400(self):
        self.assertEqual(self.get(date='2026-12-20').status_code, 400)

    @patch('reports.views.requests.get')
    def test_recent_date_uses_forecast_and_picks_the_requested_hour(self, mock_get):
        mock_get.return_value = Mock(status_code=200, json=lambda: make_open_meteo_payload())

        response = self.get(date='2026-09-20', time='12:20')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(mock_get.call_args.args[0], 'https://api.open-meteo.com/v1/forecast')
        params = mock_get.call_args.kwargs['params']
        self.assertEqual((params['start_date'], params['end_date']), ('2026-09-20', '2026-09-20'))
        self.assertEqual(params['timezone'], 'Asia/Manila')
        self.assertEqual(response.data, {
            'condition': 'Sunny', 'temperatureC': 29.4, 'humidityPct': 71, 'windKph': 8.3,
            'observedAt': '2026-09-20T12:00', 'source': 'Open-Meteo',
        })

    @patch('reports.views.requests.get')
    def test_old_date_uses_the_archive(self, mock_get):
        mock_get.return_value = Mock(status_code=200, json=lambda: make_open_meteo_payload('2025-03-10'))

        response = self.get(date='2025-03-10')  # no time → midday

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(mock_get.call_args.args[0], 'https://archive-api.open-meteo.com/v1/archive')
        self.assertEqual(response.data['observedAt'], '2025-03-10T12:00')

    @patch('reports.views.requests.get')
    def test_condition_mapping(self, mock_get):
        cases = [
            ({'weather_code': 2}, 'Partly cloudy'),
            ({'weather_code': 3}, 'Overcast'),
            ({'weather_code': 45}, 'Overcast'),
            ({'weather_code': 61}, 'Rainy'),
            ({'weather_code': 81}, 'Rainy'),
            ({'weather_code': 95}, 'Rainy'),
            ({'weather_code': 0, 'wind_speed_10m': 35}, 'Windy'),
        ]
        for row, expected in cases:
            mock_get.return_value = Mock(status_code=200, json=lambda row=row: make_open_meteo_payload(**row))
            self.assertEqual(self.get(date='2026-09-20').data['condition'], expected, row)

    @patch('reports.views.requests.get')
    def test_empty_archive_hours_are_404(self, mock_get):
        payload = make_open_meteo_payload()
        for field in ('temperature_2m', 'relative_humidity_2m', 'wind_speed_10m'):
            payload['hourly'][field][12] = None
        mock_get.return_value = Mock(status_code=200, json=lambda: payload)
        self.assertEqual(self.get(date='2026-09-20').status_code, 404)

    @patch('reports.views.requests.get')
    def test_upstream_failure_is_502(self, mock_get):
        mock_get.return_value = Mock(status_code=500, json=lambda: {})
        self.assertEqual(self.get(date='2026-09-20').status_code, 502)
        mock_get.side_effect = requests.ConnectionError('boom')
        self.assertEqual(self.get(date='2026-09-20').status_code, 502)


_TEMP_MEDIA = tempfile.mkdtemp(prefix='pollens-test-media-')


@override_settings(MEDIA_ROOT=_TEMP_MEDIA)
class ReportCreateValidationTests(APITestCase):
    url = '/api/v1/reports/'

    def setUp(self):
        self.user = User.objects.create(email='researcher@up.edu.ph', institution='up.edu.ph')
        self.client.force_authenticate(user=self.user)

    def post(self, image=None, **overrides):
        payload = make_report_payload(**overrides)
        payload['0'] = image or make_test_image()
        return self.client.post(self.url, payload, format='multipart')

    def test_edge_boxes_are_clipped_to_the_image(self):
        slide = make_slide_payload(grains=[{
            'speciesId': 'amaranthus_spinosus', 'confidence': 0.9,
            'box': {'x': -0.05, 'y': 0.9, 'width': 0.2, 'height': 0.2},
        }])
        response = self.post(slides=json.dumps([slide]))

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        box = response.data['slides'][0]['grains'][0]['box']
        self.assertEqual(box['x'], 0.0)
        self.assertAlmostEqual(box['width'], 0.15)
        self.assertAlmostEqual(box['y'] + box['height'], 1.0)

    def test_box_entirely_outside_the_image_is_rejected(self):
        slide = make_slide_payload(grains=[{
            'speciesId': 'amaranthus_spinosus', 'confidence': 0.9,
            'box': {'x': 1.0, 'y': 0.1, 'width': 0.2, 'height': 0.2},
        }])
        self.assertEqual(self.post(slides=json.dumps([slide])).status_code, 400)

    def test_duplicate_species_rows_are_a_400_not_a_500(self):
        row = {'speciesId': 'amaranthus_spinosus', 'grainCount': 1, 'avgConfidence': 0.9}
        slide = make_slide_payload(detections=[row, row])
        self.assertEqual(self.post(slides=json.dumps([slide])).status_code, 400)

    def test_overlong_location_is_rejected(self):
        self.assertEqual(self.post(location='x' * 300).status_code, 400)

    def test_non_image_upload_is_rejected(self):
        fake = SimpleUploadedFile('slide.png', b'not really a png', content_type='image/png')
        response = self.post(image=fake)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('not a readable image', response.data['detail'])

    def test_unsupported_image_format_is_rejected(self):
        buffer = io.BytesIO()
        Image.new('RGB', (4, 4)).save(buffer, format='GIF')
        gif = SimpleUploadedFile('slide.gif', buffer.getvalue(), content_type='image/gif')
        self.assertEqual(self.post(image=gif).status_code, status.HTTP_400_BAD_REQUEST)

    @override_settings(MAX_SLIDE_IMAGE_BYTES=10)
    def test_oversized_image_is_413(self):
        self.assertEqual(self.post().status_code, status.HTTP_413_REQUEST_ENTITY_TOO_LARGE)

    def test_stored_extension_comes_from_the_real_format(self):
        response = self.post(image=make_test_image(name='mislabelled.jpeg'))  # PNG bytes

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        slide = Report.objects.get(sample_id=response.data['sampleId']).slides.get()
        self.assertTrue(slide.image.name.endswith('.png'), slide.image.name)

    def test_pending_report_may_have_no_location_yet(self):
        response = self.post(status='Pending', location='')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data['status'], 'Pending')
        self.assertIs(response.data['canEdit'], True)
        self.assertIn('createdAt', response.data)

    def test_report_must_be_created_as_pending(self):
        response = self.post(status='Completed')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('status', response.data['errors'])

    def test_owner_me_lists_only_the_callers_reports(self):
        mine = make_report()
        mine.owner = self.user
        mine.save()
        make_report()  # belongs to nobody in particular

        response = self.client.get(self.url, {'owner': 'me'})

        self.assertEqual([r['sampleId'] for r in response.data], [mine.sample_id])


@override_settings(MEDIA_ROOT=_TEMP_MEDIA)
class ReportUpdateDeleteTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create(email='owner@up.edu.ph', institution='up.edu.ph')
        self.other = User.objects.create(email='other@up.edu.ph', institution='up.edu.ph')
        self.report = make_report(status='Pending', location='')
        self.report.owner = self.owner
        self.report.save()
        self.url = f'/api/v1/reports/{self.report.sample_id}/'
        self.client.force_authenticate(user=self.owner)

    def patch(self, body):
        return self.client.patch(self.url, body, format='json')

    def test_owner_edits_details_and_slide_notes(self):
        response = self.patch({
            'reportName': '  Lucban morning  ',
            'location': ' Candelaria, Quezon ',
            'weather': {'condition': 'Rainy', 'temperatureC': 27, 'humidityPct': 90, 'windKph': 12},
            'slides': [{'id': f'{self.report.sample_id}-S1', 'notes': 'clumped grains'}],
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data['location'], 'Candelaria, Quezon')
        self.assertEqual(response.data['reportName'], 'Lucban morning')
        self.assertEqual(response.data['weather']['condition'], 'Rainy')
        self.assertEqual(response.data['slides'][0]['notes'], 'clumped grains')

    def test_weather_null_clears_it(self):
        self.patch({'weather': {'condition': 'Sunny', 'temperatureC': None, 'humidityPct': None, 'windKph': None}})
        response = self.patch({'weather': None})
        self.assertIsNone(response.data['weather'])

    def test_generate_report_needs_a_location(self):
        response = self.patch({'status': 'Needs review'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('location', response.data['errors'])

    def test_lifecycle_pending_needs_review_completed_and_later_review(self):
        response = self.patch({'status': 'Needs review', 'location': 'Lucban, Quezon'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'Needs review')
        self.assertEqual(self.patch({'status': 'Completed'}).data['status'], 'Completed')
        self.assertEqual(self.patch({'status': 'Needs review'}).data['status'], 'Needs review')
        self.assertEqual(self.patch({'status': 'Completed'}).data['status'], 'Completed')

    def test_disallowed_transition_is_400(self):
        response = self.patch({'status': 'Completed'})  # Pending must pass through Needs review
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('status', response.data['errors'])

    def test_unknown_slide_is_400(self):
        response = self.patch({'slides': [{'id': 'PLN-1999-0001-S1', 'notes': 'x'}]})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_other_researchers_can_read_but_not_change_or_delete(self):
        self.client.force_authenticate(user=self.other)

        get = self.client.get(self.url)
        self.assertEqual(get.status_code, 200)
        self.assertIs(get.data['canEdit'], False)
        self.assertEqual(self.patch({'location': 'x'}).status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.delete(self.url).status_code, status.HTTP_403_FORBIDDEN)

    def test_staff_may_change_any_report(self):
        self.other.is_staff = True
        self.other.save()
        self.client.force_authenticate(user=self.other)
        self.assertEqual(self.patch({'location': 'Tayabas City, Quezon'}).status_code, 200)

    def test_delete_removes_the_report_and_its_images(self):
        image_name = self.report.slides.get().image.name
        storage = self.report.slides.get().image.storage
        self.assertTrue(storage.exists(image_name))

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.delete(self.url)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Report.objects.filter(pk=self.report.pk).exists())
        self.assertFalse(storage.exists(image_name))

    def test_missing_report_is_404(self):
        self.assertEqual(self.client.delete('/api/v1/reports/PLN-1999-9999/').status_code, 404)


@override_settings(ROBOFLOW_MOCK=True)
class DetectImageValidationTests(APITestCase):
    url = '/api/v1/reports/detect/'

    def setUp(self):
        self.client.force_authenticate(user=User.objects.create(email='r@up.edu.ph'))

    def test_non_image_is_400(self):
        fake = SimpleUploadedFile('x.png', b'nope', content_type='image/png')
        self.assertEqual(self.client.post(self.url, {'image': fake}, format='multipart').status_code, 400)

    @override_settings(MAX_SLIDE_IMAGE_BYTES=10)
    def test_oversized_is_413(self):
        response = self.client.post(self.url, {'image': make_test_image()}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_413_REQUEST_ENTITY_TOO_LARGE)

    def test_detect_uses_its_own_throttle_scope(self):
        from .views import DetectView
        self.assertEqual(DetectView.throttle_scope, 'detect')


class SpeciesReferenceMigrationTests(APITestCase):
    """0010 fills the Allergen Reference content for every species, without clinical claims."""

    def test_every_species_has_names_photo_and_credit(self):
        self.client.force_authenticate(user=User.objects.create(email='r@up.edu.ph', institution='up.edu.ph'))
        rows = self.client.get('/api/v1/reports/species/').data
        self.assertEqual(len(rows), 23)
        for row in rows:
            self.assertTrue(row['commonName'], row['id'])
            self.assertTrue(row['description'], row['id'])
            self.assertEqual(row['photoUrl'], f"/species/{row['id']}.jpg")
            self.assertTrue(row['photoCredit'] and row['photoLicense'] and row['photoSource'], row['id'])
            # Botanical content only: allergenicity is still unassessed.
            self.assertEqual(row['riskLevel'], 'Not assessed')


class SpeciesRiskMigrationTests(APITestCase):
    def test_seeded_placeholder_risk_levels_read_not_assessed(self):
        self.client.force_authenticate(user=User.objects.create(email='r@up.edu.ph'))
        levels = {s['riskLevel'] for s in self.client.get('/api/v1/reports/species/').data}
        self.assertEqual(levels, {'Not assessed'})


@override_settings(ROBOFLOW_MOCK=True)
class QARegressionTests(APITestCase):
    """Defects found in the 2026-09-25 QA pass; each must stay fixed."""

    def setUp(self):
        self.owner = User.objects.create(email='owner@up.edu.ph', institution='up.edu.ph')
        self.client.force_authenticate(user=self.owner)
        self.report = make_report(status='Pending', location='')
        self.report.owner = self.owner
        self.report.save()
        self.url = f'/api/v1/reports/{self.report.sample_id}/'

    def patch_report(self, body):
        return self.client.patch(self.url, body, format='json')

    # --- PATCH input shapes that used to 500 ---------------------------------
    def test_partial_weather_is_400_and_empty_weather_does_not_wipe(self):
        self.patch_report({'weather': {'condition': 'Sunny', 'temperatureC': 30, 'humidityPct': 60, 'windKph': 5}})
        self.assertEqual(self.patch_report({'weather': {'temperatureC': 31}}).status_code, 400)
        self.assertEqual(self.patch_report({'weather': {}}).status_code, 400)
        self.report.refresh_from_db()
        self.assertEqual(self.report.weather_condition, 'Sunny')

    def test_slide_notes_need_id_and_notes(self):
        sid = f'{self.report.sample_id}-S1'
        self.assertEqual(self.patch_report({'slides': [{'id': sid}]}).status_code, 400)
        self.assertEqual(self.patch_report({'slides': [{'notes': 'x'}]}).status_code, 400)

    def test_unicode_digit_slide_id_is_400(self):
        self.assertEqual(self.patch_report({'slides': [{'id': f'{self.report.sample_id}-S²', 'notes': 'x'}]}).status_code, 400)

    def test_impossible_collected_at_is_400(self):
        self.assertEqual(self.patch_report({'collectedAt': '2026-99-99'}).status_code, 400)
        self.assertEqual(self.patch_report({'collectedAt': '2026-02-30T10:00'}).status_code, 400)

    def test_blank_researcher_becomes_unknown(self):
        self.assertEqual(self.patch_report({'researcher': '  '}).data['researcher'], 'Unknown')

    # --- create ----------------------------------------------------------------
    def test_non_object_body_is_400(self):
        response = self.client.post('/api/v1/reports/', [1, 2], format='json')
        self.assertEqual(response.status_code, 400)

    def test_missing_later_image_writes_no_files(self):
        storage = self.report.slides.get().image.storage
        before = set(storage.listdir('reports')[0]) if storage.exists('reports') else set()
        payload = make_report_payload(slides=json.dumps([make_slide_payload(), make_slide_payload()]))
        payload['0'] = make_test_image()  # slide 1 ('1') has no image
        response = self.client.post('/api/v1/reports/', payload, format='multipart')
        self.assertEqual(response.status_code, 400)
        after = set(storage.listdir('reports')[0]) if storage.exists('reports') else set()
        self.assertEqual(after, before)

    def test_sample_detections_flag_round_trips(self):
        payload = make_report_payload(sampleDetections='true', status='Pending')
        payload['0'] = make_test_image()
        response = self.client.post('/api/v1/reports/', payload, format='multipart')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertIs(response.data['sampleDetections'], True)
        self.assertIs(self.client.get(self.url).data['sampleDetections'], False)

    # --- images ----------------------------------------------------------------
    @override_settings(MAX_SLIDE_IMAGE_PIXELS=100)
    def test_too_many_pixels_is_413(self):
        buffer = io.BytesIO()
        Image.new('RGB', (20, 20)).save(buffer, format='PNG')
        upload = SimpleUploadedFile('big.png', buffer.getvalue(), content_type='image/png')
        response = self.client.post('/api/v1/reports/detect/', {'image': upload}, format='multipart')
        self.assertEqual(response.status_code, 413)

    def test_decompression_bomb_is_rejected_not_500(self):
        with patch('reports.images.Image.open', side_effect=Image.DecompressionBombError('boom')):
            response = self.client.post('/api/v1/reports/detect/', {'image': make_test_image()}, format='multipart')
        self.assertEqual(response.status_code, 413)

    # --- delete ------------------------------------------------------------------
    def test_storage_error_on_delete_is_still_204(self):
        with patch('django.core.files.storage.FileSystemStorage.delete', side_effect=OSError('down')):
            with self.captureOnCommitCallbacks(execute=True):
                response = self.client.delete(self.url)
        self.assertEqual(response.status_code, 204)
        self.assertFalse(Report.objects.filter(pk=self.report.pk).exists())

    # --- detect --------------------------------------------------------------------
    @override_settings(
        ROBOFLOW_MOCK=False, ROBOFLOW_API_KEY='k', ROBOFLOW_MODEL_ID='w/m', ROBOFLOW_MODEL_VERSION='1',
        ROBOFLOW_WORKSPACE='', ROBOFLOW_WORKFLOW_ID='',
    )
    @patch('reports.views.requests.post')
    def test_non_object_roboflow_payload_is_502(self, mock_post):
        mock_post.return_value = Mock(status_code=200, json=lambda: ['nope'])
        response = self.client.post('/api/v1/reports/detect/', {'image': make_test_image()}, format='multipart')
        self.assertEqual(response.status_code, 502)

    # --- monthly counts include Needs review -------------------------------------
    def test_monthly_counts_include_needs_review(self):
        month = timezone.localtime(timezone.now(), zoneinfo.ZoneInfo('Asia/Manila')).strftime('%Y-%m')
        make_report(status='Needs review', collected_at=f'{month}-01')
        data = self.client.get('/api/v1/reports/monthly-counts/').data
        self.assertEqual(data[-1]['series']['amaranthus_spinosus'], 3)


@override_settings(SIGNIN_ALLOWED_DOMAINS=['up.edu.ph'], SIGNIN_ALLOWED_EMAILS=[])
class TokenRefreshQATests(APITestCase):
    url = '/api/v1/auth/token/refresh/'

    def test_deleted_user_refresh_is_401(self):
        user = User.objects.create(email='gone@up.edu.ph')
        refresh = str(RefreshToken.for_user(user))
        user.delete()
        self.assertEqual(self.client.post(self.url, {'refresh': refresh}, format='json').status_code, 401)

    def test_user_removed_from_allowlist_cannot_refresh(self):
        user = User.objects.create(email='someone@up.edu.ph')
        refresh = str(RefreshToken.for_user(user))
        with override_settings(SIGNIN_ALLOWED_DOMAINS=['mseuf.edu.ph']):
            self.assertEqual(self.client.post(self.url, {'refresh': refresh}, format='json').status_code, 401)


@patch('reports.views.timezone.now', lambda: FROZEN_NOW)
class WeatherQATests(APITestCase):
    url = '/api/v1/reports/weather/'

    def setUp(self):
        self.client.force_authenticate(user=User.objects.create(email='w@up.edu.ph'))

    def get(self, **params):
        return self.client.get(self.url, {'lat': '13.95', 'lon': '121.42', **params})

    @patch('reports.views.requests.get')
    def test_rounds_to_the_nearest_hour(self, mock_get):
        mock_get.return_value = Mock(status_code=200, json=lambda: make_open_meteo_payload())
        self.assertEqual(self.get(date='2026-09-20', time='11:40').data['observedAt'], '2026-09-20T12:00')

    @patch('reports.views.requests.get')
    def test_late_evening_rolls_to_next_day(self, mock_get):
        mock_get.return_value = Mock(status_code=200, json=lambda: make_open_meteo_payload('2026-09-21'))
        self.get(date='2026-09-20', time='23:45')
        self.assertEqual(mock_get.call_args.kwargs['params']['start_date'], '2026-09-21')

    def test_before_1940_is_400(self):
        self.assertEqual(self.get(date='1900-01-01').status_code, 400)

    @patch('reports.views.requests.get')
    def test_upstream_400_is_404(self, mock_get):
        mock_get.return_value = Mock(status_code=400, json=lambda: {'error': True, 'reason': 'out of range'})
        self.assertEqual(self.get(date='2026-09-20').status_code, 404)

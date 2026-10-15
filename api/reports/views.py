import calendar
import io
import logging
from collections.abc import Mapping
import datetime
import json
from functools import lru_cache
import re
import uuid
import zoneinfo
from pathlib import Path

import requests
from PIL import Image as PILImage
from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.db.models.functions import Substr
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .images import SlideImageError, check_slide_image

logger = logging.getLogger(__name__)
MANILA = zoneinfo.ZoneInfo('Asia/Manila')
# Reports that describe finished work — what charts and maps count.
FINALISED_STATUSES = ('Completed', 'Needs review')
from .models import STATUS_CHOICES, GrainAnnotation, Report, Slide, Species
from .serializers import (
    GrainAnnotationInputSerializer,
    GrainAnnotationSerializer,
    ReportCreateSerializer,
    ReportSerializer,
    ReportUpdateSerializer,
    SpeciesSerializer,
)

DATE_PARAM_VALIDATOR = re.compile(r'^\d{4}-\d{2}-\d{2}$')
VALID_STATUSES = dict(STATUS_CHOICES)


def image_error_response(exc):
    return Response(
        {'detail': str(exc)},
        status=(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE if exc.too_large
            else status.HTTP_400_BAD_REQUEST
        ),
    )


def delete_image_files(images):
    for image in images:
        try:
            image.storage.delete(image.name)
        except Exception:  # noqa: BLE001 — storage backends raise anything
            logger.exception('Could not delete %s', image.name)


def all_species_ids():
    # Queried per call, not cached at import time — a module-level query
    # would run during management commands (makemigrations, check) before
    # the table necessarily exists. Species.Meta.ordering = ['sort_order']
    # already applies, .order_by() here is just for readability at the call site.
    return list(Species.objects.order_by('sort_order').values_list('id', flat=True))


class ReportListCreateView(APIView):
    """
    GET  /api/v1/reports/   — list every report (shared corpus). `owner=me`
                              narrows to the caller's own (e.g. their Pending).
    POST /api/v1/reports/   — persist an analyzed batch as one Pending report.
    """

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        reports = Report.objects.all()

        status_param = request.query_params.get('status', '').strip()
        if status_param and status_param.lower() != 'all':
            if status_param not in VALID_STATUSES:
                return Response(
                    {'detail': f'"{status_param}" is not a valid status.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            reports = reports.filter(status=status_param)

        if request.query_params.get('owner', '').strip() == 'me':
            reports = reports.filter(owner=request.user)

        location_param = request.query_params.get('location', '').strip()
        if location_param and location_param.lower() != 'all':
            reports = reports.filter(location=location_param)

        date_from = request.query_params.get('from', '').strip()
        date_to = request.query_params.get('to', '').strip()
        reports = reports.annotate(collected_date=Substr('collected_at', 1, 10))
        for label, value in (('from', date_from), ('to', date_to)):
            if value and not DATE_PARAM_VALIDATOR.match(value):
                return Response(
                    {'detail': f'"{label}" must be "YYYY-MM-DD".'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        if date_from or date_to:
            if date_from:
                reports = reports.filter(collected_date__gte=date_from)
            if date_to:
                reports = reports.filter(collected_date__lte=date_to)

        query = request.query_params.get('q', '').strip()
        if query:
            reports = reports.filter(
                Q(sample_id__icontains=query)
                | Q(report_name__icontains=query)
                | Q(location__icontains=query)
                | Q(collected_date__icontains=query)
                | Q(slides__detections__species__id__icontains=query)
            ).distinct()

        reports = reports.prefetch_related(
            'slides__detections', 'slides__grains', 'slides__annotations',
        )
        return Response(
            ReportSerializer(reports, many=True, context={'request': request}).data
        )

    def post(self, request):
        # request.data is a QueryDict for multipart bodies; DRF treats any
        # Mapping with .getlist() as HTML form input and parses nested
        # many=True fields as bracket-notation keys ("slides[0]...") rather
        # than reading our single JSON-encoded field. A plain dict avoids
        # that HTML-form code path.
        if not isinstance(request.data, Mapping):
            return Response(
                {'detail': 'Send the report as multipart form data.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        data = {key: request.data[key] for key in request.data}
        for key in ('weather', 'slides'):
            raw = data.get(key)
            if isinstance(raw, str) and raw:
                try:
                    data[key] = json.loads(raw)
                except ValueError:
                    return Response(
                        {'detail': f'"{key}" must be valid JSON.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

        # Every image is checked (real JPEG/PNG, within the size limit) before
        # anything is written.
        extensions = {}
        for key, upload in request.FILES.items():
            try:
                extensions[key] = check_slide_image(upload)
            except SlideImageError as exc:
                return image_error_response(exc)

        serializer = ReportCreateSerializer(
            data=data,
            context={'files': request.FILES, 'extensions': extensions, 'owner': request.user},
        )
        if not serializer.is_valid():
            return Response(
                {'detail': 'The report payload is invalid.', 'errors': serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            report = serializer.save()
        except ValidationError as exc:
            return Response(
                {'detail': 'The report payload is invalid.', 'errors': exc.detail},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(
            ReportSerializer(report, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


PREDICTION_FIELDS = ('class', 'confidence', 'x', 'y', 'width', 'height')
# A captured-shape detection response (inference_id/time/image/predictions,
# class names = Species slugs) served while DETECTION_MOCK is on. Not a
# Django loaddata fixture despite the directory name.
MOCK_RESPONSE = Path(__file__).resolve().parent / 'fixtures' / 'sample_detect_response.json'


class DetectionUnavailable(Exception):
    """An inference provider couldn't be reached or answered usefully."""


class DetectionNotConfigured(Exception):
    """The selected local detector or its classification stage isn't configured."""


@lru_cache(maxsize=2)
def _yolo26_detector(weights_path):
    """Load one detector per worker process and weights path."""
    from .inference.artifacts import verify_artifact
    from .inference.yolo26 import YOLO26PollenDetector

    verify_artifact(weights_path, settings.YOLO26_WEIGHTS_SHA256)
    return YOLO26PollenDetector(weights_path)


@lru_cache(maxsize=2)
def _yolo26_classifier(weights_path):
    """Load one local classifier session per worker process and weights path."""
    from .inference.artifacts import verify_artifact
    from .inference.efficientnet_classifier import EfficientNetB0Classifier

    verify_artifact(weights_path, settings.YOLO26_CLASSIFIER_SHA256)
    verify_artifact(Path(weights_path).with_name('class_names.json'), settings.YOLO26_CLASS_NAMES_SHA256)
    return EfficientNetB0Classifier(weights_path)


def _yolo26_detect_and_classify(image_upload):
    """Run local YOLO26, then classify its pollen crops with local EfficientNet."""
    from PIL import ImageOps

    from .inference.efficientnet_classifier import (
        ClassifierConfigurationError,
        ClassifierOutputError,
    )
    from .inference.yolo26 import DetectorConfigurationError, DetectorOutputError

    if not settings.YOLO26_WEIGHTS_PATH or not settings.YOLO26_CLASSIFIER_WEIGHTS_PATH:
        raise DetectionNotConfigured

    try:
        classifier = _yolo26_classifier(settings.YOLO26_CLASSIFIER_WEIGHTS_PATH)
    except (ClassifierConfigurationError, ImportError, OSError, ValueError) as exc:
        logger.exception('Local EfficientNet classifier is not ready')
        raise DetectionNotConfigured from exc

    try:
        detector = _yolo26_detector(settings.YOLO26_WEIGHTS_PATH)
    except (DetectorConfigurationError, ImportError, OSError, ValueError) as exc:
        logger.exception('YOLO26 detector is not ready')
        raise DetectionNotConfigured from exc
    except RuntimeError as exc:
        logger.exception('YOLO26 detector failed to initialize')
        raise DetectionUnavailable from exc

    try:
        image_upload.seek(0)
        image_bytes = image_upload.read()
        image_upload.seek(0)
        with PILImage.open(io.BytesIO(image_bytes)) as source:
            image = ImageOps.exif_transpose(source).convert('RGB').copy()
        result = detector.detect_image(
            image,
            confidence=settings.YOLO26_CONFIDENCE,
            image_size=settings.YOLO26_IMAGE_SIZE,
            device=settings.YOLO26_DEVICE,
        )
    except DetectorOutputError as exc:
        logger.exception('YOLO26 detector returned unusable output')
        raise DetectionUnavailable from exc
    except (OSError, ValueError) as exc:
        logger.exception('YOLO26 detector input could not be processed')
        raise DetectionUnavailable from exc
    except RuntimeError as exc:
        logger.exception('YOLO26 detector failed')
        raise DetectionUnavailable from exc

    if not result.pollen_boxes:
        return {'image': {'width': result.image_width, 'height': result.image_height}, 'predictions': []}

    try:
        labels = classifier.classify(image, result.pollen_boxes)
    except ClassifierOutputError as exc:
        logger.exception('Local EfficientNet classifier returned unusable output')
        raise DetectionUnavailable from exc
    except RuntimeError as exc:
        logger.exception('Local EfficientNet classifier failed')
        raise DetectionUnavailable from exc
    if len(labels) != len(result.pollen_boxes):
        logger.error('Local EfficientNet classifier returned a different number of labels than boxes')
        raise DetectionUnavailable

    return {
        'image': {'width': result.image_width, 'height': result.image_height},
        'predictions': [
            {
                'class': label,
                'confidence': score,
                'x': box.x,
                'y': box.y,
                'width': box.width,
                'height': box.height,
            }
            for box, (label, score) in zip(result.pollen_boxes, labels)
        ],
    }


def _remote_detect(image):
    """
    `{image, predictions}` from the hosted inference service
    (services/inference on Modal), which already returns the provider-independent
    shape, so nothing is unwrapped. No redirects are followed: the bearer token
    must only ever go to the configured host.
    """
    try:
        image.seek(0)
        upstream = requests.post(
            f'{settings.INFERENCE_URL}/detect',
            headers={'Authorization': f'Bearer {settings.INFERENCE_TOKEN}'},
            files={'image': (image.name, image.read(), image.content_type)},
            timeout=settings.INFERENCE_TIMEOUT,
            allow_redirects=False,
        )
        payload = upstream.json()
    except (requests.RequestException, ValueError) as exc:
        raise DetectionUnavailable from exc
    if upstream.status_code != 200:
        logger.error('Inference service answered %s', upstream.status_code)
        raise DetectionUnavailable
    return payload


def _mock_detect(image):
    """
    The captured response, rescaled onto `image`'s real pixel size so boxes
    land inside whatever was uploaded, with fresh ids — otherwise
    indistinguishable from `_remote_detect`'s output.
    """
    payload = json.loads(MOCK_RESPONSE.read_text(encoding='utf-8'))
    try:
        with PILImage.open(image) as img:
            width, height = img.size
    except (OSError, ValueError):
        # Not decodable — keep the fixture's own frame rather than fail.
        width, height = payload['image']['width'], payload['image']['height']
    sx = width / payload['image']['width']
    sy = height / payload['image']['height']
    for p in payload['predictions']:
        p['x'] = round(p['x'] * sx, 1)
        p['y'] = round(p['y'] * sy, 1)
        p['width'] = round(p['width'] * sx, 1)
        p['height'] = round(p['height'] * sy, 1)
        p['detection_id'] = str(uuid.uuid4())
    payload['image'] = {'width': width, 'height': height}
    payload['inference_id'] = str(uuid.uuid4())
    return payload


class DetectView(APIView):
    """
    POST /api/v1/reports/detect/ — proxy a single specimen image to the
    configured detection pipeline.

    Stateless: called once per uploaded image at Analyze-time, before a
    report/sample id exists, so nothing here is persisted — see
    ReportListCreateView.post for where an already-analyzed batch is later
    saved. It returns the provider-independent shape the client needs:
    `{"image": {"width", "height"}, "predictions": [{"class",
    "confidence", "x", "y", "width", "height"}]}` (pixel coordinates,
    box centre-based). app/PolLens/lib/analysis.ts maps that into the app's
    normalized top-left BoundingBox client-side.

    `DETECTION_BACKEND=remote` (production) posts the image to the hosted
    YOLO26 + EfficientNet inference service (`INFERENCE_URL`, on Modal).
    `DETECTION_BACKEND=yolo26` uses the same models loaded in this process.
    Any other value answers 503.

    With DETECTION_MOCK on, the upstream call is swapped for `_mock_detect`;
    everything after it is the same code path.
    """

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    throttle_scope = 'detect'

    def post(self, request):
        image = request.FILES.get('image')
        if not image:
            return Response(
                {'detail': 'An image file is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            check_slide_image(image)
        except SlideImageError as exc:
            return image_error_response(exc)

        if settings.DETECTION_MOCK:
            payload = _mock_detect(image)
        elif settings.DETECTION_BACKEND == 'yolo26':
            try:
                payload = _yolo26_detect_and_classify(image)
            except DetectionNotConfigured:
                return Response(
                    {'detail': 'Detection service is not configured.'},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            except DetectionUnavailable:
                return Response(
                    {'detail': 'Detection service is unavailable.'},
                    status=status.HTTP_502_BAD_GATEWAY,
                )
        elif settings.DETECTION_BACKEND == 'remote':
            if not (settings.INFERENCE_URL and settings.INFERENCE_TOKEN):
                return Response(
                    {'detail': 'Detection service is not configured.'},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            try:
                payload = _remote_detect(image)
            except DetectionUnavailable:
                return Response(
                    {'detail': 'Detection service is unavailable.'},
                    status=status.HTTP_502_BAD_GATEWAY,
                )
        else:
            return Response(
                {'detail': 'Detection service is not configured.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        if not isinstance(payload, dict) or not isinstance(payload.get('predictions', []), list):
            return Response(
                {'detail': 'Detection service is unavailable.'},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        image_size = payload.get('image') or {}
        predictions = [
            {field: p[field] for field in PREDICTION_FIELDS if field in p}
            for p in payload.get('predictions', [])
            if isinstance(p, dict)
        ]
        return Response({
            'image': {'width': image_size.get('width'), 'height': image_size.get('height')},
            'predictions': predictions,
            # Lets the UI say plainly that these are sample detections.
            'mock': bool(settings.DETECTION_MOCK),
        })


OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'
OPEN_METEO_ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive'
# The forecast service keeps roughly the last 92 days and the next 16; older
# dates come from the reanalysis archive (which lags a few days behind).
FORECAST_PAST_DAYS = 90
FORECAST_FUTURE_DAYS = 14  # a day's margin: Open-Meteo counts its 16 days in UTC
EARLIEST_WEATHER_DATE = datetime.date(1940, 1, 1)  # start of the ERA5 archive
WEATHER_TIMEZONE = 'Asia/Manila'
DEFAULT_HOUR = 12  # no collection time recorded: midday
HOURLY_FIELDS = 'temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,cloud_cover'
# Sustained wind at/above this speed is reported as "Windy" ahead of sky
# condition — neither source has a "windy" condition, so this is a deliberate
# approximation, not a value from any spec.
WINDY_THRESHOLD_KPH = 30


def _condition(weather_code, cloud_cover, wind_kph):
    # WMO weather codes (Open-Meteo) → the app's 5-value WeatherCondition.
    if wind_kph is not None and wind_kph >= WINDY_THRESHOLD_KPH:
        return 'Windy'
    code = weather_code if weather_code is not None else -1
    if 51 <= code <= 67 or 80 <= code <= 82 or code >= 95:  # drizzle, rain, showers, thunder
        return 'Rainy'
    if code in (0, 1):
        return 'Sunny'
    if code == 2:
        return 'Partly cloudy'
    if code in (3, 45, 48) or 71 <= code <= 86:  # overcast, fog, snow (n/a here)
        return 'Overcast'
    if cloud_cover is not None:
        return 'Sunny' if cloud_cover < 25 else 'Partly cloudy' if cloud_cover < 70 else 'Overcast'
    return 'Overcast'


class WeatherView(APIView):
    """
    GET /api/v1/reports/weather/?lat=<deg>&lon=<deg>&date=YYYY-MM-DD[&time=HH:MM]

    Conditions at a collection site **at the collection date and time**
    (Asia/Manila local), from Open-Meteo — free, keyless, hourly data from the
    recent forecast model or, for older dates, the ERA5 reanalysis archive.
    Without `date` it returns the conditions now. Stateless; the Analyze
    screen pre-fills its (still editable) weather fields with it.

    Coordinates come from the place search (the centre of the chosen PSGC
    town), so there is no free-text geocoding: a request without lat/lon is
    a 400.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        params = request.query_params
        try:
            lat, lon = float(params.get('lat', '')), float(params.get('lon', ''))
        except ValueError:
            return Response(
                {'detail': 'Pick a place from the list — lat and lon are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            return Response({'detail': 'lat/lon are out of range.'}, status=status.HTTP_400_BAD_REQUEST)

        tz = zoneinfo.ZoneInfo(WEATHER_TIMEZONE)
        now = timezone.now().astimezone(tz)
        raw_date = params.get('date', '').strip()
        raw_time = params.get('time', '').strip()
        try:
            day = datetime.date.fromisoformat(raw_date) if raw_date else now.date()
            if raw_time:
                # Nearest hourly reading: 12:40 → 13:00, 23:30 → 00:00 the next day.
                when = datetime.datetime.combine(day, datetime.time.fromisoformat(raw_time).replace(tzinfo=None))
                if when.minute >= 30:
                    when += datetime.timedelta(hours=1)
                day, hour = when.date(), when.hour
            else:
                hour = now.hour if not raw_date else DEFAULT_HOUR
        except ValueError:
            return Response(
                {'detail': 'date must be YYYY-MM-DD and time HH:MM.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if day < EARLIEST_WEATHER_DATE:
            return Response(
                {'detail': 'Weather records start in 1940.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        age = (now.date() - day).days
        if age < -FORECAST_FUTURE_DAYS:
            return Response(
                {'detail': 'No weather is available that far in the future.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        url = OPEN_METEO_FORECAST_URL if age <= FORECAST_PAST_DAYS else OPEN_METEO_ARCHIVE_URL

        try:
            upstream = requests.get(
                url,
                params={
                    'latitude': lat,
                    'longitude': lon,
                    'start_date': day.isoformat(),
                    'end_date': day.isoformat(),
                    'hourly': HOURLY_FIELDS,
                    'timezone': WEATHER_TIMEZONE,
                },
                timeout=15,
            )
            payload = upstream.json()
        except (requests.RequestException, ValueError):
            return Response(
                {'detail': 'Weather service is unavailable.'},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        if upstream.status_code == 400:
            # Open-Meteo refuses dates outside its range with a 400.
            return Response(
                {'detail': 'No weather data for that date.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        if upstream.status_code != 200 or not isinstance(payload, dict):
            return Response(
                {'detail': 'Weather service is unavailable.'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        hourly = payload.get('hourly') or {}
        wanted = f'{day.isoformat()}T{hour:02d}:00'
        times = hourly.get('time') or []
        if wanted not in times:
            return Response(
                {'detail': 'No weather data for that date yet.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        i = times.index(wanted)

        def at(field):
            values = hourly.get(field) or []
            return values[i] if i < len(values) else None

        temperature, humidity, wind = at('temperature_2m'), at('relative_humidity_2m'), at('wind_speed_10m')
        if temperature is None and humidity is None and wind is None:
            # The archive lags a few days behind: the hours exist but are empty.
            return Response(
                {'detail': 'No weather data for that date yet.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response({
            'condition': _condition(at('weather_code'), at('cloud_cover'), wind),
            'temperatureC': temperature,
            'humidityPct': humidity,
            'windKph': wind,
            'observedAt': wanted,
            'source': 'Open-Meteo',
        })


class ReportMonthlyCountsView(APIView):
    """
    GET /api/v1/reports/monthly-counts/ — per-species grain counts for the
    dashboard's historical pollen chart, bucketed by month.

    Always returns the trailing 12 calendar months ending at the current
    month (oldest first), one entry per month, every catalog species present
    in `series` with a count of 0 when there's no data — matching
    app/PolLens/lib/data.ts's MonthlyPollenCount: `{month, series: {species_id:
    count}}`. `series` is keyed dynamically off the full Species table (not
    a fixed hardcoded struct), so it scales automatically as species are
    added/removed. `month` has no year — a rolling 12-month window never
    repeats a month abbreviation, which is what makes that unambiguous.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        all_species = all_species_ids()
        now = timezone.localtime(timezone.now(), MANILA)
        months = []
        year, month = now.year, now.month
        for _ in range(12):
            months.append((year, month))
            month -= 1
            if month == 0:
                month, year = 12, year - 1
        months.reverse()

        target_year_months = [f'{year:04d}-{month:02d}' for year, month in months]
        reports = (
            Report.objects
            .filter(status__in=FINALISED_STATUSES)
            .annotate(year_month=Substr('collected_at', 1, 7))
            .filter(year_month__in=target_year_months)
            .prefetch_related('slides__detections', 'slides__grains', 'slides__annotations')
        )
        counts = {}
        for report in reports:
            for slide in report.slides.all():
                for detection in slide.reviewed_detection_summary():
                    species_id = detection['species_id']
                    if species_id not in all_species:
                        continue
                    key = (report.year_month, species_id)
                    counts[key] = counts.get(key, 0) + detection['grain_count']

        result = []
        for year, month in months:
            year_month = f'{year:04d}-{month:02d}'
            series = {
                species_id: counts.get((year_month, species_id), 0)
                for species_id in all_species
            }
            result.append({'month': calendar.month_abbr[month], 'series': series})

        return Response(result)


class SpeciesListView(APIView):
    """GET /api/v1/reports/species/ — the full pollen species catalog, curated order."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(SpeciesSerializer(Species.objects.all(), many=True).data)


class ReportDetailView(APIView):
    """
    GET    /api/v1/reports/<sample_id>/ — a single report (any researcher).
    PATCH  /api/v1/reports/<sample_id>/ — edit details/notes, change status.
    DELETE /api/v1/reports/<sample_id>/ — delete it and its slide images.

    PATCH and DELETE are for the report's owner or staff only.
    """

    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser]

    def _get(self, sample_id):
        return Report.objects.prefetch_related(
            'slides__detections', 'slides__grains', 'slides__annotations',
        ).filter(sample_id=sample_id).first()

    @staticmethod
    def _not_found():
        return Response({'detail': 'Report not found.'}, status=status.HTTP_404_NOT_FOUND)

    @staticmethod
    def _can_edit(request, report):
        return request.user.is_staff or report.owner_id == request.user.id

    def get(self, request, sample_id):
        report = self._get(sample_id)
        if report is None:
            return self._not_found()
        return Response(ReportSerializer(report, context={'request': request}).data)

    def patch(self, request, sample_id):
        report = self._get(sample_id)
        if report is None:
            return self._not_found()
        if not self._can_edit(request, report):
            return Response(
                {'detail': 'Only the researcher who created this report can change it.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = ReportUpdateSerializer(report, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(
                {'detail': 'The update is invalid.', 'errors': serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer.save()
        return Response(ReportSerializer(self._get(sample_id), context={'request': request}).data)

    def delete(self, request, sample_id):
        report = self._get(sample_id)
        if report is None:
            return self._not_found()
        if not self._can_edit(request, report):
            return Response(
                {'detail': 'Only the researcher who created this report can delete it.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        images = [slide.image for slide in report.slides.all() if slide.image]
        with transaction.atomic():
            report.delete()
            # Files go only once the rows are really gone; a storage error is
            # logged, never turned into a 500 for a delete that already happened.
            transaction.on_commit(lambda: delete_image_files(images), robust=True)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ReportAnnotationDetailView(APIView):
    """PUT/DELETE one reviewer annotation on a report in Needs review."""

    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser]

    @staticmethod
    def _editable_report(request, sample_id):
        report = Report.objects.filter(sample_id=sample_id).first()
        if report is None:
            return None, Response({'detail': 'Report not found.'}, status=status.HTTP_404_NOT_FOUND)
        if not (request.user.is_staff or report.owner_id == request.user.id):
            return None, Response(
                {'detail': 'Only the researcher who created this report can change it.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        if report.status != 'Needs review':
            return None, Response(
                {'detail': 'Annotations can only be changed while a report Needs review.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return report, None

    def put(self, request, sample_id, annotation_id):
        report, error = self._editable_report(request, sample_id)
        if error:
            return error

        serializer = GrainAnnotationInputSerializer(
            data=request.data, context={'report': report},
        )
        if not serializer.is_valid():
            return Response(
                {'detail': 'The annotation is invalid.', 'errors': serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        data = serializer.validated_data
        box = data['box']
        grain = data['grain']
        with transaction.atomic():
            slide = Slide.objects.select_for_update().get(pk=data['slide'].pk)
            annotation = None
            if grain is not None:
                annotation = GrainAnnotation.objects.select_for_update().filter(grain=grain).first()
            if annotation is None:
                annotation = GrainAnnotation.objects.filter(
                    pk=annotation_id, slide__report=report,
                ).first()
            if annotation is None:
                if GrainAnnotation.objects.filter(pk=annotation_id).exists():
                    return Response(
                        {'detail': 'This annotation id is already in use.'},
                        status=status.HTTP_409_CONFLICT,
                    )
                annotation = GrainAnnotation(id=annotation_id)

            annotation.slide = slide
            annotation.grain = grain
            annotation.kind = data['kind']
            annotation.species = data['species']
            annotation.box_x = box['x']
            annotation.box_y = box['y']
            annotation.box_width = box['width']
            annotation.box_height = box['height']
            annotation.reviewer = request.user
            annotation.save()

        return Response(GrainAnnotationSerializer(annotation).data)

    def delete(self, request, sample_id, annotation_id):
        report, error = self._editable_report(request, sample_id)
        if error:
            return error
        deleted, _ = GrainAnnotation.objects.filter(
            pk=annotation_id, slide__report=report,
        ).delete()
        if not deleted:
            return Response({'detail': 'Annotation not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)

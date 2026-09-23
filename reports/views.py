import calendar
import json
import re
import uuid
from pathlib import Path

import requests
from PIL import Image as PILImage
from django.conf import settings
from django.db.models import Q, Sum
from django.db.models.functions import Substr
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import STATUS_CHOICES, Detection, Report, Species
from .serializers import ReportCreateSerializer, ReportSerializer, SpeciesSerializer

DATE_PARAM_VALIDATOR = re.compile(r'^\d{4}-\d{2}-\d{2}$')
VALID_STATUSES = dict(STATUS_CHOICES)


def all_species_ids():
    # Queried per call, not cached at import time — a module-level query
    # would run during management commands (makemigrations, check) before
    # the table necessarily exists. Species.Meta.ordering = ['sort_order']
    # already applies, .order_by() here is just for readability at the call site.
    return list(Species.objects.order_by('sort_order').values_list('id', flat=True))


class ReportListCreateView(APIView):
    """
    GET  /api/v1/reports/   — list every saved report (shared corpus).
    POST /api/v1/reports/   — persist an already-analyzed batch as one report.
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

        location_param = request.query_params.get('location', '').strip()
        if location_param and location_param.lower() != 'all':
            reports = reports.filter(location=location_param)

        date_from = request.query_params.get('from', '').strip()
        date_to = request.query_params.get('to', '').strip()
        for label, value in (('from', date_from), ('to', date_to)):
            if value and not DATE_PARAM_VALIDATOR.match(value):
                return Response(
                    {'detail': f'"{label}" must be "YYYY-MM-DD".'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        if date_from or date_to:
            reports = reports.annotate(collected_date=Substr('collected_at', 1, 10))
            if date_from:
                reports = reports.filter(collected_date__gte=date_from)
            if date_to:
                reports = reports.filter(collected_date__lte=date_to)

        query = request.query_params.get('q', '').strip()
        if query:
            reports = reports.filter(
                Q(sample_id__icontains=query)
                | Q(location__icontains=query)
                | Q(collected_at__icontains=query)
                | Q(slides__detections__species__id__icontains=query)
            ).distinct()

        reports = reports.prefetch_related('slides__detections', 'slides__grains')
        return Response(
            ReportSerializer(reports, many=True, context={'request': request}).data
        )

    def post(self, request):
        # request.data is a QueryDict for multipart bodies; DRF treats any
        # Mapping with .getlist() as HTML form input and parses nested
        # many=True fields as bracket-notation keys ("slides[0]...") rather
        # than reading our single JSON-encoded field. A plain dict avoids
        # that HTML-form code path.
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

        serializer = ReportCreateSerializer(
            data=data, context={'files': request.FILES, 'owner': request.user},
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


ROBOFLOW_DETECT_URL = 'https://detect.roboflow.com/{model_id}/{version}'
ROBOFLOW_PREDICTION_FIELDS = ('class', 'confidence', 'x', 'y', 'width', 'height')
# A captured-shape Roboflow response (inference_id/time/image/predictions,
# class names = Species slugs) served while ROBOFLOW_MOCK is on. Not a
# Django loaddata fixture despite the directory name.
ROBOFLOW_MOCK_RESPONSE = Path(__file__).resolve().parent / 'fixtures' / 'roboflow_detect_response.json'


class DetectionUnavailable(Exception):
    """Roboflow couldn't be reached or answered with something unusable."""


def _roboflow_detect(image):
    """Raw Roboflow response for `image`, exactly as the hosted API returns it."""
    url = ROBOFLOW_DETECT_URL.format(
        model_id=settings.ROBOFLOW_MODEL_ID, version=settings.ROBOFLOW_MODEL_VERSION,
    )
    try:
        upstream = requests.post(
            url,
            params={'api_key': settings.ROBOFLOW_API_KEY},
            files={'file': (image.name, image.read(), image.content_type)},
            timeout=30,
        )
        payload = upstream.json()
    except (requests.RequestException, ValueError) as exc:
        raise DetectionUnavailable from exc
    if upstream.status_code != 200:
        raise DetectionUnavailable
    return payload


def _mock_roboflow_detect(image):
    """
    The captured response, rescaled onto `image`'s real pixel size so boxes
    land inside whatever was uploaded, with fresh ids — otherwise
    indistinguishable from `_roboflow_detect`'s output.
    """
    payload = json.loads(ROBOFLOW_MOCK_RESPONSE.read_text(encoding='utf-8'))
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
    Roboflow-hosted grain detection model.

    Stateless: called once per uploaded image at Analyze-time, before a
    report/sample id exists, so nothing here is persisted — see
    ReportListCreateView.post for where an already-analyzed batch is later
    saved. Response is Roboflow's native shape with only the fields the
    client needs: `{"image": {"width", "height"}, "predictions": [{"class",
    "confidence", "x", "y", "width", "height"}]}` (pixel coordinates, box
    centre-based). app/PolLens/lib/analysis.ts maps that into the app's
    normalized top-left BoundingBox client-side, so this view exists only
    to hold the Roboflow API key server-side, not to reshape the response.

    With ROBOFLOW_MOCK on, the upstream call is swapped for
    `_mock_roboflow_detect`; everything after it is the same code path.
    """

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        image = request.FILES.get('image')
        if not image:
            return Response(
                {'detail': 'An image file is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if settings.ROBOFLOW_MOCK:
            payload = _mock_roboflow_detect(image)
        else:
            if not (
                settings.ROBOFLOW_API_KEY
                and settings.ROBOFLOW_MODEL_ID
                and settings.ROBOFLOW_MODEL_VERSION
            ):
                return Response(
                    {'detail': 'Detection service is not configured.'},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            try:
                payload = _roboflow_detect(image)
            except DetectionUnavailable:
                return Response(
                    {'detail': 'Detection service is unavailable.'},
                    status=status.HTTP_502_BAD_GATEWAY,
                )

        image_size = payload.get('image') or {}
        predictions = [
            {field: p[field] for field in ROBOFLOW_PREDICTION_FIELDS if field in p}
            for p in payload.get('predictions', [])
        ]
        return Response({
            'image': {'width': image_size.get('width'), 'height': image_size.get('height')},
            'predictions': predictions,
        })


OPENWEATHER_URL = 'https://api.openweathermap.org/data/2.5/weather'
# Sustained wind at/above this speed is reported as "Windy" ahead of sky
# condition — OpenWeather has no dedicated "windy" weather group, so this
# is a deliberate approximation, not a value from any spec.
WINDY_THRESHOLD_KPH = 30


def _map_weather_response(payload):
    # OpenWeather's ~10 weather groups (Clear/Clouds/Rain/Drizzle/
    # Thunderstorm/Snow/Atmosphere...) don't map 1:1 onto the app's 5-value
    # WeatherCondition enum (lib/data.ts), so this is an approximation:
    # wind speed is checked first, then sky condition, and anything outside
    # Clear/Clouds/the rain family falls back to "Overcast" as the closest
    # available value.
    main = payload.get('main') or {}
    wind = payload.get('wind') or {}
    clouds = payload.get('clouds') or {}
    weather_main = (payload.get('weather') or [{}])[0].get('main', '')
    wind_kph = round(wind.get('speed', 0) * 3.6, 1)

    if wind_kph >= WINDY_THRESHOLD_KPH:
        condition = 'Windy'
    elif weather_main in ('Thunderstorm', 'Drizzle', 'Rain'):
        condition = 'Rainy'
    elif weather_main == 'Clear':
        condition = 'Sunny'
    elif weather_main == 'Clouds':
        condition = 'Partly cloudy' if clouds.get('all', 0) < 50 else 'Overcast'
    else:
        condition = 'Overcast'

    return {
        'condition': condition,
        'temperatureC': main.get('temp'),
        'humidityPct': main.get('humidity'),
        'windKph': wind_kph,
    }


class WeatherView(APIView):
    """
    GET /api/v1/reports/weather/?lat=<deg>&lon=<deg> (preferred) or
    ?location=<free-text location> — current conditions for a collection
    site, via OpenWeather.

    Stateless, like DetectView — called at Analyze-time to pre-fill the
    manually-entered weather fields (lib/analysis.ts's fetchWeather TODO),
    not persisted here. `location` is passed through to OpenWeather as-is
    (the same free-text "Town, Province" strings the frontend already
    collects); if OpenWeather can't resolve it, that's a 404, not a service
    failure. The frontend's place search sends `lat`/`lon` instead (the
    centre of the chosen PSGC town), which OpenWeather never fails to
    resolve; when both are given, coordinates win.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        lat = request.query_params.get('lat', '').strip()
        lon = request.query_params.get('lon', '').strip()
        location = request.query_params.get('location', '').strip()
        if lat or lon:
            try:
                lat, lon = float(lat), float(lon)
            except ValueError:
                return Response(
                    {'detail': 'lat and lon must both be numbers.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not (-90 <= lat <= 90 and -180 <= lon <= 180):
                return Response(
                    {'detail': 'lat/lon are out of range.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            place = {'lat': lat, 'lon': lon}
        elif location:
            place = {'q': location}
        else:
            return Response(
                {'detail': 'A location or lat/lon is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not settings.OPENWEATHER_API_KEY:
            return Response(
                {'detail': 'Weather lookup is not configured.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            upstream = requests.get(
                OPENWEATHER_URL,
                params={**place, 'appid': settings.OPENWEATHER_API_KEY, 'units': 'metric'},
                timeout=10,
            )
        except requests.RequestException:
            return Response(
                {'detail': 'Weather service is unavailable.'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        if upstream.status_code == 404:
            return Response(
                {'detail': 'Location not found.'}, status=status.HTTP_404_NOT_FOUND,
            )
        if upstream.status_code != 200:
            return Response(
                {'detail': 'Weather service is unavailable.'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        try:
            payload = upstream.json()
        except ValueError:
            return Response(
                {'detail': 'Weather service is unavailable.'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response(_map_weather_response(payload))


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
        now = timezone.now()
        months = []
        year, month = now.year, now.month
        for _ in range(12):
            months.append((year, month))
            month -= 1
            if month == 0:
                month, year = 12, year - 1
        months.reverse()

        target_year_months = [f'{year:04d}-{month:02d}' for year, month in months]
        rows = (
            Detection.objects
            .filter(species_id__in=all_species, slide__report__status='Completed')
            .annotate(year_month=Substr('slide__report__collected_at', 1, 7))
            .filter(year_month__in=target_year_months)
            .values('year_month', 'species_id')
            .annotate(total=Sum('grain_count'))
        )
        counts = {(row['year_month'], row['species_id']): row['total'] for row in rows}

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
    GET /api/v1/reports/<sample_id>/ — a single report by its sample id.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, sample_id):
        try:
            report = Report.objects.prefetch_related(
                'slides__detections', 'slides__grains',
            ).get(sample_id=sample_id)
        except Report.DoesNotExist:
            return Response(
                {'detail': 'Report not found.'}, status=status.HTTP_404_NOT_FOUND,
            )
        return Response(ReportSerializer(report, context={'request': request}).data)

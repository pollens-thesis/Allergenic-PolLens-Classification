import calendar
import json
import re

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

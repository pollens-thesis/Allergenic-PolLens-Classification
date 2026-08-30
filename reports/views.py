import json

from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Report
from .serializers import ReportCreateSerializer, ReportSerializer


class ReportListCreateView(APIView):
    """
    GET  /api/v1/reports/   — list every saved report (shared corpus).
    POST /api/v1/reports/   — persist an already-analyzed batch as one report.
    """

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        reports = Report.objects.prefetch_related('slides__detections', 'slides__grains')
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

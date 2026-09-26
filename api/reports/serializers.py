import datetime
import re

from django.db import transaction
from rest_framework import serializers

from .models import (
    STATUS_CHOICES,
    STATUS_TRANSITIONS,
    WEATHER_CONDITION_CHOICES,
    Detection,
    Grain,
    Report,
    Slide,
    Species,
    next_sample_id,
)

# ---------------------------------------------------------------------------
# Input (write-only) — validates and parses the multipart POST body.
#
# Nested objects (weather, slides[].detections, slides[].grains) travel as
# JSON-encoded strings inside form fields; images travel as one file part
# per slide, keyed by the slide's index as a string (e.g. "0", "1"),
# mirroring the frontend's `images: Record<string, Blob>` in lib/store.ts.
# Image type/size is checked by the view (reports.images) before this runs.
# ---------------------------------------------------------------------------

# How far outside the frame a box may start before it's treated as garbage
# rather than a grain cut off by the image edge.
BOX_TOLERANCE = 0.5


class BoundingBoxInputSerializer(serializers.Serializer):
    """
    Normalized top-left box. A detector legitimately reports grains that run
    off the edge of the frame (x or y slightly below 0, or x + width past 1);
    those are clipped to the image rather than rejecting the whole report.
    """

    x = serializers.FloatField(min_value=-BOX_TOLERANCE, max_value=1)
    y = serializers.FloatField(min_value=-BOX_TOLERANCE, max_value=1)
    width = serializers.FloatField(min_value=0, max_value=1 + BOX_TOLERANCE)
    height = serializers.FloatField(min_value=0, max_value=1 + BOX_TOLERANCE)

    def validate(self, box):
        x0, y0 = max(0.0, box['x']), max(0.0, box['y'])
        x1 = min(1.0, box['x'] + box['width'])
        y1 = min(1.0, box['y'] + box['height'])
        if x1 <= x0 or y1 <= y0:
            raise serializers.ValidationError('The box lies outside the image.')
        return {'x': x0, 'y': y0, 'width': x1 - x0, 'height': y1 - y0}


class DetectionInputSerializer(serializers.Serializer):
    speciesId = serializers.SlugRelatedField(
        slug_field='id', queryset=Species.objects.all(), source='species',
    )
    grainCount = serializers.IntegerField(min_value=0, source='grain_count')
    avgConfidence = serializers.FloatField(min_value=0, max_value=1, source='avg_confidence')


class GrainInputSerializer(serializers.Serializer):
    speciesId = serializers.SlugRelatedField(
        slug_field='id', queryset=Species.objects.all(), source='species',
    )
    confidence = serializers.FloatField(min_value=0, max_value=1)
    box = BoundingBoxInputSerializer()


class WeatherInputSerializer(serializers.Serializer):
    condition = serializers.ChoiceField(choices=WEATHER_CONDITION_CHOICES)
    temperatureC = serializers.FloatField(allow_null=True, source='temperature_c')
    humidityPct = serializers.FloatField(allow_null=True, source='humidity_pct')
    windKph = serializers.FloatField(allow_null=True, source='wind_kph')


class SlideInputSerializer(serializers.Serializer):
    fileName = serializers.CharField(source='file_name', max_length=255)
    detections = DetectionInputSerializer(many=True)
    grains = GrainInputSerializer(many=True, required=False, default=list)
    notes = serializers.CharField(allow_blank=True, default='')

    def validate_detections(self, detections):
        seen = set()
        for detection in detections:
            species_id = detection['species'].id
            if species_id in seen:
                raise serializers.ValidationError(
                    f'"{species_id}" appears more than once; send one summary row per species.'
                )
            seen.add(species_id)
        return detections


def check_collected_at(value):
    """The regex only checks the shape; this rejects impossible dates like 2026-99-99."""
    try:
        datetime.datetime.strptime(value, '%Y-%m-%dT%H:%M' if 'T' in value else '%Y-%m-%d')
    except ValueError:
        raise serializers.ValidationError('Not a real date/time.')
    return value


def require_location(status, location):
    if status in ('Completed', 'Needs review') and not (location or '').strip():
        raise serializers.ValidationError(
            {'location': ['Location is required to complete a report.']}
        )


class ReportCreateSerializer(serializers.Serializer):
    """
    Validates and persists a POST /api/v1/reports/ body. Pure storage: does
    not recompute detections from grains. `status` is 'Pending' when the
    Analyze screen stores a fresh batch (finalised later via PATCH), or
    'Completed' to store an already-finalised report in one step (default).
    """

    collectedAt = serializers.RegexField(
        r'^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$', source='collected_at',
    )
    location = serializers.CharField(allow_blank=True, max_length=255)
    researcher = serializers.CharField(allow_blank=True, max_length=255)
    weather = WeatherInputSerializer(allow_null=True, required=False, default=None)
    slides = SlideInputSerializer(many=True, min_length=1)
    status = serializers.ChoiceField(choices=['Pending', 'Completed'], default='Completed')
    sampleDetections = serializers.BooleanField(default=False, source='sample_detections')

    def validate_collectedAt(self, value):
        return check_collected_at(value)

    def validate(self, attrs):
        require_location(attrs['status'], attrs['location'])
        # Every slide's image must be present before anything is written, so a
        # rejected batch never leaves files behind in storage.
        files = self.context.get('files', {})
        missing = [i for i in range(len(attrs['slides'])) if files.get(str(i)) is None]
        if missing:
            raise serializers.ValidationError(
                {'slides': [f'Missing image file for slide index {missing[0]}.']}
            )
        return attrs

    def create(self, validated_data):
        files = self.context['files']
        extensions = self.context.get('extensions', {})
        owner = self.context['owner']

        with transaction.atomic():
            weather = validated_data.get('weather')
            report = Report.objects.create(
                sample_id=next_sample_id(),
                owner=owner,
                collected_at=validated_data['collected_at'],
                location=validated_data['location'].strip(),
                researcher=validated_data['researcher'].strip() or 'Unknown',
                status=validated_data['status'],
                sample_detections=validated_data.get('sample_detections', False),
                weather_condition=weather['condition'] if weather else None,
                weather_temperature_c=weather.get('temperature_c') if weather else None,
                weather_humidity_pct=weather.get('humidity_pct') if weather else None,
                weather_wind_kph=weather.get('wind_kph') if weather else None,
            )
            for index, slide_data in enumerate(validated_data['slides']):
                image = files.get(str(index))
                if image is None:
                    raise serializers.ValidationError(
                        {'slides': f'Missing image file for slide index {index}.'}
                    )
                # Stored under the format Pillow detected, not the client's name.
                image.name = f'slide{extensions.get(str(index), "")}'
                slide = Slide.objects.create(
                    report=report, number=index + 1,
                    file_name=slide_data['file_name'], image=image,
                    notes=slide_data['notes'].strip(),
                )
                Detection.objects.bulk_create(
                    Detection(slide=slide, **detection) for detection in slide_data['detections']
                )
                Grain.objects.bulk_create(
                    Grain(
                        slide=slide, number=i + 1, species=grain['species'],
                        confidence=grain['confidence'],
                        box_x=grain['box']['x'], box_y=grain['box']['y'],
                        box_width=grain['box']['width'], box_height=grain['box']['height'],
                    )
                    for i, grain in enumerate(slide_data['grains'])
                )
        return report


class SlideNotesInputSerializer(serializers.Serializer):
    id = serializers.CharField()  # "{sampleId}-S{n}", as returned by the API
    notes = serializers.CharField(allow_blank=True, max_length=10000)


class ReportUpdateSerializer(serializers.Serializer):
    """
    PATCH /api/v1/reports/<id>/ — edit a report's collection details and slide
    notes, and move it through its lifecycle (models.STATUS_TRANSITIONS):
    Pending → Completed ("Generate Report"), Completed ⇄ Needs review.
    Every field is optional; only the ones sent change.
    """

    collectedAt = serializers.RegexField(
        r'^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$', source='collected_at', required=False,
    )
    location = serializers.CharField(allow_blank=True, max_length=255, required=False)
    researcher = serializers.CharField(allow_blank=True, max_length=255, required=False)
    weather = WeatherInputSerializer(allow_null=True, required=False)
    slides = SlideNotesInputSerializer(many=True, required=False)
    status = serializers.ChoiceField(choices=STATUS_CHOICES, required=False)

    def validate_collectedAt(self, value):
        return check_collected_at(value)

    def validate(self, attrs):
        # Partial updates skip missing keys *inside* nested objects too, so the
        # raw body is checked: a weather object is all four readings or null,
        # and every slide entry names its id and its notes.
        raw = self.initial_data if isinstance(self.initial_data, dict) else {}
        weather = raw.get('weather')
        if 'weather' in raw and weather is not None:
            needed = {'condition', 'temperatureC', 'humidityPct', 'windKph'}
            if not isinstance(weather, dict) or not needed <= set(weather):
                raise serializers.ValidationError(
                    {'weather': ['Send condition, temperatureC, humidityPct and windKph, or null.']}
                )
        for entry in raw.get('slides') or []:
            if not isinstance(entry, dict) or not {'id', 'notes'} <= set(entry):
                raise serializers.ValidationError({'slides': ['Each slide needs an id and notes.']})

        report = self.instance
        new_status = attrs.get('status', report.status)
        if new_status != report.status and new_status not in STATUS_TRANSITIONS[report.status]:
            raise serializers.ValidationError(
                {'status': [f'A {report.status} report can\'t be changed to {new_status}.']}
            )
        require_location(new_status, attrs.get('location', report.location))

        numbers = {}
        for slide in attrs.get('slides', []):
            match = re.fullmatch(re.escape(report.sample_id) + r'-S([0-9]+)', slide['id'])
            if not match or not report.slides.filter(number=int(match.group(1))).exists():
                raise serializers.ValidationError({'slides': [f'Unknown slide "{slide["id"]}".']})
            numbers[int(match.group(1))] = slide['notes'].strip()
        attrs['slide_notes'] = numbers
        return attrs

    def update(self, report, data):
        fields = []
        for field in ('collected_at', 'status'):
            if field in data:
                setattr(report, field, data[field])
                fields.append(field)
        if 'location' in data:
            report.location = data['location'].strip()
            fields.append('location')
        if 'researcher' in data:
            report.researcher = data['researcher'].strip() or 'Unknown'  # same rule as create
            fields.append('researcher')
        if 'weather' in data:
            weather = data['weather']
            report.weather_condition = weather['condition'] if weather else None
            report.weather_temperature_c = weather.get('temperature_c') if weather else None
            report.weather_humidity_pct = weather.get('humidity_pct') if weather else None
            report.weather_wind_kph = weather.get('wind_kph') if weather else None
            fields += ['weather_condition', 'weather_temperature_c',
                       'weather_humidity_pct', 'weather_wind_kph']
        with transaction.atomic():
            if fields:
                report.save(update_fields=fields)
            for number, notes in data['slide_notes'].items():
                report.slides.filter(number=number).update(notes=notes)
        return report


# ---------------------------------------------------------------------------
# Output (read-only) — shaped exactly like the frontend's `Specimen` type,
# camelCase throughout via explicit `source=`.
# ---------------------------------------------------------------------------


class SpeciesSerializer(serializers.Serializer):
    id = serializers.CharField()
    scientificName = serializers.CharField(source='scientific_name')
    commonName = serializers.CharField(source='common_name')
    code = serializers.CharField()
    season = serializers.CharField()
    riskLevel = serializers.CharField(source='risk_level')
    color = serializers.CharField()
    # Allergen Reference content (botanical only; see Species).
    filipinoName = serializers.CharField(source='filipino_name')
    family = serializers.CharField()
    growthForm = serializers.CharField(source='growth_form')
    description = serializers.CharField()
    distribution = serializers.CharField()
    pollination = serializers.CharField()
    infoSource = serializers.CharField(source='info_source')
    photoUrl = serializers.CharField(source='photo_url')
    photoCredit = serializers.CharField(source='photo_credit')
    photoLicense = serializers.CharField(source='photo_license')
    photoSource = serializers.CharField(source='photo_source')


class BoundingBoxSerializer(serializers.Serializer):
    x = serializers.FloatField(source='box_x')
    y = serializers.FloatField(source='box_y')
    width = serializers.FloatField(source='box_width')
    height = serializers.FloatField(source='box_height')


class GrainSerializer(serializers.Serializer):
    id = serializers.SerializerMethodField()
    speciesId = serializers.CharField(source='species_id')
    confidence = serializers.FloatField()
    box = BoundingBoxSerializer(source='*')

    def get_id(self, obj):
        return f'G{obj.number}'


class DetectionSerializer(serializers.Serializer):
    speciesId = serializers.CharField(source='species_id')
    grainCount = serializers.IntegerField(source='grain_count')
    avgConfidence = serializers.FloatField(source='avg_confidence')


class SlideSerializer(serializers.Serializer):
    id = serializers.SerializerMethodField()
    fileName = serializers.CharField(source='file_name')
    detections = DetectionSerializer(many=True)
    grains = GrainSerializer(many=True)
    notes = serializers.CharField()
    image_url = serializers.SerializerMethodField()

    def get_id(self, obj):
        return f'{obj.report.sample_id}-S{obj.number}'

    def get_image_url(self, obj):
        request = self.context.get('request')
        url = obj.image.url
        return request.build_absolute_uri(url) if request else url


class ReportSerializer(serializers.Serializer):
    sampleId = serializers.CharField(source='sample_id')
    collectedAt = serializers.CharField(source='collected_at')
    location = serializers.CharField()
    slides = SlideSerializer(many=True)
    weather = serializers.SerializerMethodField()
    researcher = serializers.CharField()
    status = serializers.CharField()
    sampleDetections = serializers.BooleanField(source='sample_detections')
    createdAt = serializers.DateTimeField(source='created_at')
    # Whether the caller may edit/delete it — the owner itself isn't exposed.
    canEdit = serializers.SerializerMethodField()

    def get_canEdit(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if user is None or not user.is_authenticated:
            return False
        return user.is_staff or obj.owner_id == user.id

    def get_weather(self, obj):
        if obj.weather_condition is None:
            return None
        return {
            'condition': obj.weather_condition,
            'temperatureC': obj.weather_temperature_c,
            'humidityPct': obj.weather_humidity_pct,
            'windKph': obj.weather_wind_kph,
        }

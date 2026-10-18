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
    GrainAnnotation,
    Report,
    Slide,
    Species,
    next_sample_id,
)
from .verification import sync_after_change

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
    """The date-only regex checks the shape; this rejects impossible dates like 2026-99-99."""
    try:
        datetime.datetime.strptime(value, '%Y-%m-%d')
    except ValueError:
        raise serializers.ValidationError('Not a real date.')
    return value


def require_location(status, location):
    if status in ('Completed', 'Needs review') and not (location or '').strip():
        raise serializers.ValidationError(
            {'location': ['Location is required before generating or completing a report.']}
        )


class ReportCreateSerializer(serializers.Serializer):
    """
    Validates and persists a POST /api/v1/reports/ body. Pure storage: does
    not recompute detections from grains. New reports start as 'Pending'; the
    researcher generates them into 'Needs review', then marks them 'Completed'.
    """

    reportName = serializers.CharField(
        source='report_name', max_length=255, allow_blank=True, required=False, default='',
    )
    collectedAt = serializers.RegexField(
        r'^\d{4}-\d{2}-\d{2}$', source='collected_at',
    )
    location = serializers.CharField(allow_blank=True, max_length=255)
    researcher = serializers.CharField(allow_blank=True, max_length=255)
    weather = WeatherInputSerializer(allow_null=True, required=False, default=None)
    slides = SlideInputSerializer(many=True, min_length=1)
    status = serializers.ChoiceField(choices=['Pending'], default='Pending')
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
                report_name=validated_data.get('report_name', '').strip(),
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


class GrainAnnotationInputSerializer(serializers.Serializer):
    """One user-reviewed label, validated against its report and slide."""

    slideId = serializers.CharField()
    grainId = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    kind = serializers.ChoiceField(choices=GrainAnnotation.KIND_CHOICES)
    speciesId = serializers.SlugRelatedField(
        slug_field='id', queryset=Species.objects.all(), required=False, allow_null=True,
    )
    box = BoundingBoxInputSerializer(required=False)

    def validate(self, attrs):
        report = self.context['report']
        match = re.fullmatch(re.escape(report.sample_id) + r'-S([0-9]+)', attrs['slideId'])
        slide = report.slides.filter(number=int(match.group(1))).first() if match else None
        if slide is None:
            raise serializers.ValidationError({'slideId': ['Unknown slide for this report.']})

        grain_id = attrs.get('grainId')
        grain = None
        if grain_id:
            grain_match = re.fullmatch(r'G([0-9]+)', grain_id)
            grain = slide.grains.filter(number=int(grain_match.group(1))).first() if grain_match else None
            if grain is None:
                raise serializers.ValidationError({'grainId': ['Unknown grain for this slide.']})

        kind = attrs['kind']
        species = attrs.get('speciesId')
        box = attrs.get('box')
        if kind == 'missed':
            if grain is not None:
                raise serializers.ValidationError({'grainId': ['A missed grain cannot refer to a model detection.']})
            if species is None:
                raise serializers.ValidationError({'speciesId': ['Choose a species for the missed grain.']})
            if box is None:
                raise serializers.ValidationError({'box': ['Draw a box around the missed grain.']})
        else:
            if grain is None:
                raise serializers.ValidationError({'grainId': ['Choose a model detection to review.']})
            if kind == 'confirmed':
                species = grain.species
            elif kind == 'corrected' and species is None:
                raise serializers.ValidationError({'speciesId': ['Choose the corrected species.']})
            elif kind in ('false_positive', 'uncertain'):
                species = None
            if box is None:
                box = {
                    'x': grain.box_x, 'y': grain.box_y,
                    'width': grain.box_width, 'height': grain.box_height,
                }

        attrs.update({'slide': slide, 'grain': grain, 'species': species, 'box': box})
        return attrs


class ReportUpdateSerializer(serializers.Serializer):
    """
    PATCH /api/v1/reports/<id>/ — edit a report's collection details and slide
    notes, and move it through its lifecycle (models.STATUS_TRANSITIONS):
    Pending → Needs review ("Generate Report") → Completed; a completed report
    can later be flagged Needs review again.
    Every field is optional; only the ones sent change.
    """

    reportName = serializers.CharField(
        source='report_name', max_length=255, allow_blank=True, required=False,
    )
    collectedAt = serializers.RegexField(
        r'^\d{4}-\d{2}-\d{2}$', source='collected_at', required=False,
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
        submitted_now = report.status == 'Pending' and data.get('status', 'Pending') != 'Pending'
        for field in ('report_name', 'collected_at', 'status'):
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
        fields += sync_after_change(
            report, content_changed=bool(fields), submitted_now=submitted_now,
        )
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


class GrainAnnotationSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    grainId = serializers.SerializerMethodField()
    kind = serializers.CharField()
    speciesId = serializers.CharField(source='species_id', allow_null=True)
    box = BoundingBoxSerializer(source='*')
    reviewedAt = serializers.DateTimeField(source='updated_at')
    trainingEligible = serializers.SerializerMethodField(method_name='get_training_eligible')

    def get_grainId(self, obj):
        return f'G{obj.grain.number}' if obj.grain_id else None

    def get_training_eligible(self, obj):
        report = obj.slide.report
        return (
            not report.sample_detections
            and report.verification == 'Verified'
            and obj.kind in ('confirmed', 'corrected', 'missed')
        )


class DetectionSerializer(serializers.Serializer):
    speciesId = serializers.CharField(source='species_id')
    grainCount = serializers.IntegerField(source='grain_count')
    avgConfidence = serializers.FloatField(source='avg_confidence')
    confidenceGrainCount = serializers.SerializerMethodField()

    def get_confidenceGrainCount(self, obj):
        if isinstance(obj, dict):
            return obj.get('confidence_grain_count', obj.get('grain_count', 0))
        return obj.grain_count


class SlideSerializer(serializers.Serializer):
    id = serializers.SerializerMethodField()
    fileName = serializers.CharField(source='file_name')
    # `detections` is the reviewed result shown in reports and summaries.
    # Keep the unmodified model output alongside it for evaluation/audit.
    detections = serializers.SerializerMethodField()
    modelDetections = DetectionSerializer(many=True, source='detections')
    grains = GrainSerializer(many=True)
    annotations = GrainAnnotationSerializer(many=True)
    notes = serializers.CharField()
    image_url = serializers.SerializerMethodField()

    def get_id(self, obj):
        return f'{obj.report.sample_id}-S{obj.number}'

    def get_detections(self, obj):
        return DetectionSerializer(obj.reviewed_detection_summary(), many=True).data

    def get_image_url(self, obj):
        request = self.context.get('request')
        url = obj.image.url
        return request.build_absolute_uri(url) if request else url


class ReportSerializer(serializers.Serializer):
    sampleId = serializers.CharField(source='sample_id')
    reportName = serializers.CharField(source='report_name')
    collectedAt = serializers.SerializerMethodField()
    location = serializers.CharField()
    slides = SlideSerializer(many=True)
    weather = serializers.SerializerMethodField()
    researcher = serializers.SerializerMethodField()
    status = serializers.CharField()
    sampleDetections = serializers.BooleanField(source='sample_detections')
    createdAt = serializers.DateTimeField(source='created_at')
    verification = serializers.CharField()
    verifiedAt = serializers.DateTimeField(source='verified_at', allow_null=True)
    declineReason = serializers.SerializerMethodField()
    # Whether the caller may edit/delete it — the owner itself isn't exposed.
    canEdit = serializers.SerializerMethodField()
    # Whether the caller is the one who created it (staff editing someone else's is not "mine").
    isMine = serializers.SerializerMethodField()
    # Whether the caller may approve/decline it right now.
    canVerify = serializers.SerializerMethodField()

    def _user(self):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        return user if user is not None and user.is_authenticated else None

    def get_declineReason(self, obj):
        # Only the owner (to fix and resubmit) and verifiers need the reason.
        user = self._user()
        if user is None or not (user.can_verify or obj.owner_id == user.id):
            return ''
        return obj.decline_reason

    def get_canVerify(self, obj):
        user = self._user()
        return bool(
            user is not None and user.can_verify
            and obj.verification == 'Awaiting' and obj.status != 'Pending'
            and obj.owner_id != user.id
        )

    def get_isMine(self, obj):
        user = self._user()
        return user is not None and obj.owner_id == user.id

    def get_canEdit(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if user is None or not user.is_authenticated:
            return False
        return user.is_staff or obj.owner_id == user.id

    def get_collectedAt(self, obj):
        # Legacy rows may retain a time suffix, but the public API exposes dates only.
        return obj.collected_at.split('T', 1)[0]

    def get_researcher(self, obj):
        # The name is visible only to the researcher who owns this report and to
        # admins (not to other users or verifiers).
        user = self._user()
        if user is None or not (user.is_superuser or obj.owner_id == user.id):
            return ''
        return obj.researcher

    def get_weather(self, obj):
        if obj.weather_condition is None:
            return None
        return {
            'condition': obj.weather_condition,
            'temperatureC': obj.weather_temperature_c,
            'humidityPct': obj.weather_humidity_pct,
            'windKph': obj.weather_wind_kph,
        }

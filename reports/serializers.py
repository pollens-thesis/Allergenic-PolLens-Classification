from django.db import transaction
from rest_framework import serializers

from .models import (
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
# ---------------------------------------------------------------------------


class BoundingBoxInputSerializer(serializers.Serializer):
    x = serializers.FloatField(min_value=0, max_value=1)
    y = serializers.FloatField(min_value=0, max_value=1)
    width = serializers.FloatField(min_value=0, max_value=1)
    height = serializers.FloatField(min_value=0, max_value=1)


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
    fileName = serializers.CharField(source='file_name')
    detections = DetectionInputSerializer(many=True)
    grains = GrainInputSerializer(many=True, required=False, default=list)
    notes = serializers.CharField(allow_blank=True, default='')


class ReportCreateSerializer(serializers.Serializer):
    """
    Validates and persists a POST /api/v1/reports/ body. Pure storage: does
    not recompute detections from grains, and always writes
    status='Completed' — server-side ML inference is a separate feature.
    """

    collectedAt = serializers.RegexField(
        r'^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$', source='collected_at',
    )
    location = serializers.CharField()
    researcher = serializers.CharField(allow_blank=True)
    weather = WeatherInputSerializer(allow_null=True, required=False, default=None)
    slides = SlideInputSerializer(many=True, min_length=1)

    def create(self, validated_data):
        files = self.context['files']
        owner = self.context['owner']

        with transaction.atomic():
            weather = validated_data.get('weather')
            report = Report.objects.create(
                sample_id=next_sample_id(),
                owner=owner,
                collected_at=validated_data['collected_at'],
                location=validated_data['location'].strip(),
                researcher=validated_data['researcher'].strip() or 'Unknown',
                status='Completed',
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

    def get_weather(self, obj):
        if obj.weather_condition is None:
            return None
        return {
            'condition': obj.weather_condition,
            'temperatureC': obj.weather_temperature_c,
            'humidityPct': obj.weather_humidity_pct,
            'windKph': obj.weather_wind_kph,
        }

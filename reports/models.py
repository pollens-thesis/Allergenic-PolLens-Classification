import pathlib

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator, RegexValidator
from django.db import models, transaction
from django.utils import timezone

RISK_LEVEL_CHOICES = [
    ('High', 'High'), ('Moderate', 'Moderate'), ('Low', 'Low'),
]  # matches Species['riskLevel'] in app/PolLens/lib/data.ts

STATUS_CHOICES = [
    ('Completed', 'Completed'), ('Processing', 'Processing'), ('Needs review', 'Needs review'),
]  # matches ReportStatus; this app only ever writes 'Completed' — see api/CLAUDE.md

WEATHER_CONDITION_CHOICES = [
    ('Sunny', 'Sunny'), ('Partly cloudy', 'Partly cloudy'), ('Overcast', 'Overcast'),
    ('Rainy', 'Rainy'), ('Windy', 'Windy'),
]

COLLECTED_AT_VALIDATOR = RegexValidator(
    r'^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$',
    'collectedAt must be "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm".',
)


class ReportSequence(models.Model):
    """One row per calendar year; guards sample_id minting under concurrency."""

    year = models.PositiveIntegerField(unique=True)
    last_number = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f'{self.year}:{self.last_number}'


def next_sample_id(year=None):
    """
    Mints the next 'PLN-<year>-NNNN' sample id, row-locking the year's
    sequence counter so concurrent POSTs can't mint duplicates. Call this
    as the first statement inside the same transaction that creates the
    Report, so a rolled-back create doesn't leave a permanent gap.
    """
    year = year or timezone.now().year
    with transaction.atomic():
        seq, _ = ReportSequence.objects.select_for_update().get_or_create(
            year=year, defaults={'last_number': 0},
        )
        seq.last_number += 1
        seq.save(update_fields=['last_number'])
        return f'PLN-{year}-{seq.last_number:04d}'


class Report(models.Model):
    """
    A saved collection session (one microscope batch). Maps to the
    frontend's `Specimen` type (app/PolLens/lib/data.ts). Reports are a
    shared corpus — every authenticated user can read every report;
    `owner` is for attribution and future edit/delete permission checks
    only, and is never exposed in the API response.
    """

    sample_id = models.CharField(max_length=20, unique=True, editable=False)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='reports',
    )

    # Opaque ISO string ("YYYY-MM-DD" or "YYYY-MM-DDTHH:mm") stored as-is —
    # not a DateTimeField, so round-trip fidelity matches the frontend's own
    # string-comparison sort in app/PolLens/lib/data.ts.
    collected_at = models.CharField(max_length=16, validators=[COLLECTED_AT_VALIDATOR])
    location = models.CharField(max_length=255)
    researcher = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Completed')

    weather_condition = models.CharField(
        max_length=20, choices=WEATHER_CONDITION_CHOICES, null=True, blank=True,
    )
    weather_temperature_c = models.FloatField(null=True, blank=True)
    weather_humidity_pct = models.FloatField(null=True, blank=True)
    weather_wind_kph = models.FloatField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-collected_at', '-sample_id']

    def __str__(self):
        return self.sample_id


def slide_image_upload_to(instance, filename):
    suffix = pathlib.Path(filename).suffix
    return f'reports/{instance.report.sample_id}/slide-{instance.number}{suffix}'


class Slide(models.Model):
    """One microscope slide image within a report. Maps to SpecimenSlide."""

    report = models.ForeignKey(Report, on_delete=models.CASCADE, related_name='slides')
    number = models.PositiveIntegerField()  # 1-based; derives id "{sample_id}-S{number}"
    file_name = models.CharField(max_length=255)  # original client filename, informational
    image = models.ImageField(upload_to=slide_image_upload_to)
    notes = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['number']
        constraints = [
            models.UniqueConstraint(fields=['report', 'number'], name='unique_slide_number_per_report'),
        ]

    def __str__(self):
        return f'{self.report.sample_id}-S{self.number}'


class Species(models.Model):
    """
    The 23-species UPLB pollen catalog — single source of truth for the
    species slug used by Detection/Grain (was a hardcoded SPECIES_CHOICES
    list). Maps to `Species` in app/PolLens/lib/data.ts.
    """

    id = models.SlugField(max_length=32, primary_key=True)
    scientific_name = models.CharField(max_length=100, unique=True)
    common_name = models.CharField(max_length=100, blank=True, default='')
    code = models.CharField(max_length=4, unique=True)
    season = models.CharField(max_length=100, blank=True, default='')
    risk_level = models.CharField(max_length=10, choices=RISK_LEVEL_CHOICES, default='Moderate')
    color = models.CharField(max_length=7)  # CSS hex, e.g. "#2a78d6"
    sort_order = models.PositiveSmallIntegerField(unique=True)  # curated display order

    class Meta:
        ordering = ['sort_order']
        verbose_name_plural = 'species'

    def __str__(self):
        return self.scientific_name


class Detection(models.Model):
    """Per-species summary row for one slide. Maps to SpecimenDetection."""

    slide = models.ForeignKey(Slide, on_delete=models.CASCADE, related_name='detections')
    species = models.ForeignKey(Species, on_delete=models.PROTECT)
    grain_count = models.PositiveIntegerField()
    avg_confidence = models.FloatField(validators=[MinValueValidator(0), MaxValueValidator(1)])

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['slide', 'species'], name='unique_species_per_slide'),
        ]

    def __str__(self):
        return f'{self.slide}:{self.species_id}'


class Grain(models.Model):
    """One boxed grain detection. Maps to DetectedGrain. Optional — a slide may have zero."""

    slide = models.ForeignKey(Slide, on_delete=models.CASCADE, related_name='grains')
    number = models.PositiveIntegerField()  # 1-based; derives id "G{number}"
    species = models.ForeignKey(Species, on_delete=models.PROTECT)
    confidence = models.FloatField(validators=[MinValueValidator(0), MaxValueValidator(1)])
    box_x = models.FloatField()
    box_y = models.FloatField()
    box_width = models.FloatField()
    box_height = models.FloatField()

    class Meta:
        ordering = ['number']
        constraints = [
            models.UniqueConstraint(fields=['slide', 'number'], name='unique_grain_number_per_slide'),
        ]

    def __str__(self):
        return f'{self.slide}:G{self.number}'

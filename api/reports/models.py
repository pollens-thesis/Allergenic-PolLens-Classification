import pathlib
import uuid
import zoneinfo

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator, RegexValidator
from django.db import models, transaction
from django.db.models import Q
from django.utils import timezone

RISK_LEVEL_CHOICES = [
    ('High', 'High'), ('Moderate', 'Moderate'), ('Low', 'Low'),
    # Honest default until the real allergenicity data is entered in admin —
    # the catalog was seeded before any risk levels were known.
    ('Not assessed', 'Not assessed'),
]  # matches Species['riskLevel'] in app/PolLens/lib/data.ts

# The report lifecycle (matches ReportStatus in app/PolLens/lib/data.ts):
#   Pending      — analysed and stored, not yet generated
#   Needs review — generated and awaiting researcher sign-off, or flagged again
#   Completed    — reviewed and signed off
# Completed and Needs review both count in charts and the map.
STATUS_CHOICES = [
    ('Pending', 'Pending'), ('Completed', 'Completed'), ('Needs review', 'Needs review'),
]

# Allowed status changes via PATCH /api/v1/reports/<id>/.
STATUS_TRANSITIONS = {
    'Pending': {'Needs review'},
    'Completed': {'Needs review'},
    'Needs review': {'Completed'},
}

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
    # The lab's calendar year (Asia/Manila), not UTC's: a report saved on
    # 1 January before 08:00 belongs to the new year.
    year = year or timezone.localtime(timezone.now(), zoneinfo.ZoneInfo('Asia/Manila')).year
    with transaction.atomic():
        seq, _ = ReportSequence.objects.select_for_update().get_or_create(
            year=year, defaults={'last_number': 0},
        )
        seq.last_number += 1
        seq.save(update_fields=['last_number'])
        return f'PLN-{year}-{seq.last_number:04d}'


class Report(models.Model):
    """
    A collection session (one microscope batch). Maps to the frontend's
    `Specimen` type (app/PolLens/lib/data.ts). Reports are a shared corpus —
    every authenticated user can read every report (a deliberate decision,
    see docs/system-spec.md); only the `owner` (or staff) may edit, change
    the status of, or delete one. The owner itself is never exposed in the
    API response — only whether the caller may edit (`canEdit`).
    """

    sample_id = models.CharField(max_length=20, unique=True, editable=False)
    report_name = models.CharField(max_length=255, blank=True, default='')
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='reports',
    )

    # Opaque ISO string ("YYYY-MM-DD" or "YYYY-MM-DDTHH:mm") stored as-is —
    # not a DateTimeField, so round-trip fidelity matches the frontend's own
    # string-comparison sort in app/PolLens/lib/data.ts.
    collected_at = models.CharField(max_length=16, validators=[COLLECTED_AT_VALIDATOR])
    location = models.CharField(max_length=255, blank=True)  # required to complete, not while Pending
    researcher = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Completed')
    # The detections came from the detect endpoint's built-in sample
    # (ROBOFLOW_MOCK), not a trained model — shown as a warning on the report.
    sample_detections = models.BooleanField(default=False)

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

    def reviewed_detection_summary(self):
        """Return reviewed pollen counts with model confidence kept separate.

        The persisted Detection and Grain rows remain the model's original
        output. This summary is the result shown to researchers after review:
        verified non-pollen boxes are removed, and manually boxed missed pollen
        is added. Confidence is averaged over retained model grains only.
        Slides from older reports may have summary rows without saved grain
        boxes; those remain unchanged because individual false positives
        cannot be linked to them.
        """
        grains = {grain.pk: grain for grain in self.grains.all()}
        removed_by_species = {}
        missed_by_species = {}
        for annotation in self.annotations.all():
            if annotation.kind == 'missed':
                if annotation.species_id is not None:
                    missed_by_species[annotation.species_id] = (
                        missed_by_species.get(annotation.species_id, 0) + 1
                    )
                continue
            if annotation.kind != 'false_positive' or annotation.grain_id is None:
                continue
            grain = grains.get(annotation.grain_id)
            if grain is None:
                continue
            entry = removed_by_species.setdefault(
                grain.species_id, {'count': 0, 'confidence_sum': 0.0},
            )
            entry['count'] += 1
            entry['confidence_sum'] += grain.confidence

        result_by_species = {}
        for detection in self.detections.all():
            removed = removed_by_species.get(detection.species_id, {})
            model_grain_count = max(0, detection.grain_count - removed.get('count', 0))
            confidence_sum = max(
                0.0,
                detection.avg_confidence * detection.grain_count - removed.get('confidence_sum', 0.0),
            )
            result_by_species[detection.species_id] = {
                'species_id': detection.species_id,
                'grain_count': model_grain_count,
                'confidence_grain_count': model_grain_count,
                'confidence_sum': confidence_sum if model_grain_count else 0.0,
            }

        for species_id, missed_count in missed_by_species.items():
            entry = result_by_species.setdefault(species_id, {
                'species_id': species_id,
                'grain_count': 0,
                'confidence_grain_count': 0,
                'confidence_sum': 0.0,
            })
            entry['grain_count'] += missed_count

        result = []
        for entry in result_by_species.values():
            if entry['grain_count'] == 0:
                continue
            confidence_grain_count = entry['confidence_grain_count']
            result.append({
                'species_id': entry['species_id'],
                'grain_count': entry['grain_count'],
                'confidence_grain_count': confidence_grain_count,
                # Keep the numeric API shape; clients use confidenceGrainCount
                # to display an em dash when there are no model scores.
                'avg_confidence': (
                    entry['confidence_sum'] / confidence_grain_count
                    if confidence_grain_count else 0.0
                ),
            })

        return sorted(result, key=lambda row: (-row['grain_count'], -row['avg_confidence']))


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
    risk_level = models.CharField(max_length=16, choices=RISK_LEVEL_CHOICES, default='Not assessed')
    color = models.CharField(max_length=7)  # CSS hex, e.g. "#2a78d6"
    sort_order = models.PositiveSmallIntegerField(unique=True)  # curated display order

    # Reference content for the Allergen Reference atlas (all editable in the
    # admin). Botanical description only: allergenicity stays in risk_level,
    # which remains "Not assessed" until UPLB supplies it.
    filipino_name = models.CharField(max_length=100, blank=True, default='')
    family = models.CharField(max_length=60, blank=True, default='')
    growth_form = models.CharField(max_length=100, blank=True, default='')
    description = models.TextField(blank=True, default='')
    distribution = models.CharField(max_length=255, blank=True, default='')
    pollination = models.CharField(max_length=60, blank=True, default='')
    info_source = models.CharField(max_length=255, blank=True, default='')
    # A freely licensed photo, bundled with the frontend at photo_url; the
    # credit, license and source page are shown beside it.
    photo_url = models.CharField(max_length=200, blank=True, default='')
    photo_credit = models.CharField(max_length=120, blank=True, default='')
    photo_license = models.CharField(max_length=40, blank=True, default='')
    photo_source = models.URLField(max_length=300, blank=True, default='')

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
        ordering = ['-grain_count', '-avg_confidence']  # richest first, like sortByAbundance
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


class GrainAnnotation(models.Model):
    """Researcher review of a model grain, or a manually added missed grain.

    The model's Grain row is kept unchanged so its original class, confidence,
    and box remain available for evaluation. False-positive annotations are
    excluded from the reviewed result counts; other annotations remain review
    labels alongside the model prediction.
    """

    KIND_CHOICES = [
        ('confirmed', 'Confirmed'),
        ('corrected', 'Corrected'),
        ('false_positive', 'False positive'),
        ('missed', 'Missed grain'),
        ('uncertain', 'Uncertain'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    slide = models.ForeignKey(Slide, on_delete=models.CASCADE, related_name='annotations')
    # Null for a manually drawn grain missed by the model.
    grain = models.ForeignKey(
        Grain, on_delete=models.CASCADE, null=True, blank=True,
        related_name='review_annotations',
    )
    kind = models.CharField(max_length=20, choices=KIND_CHOICES)
    species = models.ForeignKey(Species, on_delete=models.PROTECT, null=True, blank=True)
    box_x = models.FloatField(validators=[MinValueValidator(0), MaxValueValidator(1)])
    box_y = models.FloatField(validators=[MinValueValidator(0), MaxValueValidator(1)])
    box_width = models.FloatField(validators=[MinValueValidator(0), MaxValueValidator(1)])
    box_height = models.FloatField(validators=[MinValueValidator(0), MaxValueValidator(1)])
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='grain_annotations',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['created_at', 'id']
        constraints = [
            models.UniqueConstraint(
                fields=['grain'], condition=Q(grain__isnull=False),
                name='unique_review_annotation_per_grain',
            ),
        ]

    def __str__(self):
        target = f'{self.slide}:G{self.grain.number}' if self.grain_id else f'{self.slide}:missed'
        return f'{target} ({self.kind})'

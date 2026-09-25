from django.contrib import admin

from .models import Detection, Grain, Report, Slide, Species
from .views import delete_image_files


class SlideInline(admin.TabularInline):
    model = Slide
    extra = 0


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ('sample_id', 'collected_at', 'location', 'researcher', 'status', 'owner')
    search_fields = ('sample_id', 'location', 'researcher')
    inlines = [SlideInline]

    # Deleting here removes the slide images too, like DELETE /api/v1/reports/<id>/.
    def delete_model(self, request, obj):
        images = [slide.image for slide in obj.slides.all() if slide.image]
        super().delete_model(request, obj)
        delete_image_files(images)

    def delete_queryset(self, request, queryset):
        images = [s.image for s in Slide.objects.filter(report__in=queryset) if s.image]
        super().delete_queryset(request, queryset)
        delete_image_files(images)


@admin.register(Species)
class SpeciesAdmin(admin.ModelAdmin):
    list_display = ('sort_order', 'id', 'scientific_name', 'common_name', 'code', 'season', 'risk_level', 'color')
    list_editable = ('common_name', 'season', 'risk_level', 'color')
    ordering = ('sort_order',)
    search_fields = ('id', 'scientific_name', 'common_name')


admin.site.register(Slide)
admin.site.register(Detection)
admin.site.register(Grain)

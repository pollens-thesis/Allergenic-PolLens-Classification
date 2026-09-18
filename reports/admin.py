from django.contrib import admin

from .models import Detection, Grain, Report, Slide, Species


class SlideInline(admin.TabularInline):
    model = Slide
    extra = 0


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ('sample_id', 'collected_at', 'location', 'researcher', 'status', 'owner')
    search_fields = ('sample_id', 'location', 'researcher')
    inlines = [SlideInline]


@admin.register(Species)
class SpeciesAdmin(admin.ModelAdmin):
    list_display = ('sort_order', 'id', 'scientific_name', 'common_name', 'code', 'season', 'risk_level', 'color')
    list_editable = ('common_name', 'season', 'risk_level', 'color')
    ordering = ('sort_order',)
    search_fields = ('id', 'scientific_name', 'common_name')


admin.site.register(Slide)
admin.site.register(Detection)
admin.site.register(Grain)

from django.contrib import admin

from .models import Detection, Grain, Report, Slide


class SlideInline(admin.TabularInline):
    model = Slide
    extra = 0


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ('sample_id', 'collected_at', 'location', 'researcher', 'status', 'owner')
    search_fields = ('sample_id', 'location', 'researcher')
    inlines = [SlideInline]


admin.site.register(Slide)
admin.site.register(Detection)
admin.site.register(Grain)

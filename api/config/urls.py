"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.conf import settings

from . import checks  # noqa: F401 — registers the deploy checks
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from accounts.views import (
    GoogleLoginView,
    LogoutView,
    MeView,
    MicrosoftLoginView,
    UserDetailView,
    UserListView,
)
from reports.views import (
    DetectView,
    ReportAnnotationDetailView,
    ReportDetailView,
    ReportListCreateView,
    ReportMonthlyCountsView,
    ReportResubmitView,
    ReportVerifyView,
    SpeciesDetailView,
    SpeciesListView,
    SpeciesPhotoView,
    WeatherView,
)

def healthz(request):
    """Liveness probe for the host's health check: no auth, no database."""
    return JsonResponse({'status': 'ok'})


urlpatterns = [
    path('healthz/', healthz, name='healthz'),
    path('admin/', admin.site.urls),
    path('api/v1/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/v1/auth/google/', GoogleLoginView.as_view(), name='google_login'),
    path('api/v1/auth/microsoft/', MicrosoftLoginView.as_view(), name='microsoft_login'),
    path('api/v1/auth/logout/', LogoutView.as_view(), name='logout'),
    path('api/v1/auth/me/', MeView.as_view(), name='me'),
    path('api/v1/reports/', ReportListCreateView.as_view(), name='report_list_create'),
    # Must come before <str:sample_id>/ or that dynamic segment swallows
    # "monthly-counts" as a sample id — Django matches patterns in order.
    path('api/v1/reports/monthly-counts/', ReportMonthlyCountsView.as_view(), name='report_monthly_counts'),
    path('api/v1/reports/species/', SpeciesListView.as_view(), name='species_list'),
    path('api/v1/reports/species/<slug:species_id>/', SpeciesDetailView.as_view(), name='species_detail'),
    path('api/v1/reports/species/<slug:species_id>/photo/', SpeciesPhotoView.as_view(), name='species_photo'),
    path('api/v1/reports/detect/', DetectView.as_view(), name='report_detect'),
    path('api/v1/reports/weather/', WeatherView.as_view(), name='report_weather'),
    path(
        'api/v1/reports/<str:sample_id>/annotations/<uuid:annotation_id>/',
        ReportAnnotationDetailView.as_view(), name='report_annotation_detail',
    ),
    path(
        'api/v1/reports/<str:sample_id>/verify/',
        ReportVerifyView.as_view(), name='report_verify',
    ),
    path(
        'api/v1/reports/<str:sample_id>/resubmit/',
        ReportResubmitView.as_view(), name='report_resubmit',
    ),
    path('api/v1/reports/<str:sample_id>/', ReportDetailView.as_view(), name='report_detail'),
    path('api/v1/users/', UserListView.as_view(), name='user_list'),
    path('api/v1/users/<int:user_id>/', UserDetailView.as_view(), name='user_detail'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

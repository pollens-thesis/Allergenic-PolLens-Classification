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
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

from accounts.views import GoogleLoginView, LogoutView, MeView
from reports.views import (
    DetectView,
    ReportDetailView,
    ReportListCreateView,
    ReportMonthlyCountsView,
    SpeciesListView,
)

urlpatterns = [
    path('admin/', admin.site.urls),
    # Scaffolding placeholder — there is no username/password login; real
    # login is GoogleLoginView below. See the Auth section of api/CLAUDE.md.
    path('api/v1/auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/v1/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/v1/auth/google/', GoogleLoginView.as_view(), name='google_login'),
    path('api/v1/auth/logout/', LogoutView.as_view(), name='logout'),
    path('api/v1/auth/me/', MeView.as_view(), name='me'),
    path('api/v1/reports/', ReportListCreateView.as_view(), name='report_list_create'),
    # Must come before <str:sample_id>/ or that dynamic segment swallows
    # "monthly-counts" as a sample id — Django matches patterns in order.
    path('api/v1/reports/monthly-counts/', ReportMonthlyCountsView.as_view(), name='report_monthly_counts'),
    path('api/v1/reports/species/', SpeciesListView.as_view(), name='species_list'),
    path('api/v1/reports/detect/', DetectView.as_view(), name='report_detect'),
    path('api/v1/reports/<str:sample_id>/', ReportDetailView.as_view(), name='report_detail'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

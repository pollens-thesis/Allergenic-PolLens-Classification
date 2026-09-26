"""
Django settings for config project.

For more information on this file, see
https://docs.djangoproject.com/en/6.1/topics/settings/

For the full list of settings and their values, see
https://docs.djangoproject.com/en/6.1/ref/settings/
"""

from datetime import timedelta
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv
import os
import sys

from .dburl import database_from_url

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / '.env')


def env_bool(name, default=False):
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in ('1', 'true', 'yes', 'on')


def env_list(name, default=''):
    value = os.environ.get(name, default)
    return [item.strip() for item in value.split(',') if item.strip()]


# SECURITY WARNING: don't run with debug turned on in production!
# Off unless explicitly enabled — a deploy that forgets the variable must not
# come up in debug mode. Local dev sets DJANGO_DEBUG=true in .env.
DEBUG = env_bool('DJANGO_DEBUG', False)

# SECURITY WARNING: keep the secret key used in production secret!
# The committed fallback key is only ever acceptable in DEBUG.
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', '')
if not SECRET_KEY:
    if not DEBUG:
        raise ImproperlyConfigured('DJANGO_SECRET_KEY must be set when DJANGO_DEBUG is off.')
    SECRET_KEY = 'django-insecure-)y9p7_7dye9f5q*-+e=gowqr3!0ihfhwm@87xs(ks!390a4sv2'

ALLOWED_HOSTS = env_list('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1')
# Render sets this to the service's own hostname (xxx.onrender.com), so the
# deployed API trusts itself without a hand-copied value.
RENDER_EXTERNAL_HOSTNAME = os.environ.get('RENDER_EXTERNAL_HOSTNAME', '')
if RENDER_EXTERNAL_HOSTNAME:
    ALLOWED_HOSTS.append(RENDER_EXTERNAL_HOSTNAME)


# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',

    'accounts',
    'reports',
]

AUTH_USER_MODEL = 'accounts.User'

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    # Serves collectstatic output (the Django admin's CSS/JS) in production.
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'


# Database
# https://docs.djangoproject.com/en/6.1/ref/settings/#databases
#
# Falls back to sqlite for zero-config local development. Point at PostgreSQL
# with either DATABASE_URL (one connection string, as Neon's dashboard shows
# it — preferred) or the separate DATABASE_* variables (see .env.example).

if os.environ.get('DATABASE_URL'):
    DATABASES = {'default': database_from_url(os.environ['DATABASE_URL'])}
elif os.environ.get('DATABASE_NAME'):
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.environ['DATABASE_NAME'],
            'USER': os.environ.get('DATABASE_USER', 'postgres'),
            'PASSWORD': os.environ.get('DATABASE_PASSWORD', ''),
            'HOST': os.environ.get('DATABASE_HOST', 'localhost'),
            'PORT': os.environ.get('DATABASE_PORT', '5432'),
            'OPTIONS': {'sslmode': os.environ.get('DATABASE_SSLMODE', 'require')},
            'CONN_MAX_AGE': 600,
            # A connection the server has since closed (Neon suspends idle
            # databases) is detected and replaced instead of failing the request.
            'CONN_HEALTH_CHECKS': True,
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }


# Password validation
# https://docs.djangoproject.com/en/6.1/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Django REST Framework

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'accounts.authentication.AllowlistedJWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    # Coarse abuse limits. /detect/ proxies a paid upstream model and the
    # login endpoints are unauthenticated, so they get their own tighter scopes.
    'DEFAULT_THROTTLE_CLASSES': (
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
        'rest_framework.throttling.ScopedRateThrottle',
    ),
    'DEFAULT_THROTTLE_RATES': {
        # Per IP — a whole campus can share one NAT address, and token
        # refreshes count here too.
        'anon': os.environ.get('THROTTLE_ANON', '600/hour'),
        'user': os.environ.get('THROTTLE_USER', '5000/hour'),
        'detect': os.environ.get('THROTTLE_DETECT', '600/hour'),
        'login': os.environ.get('THROTTLE_LOGIN', '30/minute'),
    },
}

# The test suite makes hundreds of requests in one process and the throttle
# counters live in the (process-wide) cache, so real limits would make tests
# fail depending on run order. Same classes, effectively unlimited rates.
if sys.argv[1:2] == ['test']:
    REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'] = {
        scope: '100000/minute' for scope in REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']
    }
    # Uploaded test images go to a throwaway folder, never the real media/.
    import atexit
    import shutil
    import tempfile
    MEDIA_ROOT = Path(tempfile.mkdtemp(prefix='pollens-test-media-'))
    atexit.register(shutil.rmtree, MEDIA_ROOT, ignore_errors=True)

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'USER_AUTHENTICATION_RULE': 'accounts.access.user_can_authenticate',
    'TOKEN_REFRESH_SERIALIZER': 'accounts.serializers.SafeTokenRefreshSerializer',
}


# CORS
# Frontend (app/PolLens/, Next.js) runs on a different origin in dev.

CORS_ALLOWED_ORIGINS = env_list(
    'CORS_ALLOWED_ORIGINS',
    # The localhost default is for development only; production must name its site.
    'http://localhost:3000,http://127.0.0.1:3000' if DEBUG else '',
)
# Optional, e.g. r"^https://pollens-[a-z0-9-]+\.vercel\.app$" for Vercel
# preview deployments, whose URLs change per branch.
# Separated by ";" — a regex can itself contain commas ({1,3}).
CORS_ALLOWED_ORIGIN_REGEXES = [
    r.strip() for r in os.environ.get('CORS_ALLOWED_ORIGIN_REGEXES', '').split(';') if r.strip()
]

# The API itself is token-authenticated (no CSRF), but the Django admin uses
# sessions and, served over HTTPS, needs its own origin listed here (added
# automatically on Render, below).
CSRF_TRUSTED_ORIGINS = env_list('CSRF_TRUSTED_ORIGINS')
if RENDER_EXTERNAL_HOSTNAME:
    CSRF_TRUSTED_ORIGINS.append(f'https://{RENDER_EXTERNAL_HOSTNAME}')


# Google OAuth
# Login is via Google ID token exchange — see accounts.views.GoogleLoginView.

GOOGLE_OAUTH_CLIENT_ID = os.environ.get('GOOGLE_OAUTH_CLIENT_ID', '')

# Microsoft (Entra ID) sign-in — see accounts.views.MicrosoftLoginView. The
# Application (client) ID of a multitenant app registration; any work/school
# account can authenticate, and the allowlist below decides who gets in.
MICROSOFT_CLIENT_ID = os.environ.get('MICROSOFT_CLIENT_ID', '')

# Who may sign in (accounts.access). A domain admits its subdomains too.
# Both empty admits nobody.
SIGNIN_ALLOWED_DOMAINS = [
    d.lower() for d in env_list('SIGNIN_ALLOWED_DOMAINS', 'up.edu.ph,mseuf.edu.ph')
]
SIGNIN_ALLOWED_EMAILS = [e.lower() for e in env_list('SIGNIN_ALLOWED_EMAILS')]


# Roboflow
# Grain detection proxy — see reports.views.DetectView. The model isn't
# deployed yet as of this writing; these are left blank until it is.

ROBOFLOW_API_KEY = os.environ.get('ROBOFLOW_API_KEY', '')
ROBOFLOW_MODEL_ID = os.environ.get('ROBOFLOW_MODEL_ID', '')  # e.g. "workspace-slug/model-slug"
ROBOFLOW_MODEL_VERSION = os.environ.get('ROBOFLOW_MODEL_VERSION', '')
# Serve reports/fixtures/roboflow_detect_response.json (Roboflow's real
# response shape) instead of calling Roboflow, so the Analyze flow works
# end-to-end before the model exists. Going live: fill the three vars
# above and set this to false — no code changes.
ROBOFLOW_MOCK = env_bool('ROBOFLOW_MOCK', False)


# Weather comes from Open-Meteo (free, no key) — see reports.views.WeatherView.


# Internationalization
# https://docs.djangoproject.com/en/6.1/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/6.1/howto/static-files/

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'


# Media (uploaded slide images — reports.Slide.image)
#
# Local dev: files on disk under MEDIA_ROOT, served by config/urls.py's
# static() helper under DEBUG.
#
# Production (AWS_STORAGE_BUCKET_NAME set): an S3-compatible bucket —
# Cloudflare R2 in the deployment runbook (../docs/deployment.md). Hosts like
# Render wipe local disk on every deploy, so uploads can't live there. The
# bucket stays private and image URLs are presigned and expire: slide paths
# are guessable (reports/PLN-2026-0001/slide-1.jpg), so public URLs would
# expose every specimen. SlideSerializer's build_absolute_uri passes the
# already-absolute presigned URL through unchanged.

MEDIA_URL = 'media/'
MEDIA_ROOT = BASE_DIR / 'media'

AWS_STORAGE_BUCKET_NAME = os.environ.get('AWS_STORAGE_BUCKET_NAME', '')

STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {
        # Plain storage under DEBUG so tests/dev don't need collectstatic's manifest.
        'BACKEND': (
            'django.contrib.staticfiles.storage.StaticFilesStorage'
            if DEBUG
            else 'whitenoise.storage.CompressedManifestStaticFilesStorage'
        ),
    },
}

if AWS_STORAGE_BUCKET_NAME:
    STORAGES['default'] = {'BACKEND': 'storages.backends.s3.S3Storage'}
    AWS_ACCESS_KEY_ID = os.environ.get('AWS_ACCESS_KEY_ID', '')
    AWS_SECRET_ACCESS_KEY = os.environ.get('AWS_SECRET_ACCESS_KEY', '')
    # R2: https://<account-id>.r2.cloudflarestorage.com
    AWS_S3_ENDPOINT_URL = os.environ.get('AWS_S3_ENDPOINT_URL', '') or None
    AWS_S3_REGION_NAME = os.environ.get('AWS_S3_REGION_NAME', 'auto')
    AWS_S3_SIGNATURE_VERSION = 's3v4'
    AWS_S3_ADDRESSING_STYLE = 'virtual'
    AWS_DEFAULT_ACL = None  # R2 has no ACLs; access is the bucket's (private)
    AWS_S3_FILE_OVERWRITE = False
    AWS_QUERYSTRING_AUTH = True
    AWS_QUERYSTRING_EXPIRE = int(os.environ.get('AWS_QUERYSTRING_EXPIRE', '3600'))

# A multi-slide report batch (several microscope photos in one POST) can
# exceed Django's 2.5MB default multipart/memory limits.
DATA_UPLOAD_MAX_MEMORY_SIZE = 25 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 25 * 1024 * 1024

# Per-image limit enforced by reports.images.check_slide_image (the settings
# above only tune buffering). 25 MB is the paper's upload limit.
MAX_SLIDE_IMAGE_BYTES = int(os.environ.get('MAX_SLIDE_IMAGE_MB', '25')) * 1024 * 1024
MAX_SLIDE_IMAGE_PIXELS = int(os.environ.get('MAX_SLIDE_IMAGE_MEGAPIXELS', '60')) * 1_000_000


DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'


# HTTPS — production only. Render (like most PaaS) terminates TLS at its proxy
# and forwards plain HTTP with X-Forwarded-Proto; trusting that header is what
# makes request.is_secure() — and so the absolute image URLs — say https.

if not DEBUG:
    # Exactly one proxy (Render's) sits in front: throttles key on the real
    # client address, not on a spoofable X-Forwarded-For string.
    REST_FRAMEWORK['NUM_PROXIES'] = 1
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_SSL_REDIRECT = env_bool('DJANGO_SECURE_SSL_REDIRECT', True)
    SECURE_REDIRECT_EXEMPT = [r'^healthz/$']  # the platform health check may probe over HTTP
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    # Start short; raise once the deployment is known-good (HSTS is sticky in browsers).
    SECURE_HSTS_SECONDS = int(os.environ.get('DJANGO_HSTS_SECONDS', '86400'))

# No email is sent by this app, so Django's default (SMTP) backend is left in
# place. HSTS includeSubDomains/preload are deliberately off: the API lives on
# a shared host domain (onrender.com) it doesn't own.
SILENCED_SYSTEM_CHECKS = ['security.W005', 'security.W021']


# Logging — errors to stdout, where Render's log viewer picks them up.

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {'console': {'class': 'logging.StreamHandler'}},
    'root': {'handlers': ['console'], 'level': 'WARNING'},
    'loggers': {
        'django': {'handlers': ['console'], 'level': 'INFO', 'propagate': False},
    },
}


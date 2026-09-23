"""
Django settings for config project.

For more information on this file, see
https://docs.djangoproject.com/en/6.1/topics/settings/

For the full list of settings and their values, see
https://docs.djangoproject.com/en/6.1/ref/settings/
"""

from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv
import os

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


# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.environ.get(
    'DJANGO_SECRET_KEY',
    'django-insecure-)y9p7_7dye9f5q*-+e=gowqr3!0ihfhwm@87xs(ks!390a4sv2',
)

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = env_bool('DJANGO_DEBUG', True)

ALLOWED_HOSTS = env_list('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1')


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
# Falls back to sqlite for zero-config local development. Set DATABASE_*
# env vars (see .env.example) to point at PostgreSQL.

if os.environ.get('DATABASE_NAME'):
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
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
}


# CORS
# Frontend (app/PolLens/, Next.js) runs on a different origin in dev.

CORS_ALLOWED_ORIGINS = env_list(
    'CORS_ALLOWED_ORIGINS', 'http://localhost:3000,http://127.0.0.1:3000'
)


# Google OAuth
# Login is via Google ID token exchange — see accounts.views.GoogleLoginView.

GOOGLE_OAUTH_CLIENT_ID = os.environ.get('GOOGLE_OAUTH_CLIENT_ID', '')


# Roboflow
# Grain detection proxy — see reports.views.DetectView. The model isn't
# deployed yet as of this writing; these are left blank until it is.

ROBOFLOW_API_KEY = os.environ.get('ROBOFLOW_API_KEY', '')
ROBOFLOW_MODEL_ID = os.environ.get('ROBOFLOW_MODEL_ID', '')  # e.g. "workspace-slug/model-slug"
ROBOFLOW_MODEL_VERSION = os.environ.get('ROBOFLOW_MODEL_VERSION', '')


# OpenWeather
# Weather lookup for the Analyze screen — see reports.views.WeatherView.

OPENWEATHER_API_KEY = os.environ.get('OPENWEATHER_API_KEY', '')


# Internationalization
# https://docs.djangoproject.com/en/6.1/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/6.1/howto/static-files/

STATIC_URL = 'static/'


# Media (uploaded slide images — reports.Slide.image)
# Dev-only: served from local disk via config/urls.py's static() helper
# under DEBUG. Production media storage (S3/Cloud Storage) is out of scope
# for now.

MEDIA_URL = 'media/'
MEDIA_ROOT = BASE_DIR / 'media'

# A multi-slide report batch (several microscope photos in one POST) can
# exceed Django's 2.5MB default multipart/memory limits.
DATA_UPLOAD_MAX_MEMORY_SIZE = 25 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 25 * 1024 * 1024


DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'


# Email
# https://docs.djangoproject.com/en/6.1/topics/email/#topic-email-configuration

MAILERS = {
    'default': {
        'BACKEND': 'django.core.mail.backends.console.EmailBackend',
    },
}

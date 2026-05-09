"""
Django settings for backend project.
"""

from pathlib import Path
from dotenv import load_dotenv
import os

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get("SECRET_KEY", "django-insecure-change-me")

DEBUG = os.environ.get("DEBUG", "False") == "True"

ALLOWED_HOSTS = [
    "localhost",
    "127.0.0.1",
    ".onrender.com",
]

CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "https://localhost:5173",
    "https://pulsenet-fiicode.netlify.app"
]

# --- FIX: CROSS-DOMAIN COOKIE SETTINGS ---
CSRF_COOKIE_NAME = "csrftoken"
# Must be True for cross-origin (SameSite=None), but allows HTTP for local testing if DEBUG is True
CSRF_COOKIE_SECURE = True if not DEBUG else False
CSRF_COOKIE_HTTPONLY = False
CSRF_COOKIE_SAMESITE = "None" if not DEBUG else "Lax"

CSRF_TRUSTED_ORIGINS = [
    "http://localhost:5173",
    "https://localhost:5173",
    "https://pulsenet-fiicode.netlify.app",
    "https://pulsenet-45is.onrender.com", # <-- FIX 1: Allows you to log into the Render admin panel!
]

SESSION_COOKIE_NAME = "session"
SESSION_COOKIE_SECURE = True if not DEBUG else False
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "None" if not DEBUG else "Lax"
SESSION_EXPIRE_AT_BROWSER_CLOSE = True

INSTALLED_APPS = [
    "django_extensions",
    "cloudinary_storage",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "cloudinary",
    "django.contrib.gis",
    "corsheaders",
    "apps.accounts",
    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    "allauth.socialaccount.providers.google",
    "channels",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "allauth.account.middleware.AccountMiddleware",
]

AUTH_USER_MODEL = "accounts.User"

AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
    "allauth.account.auth_backends.AuthenticationBackend",
]

LOGIN_REDIRECT_URL = "http://localhost:5173/home"
SITE_ID = 1

ROOT_URLCONF = "backend.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

SOCIALACCOUNT_PROVIDERS = {
    "google": {
        "APP": {
            "client_id": os.environ.get("client_id_Google", ""),
            "secret": os.environ.get("secret_Google", ""),
            "key": "",
        },
        "REDIRECT_URI": "http://localhost:8000/accounts/google/login/callback/",
    }
}

ACCOUNT_AUTHENTICATION_METHOD = "email"
ACCOUNT_EMAIL_REQUIRED = True
ACCOUNT_USERNAME_REQUIRED = False

WSGI_APPLICATION = "backend.wsgi.application"
ASGI_APPLICATION = "backend.asgi.application"

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [
                os.environ.get("REDIS_URL", "redis://localhost:6379/0"),
            ],
        },
    },
}

DATABASES = {
    "default": {
        "ENGINE": "django.contrib.gis.db.backends.postgis",
        "NAME": os.environ.get("db_name", ""),
        "USER": os.environ.get("db_user", ""),
        "PASSWORD": os.environ.get("db_password", ""),
        "HOST": os.environ.get("db_host", ""),
        "PORT": os.environ.get("db_port", "5432"),
        "OPTIONS": {
            "sslmode": "require",
        },
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]

LANGUAGE_CODE = "ro-ro"
TIME_ZONE = "Europe/Bucharest"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# --- CLOUDINARY & STORAGE CONFIGURATION ---
CLOUDINARY_STORAGE = {
    'CLOUDINARY_URL': os.environ.get('CLOUDINARY_URL')
}

STORAGES = {
    "default": {
        "BACKEND": "cloudinary_storage.storage.MediaCloudinaryStorage",
    },
    "staticfiles": {
        # FIX 2: Removed "Manifest" to prevent 500 errors if collectstatic isn't perfect
        "BACKEND": "whitenoise.storage.CompressedStaticFilesStorage",
    },
}
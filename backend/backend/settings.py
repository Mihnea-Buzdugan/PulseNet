"""
Django settings for backend project.
"""

from pathlib import Path
from dotenv import load_dotenv
from datetime import timedelta
import os
import urllib.parse
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get("SECRET_KEY", "django-insecure-change-me")

DEBUG = os.environ.get("DEBUG", "True") == "True"

# =========================================================
# DOMAINS
# =========================================================

FRONTEND_URL = os.environ.get(
    "FRONTEND_URL",
    "http://localhost:5173"
)

BACKEND_URL = os.environ.get(
    "BACKEND_URL",
    "http://127.0.0.1:8000"
)

ALLOWED_HOSTS = [
    "localhost",
    "127.0.0.1",
    ".onrender.com",
]

# =========================================================
# CORS / CSRF
# =========================================================

CORS_ALLOW_CREDENTIALS = True

CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "https://localhost:5173",
    "https://pulsenet1.netlify.app",
    "https://pulsenet-45is.onrender.com",
]

CSRF_TRUSTED_ORIGINS = [
    "http://localhost:5173",
    "https://localhost:5173",
    "https://pulsenet1.netlify.app",
    "https://pulsenet-45is.onrender.com",
]

# =========================================================
# COOKIES
# =========================================================

CSRF_COOKIE_NAME = "csrftoken"
CSRF_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_HTTPONLY = False
CSRF_COOKIE_SAMESITE = "None" if not DEBUG else "Lax"

SESSION_COOKIE_NAME = "session"
SESSION_COOKIE_SECURE = not DEBUG
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "None" if not DEBUG else "Lax"
SESSION_EXPIRE_AT_BROWSER_CLOSE = True

# =========================================================
# INSTALLED APPS
# =========================================================

INSTALLED_APPS = [
    "django_extensions",

    # Django
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.gis",

    # Third party
    "corsheaders",
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",

    "cloudinary",
    "cloudinary_storage",

    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    "allauth.socialaccount.providers.google",

    "channels",

    # Apps
    "apps.accounts",
]

# =========================================================
# MIDDLEWARE
# =========================================================

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

# =========================================================
# AUTH
# =========================================================

AUTH_USER_MODEL = "accounts.User"

AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
    "allauth.account.auth_backends.AuthenticationBackend",
]

ACCOUNT_AUTHENTICATION_METHOD = "email"
ACCOUNT_EMAIL_REQUIRED = True
ACCOUNT_USERNAME_REQUIRED = False

LOGIN_REDIRECT_URL = f"{FRONTEND_URL}/home"

SITE_ID = 1

# =========================================================
# URLS
# =========================================================

ROOT_URLCONF = "backend.urls"

# =========================================================
# TEMPLATES
# =========================================================

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

# =========================================================
# GOOGLE AUTH
# =========================================================

SOCIALACCOUNT_PROVIDERS = {
    "google": {
        "APP": {
            "client_id": os.environ.get("client_id_Google", ""),
            "secret": os.environ.get("secret_Google", ""),
            "key": "",
        }
    }
}

# =========================================================
# DJANGO REST FRAMEWORK
# =========================================================

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ),

    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
}

# =========================================================
# JWT
# =========================================================

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60000),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=70),

    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,

    "AUTH_HEADER_TYPES": ("Bearer",),

    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

# =========================================================
# WSGI / ASGI
# =========================================================

WSGI_APPLICATION = "backend.wsgi.application"
ASGI_APPLICATION = "backend.asgi.application"

# =========================================================
# WEBSOCKETS / CHANNELS
# =========================================================

REDIS_URL = os.environ.get("REDIS_URL", "")
url = urllib.parse.urlparse(REDIS_URL)

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [{
                "address": REDIS_URL,
                # If using rediss://, this ensures SSL is handled correctly
                "ssl_cert_reqs": None
            }],
        },
    },
}

# =========================================================
# DATABASE
# =========================================================

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

# =========================================================
# PASSWORD VALIDATORS
# =========================================================

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

# =========================================================
# INTERNATIONALIZATION
# =========================================================

LANGUAGE_CODE = "ro-ro"

TIME_ZONE = "Europe/Bucharest"

USE_I18N = True
USE_TZ = True

# =========================================================
# STATIC FILES
# =========================================================

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

STATICFILES_STORAGE = (
    "whitenoise.storage.CompressedStaticFilesStorage"
)

# =========================================================
# MEDIA FILES
# =========================================================

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# =========================================================
# CLOUDINARY
# =========================================================

CLOUDINARY_STORAGE = {
    "CLOUDINARY_URL": os.environ.get("CLOUDINARY_URL")
}

STORAGES = {
    "default": {
        "BACKEND": "cloudinary_storage.storage.MediaCloudinaryStorage",
    },

    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedStaticFilesStorage",
    },
}
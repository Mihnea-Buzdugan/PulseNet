from django.contrib import admin
from django.http import JsonResponse
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

def health_check(request):
    return JsonResponse({"status": "ok"})

urlpatterns = [
    path("", health_check),

    path("admin/", admin.site.urls),

    path("api/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),

    # YOUR API
    path("accounts/", include("apps.accounts.urls")),

    # ALLAUTH
    path("auth/", include("allauth.urls")),

] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
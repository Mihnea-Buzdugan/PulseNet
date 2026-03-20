from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django import forms
from django.contrib.gis.geos import Point
from .models import (
    User, Follow, Friendship, PendingFollow, Pulse, PulseImage,
    Group_Conversation, DirectConversation, FavoritePulse,
    PulseRental, Alert, AlertImage, PulseComment,
    PulseRating, Notification, UrgentRequest, AlertReport, AlertConfirm, UrgentRequestImage, RequestComment
)

class LocationAdminForm(forms.ModelForm):
    lat = forms.FloatField(required=False, label="Latitude")
    lng = forms.FloatField(required=False, label="Longitude")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance and self.instance.location:
            self.fields['lat'].initial = self.instance.location.y
            self.fields['lng'].initial = self.instance.location.x

    def save(self, commit=True):
        lat = self.cleaned_data.get('lat')
        lng = self.cleaned_data.get('lng')
        if lat is not None and lng is not None:
            self.instance.location = Point(lng, lat, srid=4326)
        return super().save(commit=commit)

# --- Configurări Admin ---

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    form = LocationAdminForm
    fieldsets = UserAdmin.fieldsets + (
        ('Custom Profile', {'fields': ('profile_picture', 'biography', 'lat', 'lng', 'visibility_radius', 'quiet_hours_start', 'quiet_hours_end', 'online_status')}),
    )

@admin.register(Pulse)
class PulseAdmin(admin.ModelAdmin):
    form = LocationAdminForm
    list_display = ('title', 'user', 'pulse_type', 'price', 'created_at')
    exclude = ('location',)

@admin.register(Alert)
class AlertAdmin(admin.ModelAdmin):
    form = LocationAdminForm
    list_display = ('title', 'user', 'category', 'is_active', 'created_at')
    readonly_fields = ('created_at',)  # Make sure Django knows it's read-only
    exclude = ('location',)

@admin.register(UrgentRequest)
class UrgentRequestAdmin(admin.ModelAdmin):
    form = LocationAdminForm
    exclude = ('location',)

admin.site.register([
    Follow, Friendship, PendingFollow, PulseImage,
    Group_Conversation, DirectConversation, FavoritePulse,
    PulseRental, AlertImage, PulseComment,
    PulseRating, Notification, AlertReport, AlertConfirm, UrgentRequestImage, RequestComment
])
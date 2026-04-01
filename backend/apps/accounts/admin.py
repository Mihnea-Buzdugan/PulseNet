from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django import forms
from django.contrib.gis.geos import Point
from .models import (
    User, Follow, Friendship, PendingFollow, Pulse, PulseImage,
    Group_Conversation, DirectConversation, FavoritePulse,
    PulseRental, Alert, AlertImage, PulseComment,
    PulseRating, Notification, UrgentRequest, AlertReport, AlertConfirm, UrgentRequestImage, RequestComment,
    UrgentRequestOffer, DirectMessage, Group_Message, AlertComment, PulseRentalSignal
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

    # Adding 'banned_until' to your existing fieldsets
    fieldsets = UserAdmin.fieldsets + (
        ('Custom Profile', {
            'fields': (
                'profile_picture', 'biography', 'lat', 'lng', 'trust_score',
                'visibility_radius', 'quiet_hours_start', 'quiet_hours_end',
                'online_status', 'private_account',
                'banned_until', 'public_key','is_verified',
            )
        }),
    )

    # This makes the ban status visible in the main list view
    list_display = ('email', 'username', 'is_banned_status', 'banned_until')

    @admin.display(boolean=True, description='Currently Banned')
    def is_banned_status(self, obj):
        return obj.is_banned  # This calls your @property from models.py

@admin.register(Pulse)
class PulseAdmin(admin.ModelAdmin):
    form = LocationAdminForm
    list_display = ('title', 'user', 'pulse_type', 'price', 'created_at')
    exclude = ('location',)

@admin.register(Alert)
class AlertAdmin(admin.ModelAdmin):
    form = LocationAdminForm
    list_display = ('title', 'user', 'category', 'is_active', 'created_at', 'is_verified')
    readonly_fields = ('created_at',)  # Make sure Django knows it's read-only
    exclude = ('location',)

@admin.register(UrgentRequest)
class UrgentRequestAdmin(admin.ModelAdmin):
    form = LocationAdminForm
    exclude = ('location',)

admin.site.register([
    Follow, Friendship, PendingFollow, PulseImage,
    Group_Conversation, DirectConversation, FavoritePulse,
    PulseRental, AlertImage, PulseComment, DirectMessage, Group_Message,
    PulseRating, Notification, AlertReport, AlertConfirm, UrgentRequestImage, RequestComment, UrgentRequestOffer, AlertComment, PulseRentalSignal
])
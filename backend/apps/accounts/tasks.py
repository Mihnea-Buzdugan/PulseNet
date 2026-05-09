import os
import pickle

from asgiref.sync import async_to_sync
from celery import shared_task
import requests
from channels.layers import get_channel_layer
from django.contrib.gis.geos import Point
from django.utils import timezone
from datetime import timedelta
from django.core.cache import cache
from pgvector.django import CosineDistance
from sentence_transformers import SentenceTransformer
from django.contrib.gis.measure import D
# Import your models and logic
from .models import Alert, UrgentRequest, User, Notification, Pulse, UrgentRequestOffer, PulseRental, AlertConfirm
from .utils import find_heroes_for_urgent_requests, process_pet_image_and_find_matches, calculate_trust_score
from django.apps import apps

_model = None

def get_model():
    global _model
    if _model is None:
        _model = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")
    return _model

# --- MAINTENANCE TASKS ---

@shared_task(name="apps.accounts.tasks.delete_expired_urgent_requests")
def delete_expired_urgent_requests():
    now = timezone.now()
    expired = UrgentRequest.objects.filter(expires_at__lte=now)
    count = expired.count()
    if count:
        expired.delete()
    return f"Deleted {count} expired urgent requests"

@shared_task(name="apps.accounts.tasks.delete_old_alerts")
def delete_old_alerts():
    now = timezone.now()

    weather_cutoff = now - timedelta(hours=24)
    deactivated_count = Alert.objects.filter(
        category="weather",
        is_active=True,
        created_at__lte=weather_cutoff
    ).update(is_active=False)

    hard_delete_cutoff = now - timedelta(days=20)
    expired_alerts = Alert.objects.filter(created_at__lte=hard_delete_cutoff)

    deleted_count, _ = expired_alerts.delete()
    return f"Deactivated {deactivated_count} weather alerts (older than 24h). Deleted {deleted_count} alerts (older than 20 days)."

@shared_task(name="apps.accounts.tasks.delete_old_request_offers")
def delete_old_request_offers():
    cutoff = timezone.now() - timedelta(days=10)
    old_offers = UrgentRequestOffer.objects.filter(created_at__lte=cutoff)
    count, _ = old_offers.delete()
    return f"Deleted {count} request offers older than 10 days"

@shared_task(name="apps.accounts.tasks.delete_old_pulse_rentals")
def delete_old_pulse_rentals():
    cutoff = timezone.now() - timedelta(days=7)
    old_rentals = PulseRental.objects.filter(end_date__lte=cutoff)
    count, _ = old_rentals.delete()
    return f"Deleted {count} pulse rentals ended more than 7 days ago"

# --- HERO SEARCH TASKS ---

@shared_task(name="apps.accounts.tasks.run_hero_search_task")
def run_hero_search_task(request_id):
    """Runs the search for a specific single request."""
    # This calls the function in your utils.py
    find_heroes_for_urgent_requests(request_id)

@shared_task(name="apps.accounts.tasks.search_heroes_for_all_active_requests")
def search_heroes_for_all_active_requests():
    """Scheduled task: finds all active requests and triggers individual searches."""
    active_requests = UrgentRequest.objects.filter(expires_at__gt=timezone.now())
    for req in active_requests:
        run_hero_search_task.delay(req.id)

# --- EMBEDDING TASKS ---

@shared_task(name="apps.accounts.tasks.update_user_embedding")
def update_user_embedding(user_id):
    """Updates the embedding for a single user."""
    try:
        user = User.objects.get(id=user_id)
        raw_text = user.get_skills_text()
        if raw_text:
            embedding = get_model().encode(raw_text)
            user.skills_embedding = pickle.dumps(embedding)
            user.save(update_fields=["skills_embedding"])
    except User.DoesNotExist:
        pass


@shared_task(name="alerts.process_pet_match")
def process_pet_match_task(alert_id):
    try:

        alert = Alert.objects.get(id=alert_id)

        matches = process_pet_image_and_find_matches(alert)

        if not matches:
            return

        channel_layer = get_channel_layer()

        for match in matches:
            recipient = None
            msg = ""
            target_id = None

            if alert.category == "found_pet" and match.category == "lost_pet":
                recipient = match.user
                target_id = alert.id
                msg = f"Someone has found an animal which looks like yours ({alert.title})!"

            elif alert.category == "lost_pet" and match.category == "found_pet":
                recipient = alert.user
                target_id = match.id
                msg = f"There is already a found animal post that looks like yours! Check it out here."

            if recipient:
                notification = Notification.objects.create(
                    user=recipient,
                    sender=alert.user if alert.user != recipient else None,
                    type="pet_match",
                    title="Potrivire detectata!",
                    message=msg,
                    metadata={
                        "match_alert_id": target_id,
                        "similarity_score": round(1 - getattr(match, 'distance', 0), 2)
                    }
                )

                async_to_sync(channel_layer.group_send)(
                    f"user_notifications_{recipient.id}",
                    {
                        "type": "send_pet_match_notification",
                        "notification": {
                            "id": notification.id,
                            "type": notification.type,
                            "title": notification.title,
                            "message": notification.message,
                            "metadata": notification.metadata,
                        }
                    }
                )
    except Exception as e:
        print(e)


_AWARENESS_TYPES = {
    "1": "Wind", "2": "Snow / Ice", "3": "Thunderstorm", "4": "Fog",
    "5": "Extreme Heat", "6": "Extreme Cold", "7": "Coastal Event",
    "8": "Forest Fire", "9": "Avalanche", "10": "Heavy Rain",
    "11": "Flooding", "12": "Rain & Flooding",
}
_AWARENESS_LEVELS = {
    "1": "Minor", "2": "Moderate", "3": "Severe", "4": "Extreme",
}

def _parse_event_name(raw):

    params = {}
    for part in raw.replace(";", ",").split(","):
        if "=" in part:
            k, _, v = part.strip().partition("=")
            params[k.strip()] = v.strip()
    atype = _AWARENESS_TYPES.get(params.get("awareness_type", ""), "")
    alevel = _AWARENESS_LEVELS.get(params.get("awareness_level", ""), "")
    if atype:
        return f"{alevel} {atype} Warning".strip() if alevel else f"{atype} Warning"
    return raw


@shared_task
def fetch_severe_weather_alerts():
    key = os.getenv("openweather_api_key")
    user_locations = User.objects.exclude(location__isnull=True).values_list('location', flat=True)

    if not user_locations:
        return "No users with locations found."

    unique_cluster_locations = set()
    for loc in user_locations:
        lat_rounded = round(loc.y, 1)
        lon_rounded = round(loc.x, 1)
        unique_cluster_locations.add((lat_rounded, lon_rounded))

    alerts_created = 0
    channel_layer = get_channel_layer()
    recent_time_limit = timezone.now() - timedelta(hours=12)

    for lat, lon in unique_cluster_locations:
        url = f"https://api.openweathermap.org/data/3.0/onecall?lat={lat}&lon={lon}&exclude=minutely,daily&appid={key}&units=metric"

        try:
            response = requests.get(url)
            data = response.json()
            alert_location = Point(lon, lat, srid=4326)

            current = data.get("current", {})
            hourly_forecast = []
            for hour in data.get("hourly", [])[:4]:
                hourly_forecast.append({
                    "time": hour.get("dt"),
                    "temp": hour.get("temp"),
                    "description": hour.get("weather", [{}])[0].get("description", ""),
                    "pop": hour.get("pop", 0)
                })

            cache_key = f"weather_cluster_{lat}_{lon}"
            cache.set(cache_key, {
                "current": {
                    "temp": current.get("temp"),
                    "feels_like": current.get("feels_like"),
                    "description": current.get("weather", [{}])[0].get("description", ""),
                    "icon": current.get("weather", [{}])[0].get("icon", ""),
                },
                "upcoming": hourly_forecast
            }, timeout=1800)

            if "alerts" in data:
                for weather_alert in data["alerts"]:
                    event_name = _parse_event_name(weather_alert.get("event", "Severe Weather"))
                    description = weather_alert.get("description", "Please stay safe!")

                    alert_exists = Alert.objects.filter(
                        category="severe_weather",
                        title=f"Safety Check-in: {event_name}",
                        created_at__gte=recent_time_limit,
                        location__distance_lte=(alert_location, 11000)
                    ).exists()

                    if not alert_exists:
                        Alert.objects.create(
                            user_id=1,
                            title=f"Safety Check-in: {event_name}",
                            description=description,
                            category="severe_weather",
                            location=alert_location,
                            is_active=True
                        )
                        alerts_created += 1


                        async_to_sync(channel_layer.group_send)(
                            "alerts_feed",
                            {
                                "type": "weather_message",
                                "message": f"Severe weather alert: {event_name}. Please stay safe.",
                                "priority": "high"
                            }
                        )


            elif "hourly" in data:
                for hour_data in data["hourly"][:3]:
                    weather_code = hour_data.get("weather", [{}])[0].get("id", 800)
                    pop = hour_data.get("pop", 0)

                    if weather_code < 700 or pop > 0.70:
                        weather_desc = hour_data.get("weather", [{}])[0].get("description", "bad weather")

                        warning_exists = Alert.objects.filter(
                            category="weather_warning",
                            created_at__gte=recent_time_limit,
                            location__distance_lte=(alert_location, 11000)
                        ).exists()

                        if not warning_exists:
                            Alert.objects.create(
                                user_id=1,
                                title="Upcoming Weather Warning",
                                description=f"Heads up! High probability of {weather_desc} starting soon.",
                                category="weather_warning",
                                location=alert_location,
                                is_active=True
                            )
                            alerts_created += 1

                            async_to_sync(channel_layer.group_send)(
                                "alerts_feed",
                                {
                                    "type": "weather_message",
                                    "message": f"Heads up! {weather_desc.capitalize()} expected soon.",
                                    "priority": "medium"
                                }
                            )
                        break

        except Exception as e:
            print(f"Error fetching weather for cluster {lat}, {lon}: {e}")


@shared_task
def update_user_trust_score_task(user_id):
    try:
        user = User.objects.get(id=user_id)

        score = calculate_trust_score(user)

        score = max(-500, min(score, 500))

        user.trust_score = score
        user.save(update_fields=["trust_score"])

    except User.DoesNotExist:
        pass


@shared_task(rate_limit="1/s", max_retries=3)
def reverse_geocode_location(model_name, instance_id, app_label="accounts"):

    try:
        ModelClass = apps.get_model(app_label=app_label, model_name=model_name)
        instance = ModelClass.objects.get(id=instance_id)

        if not instance.location:
            instance.address = "Global / Online"
            instance.save(update_fields=['address'])
            return

        lat, lng = instance.location.y, instance.location.x
        url = f"https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat={lat}&lon={lng}&addressdetails=1"
        headers = {'Accept-Language': 'ro', 'User-Agent': 'PulseNet'}

        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            addr = data.get('address', {})

            street = addr.get('road', '')
            num = addr.get('house_number', '')
            city = addr.get('city') or addr.get('town') or addr.get('village') or ''

            formatted_address = ", ".join([p for p in [street, num, city] if p])
            if not formatted_address:
                formatted_address = ", ".join(data.get('display_name', '').split(',')[:3])

            instance.address = formatted_address or "Locație necunoscută"
            instance.save(update_fields=['address'])

            group_name = f"{model_name.lower()}s_feed"

            mapping = {
                "Pulse": "pulses_feed",
                "UrgentRequest": "requests_feed",
                "Alert": "alerts_feed"
            }
            target_group = mapping.get(model_name, group_name)

            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                target_group,
                {
                    "type": "address_update",
                    "id": instance.id,
                    "address": instance.address,
                    "model_type": model_name
                }
            )

    except Exception as e:
        print(f"Eroare geocodare pentru {model_name} ID {instance_id}: {e}")


@shared_task
def process_alert_text_embedding(alert_id):
    try:
        alert = Alert.objects.get(id=alert_id)

        model = get_model()
        text_to_embed = f"{alert.title}. {alert.description}"
        embedding_vector = model.encode(text_to_embed).tolist()

        if len(embedding_vector) < 512:
            embedding_vector += [0.0] * (512 - len(embedding_vector))

        duplicate = None

        if alert.location:
            duplicate = Alert.objects.filter(
                category=alert.category,
                location__distance_lte=(alert.location, D(m=100)),
                is_active=True
            ).exclude(
                id=alert.id
            ).annotate(
                distance=CosineDistance('duplicate_check_embedding', embedding_vector)
            ).filter(
                distance__lt=0.45
            ).order_by('created_at').first()

        channel_layer = get_channel_layer()

        if duplicate:

            AlertConfirm.objects.get_or_create(alert=duplicate, user=alert.user)

            alert.delete()

            async_to_sync(channel_layer.group_send)(
                f"user_notifications_{alert.user.id}",
                {
                    "type": "alert_merged",
                    "original_alert_id": duplicate.id,
                    "message": "There is already an alert which describes your issue! Your alert was send as an upvote."
                }
            )

            async_to_sync(channel_layer.group_send)(
                "alerts_feed",
                {
                    "type": "alert_updated_confirm_count",
                    "id": duplicate.id,
                    "confirm_count": duplicate.confirms.count()
                }
            )

        else:
            alert.duplicate_check_embedding = embedding_vector
            alert.is_active = True
            alert.save()

            if alert.location:
                reverse_geocode_location.delay("Alert", alert.id)

            images = [img.image.url for img in alert.images.all()]
            user_avatar = alert.user.profile_picture.url if hasattr(alert.user,
                                                                    'profile_picture') and alert.user.profile_picture else None

            broadcast_data = {
                "id": alert.id,
                "title": alert.title,
                "description": alert.description,
                "category": alert.category,
                "category_display": alert.get_category_display(),
                "user_name": alert.user.username,
                "user_avatar": user_avatar,
                "created_at": alert.created_at.isoformat(),
                "lat": alert.location.y if alert.location else None,
                "lng": alert.location.x if alert.location else None,
                "address": "Searching address...",
                "images": images,
                "image": images[0] if images else None,
                "is_admin_alert": alert.user.is_staff,
            }

            async_to_sync(channel_layer.group_send)(
                "alerts_feed",
                {
                    "type": "alert.message",
                    "data": broadcast_data,
                }
            )

    except Exception as e:
        print(f"Error in Celery Task process_alert_text_embedding: {e}")
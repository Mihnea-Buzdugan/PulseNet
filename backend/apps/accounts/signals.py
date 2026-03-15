import json
from django.db.models.signals import post_save
from django.dispatch import receiver
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .models import Pulse


@receiver(post_save, sender=Pulse)
def broadcast_new_pulse(sender, instance, created, **kwargs):
    if created:
        channel_layer = get_channel_layer()

        lat = instance.location.y if instance.location else None
        lng = instance.location.x if instance.location else None

        image_url = None
        if instance.images.exists():
            image_url = instance.images.first().image.url

        data = {
            "id": instance.id,
            "type": instance.pulse_type,
            "user": instance.user.username,
            "user_avatar": instance.user.profile_picture.url if instance.user.profile_picture else None,
            "name": instance.title,
            "description": instance.description,
            "price": float(instance.price),
            "currency": instance.currencyType,
            "popularity_score": float(instance.popularity_score),
            "total_reviews": instance.total_reviews,
            "timestamp": instance.created_at.strftime("%Y-%m-%d %H:%M"),
            "lat": lat,
            "lng": lng,
            "image": image_url,
            "is_live": True
        }

        async_to_sync(channel_layer.group_send)(
            "pulses_feed",
            {
                "type": "pulse_message",  # Trebuie să coincidă cu funcția din consumers.py
                "data": data,
            }
        )
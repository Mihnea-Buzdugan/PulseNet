from django.db.models.signals import post_delete
from django.dispatch import receiver
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from .models import Pulse, UrgentRequest, Alert

@receiver(post_delete, sender=Pulse)
def broadcast_pulse_deletion(sender, instance, **kwargs):
    """
    Broadcasts a WebSocket message whenever a Pulse is deleted
    """
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        "pulses_feed",
        {
            "type": "pulse.deleted",  # matches PulseConsumer.pulse_deleted method
            "id": instance.id
        }
    )


@receiver(post_delete, sender=UrgentRequest)
def broadcast_request_deletion(sender, instance, **kwargs):
    """
    Broadcasts a WebSocket message whenever a Pulse is deleted
    """
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        "requests_feed",
        {
            "type": "request.deleted",  # matches RequestConsumer.pulse_deleted method
            "id": instance.id
        }
    )

@receiver(post_delete, sender=Alert)
def broadcast_request_deletion(sender, instance, **kwargs):
    """
    Broadcasts a WebSocket message whenever a Pulse is deleted
    """
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        "alerts_feed",
        {
            "type": "alert.deleted",  # matches RequestConsumer.pulse_deleted method
            "id": instance.id
        }
    )
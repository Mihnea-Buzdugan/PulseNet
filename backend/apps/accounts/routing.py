from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/notifications/$', consumers.NotificationConsumer.as_asgi()),
    re_path(r'ws/chat/(?P<chat_type>\w+)/(?P<conversation_id>\d+)/$', consumers.ChatConsumer.as_asgi()),
    re_path(r"ws/pulses/$", consumers.PulseConsumer.as_asgi()),
    re_path(r'ws/alerts/$', consumers.AlertConsumer.as_asgi()),
]
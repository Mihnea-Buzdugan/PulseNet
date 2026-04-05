import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from django.db.models import Q
from geopy.distance import geodesic

from .models import (
    Group_Conversation,
    Group_Message,
    DirectConversation,
    DirectMessage,
    Friendship,
    Notification,
)

User = get_user_model()


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.chat_type = self.scope["url_route"]["kwargs"]["chat_type"]
        self.conversation_id = self.scope["url_route"]["kwargs"]["conversation_id"]
        self.room_group_name = f"{self.chat_type}_{self.conversation_id}"

        user = self.scope.get("user")
        if not user or not user.is_authenticated:
            await self.close(code=4001)
            return

        # 1. Get the conversation object
        self.conversation = await self._get_conversation()
        if not self.conversation:
            await self.close(code=4004)
            return

        # 2. Check if user belongs here
        is_participant = await self._check_participant(user, self.conversation)
        if not is_participant:
            await self.close(code=4003)
            return

        # 3. Privacy/Friendship check for Direct Chats
        if self.chat_type == "direct":
            other_user = await self._get_other_direct_participant(user, self.conversation)
            if other_user:
                is_friend = await self._are_friends(user, other_user)
                is_public = not getattr(other_user, "private_account", False)
                if not (is_friend or is_public):
                    await self.close(code=4005)
                    return

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "room_group_name"):
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        user = self.scope["user"]
        try:
            data = json.loads(text_data)
            content = data.get("message", "").strip()
            if not content:
                return
        except json.JSONDecodeError:
            return

        # 1. Save message to DB
        message_obj = await self._create_message(user, content)

        # 2. Build payload for the chat room
        payload = {
            "type": "chat.message",
            "message_id": message_obj.id,
            "chat_type": self.chat_type,
            "conversation_id": self.conversation_id,
            "sender_id": user.id,
            "sender_username": user.username,
            "content": message_obj.content,
            "timestamp": message_obj.timestamp.isoformat(),
        }

        # 3. Broadcast message to the chat room
        await self.channel_layer.group_send(self.room_group_name, payload)

        # 4. Handle Global Notifications (for Direct Chats)
        if self.chat_type == "direct":
            other_user = await self._get_other_direct_participant(user, self.conversation)
            if other_user:

                notification_text = f"{user.username} sent a new message"
                # Create DB notification first (so it exists even if recipient is offline)
                await self._create_message_notification(
                    receiver_id=other_user.id,
                    sender_id=user.id,
                    conversation_id=self.conversation_id,
                    content=notification_text,
                    message_id=message_obj.id,
                )

                # Then push a websocket notification (recipient may or may not be connected)
                notification_group = f"user_notifications_{other_user.id}"
                await self.channel_layer.group_send(
                    notification_group,
                    {
                        "type": "send_notification",  # handled by NotificationConsumer.send_notification
                        "conversation_id": self.conversation_id,
                        "sender_id": user.id,
                        "sender_name": user.username,
                        "content": notification_text,  # Send a preview
                    },
                )

    async def chat_message(self, event):
        """Standard handler for messages sent to the chat room group."""
        client_payload = {k: v for k, v in event.items() if k != "type"}
        await self.send(text_data=json.dumps(client_payload))

    # ---- Database Helpers ----

    @database_sync_to_async
    def _get_conversation(self):
        if self.chat_type == "group":
            return Group_Conversation.objects.filter(id=self.conversation_id).first()
        return DirectConversation.objects.filter(id=self.conversation_id).first()

    @database_sync_to_async
    def _check_participant(self, user, conversation):
        if self.chat_type == "group":
            return conversation.participants.filter(id=user.id).exists()
        return conversation.user1 == user or conversation.user2 == user

    @database_sync_to_async
    def _get_other_direct_participant(self, user, conversation):
        if self.chat_type != "direct":
            return None
        return conversation.user2 if conversation.user1 == user else conversation.user1

    @database_sync_to_async
    def _are_friends(self, user, other_user):
        return Friendship.objects.filter(
            (Q(user1=user) & Q(user2=other_user)) | (Q(user1=other_user) & Q(user2=user))
        ).exists()

    @database_sync_to_async
    def _create_message(self, user, content):
        if self.chat_type == "group":
            conv = Group_Conversation.objects.get(id=self.conversation_id)
            return Group_Message.objects.create(conversation=conv, sender=user, content=content)
        else:
            conv = DirectConversation.objects.get(id=self.conversation_id)
            return DirectMessage.objects.create(conversation=conv, sender=user, content=content)

    @database_sync_to_async
    def _create_message_notification(self, receiver_id, sender_id, conversation_id, content, message_id):
        """Create a DB notification for a chat message (sync DB call wrapped)."""
        try:
            receiver = User.objects.get(id=receiver_id)
            sender = User.objects.get(id=sender_id)

            Notification.objects.create(
                user=receiver,
                sender=sender,
                type="chat_message",
                title="New Message",
                message=content,
                conversation_id=conversation_id,
                metadata={"message_id": message_id, "preview": content},
            )
        except User.DoesNotExist:
            pass


class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope.get("user")

        if not self.user or not self.user.is_authenticated:
            await self.close()
            return

        self.notification_group = f"user_notifications_{self.user.id}"

        await self.channel_layer.group_add(self.notification_group, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "notification_group"):
            await self.channel_layer.group_discard(self.notification_group, self.channel_name)

    async def send_notification(self, event):
        """Called by group_send for chat messages (only forwards payload to client)."""
        await self.send(
            text_data=json.dumps(
                {
                    "type": "new_message",
                    "conversation_id": event["conversation_id"],
                    "sender_id": event["sender_id"],
                    "sender_name": event["sender_name"],
                    "content": event["content"],
                }
            )
        )

    async def send_rental_notification(self, event):
        """Handler for rental proposals (forward only — DB creation should happen on the view)."""
        await self.send(
            text_data=json.dumps(
                {
                    "type": "new_rental_proposal",
                    "title": event.get("title"),
                    "message": event.get("message"),
                    "pulse_id": event.get("pulse_id"),
                    "rental_id": event.get("rental_id"),
                    "proposed_total": event.get("proposed_total"),
                    "renter_id": event.get("renter_id"),
                    "renter_username": event.get("renter_username"),
                }
            )
        )

    async def send_pet_match_notification(self, event):
        notification = event["notification"]
        metadata = notification.get("metadata", {})
        await self.send(text_data=json.dumps({
            "type": "pet_match",
            "notification_id": notification["id"],
            "title": notification["title"],
            "message": notification["message"],
            "metadata": metadata,
            "similarity_score": metadata.get("similarity_score"),
            "match_alert_id": metadata.get("match_alert_id"),
            "is_read": False,
        }))

    async def send_hero_alert(self, event):
        await self.send(
            text_data=json.dumps(
                {
                    "type": "hero_alert",

                    # Notification core fields
                    "notification_id": event["notification_id"],
                    "title": event["title"],
                    "message": event["message"],
                    "created_at": event["created_at"],
                    "is_read": False,

                    # Sender info (optional but VERY useful for UI)
                    "sender_id": event.get("sender_id"),
                    "sender_username": event.get("sender_username"),

                    # Hero-specific data
                    "request_id": event["request_id"],
                    "score": event["score"],

                    # Optional extras
                    "metadata": event.get("metadata", {}),
                }
            )
        )

    async def send_signal_resolved(self, event):
        """Handler for signal resolution notifications."""
        await self.send(
            text_data=json.dumps(
                {
                    "type": "signal_resolved",
                    "notification_id": event.get("notification_id"),
                    "title": event.get("title"),
                    "message": event.get("message"),
                    "created_at": event.get("created_at"),
                    "metadata": event.get("metadata"),
                    "is_read": False,
                }
            )
        )

class PulseConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_group_name = "pulses_feed"
        self.user_coords = None
        self.visibility_radius = None

        user = self.scope.get("user")
        if user and user.is_authenticated:
            await self._load_user_location(user)

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    @database_sync_to_async
    def _load_user_location(self, user):
        try:
            u = User.objects.get(id=user.id)
            if u.location:
                self.user_coords = {
                    "lat": u.location.y,
                    "lng": u.location.x,
                }
            self.visibility_radius = u.visibility_radius or 1
        except User.DoesNotExist:
            self.user_coords = None
            self.visibility_radius = None

    async def receive(self, text_data=None, bytes_data=None):
        if text_data:
            data = json.loads(text_data)
            if data.get("type") == "set_location":
                lat = data.get("lat")
                lng = data.get("lng")
                if lat is not None and lng is not None:
                    self.user_coords = {"lat": lat, "lng": lng}
                self.visibility_radius = data.get("radius", self.visibility_radius or 10)

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)
        print(f"Connection closed with code: {close_code}")

    async def pulse_message(self, event):
        pulse_data = event.get("data")
        if not pulse_data or not pulse_data.get("location") or not self.user_coords:
            return

        # Extract coordinates from GeoJSON location
        coords = pulse_data["location"].get("coordinates")
        if not coords or len(coords) < 2:
            return

        pulse_point = (coords[1], coords[0])  # GeoJSON: [lng, lat]
        user_point = (self.user_coords["lat"], self.user_coords["lng"])

        # Calculate distance
        distance_km = geodesic(user_point, pulse_point).km

        # Send only if within visibility radius
        if distance_km <= self.visibility_radius:
            pulse_data["distance"] = round(distance_km, 2)
            await self.send(text_data=json.dumps(pulse_data))
        else:
            print(f"Pulse ignored. Distance: {distance_km}km > Radius: {self.visibility_radius}km")

    async def pulse_deleted(self, event):
        # This sends the deleted pulse ID to clients
        await self.send(text_data=json.dumps({
            "type": "pulse_deleted",
            "id": event["id"]
        }))

    async def address_update(self, event):
        await self.send(text_data=json.dumps({
            "type": "address_updated",
            "id": event["id"],
            "address": event["address"],
            "model_type": event.get("model_type")
        }))

class RequestConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_group_name = "requests_feed"
        self.user_coords = None
        self.visibility_radius = None

        user = self.scope.get("user")
        if user and user.is_authenticated:
            await self._load_user_location(user)

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    @database_sync_to_async
    def _load_user_location(self, user):
        try:
            u = User.objects.get(id=user.id)
            if u.location:
                self.user_coords = {
                    "lat": u.location.y,
                    "lng": u.location.x,
                }
            self.visibility_radius = u.visibility_radius or 1
        except User.DoesNotExist:
            self.user_coords = None
            self.visibility_radius = None

    async def receive(self, text_data=None, bytes_data=None):
        if text_data:
            data = json.loads(text_data)
            if data.get("type") == "set_location":
                lat = data.get("lat")
                lng = data.get("lng")
                if lat is not None and lng is not None:
                    self.user_coords = {"lat": lat, "lng": lng}
                self.visibility_radius = data.get("radius", self.visibility_radius or 10)

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)
        print(f"Connection closed with code: {close_code}")

    async def request_message(self, event):
        request_data = event.get("data")
        if not request_data or not request_data.get("location") or not self.user_coords:
            return

        # Extract coordinates from GeoJSON location
        coords = request_data["location"].get("coordinates")
        if not coords or len(coords) < 2:
            return

        request_point = (coords[1], coords[0])  # GeoJSON: [lng, lat]
        user_point = (self.user_coords["lat"], self.user_coords["lng"])

        # Calculate distance
        distance_km = geodesic(user_point, request_point).km

        # Send only if within visibility radius
        if distance_km <= self.visibility_radius:
            request_data["distance"] = round(distance_km, 2)
            await self.send(text_data=json.dumps(request_data))
        else:
            print(f"Request ignored. Distance: {distance_km}km > Radius: {self.visibility_radius}km")

    async def request_deleted(self, event):
        # This sends the deleted request ID to clients
        await self.send(text_data=json.dumps({
            "type": "request_deleted",
            "id": event["id"]
        }))
    async def address_update(self, event):
        await self.send(text_data=json.dumps({
            "type": "address_updated",
            "id": event["id"],
            "address": event["address"],
            "model_type": event.get("model_type")
        }))


class AlertConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        try:
            self.room_group_name = "alerts_feed"
            # Join the alerts group
            await self.channel_layer.group_add(self.room_group_name, self.channel_name)
            await self.accept()

            await self.send(text_data=json.dumps({
                "type": "welcome",
                "message": "Connected to Alerts feed"
            }))
            print("Successfully connected and sent welcome message!")
        except Exception as e:
            print(f"🔥 ERROR IN WEBSOCKET CONNECT: {e} 🔥")
            raise

    async def disconnect(self, close_code):
        # Leave the group
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)
        print(f"AlertConsumer disconnected: {close_code}")

    async def alert_message(self, event):
        """
        Receive alert broadcast from signal and send it to the WebSocket client
        """
        alert_data = event.get("data")
        if not alert_data:
            return

        # Admin-posted weather alerts go to the news bar
        if alert_data.get("category") == "weather" and alert_data.get("is_admin_alert"):
            await self.send(text_data=json.dumps({
                "type": "weather_alert",
                "action": "new_weather_alert",
                "id": alert_data.get("id"),
                "title": alert_data.get("title"),
                "message": alert_data.get("description", ""),
                "category": "weather",
            }))
        else:
            await self.send(text_data=json.dumps({
                "type": "alert",
                "data": alert_data
            }))

    async def alert_deleted(self, event):
        # This sends the deleted alert ID to clients
        await self.send(text_data=json.dumps({
            "type": "alert_deleted",
            "id": event["id"]
        }))

    async def address_update(self, event):
        await self.send(text_data=json.dumps({
            "type": "address_updated",
            "id": event["id"],
            "address": event["address"],
            "model_type": event.get("model_type")
        }))

    async def weather_message(self, event):

        message = event.get("message")

        priority = event.get("priority", "medium")

        if priority == "high":
            title = "Safety Check-in "
        else:
            title = "Weather Update "

        await self.send(text_data=json.dumps({
            "type": "weather_alert",
            "action": "new_weather_alert",
            "title": title,
            "message": message,
            "priority": priority,
            "category": "weather"
        }))
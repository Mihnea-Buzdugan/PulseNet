import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from django.db.models import Q
from .models import Group_Conversation, Group_Message, DirectConversation, DirectMessage, Friendship

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
                is_public = not getattr(other_user, 'private_account', False)
                if not (is_friend or is_public):
                    await self.close(code=4005)
                    return

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'room_group_name'):
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
                notification_group = f"user_notifications_{other_user.id}"
                await self.channel_layer.group_send(
                    notification_group,
                    {
                        "type": "send_notification",  # Targets NotificationConsumer.send_notification
                        "conversation_id": self.conversation_id,
                        "sender_id": user.id,
                        "sender_name": user.username,
                        "content": content[:50]  # Send a preview
                    }
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
        if self.chat_type != "direct": return None
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


class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope.get("user")

        if not self.user or not self.user.is_authenticated:
            await self.close()
            return

        self.notification_group = f"user_notifications_{self.user.id}"

        await self.channel_layer.group_add(
            self.notification_group,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'notification_group'):
            await self.channel_layer.group_discard(
                self.notification_group,
                self.channel_name
            )

    async def send_notification(self, event):

        await self.send(text_data=json.dumps({
            "type": event.get("notification_type", "new_message"),
            "conversation_id": event.get("conversation_id"),
            "sender_id": event["sender_id"],
            "sender_name": event["sender_name"],
            "content": event["content"]
        }))

import json
from channels.generic.websocket import AsyncWebsocketConsumer

class PulseConsumer(AsyncWebsocketConsumer):
    async def connect(self):

        self.room_group_name = "pulses_feed"

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        # 2. Accept the connection
        await self.accept()
        print(f"Connection accepted for group: {self.room_group_name}")

    async def disconnect(self, close_code):

        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )
        print(f"Connection closed with code: {close_code}")

    async def pulse_message(self, event):
        data = event["data"]

        await self.send(text_data=json.dumps(data))
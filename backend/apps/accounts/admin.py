from django.contrib import admin
from .models import User, Follow, Friendship, PendingFollow, Pulse, PulseImage, Group_Conversation, DirectConversation

# Register your models here.

admin.site.register(User)
admin.site.register(Pulse)
admin.site.register(PulseImage)
admin.site.register(Follow)
admin.site.register(Friendship)
admin.site.register(PendingFollow)
admin.site.register(Group_Conversation)
admin.site.register(DirectConversation)
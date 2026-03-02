from django.contrib import admin
from .models import User, Skill, UserObject, Follow, Friendship, PendingFollow

# Register your models here.

admin.site.register(User)
admin.site.register(Skill)
admin.site.register(UserObject)
admin.site.register(Follow)
admin.site.register(Friendship)
admin.site.register(PendingFollow)
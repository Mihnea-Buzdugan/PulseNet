from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractUser, PermissionsMixin
from django.db import models
from django.utils.crypto  import get_random_string
# Create your models here.

class User(AbstractUser):

    email = models.EmailField(unique=True)

    profile_picture = models.ImageField(
        upload_to="user_images/",
        blank=True,
        null=True
    )

    biography = models.TextField(blank=True, max_length=500)

    location = models.JSONField(default=dict)

    distance_radius = models.IntegerField(default=0)

    ONLINE_STATUS_CHOICES = [
        ("online", "Online"),
        ("away", "Away"),
        ("do_not_disturb", "Do Not Disturb"),
        ("offline", "Offline"),
    ]

    online_status = models.CharField(
        max_length=20,
        choices=ONLINE_STATUS_CHOICES,
        default="offline",
    )

    quiet_hours_start = models.TimeField(null=True, blank=True)
    quiet_hours_end = models.TimeField(null=True, blank=True)

    trust_score = models.FloatField(default=0)
    is_verified = models.BooleanField(default=False)
    private_account = models.BooleanField(default=False)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["first_name", "last_name", "username"]

    def __str__(self):
        return self.email



class Skill(models.Model):
    user = models.ForeignKey(
        "User",
        on_delete=models.CASCADE,
        related_name="skills",
        null=True,
        blank=True,
    )

    name = models.CharField(max_length=150)
    category = models.CharField(max_length=150, blank=True)

    PROFICIENCY_CHOICES = [
        ("beginner", "Beginner"),
        ("intermediate", "Intermediate"),
        ("expert", "Expert"),
    ]

    proficiency_level = models.CharField(
        max_length=20,
        choices=PROFICIENCY_CHOICES,
        default="beginner",
    )

    years_of_experience = models.FloatField(default=0)

    added_at = models.DateTimeField(auto_now_add=True, blank=True, null=True)

    class Meta:
        unique_together = ("user", "name")

    def __str__(self):
        return f"{self.name} ({self.user.email})"



class UserObject(models.Model):
    owner = models.ForeignKey(
        "User",
        on_delete=models.CASCADE,
        related_name="owned_objects"
    )

    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)

    category = models.CharField(max_length=150, blank=True)

    condition = models.CharField(
        max_length=50,
        choices=[
            ("new", "New"),
            ("good", "Good"),
            ("used", "Used"),
            ("damaged", "Damaged"),
        ],
        default="good",
    )

    is_available = models.BooleanField(default=True)


    price_per_day = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0
    )

    image = models.ImageField(
        upload_to="object_images/",
        blank=True,
        null=True
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} ({self.owner.email})"



class Follow(models.Model):
    follower = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="following"
    )

    following = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="followers"
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("follower", "following")


class PendingFollow(models.Model):
    requester = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="pending_requests_sent"
    )

    target = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="pending_requests_received"
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("requester", "target")

    def __str__(self):
        return f"{self.requester} → {self.target} (pending)"


class Friendship(models.Model):
    user1 = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="friendships_initiated"
    )

    user2 = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="friendships_received"
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user1", "user2")


class Conversation(models.Model):
    participants = models.ManyToManyField(
        User,
        related_name="conversations"
    )

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Conversation {self.id}"


class Message(models.Model):
    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name="messages"
    )

    sender = models.ForeignKey(
        User,
        on_delete=models.CASCADE
    )

    content = models.TextField()

    timestamp = models.DateTimeField(auto_now_add=True)

    is_read = models.BooleanField(default=False)
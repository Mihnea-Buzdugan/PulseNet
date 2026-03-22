from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractUser, PermissionsMixin
from django.contrib.gis.db import models
from django.contrib.postgres.fields import ArrayField
from django.utils.crypto  import get_random_string
from django.db.models import F
# Create your models here.

class User(AbstractUser):

    email = models.EmailField(unique=True)

    profile_picture = models.ImageField(
        upload_to="user_images/",
        blank=True,
        null=True
    )

    biography = models.TextField(blank=True, max_length=500)

    location = models.PointField(srid=4326, null=True, blank=True)

    visibility_radius = models. PositiveIntegerField(default=1)


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

    skills = models.JSONField(default=list, blank=True)

    skills_embedding = models.BinaryField(null=True, blank=True)

    banned_until = models.DateTimeField(null=True, blank=True)

    # Add this helper property near your is_quiet_now function
    @property
    def is_banned(self):
        from django.utils import timezone
        if self.banned_until:
            # If the current time is before the ban expiration time, they are banned
            return timezone.now() < self.banned_until
        return False

    #transform JSON list in an embedded vector
    def get_skills_text(self):
        if not self.skills:
            return ""
        return ", ".join([str(s).strip() for s in self.skills])


    #helper function pentru quiet hours
    def is_quiet_now(self):
        from django.utils import timezone
        if not self.quiet_hours_start or not self.quiet_hours_end:
            return False
        now = timezone.localtime().time()
        if self.quiet_hours_start <= self.quiet_hours_end:
            return self.quiet_hours_start <= now <= self.quiet_hours_end
        else:
            return now >= self.quiet_hours_start or now <= self.quiet_hours_end

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["first_name", "last_name", "username"]

    def __str__(self):
        return self.email

class Pulse(models.Model):
    user = models.ForeignKey(
        "User",
        on_delete=models.CASCADE,
        related_name="pulses"
    )

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)

    is_approved = models.BooleanField(default=True)
    is_flagged = models.BooleanField(default=False)
    toxicity_score = models.FloatField(default=0.0)

    #category in cazu in care adaugam categorii de obiecte pe viitor
    category = models.CharField(max_length=150, blank=True)

    phone_number = models.CharField(max_length=20, blank=True)

    PULSE_TYPE_CHOICES = [
        ("servicii", "Servicii / Evenimente"),
        ("obiecte", "Obiecte / Produse"),
    ]
    pulse_type = models.CharField(
        max_length=20,
        choices=PULSE_TYPE_CHOICES
    )
    location = models.PointField(srid=4326, null=True, blank=True)

    price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    currencyType = models.CharField(max_length=10, default="RON")

    is_available = models.BooleanField(default=True)
    visibility_radius = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    popularity_score = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_reviews = models.IntegerField(default=0)
    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} ({self.pulse_type})"

class PulseRental(models.Model):
    pulse = models.ForeignKey(
        Pulse,
        on_delete=models.CASCADE,
        related_name="rentals"
    )

    renter = models.ForeignKey(
        "User",
        on_delete=models.CASCADE,
        related_name="pulse_rentals"
    )

    start_date = models.DateTimeField()
    end_date = models.DateTimeField()
    total_price = models.DecimalField(max_digits=12, decimal_places=2)
    initial_price = models.DecimalField(max_digits=12, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)
    last_offer_by = models.ForeignKey(User, null=True, on_delete=models.SET_NULL)

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("confirmed", "Confirmed"),
        ("declined", "Declined"),
        ("completed", "Completed"),
    ]

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="pending"
    )

    class Meta:
        ordering = ["-start_date"]

    def __str__(self):
        return f"{self.pulse.title} reserved by {self.renter} ({self.start_date} - {self.end_date})"

class PulseComment(models.Model):
    pulse = models.ForeignKey(
        Pulse,
        on_delete=models.CASCADE,
    )

    user = models.ForeignKey(
        "User",
        on_delete=models.CASCADE,
        related_name="pulse_comments"
    )

    content = models.TextField()
    pub_date = models.DateTimeField(auto_now_add=True)

    def can_delete(self, request_user):
        return request_user == self.user or request_user.is_superuser

    def __str__(self):
        return f"{self.user} - {self.pub_date}"

class PulseRating(models.Model):
    pulse = models.ForeignKey(Pulse,on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    rating = models.PositiveIntegerField(default=10)

class FavoritePulse(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="favorite_pulses"
    )

    pulse = models.ForeignKey(
        "Pulse",
        on_delete=models.CASCADE,
        related_name="favorited_by"
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "pulse")
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.username} ❤️ {self.pulse.title}"


class PulseImage(models.Model):
    pulse = models.ForeignKey(
        Pulse,
        on_delete=models.CASCADE,
        related_name="images"
    )
    image = models.ImageField(upload_to="pulse_images/")
    uploaded_at = models.DateTimeField(auto_now_add=True)

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


class Group_Conversation(models.Model):
    participants = models.ManyToManyField(
        User,
        related_name="conversations"
    )

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Conversation {self.id}"




class Group_Message(models.Model):
    conversation = models.ForeignKey(
        Group_Conversation,
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


class DirectConversation(models.Model):
    # Ensure only 2 users can be in a direct chat
    user1 = models.ForeignKey(User, on_delete=models.CASCADE, related_name="direct_chats_as_user1")
    user2 = models.ForeignKey(User, on_delete=models.CASCADE, related_name="direct_chats_as_user2")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # Prevent duplicate conversations between the same two users
        unique_together = ('user1', 'user2')

    def __str__(self):
        return f"Direct Chat: {self.user1.email} & {self.user2.email}"

class DirectMessage(models.Model):
    conversation = models.ForeignKey(
        DirectConversation,
        on_delete=models.CASCADE,
        related_name="messages"
    )
    sender = models.ForeignKey(User, on_delete=models.CASCADE)
    content = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)

    class Meta:
        ordering = ['timestamp']

    def __str__(self):
        return f"From {self.sender.email} at {self.timestamp}"


class Alert(models.Model):
    CATEGORY_CHOICES = [
        ("weather", "Weather Alert"),
        ("lost", "Lost Item"),
        ("found", "Found Item"),
        ("traffic", "Traffic Alert"),
        ("safety", "Safety Notice"),
        ("event", "Event"),
        ("missing_person", "Missing Person"),
        ("infrastructure", "Road / Utilities"),
        ("public_health", "Health / Medical"),
        ("meetup", "Meetup"),
        ("volunteer", "Volunteer Request"),
        ("other", "Other"),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notices")

    title = models.CharField(max_length=150)
    description = models.TextField()

    is_approved = models.BooleanField(default=True)
    is_flagged = models.BooleanField(default=False)
    toxicity_score = models.FloatField(default=0.0)

    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default="other")
    created_at = models.DateTimeField(auto_now_add=True)
    location = models.PointField(srid=4326, null=True, blank=True)
    confirm_count = models.PositiveIntegerField(default=0)
    report_count = models.PositiveIntegerField(default=0)
    views_count = models.PositiveIntegerField(default=0)
    viewed_users = ArrayField(
        models.IntegerField(),  # store user IDs
        default=list,
        blank=True
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} ({self.get_category_display()})"


class AlertImage(models.Model):
    alert = models.ForeignKey(
        Alert,
        on_delete=models.CASCADE,
        related_name="images"
    )
    image = models.ImageField(upload_to="alert_images/")
    uploaded_at = models.DateTimeField(auto_now_add=True)

class AlertConfirm(models.Model):
    alert = models.ForeignKey(
        Alert,
        on_delete=models.CASCADE,
        related_name="confirms"
    )

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="alert_confirms"
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("alert", "user")

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)

        if is_new:
            Alert.objects.filter(id=self.alert.id).update(
                confirm_count=F("confirm_count") + 1
            )

    def delete(self, *args, **kwargs):
        Alert.objects.filter(id=self.alert.id).update(
            confirm_count=F("confirm_count") - 1
        )
        super().delete(*args, **kwargs)

    def __str__(self):
        return f"{self.user} confirmed Alert {self.alert.id}"


class AlertReport(models.Model):

    REASON_CHOICES = [
        ("false_info", "False information"),
        ("duplicate", "Duplicate"),
        ("irrelevant", "Irrelevant / Spam"),
        ("safety_concern", "Safety concern"),
        ("other", "Other"),
    ]

    alert = models.ForeignKey(
        Alert,
        on_delete=models.CASCADE,
        related_name="reports"
    )

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="alert_reports"
    )

    reason = models.CharField(max_length=50, choices=REASON_CHOICES)

    description = models.TextField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)

        if is_new:
            Alert.objects.filter(id=self.alert.id).update(
                report_count=F("report_count") + 1
            )

    def delete(self, *args, **kwargs):
        Alert.objects.filter(id=self.alert.id).update(
            report_count=F("report_count") - 1
        )
        super().delete(*args, **kwargs)

    def __str__(self):
        return f"Report for Alert {self.alert.id} ({self.reason})"


class Notification(models.Model):
    NOTIFICATION_TYPES = (
        ("rental_proposal", "Rental Proposal"),
        ("chat_message", "Chat Message"),
        ("hero_alert", "Hero Alert"),
    )

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="notifications"
    )
    sender = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sent_notifications"
    )

    type = models.CharField(max_length=50, choices=NOTIFICATION_TYPES)

    title = models.CharField(max_length=255)
    message = models.TextField()

    pulse_id = models.IntegerField(null=True, blank=True)
    rental_id = models.IntegerField(null=True, blank=True)
    conversation_id = models.IntegerField(null=True, blank=True)

    # For hero alerts / future flexible data
    metadata = models.JSONField(null=True, blank=True)

    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "is_read", "-created_at"]),
            models.Index(fields=["type", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.user} - {self.type}"


class UrgentRequest(models.Model):
    user = models.ForeignKey(
        "User",
        on_delete=models.CASCADE,
        related_name="urgent_requests"
    )
    title = models.CharField(max_length=200)  # optional description of request
    description = models.TextField(blank=True)

    is_approved = models.BooleanField(default=True)
    is_flagged = models.BooleanField(default=False)
    toxicity_score = models.FloatField(default=0.0)

    category = models.CharField(max_length=150, blank=True)

    max_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Maximum price user is willing to pay"
    )

    location = models.PointField(srid=4326, null=True, blank=True)

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"UrgentRequest by {self.user.username} ({self.title})"


class UrgentRequestImage(models.Model):
    urgent_request = models.ForeignKey(
        UrgentRequest,
        on_delete=models.CASCADE,
        related_name="images"
    )
    image = models.ImageField(upload_to="urgent_request_images/")
    uploaded_at = models.DateTimeField(auto_now_add=True)


class RequestComment(models.Model):
    request = models.ForeignKey(
        UrgentRequest,
        on_delete=models.CASCADE,
    )

    user = models.ForeignKey(
        "User",
        on_delete=models.CASCADE,
        related_name="request_comments"
    )

    content = models.TextField()
    pub_date = models.DateTimeField(auto_now_add=True)

    def can_delete(self, request_user):
        return request_user == self.user or request_user.is_superuser

    def __str__(self):
        return f"{self.user} - {self.pub_date}"
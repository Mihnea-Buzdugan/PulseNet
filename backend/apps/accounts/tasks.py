from celery import shared_task
from django.utils import timezone
from datetime import timedelta
from .models import Alert, UrgentRequest


@shared_task
def delete_expired_urgent_requests():
    now = timezone.now()
    expired = UrgentRequest.objects.filter(expires_at__lte=now)
    count = expired.count()
    if count:
        expired.delete()
    return f"Deleted {count} expired urgent requests"


@shared_task
def delete_old_alerts():
    # Calculate the cutoff date: 20 days ago
    cutoff_date = timezone.now() - timedelta(days=20)

    # Get alerts older than 20 days
    expired_alerts = Alert.objects.filter(created_at__lte=cutoff_date)
    count = expired_alerts.count()

    if count:
        expired_alerts.delete()

    return f"Deleted {count} alerts older than 20 days"
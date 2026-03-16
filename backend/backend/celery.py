# backend/celery.py
import os
from celery import Celery
from celery.schedules import crontab

# Set default Django settings
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")

# Create Celery app and set broker to Docker Redis service
app = Celery(
    "backend",
    broker="redis://redis:6379/0",  # use 'redis' as service name from docker-compose
)

# Load configuration from Django settings, using CELERY namespace
app.config_from_object("django.conf:settings", namespace="CELERY")

# Autodiscover tasks in installed apps
app.autodiscover_tasks()

# Celery Beat schedule
app.conf.beat_schedule = {
    # Delete expired urgent requests every minute
    "delete-expired-urgent-requests-every-minute": {
        "task": "apps.accounts.tasks.delete_expired_urgent_requests",
        "schedule": crontab(minute="*/1"),  # every minute
    },

    # Delete old alerts older than 20 days every day at midnight
    "delete-old-alerts-daily": {
        "task": "apps.accounts.tasks.delete_old_alerts",
        'schedule': crontab(minute=0),  # daily at 00:00
    },
}


# Optional: make sure task decorator works for Django
@app.task(bind=True)
def debug_task(self):
    print(f"Request: {self.request!r}")
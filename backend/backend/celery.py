# backend/celery.py
import os
from celery import Celery
from celery.schedules import crontab

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")

app = Celery(
    "backend",
    broker="redis://redis:6379/0",
)

app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()

app.conf.beat_schedule = {
    "delete-expired-urgent-requests-every-minute": {
        "task": "apps.accounts.tasks.delete_expired_urgent_requests",
        "schedule": crontab(minute="*/1"),
    },
    "delete-old-alerts-daily": {
        "task": "apps.accounts.tasks.delete_old_alerts",
        'schedule': crontab(minute=0, hour=0),  # daily at midnight
    },

    # NEW: Run the hero search every hour at the top of the hour
    "search-heroes-hourly": {
        "task": "apps.accounts.tasks.search_heroes_for_all_active_requests",
        "schedule": crontab(minute=0),
    },

"check-weather-alerts-30-min": {
        "task": "apps.accounts.tasks.fetch_severe_weather_alerts",
        "schedule": crontab(minute="*/30"),
    },
    "delete-old-request-offers-daily": {
        "task": "apps.accounts.tasks.delete_old_request_offers",
        "schedule": crontab(minute=0, hour=1),  # daily at 1am
    },
    "delete-old-pulse-rentals-daily": {
        "task": "apps.accounts.tasks.delete_old_pulse_rentals",
        "schedule": crontab(minute=0, hour=1),  # daily at 1am
    },
}


@app.task(bind=True)
def debug_task(self):
    print(f"Request: {self.request!r}")
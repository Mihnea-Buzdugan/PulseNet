import pickle

from asgiref.sync import async_to_sync
from celery import shared_task
from channels.layers import get_channel_layer
from django.utils import timezone
from datetime import timedelta

from kombu.transport.sqlalchemy import metadata
from sentence_transformers import SentenceTransformer

# Import your models and logic
from .models import Alert, UrgentRequest, User, Notification
from .utils import find_heroes_for_urgent_requests, process_pet_image_and_find_matches

# Lazy loader for the model to keep worker memory clean
_model = None

def get_model():
    global _model
    if _model is None:
        # Note: loading this inside the task is usually safer for worker stability
        _model = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")
    return _model

# --- MAINTENANCE TASKS ---

@shared_task(name="apps.accounts.tasks.delete_expired_urgent_requests")
def delete_expired_urgent_requests():
    now = timezone.now()
    expired = UrgentRequest.objects.filter(expires_at__lte=now)
    count = expired.count()
    if count:
        expired.delete()
    return f"Deleted {count} expired urgent requests"

@shared_task(name="apps.accounts.tasks.delete_old_alerts")
def delete_old_alerts():
    cutoff_date = timezone.now() - timedelta(days=20)
    expired_alerts = Alert.objects.filter(created_at__lte=cutoff_date)
    count = expired_alerts.count()
    if count:
        expired_alerts.delete()
    return f"Deleted {count} alerts older than 20 days"

# --- HERO SEARCH TASKS ---

@shared_task(name="apps.accounts.tasks.run_hero_search_task")
def run_hero_search_task(request_id):
    """Runs the search for a specific single request."""
    # This calls the function in your utils.py
    find_heroes_for_urgent_requests(request_id)

@shared_task(name="apps.accounts.tasks.search_heroes_for_all_active_requests")
def search_heroes_for_all_active_requests():
    """Scheduled task: finds all active requests and triggers individual searches."""
    active_requests = UrgentRequest.objects.filter(expires_at__gt=timezone.now())
    for req in active_requests:
        run_hero_search_task.delay(req.id)

# --- EMBEDDING TASKS ---

@shared_task(name="apps.accounts.tasks.update_user_embedding")
def update_user_embedding(user_id):
    """Updates the embedding for a single user."""
    try:
        user = User.objects.get(id=user_id)
        raw_text = user.get_skills_text()
        if raw_text:
            embedding = get_model().encode(raw_text)
            user.skills_embedding = pickle.dumps(embedding)
            user.save(update_fields=["skills_embedding"])
    except User.DoesNotExist:
        pass

@shared_task(name="apps.accounts.tasks.bulk_update_all_user_embeddings")
def bulk_update_all_user_embeddings():
    """Scheduled task to refresh every user's embedding."""
    users = User.objects.all()
    for user in users:
        update_user_embedding.delay(user.id)

@shared_task(name="alerts.process_pet_match")
def process_pet_match_task(alert_id):
    try:

        alert = Alert.objects.get(id=alert_id)

        matches = process_pet_image_and_find_matches(alert)

        if not matches:
            return

        channel_layer = get_channel_layer()

        for match in matches:
            recipient = None
            msg = ""
            target_id = None

            # CAZUL A: Cineva a postat un animal GĂSIT
            # Vrem să anunțăm stăpânii care au animale PIERDUTE (Lost)
            if alert.category == "found_pet" and match.category == "lost_pet":
                recipient = match.user
                target_id = alert.id
                msg = f"Cineva a găsit un animal care seamănă cu cel pierdut de tine ({alert.title})!"

            elif alert.category == "lost_pet" and match.category == "found_pet":
                recipient = alert.user
                target_id = match.id
                msg = f"Există deja un anunț cu un animal găsit care seamănă cu al tău! Verifică-l aici."

            if recipient:
                notification = Notification.objects.create(
                    user=recipient,
                    sender=alert.user if alert.user != recipient else None,
                    type="pet_match",
                    title="Potrivire detectata!",
                    message=msg,
                    metadata={
                        "match_alert_id": target_id,
                        "similarity_score": round(1 - getattr(match, 'distance', 0), 2)
                    }
                )

                async_to_sync(channel_layer.group_send)(
                    f"user_notifications_{recipient.id}",
                    {
                        "type": "send_pet_match_notification",
                        "notification": {
                            "id": notification.id,
                            "type": notification.type,
                            "title": notification.title,
                            "message": notification.message,
                            "metadata": notification.metadata,
                        }
                    }
                )
    except Exception as e:
        print(e)

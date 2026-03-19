import pickle
from celery import shared_task
from django.utils import timezone
from datetime import timedelta
from sentence_transformers import SentenceTransformer

# Import your models and logic
from .models import Alert, UrgentRequest, User, Notification
from .utils import find_heroes_for_urgent_requests

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
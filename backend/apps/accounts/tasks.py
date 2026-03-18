from asgiref.sync import async_to_sync
from celery import shared_task
from channels.layers import get_channel_layer
from django.utils import timezone
from datetime import timedelta
from django.contrib.gis.measure import D
from .models import Alert, UrgentRequest, User
from sentence_transformers import SentenceTransformer, util
import pickle

_model = None

def get_model():
    global _model
    if _model is None:
        _model = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")
    return _model

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


@shared_task
def update_user_embedding(user_id):
    try:
        user = User.objects.get(id=user_id)
        raw_text = user.get_skills_text()

        if raw_text:
            processed_text = raw_text

            embedding = get_model().encode(processed_text)
            user.skills_embedding = pickle.dumps(embedding)
            user.save(update_fields=["skills_embedding"])
    except User.DoesNotExist:
        pass


@shared_task
def find_heroes_for_urgent_requests(request_id):
    try:
        req = UrgentRequest.objects.get(id=request_id)

        context_urgenta = f"{req.title} {req.description}".strip()
        query_embedding = get_model().encode(context_urgenta, convert_to_tensor=True)

        neighbors = User.objects.filter(
            location__distance_lte=(req.location, D(km=req.user.visibility_radius))
        ).exclude(id=req.user.id)

        channel_layer = get_channel_layer()
        matches = []

        for neighbor in neighbors:
            if not neighbor.skills:
                continue

            # Compare request against each skill individually, take best match
            best_score = 0.0
            for skill in [s.strip() for s in neighbor.skills if str(s).strip()]:
                skill_emb = get_model().encode(str(skill), convert_to_tensor=True)
                s = util.cos_sim(query_embedding, skill_emb).item()
                if s > best_score:
                    best_score = s

            if best_score > 0.80:
                matches.append({
                    "neighbor_id": neighbor.id,
                    "score": best_score
                })

        matches = sorted(matches, key=lambda x: x['score'], reverse=True)[:5]

        for match in matches:
            group_name = f"user_notifications_{match['neighbor_id']}"
            async_to_sync(channel_layer.group_send)(
                group_name,
                {
                    "type": "send_hero_alert",
                    "request_id": req.id,
                    "title": req.title,
                    "score": round(match['score'] * 100, 1),
                }
            )

    except UrgentRequest.DoesNotExist:
        pass

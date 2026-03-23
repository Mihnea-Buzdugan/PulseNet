import json
import os

from django.contrib.gis.geos import Point
from django.contrib.gis.measure import D
from django.utils import timezone
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from sentence_transformers import util
from sentence_transformers import SentenceTransformer
from transformers import pipeline
from PIL import Image
from pgvector.django import CosineDistance
# Import your models here - update paths as necessary
from .models import UrgentRequest, User, Notification, AlertImage

_model = None
MODEL_CACHE_PATH = os.getenv('SENTENCE_TRANSFORMERS_HOME', '/app/model_cache')

def get_model():
    global _model
    if _model is None:
        os.makedirs(MODEL_CACHE_PATH, exist_ok=True)

        _model = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2", cache_folder=MODEL_CACHE_PATH)
    return _model

_toxicity_model = None

def get_toxicity_model():
    global _toxicity_model
    if _toxicity_model is None:
        os.makedirs(MODEL_CACHE_PATH, exist_ok=True)
        _toxicity_model = pipeline(
            "text-classification",
            model="unitary/toxic-bert",
            model_kwargs={"cache_dir": MODEL_CACHE_PATH},
            top_k=None
        )
    return _toxicity_model

_clip_model = None
def get_clip_model():
    global _clip_model
    if _clip_model is None:
        os.makedirs(MODEL_CACHE_PATH, exist_ok=True)
        _clip_model = SentenceTransformer("clip-ViT-B-32", cache_folder=MODEL_CACHE_PATH)
    return _clip_model

def find_heroes_for_urgent_requests(request_id):
    print(f"\n[START] request_id={request_id}")
    try:
        req = UrgentRequest.objects.get(id=request_id)
        if not req.location:
            return

        context_urgenta = f"{req.title} {req.description}".strip()
        model = get_model()
        query_embedding = model.encode(context_urgenta, convert_to_tensor=True)

        neighbors = User.objects.filter(
            location__distance_lte=(req.location, D(km=req.user.visibility_radius))
        ).exclude(id=req.user.id)

        channel_layer = get_channel_layer()
        matches = []

        for neighbor in neighbors:
            if not neighbor.skills:
                continue

            best_score = 0.0
            for skill in [s.strip() for s in neighbor.skills if str(s).strip()]:
                skill_emb = model.encode(str(skill), convert_to_tensor=True)
                s = util.cos_sim(query_embedding, skill_emb).item()
                if s > best_score:
                    best_score = s

            if best_score > 0.50:
                matches.append({"neighbor_id": neighbor.id, "score": best_score})

        matches = sorted(matches, key=lambda x: x["score"], reverse=True)

        for match in matches:
            neighbor = User.objects.get(id=match["neighbor_id"])

            # --- ANTI-SPAM CHECK ---
            already_notified = Notification.objects.filter(
                user=neighbor,
                sender=req.user,
                metadata__request_id=req.id
            ).exists()

            if already_notified:
                print(f"[SKIP] User {neighbor.id} already notified.")
                continue

            notification = Notification.objects.create(
                user=neighbor,
                sender=req.user,
                type="hero_alert",
                title=req.title,
                message="A neighbour needs your help!",
                metadata={"request_id": req.id, "score": round(match["score"] * 100, 1)},
            )

            group_name = f"user_notifications_{neighbor.id}"
            async_to_sync(channel_layer.group_send)(
                group_name,
                {
                    "type": "send_hero_alert",
                    "notification_id": notification.id,
                    "title": notification.title,
                    "message": notification.message,
                    "created_at": notification.created_at.isoformat(),
                    "sender_id": req.user.id,
                    "sender_username": req.user.username,
                    "request_id": req.id,
                    "score": round(match["score"] * 100, 1),
                    "metadata": notification.metadata,
                }
            )
    except Exception as e:
        print(f"[ERROR] {e}")


def process_pet_image_and_find_matches(alert_instance):
    model = get_clip_model()
    alert_images = alert_instance.images.all()

    if not alert_images.exists():
        return []

    try:
        all_matches = []
        primary_embedding = None

        search_category = "found_pet" if alert_instance.category == "lost_pet" else "lost_pet"

        for img_obj in alert_images:
            img = Image.open(img_obj.image.path).convert('RGB')
            embedding = model.encode(img).tolist()

            img_obj.embedding = embedding
            img_obj.save(update_fields=['embedding'])

            if primary_embedding is None:
                primary_embedding = embedding

            similar_images = AlertImage.objects.filter(
                alert__category=search_category,
                embedding__isnull=False,
            ).exclude(
                alert=alert_instance
            ).annotate(
                distance=CosineDistance('embedding', embedding)
            ).filter(
                distance__lte=0.15
            ).select_related('alert')[:5]

            for img_match in similar_images:
                all_matches.append(img_match.alert)

        if primary_embedding:
            alert_instance.embedding = primary_embedding
            alert_instance.save(update_fields=["embedding"])

        unique_matches = {m.id: m for m in all_matches}.values()

        return list(unique_matches)

    except Exception as e:
        print(f"[ERROR AI MATCHING] {e}")
        return []


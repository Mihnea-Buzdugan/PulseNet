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

# Import your models here - update paths as necessary
from .models import UrgentRequest, User, Notification

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

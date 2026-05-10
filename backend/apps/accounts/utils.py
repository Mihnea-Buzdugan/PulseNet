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
from django.db.models import Avg

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


def calculate_trust_score(user):
    score = 0

    alerts = user.notices.all()
    for alert in alerts:
        if alert.is_flagged:
            score -= 8

        score -= alert.toxicity_score * 5

        if alert.is_verified:
            score += 10
        else:
            score += 2

    pulses = user.pulses.all()
    for pulse in pulses:
        if pulse.is_flagged:
            score -= 10

        score += float(pulse.popularity_score) * 0.5

        if pulse.is_available:
            score += 3

        avg_rating = pulse.pulserating_set.aggregate(avg=Avg("rating"))["avg"]

        if avg_rating:
            normalized = avg_rating - 5

            score += normalized * 2  # tweakable

    requests = user.urgent_requests.all()
    for req in requests:
        if req.is_flagged:
            score -= 6
        else:
            score += 2

    return round(score, 2)


from difflib import SequenceMatcher
from .models import PersonalDocument, Notification
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync


# Make sure to import your Notification and PersonalDocument models here

from difflib import SequenceMatcher
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


# Assuming PersonalDocument and Notification are imported here

def find_and_notify_matches(new_doc):
    """
    Searches for similarity between the new document and existing
    documents with the opposite status, based on specific parsed fields.
    """

    def build_comparison_string(extracted_data):
        """
        Extracts specific fields from parsed_data and builds a single
        lowercase string for comparison, ignoring nulls/empty values.
        """
        parsed = extracted_data.get("parsed_data", {})
        if not isinstance(parsed, dict):
            return ""

        fields_to_compare = [
            parsed.get("first_name"),
            parsed.get("last_name"),
            parsed.get("cnp"),
            parsed.get("address")
        ]

        # Filter out None values and empty strings, then join
        valid_fields = [str(f).strip().lower() for f in fields_to_compare if f]
        return " ".join(valid_fields)

    # 1. Determine target status (Found searches Lost, Lost searches Found)
    target_status = "FOUND" if new_doc.status == "LOST" else "LOST"

    # 2. Get all documents of the opposite status (excluding own uploads)
    potential_matches = PersonalDocument.objects.filter(status=target_status).exclude(user=new_doc.user)

    # 3. Build the targeted comparison string for the newly uploaded document
    new_compare_string = build_comparison_string(new_doc.extracted_data)

    # If the OCR failed to parse any of our target fields, there's nothing to compare
    if not new_compare_string:
        return

    # Threshold for a match (0.6 is 60% similarity - good for noisy OCR)
    SIMILARITY_THRESHOLD = 0.6

    # Initialize the channel layer
    channel_layer = get_channel_layer()

    for match in potential_matches:
        existing_compare_string = build_comparison_string(match.extracted_data)

        # Skip if the existing document doesn't have any parsed fields either
        if not existing_compare_string:
            continue

        # Calculate similarity ratio based ONLY on the parsed fields
        similarity = SequenceMatcher(None, new_compare_string, existing_compare_string).ratio()

        print(f"Comparing '{new_compare_string}' with '{existing_compare_string}' -> Similarity: {similarity}")


        if similarity >= SIMILARITY_THRESHOLD:
            # --- 1. Notification for the user who just uploaded ---
            uploader_notif = Notification.objects.create(
                user=new_doc.user,
                sender=match.user,
                type="document_alert",
                title="Possible Match Found!",
                message=f"We found a document that looks like a match for your {new_doc.status.lower()} report.",
                metadata={
                    "match_doc_id": match.id,
                    "similarity": round(similarity, 2),
                    "match_status": match.status
                }
            )

            # Send WebSocket alert to the uploader
            async_to_sync(channel_layer.group_send)(
                f"user_notifications_{new_doc.user.id}",
                {
                    "type": "send_document_match_notification",  # Matches the method in consumer
                    "notification_id": uploader_notif.id,
                    "title": uploader_notif.title,
                    "message": uploader_notif.message,
                    "metadata": uploader_notif.metadata,
                }
            )

            # --- 2. Notification for the owner of the existing document ---
            existing_owner_notif = Notification.objects.create(
                user=match.user,
                sender=new_doc.user,
                type="document_alert",
                title="Someone found/lost a matching document!",
                message=f"A new {new_doc.status.lower()} document matches your previous report.",
                metadata={
                    "match_doc_id": new_doc.id,
                    "similarity": round(similarity, 2),
                    "match_status": new_doc.status
                }
            )

            # Send WebSocket alert to the existing document owner
            async_to_sync(channel_layer.group_send)(
                f"user_notifications_{match.user.id}",
                {
                    "type": "send_document_match_notification",  # Matches the method in consumer
                    "notification_id": existing_owner_notif.id,
                    "title": existing_owner_notif.title,
                    "message": existing_owner_notif.message,
                    "metadata": existing_owner_notif.metadata,
                }
            )

            # Break after first match or continue to find multiple?
            # Usually, one match is enough to alert, but you can remove 'break' to find all.
            break
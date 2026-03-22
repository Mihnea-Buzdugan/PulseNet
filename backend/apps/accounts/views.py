from channels.layers import get_channel_layer
from django.contrib.admin.views.decorators import staff_member_required
from django.contrib.auth import authenticate
from django.core.paginator import Paginator
from django.middleware.csrf import get_token
from django.utils.dateparse import parse_datetime, parse_date
from django.views.decorators.csrf import csrf_exempt, ensure_csrf_cookie, csrf_protect
import os
from django.views.decorators.csrf import csrf_protect
from django.http import JsonResponse
from django.contrib.auth import get_user_model, login as django_login,logout as django_logout
from django.core.exceptions import ValidationError
import json
from django.db.models import Q, Prefetch
from django.contrib.auth import get_user_model
from django.views.decorators.http import require_http_methods, require_POST, require_GET
from google.auth.transport.requests import Request
from google.oauth2 import id_token
from django.contrib.auth.decorators import login_required
from django.contrib.gis.geos import Point
from django.contrib.gis.db.models.functions import Distance
from django.db import IntegrityError
from networkx.algorithms.distance_measures import radius
from math import ceil
from .decorators import api_login_required, check_hate_speech
from .models import PendingFollow, Pulse, Friendship, Follow, PulseImage, FavoritePulse, PulseRental, Alert, AlertImage, \
    PulseComment, PulseRating, Notification, UrgentRequest, UrgentRequestImage, AlertConfirm, AlertReport, \
    RequestComment
import secrets
import string
from django.contrib.auth.hashers import make_password
from django.db import models
from decimal import Decimal
from django.shortcuts import get_object_or_404
from django.contrib.gis.db.models.functions import Distance as GisDistance
from celery import shared_task

from .tasks import update_user_embedding, find_heroes_for_urgent_requests, get_model as _get_st_model, \
    run_hero_search_task
from sentence_transformers import util as st_util
def generate_password(length=12):
    alphabet = string.ascii_letters + string.digits + string.punctuation
    return ''.join(secrets.choice(alphabet) for _ in range(length))


@ensure_csrf_cookie
def csrf_token(request):
    csrf_token = get_token(request)
    return JsonResponse({'csrf_token': csrf_token})


@csrf_protect
def sign_up(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({'message': 'Invalid JSON data'}, status=400)

        email = data.get('email')
        username = data.get('username')
        password = data.get('password')
        first_name = data.get('first_name')
        last_name = data.get('last_name')

        User = get_user_model()

        if User.objects.filter(email=email).exists():
            return JsonResponse({'message': 'Email is already in use.'}, status=400)

        if User.objects.filter(username=username).exists():
            return JsonResponse({'message': 'Username is already in use.'}, status=400)

        try:
            user = User.objects.create_user(
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name,
                username=username,
            )
        except ValidationError as e:
            return JsonResponse({'message': str(e)}, status=400)

        django_login(request, user, backend='django.contrib.auth.backends.ModelBackend')
        request.session.set_expiry(3600 * 6)

        return JsonResponse({
            'message': 'User created and logged in successfully.',
            'user': {
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'username': user.username,
            }
        }, status=201)

    return JsonResponse({'message': 'Method not allowed'}, status=405)

@csrf_protect
def user_login(request):
    if request.method == 'POST':
        csrf_token = get_token(request)
        print("CSRF Token received:", csrf_token)

        try:
            data = json.loads(request.body)
            email = data.get('email')
            password = data.get('password')

            if not email or not password:
                return JsonResponse({'message': 'Email and Password are required'}, status=400)

            user = authenticate(request, username=email, password=password)

            if user is not None:
                django_login(request, user, backend='django.contrib.auth.backends.ModelBackend')
                request.session.set_expiry(3600 * 6)

                user_data = {
                    'id': user.id,
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'is_superuser': user.is_superuser
                }
                return JsonResponse({'message': 'User login successful', 'user': user_data}, status=200)
            else:
                return JsonResponse({'message': 'Invalid credentials or not a normal user'}, status=400)

        except json.JSONDecodeError:
            return JsonResponse({'message': 'Invalid JSON'}, status=400)

    return JsonResponse({'message': 'Method Not Allowed'}, status=405)


@csrf_protect
def google_login(request):
    GOOGLE_CLIENT_ID = os.environ.get('client_id_Google')

    if request.method == "POST":
        try:
            data = json.loads(request.body)
        except json.decoder.JSONDecodeError:
            return JsonResponse({'message': 'Invalid JSON'}, status=400)

        google_token = data.get('google_token')
        if google_token:
            try:
                # Verify the Google token
                id_info = id_token.verify_oauth2_token(google_token, Request(), GOOGLE_CLIENT_ID)
                google_email = id_info.get('email')
                full_given = id_info.get('given_name', '').strip()
                parts = full_given.split()
                raw_password = generate_password()
                hashed_password = make_password(raw_password)
                User = get_user_model()
                if parts:
                    # first word → last_name
                    last_name = parts[0]
                    # the rest → first_name
                    first_name = ' '.join(parts[1:]) if len(parts) > 1 else ''
                else:
                    # fallback if nothing in given_name
                    last_name = ''
                    first_name = ''

                if google_email:
                    # Find or create a user
                    user = User.objects.filter(email=google_email).first()
                    if not user:
                        # Create a new user if not found
                        user = User.objects.create_user(
                            username=google_email,
                            email=google_email,
                            first_name=first_name,
                            last_name=last_name,
                            password=hashed_password  # Random password
                        )

                    # Use the dotted path to the backend
                    user.backend = 'django.contrib.auth.backends.ModelBackend'  # Corrected line
                    if user.is_superuser == False or user.is_superuser == True:

                        django_login(request, user)
                        request.session.set_expiry(6 * 3600)

                        user_data = {
                            'email': user.email,
                            'first_name': user.first_name,
                            'last_name': user.last_name,
                            'is_superuser': user.is_superuser,
                        }
                        return JsonResponse({'message': 'User logged in with Google successfully', 'user': user_data}, status=200)
                    else:
                        return JsonResponse({'message': 'User is a superuser, cannot login with Google'}, status=400)
            except ValueError as e:
                return JsonResponse({'message': f'Invalid Google token: {str(e)}'}, status=400)

        else:
            return JsonResponse({'message': 'Invalid Google token'}, status=400)
    else:
        return JsonResponse({'message': 'Method not allowed'}, status=405)



@csrf_exempt
def logout(request):
    if request.method == "POST":
        django_logout(request)
        return JsonResponse({'message': 'User logged out successfully'}, status=200)
    else:
        return JsonResponse({'message': 'Method not allowed'}, status=405)




@login_required
def user(request):
    if request.method == "GET":
        user = request.user
        return JsonResponse({'user':{
            'id': user.id,
            'email': user.email,
            'username': user.username,
            'firstName': user.first_name,
            'lastName': user.last_name,
            'is_superuser': user.is_superuser,
            'profile_picture': user.profile_picture.url if user.profile_picture else None,
            "is_banned": user.is_banned,  # Calls your @property helper
            "banned_until": user.banned_until.isoformat() if user.banned_until else None,
        }}, status=200)
    else:
        return JsonResponse({'message': 'Method not allowed'}, status=405)


@login_required
def profile(request):
    if request.method == "GET":
        user = request.user

        pulses = Pulse.objects.filter(user=user).prefetch_related('images')

        pulses_data = []
        for p in pulses:
            pulses_data.append({
                "id": p.id,
                "title": p.title,
                "pulseType": p.pulse_type,
                "category": p.pulse_type,
                "price": float(p.price),
                "currencyType": p.currencyType,
                "description": p.description,
                "images": [request.build_absolute_uri(img.image.url) for img in p.images.all()],
                "phone_number": p.phone_number,
                "location": json.loads(p.location.geojson) if p.location else None,
                "timestamp": p.created_at.strftime("%Y-%m-%d %H:%M"),
            })

        user_data = {
            "id": user.id,
            "email": user.email,
            "firstName": user.first_name,
            "lastName": user.last_name,
            "username": user.username,
            "profilePicture": request.build_absolute_uri(user.profile_picture.url) if user.profile_picture else None,
            "biography": user.biography,
            "location": json.loads(user.location.geojson) if user.location else None,
            "visibility_radius": user.visibility_radius,
            "quiet_hours_start": user.quiet_hours_start.strftime("%H:%M") if user.quiet_hours_start else None,
            "quiet_hours_end": user.quiet_hours_end.strftime("%H:%M") if user.quiet_hours_end else None,
            "trustScore": user.trust_score,
            "isVerified": user.is_verified,
            "onlineStatus": user.online_status,
            "skills": user.skills if isinstance(user.skills, list) else [],
            "pulses": pulses_data,
        }

        return JsonResponse({"user": user_data})

    return JsonResponse({"error": "Method not allowed"}, status=405)


@login_required
@require_http_methods(["PUT"])
def update_profile(request):
    try:
        # 1. Parse JSON data from the request body
        data = json.loads(request.body)
        user = request.user

        old_skills = list(user.skills) if user.skills else []

        user.first_name = data.get('firstName', user.first_name)
        user.last_name = data.get('lastName', user.last_name)
        user.username = data.get('username', user.username)
        user.email = data.get('email', user.email)
        user.biography = data.get('biography', user.biography)
        user.online_status = data.get("online_status", user.online_status)
        user.quiet_hours_start = data.get("quiet_hours_start") or None
        user.quiet_hours_end = data.get("quiet_hours_end") or None
        user.visibility_radius = data.get('visibility_radius', user.visibility_radius)
        user.skills = data.get('skills', [])
        # 3. Validate and save
        user.save()

        if old_skills != user.skills:
            update_user_embedding.delay(user.id)

        # 2. Re-aducem pulsurile pentru a sincroniza complet frontend-ul
        # Folosim aceiași logică ca în view-ul de profile
        pulses = Pulse.objects.filter(user=user).prefetch_related('images')
        pulses_data = [
            {
                "id": p.id,
                "title": p.title,
                "pulseType": p.pulse_type,
                "price": float(p.price),
                "currencyType": p.currencyType,
                "images": [request.build_absolute_uri(img.image.url) for img in p.images.all()],
            } for p in pulses
        ]

        return JsonResponse({
            "message": "Success",
            "user": {
                "id": user.id,
                "email": user.email,
                "firstName": user.first_name,
                "lastName": user.last_name,
                "username": user.username,
                "profilePicture": request.build_absolute_uri(user.profile_picture.url) if user.profile_picture else None,
                "biography": user.biography,
                "location": json.loads(user.location.geojson) if user.location else None,
                "visibility_radius": user.visibility_radius,
                "quiet_hours_start": user.quiet_hours_start,
                "quiet_hours_end": user.quiet_hours_end,
                "trustScore": user.trust_score,
                "isVerified": user.is_verified,
                "onlineStatus": user.online_status,
                "skills": user.skills or [],
                "pulses": pulses_data, 
            }
        }, status=200)

    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON format"}, status=400)
    except ValidationError as e:
        errors = getattr(e, 'message_dict', None) or e.messages
        return JsonResponse({"error": errors}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

@login_required
@require_POST
@csrf_protect
def upload_profile_picture(request):
    user = request.user

    if "profile_picture" not in request.FILES:
        return JsonResponse(
            {"error": "No file provided."},
            status=400
        )

    file = request.FILES["profile_picture"]

    # Basic validation
    if not file.content_type.startswith("image/"):
        return JsonResponse(
            {"error": "File must be an image."},
            status=400
        )

    max_size = 20 * 1024 * 1024  # 5MB
    if file.size > max_size:
        return JsonResponse(
            {"error": "Image must be smaller than 20MB."},
            status=400
        )

    # Optional: delete old image file (avoids orphan files)
    if user.profile_picture:
        user.profile_picture.delete(save=False)

    user.profile_picture = file
    user.save()

    pulses = Pulse.objects.filter(user=user).prefetch_related('images')
    pulses_data = [
        {
            "id": p.id,
            "title": p.title,
            "pulseType": p.pulse_type,
            "images": [request.build_absolute_uri(img.image.url) for img in p.images.all()],
        } for p in pulses
    ]

    return JsonResponse({
        "user": {
            "id": user.id,
                "email": user.email,
                "firstName": user.first_name,
                "lastName": user.last_name,
                "username": user.username,
                "profilePicture": request.build_absolute_uri(user.profile_picture.url) if user.profile_picture else None,
                "biography": user.biography,
                "location": json.loads(user.location.geojson) if user.location else None,
                "visibility_radius": user.visibility_radius,
                "quiet_hours_start": user.quiet_hours_start,
                "quiet_hours_end": user.quiet_hours_end,
                "trustScore": user.trust_score,
                "isVerified": user.is_verified,
                "onlineStatus": user.online_status,
                "pulses": pulses_data,
        }
    })

@login_required
@require_POST
@csrf_protect
def delete_profile_picture(request):
    user = request.user

    # If no picture exists
    if not user.profile_picture:
        return JsonResponse(
            {"error": "No profile picture to delete."},
            status=400
        )

    # Delete file from storage (filesystem / S3 / etc.)
    user.profile_picture.delete(save=False)

    # Remove reference from database
    user.profile_picture = None
    user.save()

    return JsonResponse({
        "message": "Profile picture deleted successfully.",
        "user": {
            "id": user.id,
            "profilePicture": None
        }
    })


@login_required
@require_POST
@csrf_protect
@check_hate_speech
def add_pulse(request):
    try:
        data = request.POST

        should_flag = getattr(request, 'needs_review', False)
        ai_score = getattr(request, 'toxicity_score', 0.0)

        # coordonatele de unde a fost facuta postarea
        lat = data.get('lat')
        lng = data.get('lng')
        location_point = None
        if lat and lng:
            location_point = Point(float(lng), float(lat), srid=4326)

        pulse = Pulse.objects.create(
            user=request.user,
            title=data.get('title'),
            description=data.get('description', ''),
            category=data.get('category', ''),
            pulse_type=data.get('pulse_type'),  # 'servicii' sau 'obiecte'
            price=data.get('price', 0),
            currencyType=data.get('currencyType', 'RON'),
            phone_number=data.get('phone_number', ''),
            location=location_point,
            is_available=data.get('is_available', 'true').lower() == 'true',

            is_flagged=should_flag,
            is_approved=not should_flag,
            toxicity_score=ai_score,
        )

        images = request.FILES.getlist('images')
        for img in images:
            PulseImage.objects.create(pulse=pulse, image=img)

        first_image = pulse.images.first()
        broadcast_payload = {
            "id": pulse.id,
            "type": pulse.pulse_type,
            "name": pulse.title,
            "user": request.user.username,
            "price": float(pulse.price),
            "currency": pulse.currencyType,
            "timestamp": pulse.created_at.strftime("%Y-%m-%d %H:%M"),
            "image": request.build_absolute_uri(first_image.image.url) if first_image else None,
            "lat": pulse.location.y if pulse.location else None,
            "lng": pulse.location.x if pulse.location else None,
        }

        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            "pulses_feed",
            {"type": "pulse.message", "data": broadcast_payload}
        )

        return JsonResponse({
            "success": True,
            "pulse": {
                "id": pulse.id,
                "title": pulse.title,
                "pulseType": pulse.pulse_type,
                "location": json.loads(pulse.location.geojson) if pulse.location else None,
                "images": [request.build_absolute_uri(i.image.url) for i in pulse.images.all()]
            }
        }, status=201)

    except Exception as e:
        return JsonResponse({"success": False, "error": str(e)}, status=400)

#adauga obiect in profile page


@login_required
@require_http_methods(["POST"])
def update_pulse(request, pulse_id):
    try:
        pulse = get_object_or_404(Pulse, id=pulse_id)
        if pulse.user != request.user:
            return JsonResponse({"error": "Permission denied"}, status=403)

        # Determine if JSON or FormData
        if request.content_type.startswith("application/json"):
            data = json.loads(request.body or "{}")
        else:
            data = request.POST
        # --- Update fields if present ---
        pulse.title = data.get("title", pulse.title)
        pulse.pulse_type = data.get("category", pulse.category)
        pulse.price = data.get("price", pulse.price)
        pulse.currencyType = data.get("currencyType", pulse.currencyType)
        pulse.description = data.get("description", pulse.description)
        pulse.phone_number = data.get("phone_number", pulse.phone_number)

        # Location handling (GeoJSON)
        loc = data.get("location") if hasattr(data, "get") else None
        if loc:
            coords = loc.get("coordinates")
            if coords and len(coords) == 2:
                pulse.location = Point(coords[0], coords[1], srid=4326)
        elif loc is None:
            pulse.location = None  # allow clearing location

        pulse.full_clean()
        pulse.save()

        # --- Handle uploaded images ---
        removed_images = request.POST.getlist("removed_images")
        if removed_images:
            for url in removed_images:
                filename = url.split("/")[-1]
                pulse.images.filter(image__icontains=filename).delete()

        # Add new uploaded images
        uploaded_files = request.FILES.getlist("images")
        for img in uploaded_files:
            pulse.images.create(image=img)

        # Prepare response data
        pulse_data = {
            "id": pulse.id,
            "title": pulse.title,
            "pulseType": pulse.pulse_type,
            "category": pulse.category,
            "price": float(pulse.price) if pulse.price is not None else None,
            "currencyType": pulse.currencyType,
            "description": pulse.description,
            "phone_number": pulse.phone_number,
            "location": {
                "type": "Point",
                "coordinates": [pulse.location.x, pulse.location.y]
            } if pulse.location else None,
            "images": [request.build_absolute_uri(img.image.url) for img in pulse.images.all()],
        }

        return JsonResponse({"message": "Pulse updated", "pulse": pulse_data}, status=200)

    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    except ValidationError as e:
        errors = getattr(e, "message_dict", None) or e.messages
        return JsonResponse({"error": errors}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@login_required
@require_http_methods(["DELETE"])
def remove_pulse(request, pulse_id):
    try:
        pulse = Pulse.objects.get(id=pulse_id, user=request.user)
        pulse.delete()
        return JsonResponse({"success": True})
    except Pulse.DoesNotExist:
        return JsonResponse({"success": False, "error": "Pulsul nu a fost găsit"}, status=404)
    except Exception as e:
        # If this triggers, check your console to see the specific error
        return JsonResponse(
            {"success": False, "error": str(e)},
            status=400
        )


@csrf_protect
@login_required
@require_POST
def update_location(request):
    try:
        data = json.loads(request.body)
        lat = data.get("lat")
        lng = data.get("lng")
        if lat is None or lng is None:
            return JsonResponse({"success": False, "error": "lat/lng required"}, status=400)
        request.user.location = Point(float(lng), float(lat), srid=4326)
        request.user.save(update_fields=["location"])
        return JsonResponse({"success": True})
    except Exception as e:
        return JsonResponse({"success": False, "error": str(e)}, status=400)


def get_base_pulse_queryset(user):

    qs = Pulse.objects.select_related("user").prefetch_related("images")

    if user.location and user.visibility_radius:
        qs = qs.filter(location__dwithin=(user.location, user.visibility_radius / 111.32))

    return qs

#fixed
@csrf_protect
@login_required
@require_http_methods(["GET"])
def get_latest_pulses(request):
    page_number = request.GET.get('page', 1)
    per_page = 15

    lat = request.GET.get("lat")
    lng = request.GET.get("lng")

    if lat and lng:
        ref_location = Point(float(lng), float(lat), srid=4326)
        radius_km = request.user.visibility_radius or 1
        pulses = (
            Pulse.objects.select_related("user").prefetch_related("images")
            .filter(location__dwithin=(ref_location, radius_km / 111.32))
            .order_by("-created_at")
        )
    else:
        pulses = get_base_pulse_queryset(request.user).order_by("-created_at")

    paginator = Paginator(pulses, per_page)
    page_obj = paginator.get_page(page_number)

    final_data = []
    for p in page_obj:
        images = list(p.images.all())
        image_url = request.build_absolute_uri(images[0].image.url) if images else None

        final_data.append({
            "id": p.id,
            "type": p.pulse_type,
            "user": p.user.username,
            "user_avatar": request.build_absolute_uri(p.user.profile_picture.url) if p.user.profile_picture else None,
            "name": p.title,
            "description": p.description,
            "popularity_score": p.popularity_score,
            "total_reviews": p.total_reviews,
            "price": float(p.price),
            "pulse_type": p.pulse_type,
            "currency": p.currencyType,
            "timestamp": p.created_at.strftime("%Y-%m-%d %H:%M"),
            "image": image_url,
        })

    return JsonResponse({
        "success": True,
        "pulses": final_data,
        "has_next": page_obj.has_next(),
    })


@csrf_protect
@login_required
@require_http_methods(["GET"])
def get_nearest_pulses(request):

    lat = request.GET.get("lat")
    lng = request.GET.get("lng")

    if lat and lng:
        ref_location = Point(float(lng), float(lat), srid=4326)
    else:
        ref_location = request.user.location

    if not ref_location:
        return JsonResponse({"success": False, "error": "Location required"}, status=400)

    radius_km = request.user.visibility_radius

    pulses = (
        Pulse.objects
        .filter(location__dwithin=(ref_location, radius_km / 111.32))
        .select_related("user")
        .prefetch_related("images")
        .annotate(distance=GisDistance("location", ref_location))
        .order_by("distance")[:10]
    )

    data = []
    for p in pulses:
        images = list(p.images.all())
        image_url = request.build_absolute_uri(images[0].image.url) if images else None

        data.append({
            "id": p.id,
            "type": p.pulse_type,
            "user": p.user.username,
            "name": p.title,
            "price": float(p.price),
            "pulse_type": p.pulse_type,
            "description": p.description,
            "popularity_score": p.popularity_score,
            "total_reviews": p.total_reviews,
            "currency": p.currencyType,
            "timestamp": p.created_at.strftime("%Y-%m-%d %H:%M"),
            "distance": round(p.distance.km, 2),
            "lat": p.location.y if p.location else None,
            "lng": p.location.x if p.location else None,
            "image": image_url,
        })

    return JsonResponse({
        "success": True,
        "pulses": data
    })


@csrf_protect
@login_required
@require_http_methods(["GET"])
def get_best_pulses(request):
    page_number = request.GET.get('page', 1)
    per_page = 15

    pulses = get_base_pulse_queryset(request.user).order_by("-popularity_score")

    paginator = Paginator(pulses, per_page)
    page_obj = paginator.get_page(page_number)

    final_data = []
    for p in page_obj:
        images = list(p.images.all())
        image_url = request.build_absolute_uri(images[0].image.url) if images else None

        final_data.append({
            "id": p.id,
            "type": p.pulse_type,
            "user": p.user.username,
            "user_avatar": request.build_absolute_uri(p.user.profile_picture.url) if p.user.profile_picture else None,
            "name": p.title,
            "price": float(p.price),
            "pulse_type": p.pulse_type,
            "description": p.description,
            "popularity_score": p.popularity_score,
            "total_reviews": p.total_reviews,
            "currency": p.currencyType,
            "timestamp": p.created_at.strftime("%Y-%m-%d %H:%M"),
            "image": image_url,
        })

    return JsonResponse({
        "success": True,
        "pulses": final_data,
        "has_next": page_obj.has_next(),
    })

@csrf_protect
@login_required
@require_http_methods(["GET"])
def get_favorite_pulses(request):
    page_number = request.GET.get("page", 1)
    per_page = request.GET.get("per_page", 15)

    search = request.GET.get("search", "").strip()
    pulse_type = request.GET.get("type", "all")
    sort = request.GET.get("sort", "recent")

    try:
        # Get IDs of pulses favorited by the user
        favorite_pulse_ids = FavoritePulse.objects.filter(
            user=request.user
        ).values_list("pulse_id", flat=True)

        pulses = Pulse.objects.filter(id__in=favorite_pulse_ids).select_related("user").prefetch_related("images")

        # Server-side filtering
        if search:
            pulses = pulses.filter(title__icontains=search)
        if pulse_type != "all":
            pulses = pulses.filter(pulse_type=pulse_type)

        # Server-side sorting
        if sort == "price_asc":
            pulses = pulses.order_by("price")
        elif sort == "price_desc":
            pulses = pulses.order_by("-price")
        else:  # recent
            pulses = pulses.order_by("-created_at")

        # Pagination
        paginator = Paginator(pulses, per_page)
        page_obj = paginator.get_page(page_number)

        final_data = []
        for p in page_obj:
            final_data.append({
                "id": p.id,
                "type": p.pulse_type,
                "user": p.user.username,
                "user_avatar": request.build_absolute_uri(p.user.profile_picture.url)
                if p.user.profile_picture else None,
                "name": p.title,
                "price": float(p.price),
                "currency": p.currencyType,
                "timestamp": p.created_at.strftime("%Y-%m-%d %H:%M"),
                "image": request.build_absolute_uri(p.images.first().image.url)
                if p.images.exists() else None,
                "is_favorite": True  # ✅ Always true here
            })

        return JsonResponse({
            "success": True,
            "pulses": final_data,
            "has_next": page_obj.has_next(),
            "next_page": page_obj.next_page_number() if page_obj.has_next() else None
        })

    except Exception as e:
        return JsonResponse({
            "success": False,
            "error": str(e)
        }, status=400)


@csrf_exempt
@login_required
@require_http_methods(["GET"])
def get_pulse_by_id(request, pulse_id):
    try:
        pulse = (
            Pulse.objects
            .select_related("user")
            .prefetch_related("images", "rentals")
            .get(id=pulse_id)
        )

        coords = list(pulse.location.coords) if pulse.location else [27.5766, 47.1585]

        images = [
            request.build_absolute_uri(img.image.url)
            for img in pulse.images.all()
        ]

        # Get reserved (unavailable) periods - return ISO strings for frontend
        unavailable_ranges = [
            {
                "start": rental.start_date.isoformat(),
                "end": rental.end_date.isoformat(),
                "status": rental.status,
                "renter_id": rental.renter_id if hasattr(rental, "renter_id") else None,
            }
            for rental in pulse.rentals.filter(status__in=["pending", "confirmed"])
        ]

        try:
            user_rating_obj = PulseRating.objects.get(pulse=pulse, user=request.user)
            user_rating = user_rating_obj.rating
        except PulseRating.DoesNotExist:
            user_rating = None

        data = {
            "id": pulse.id,
            "type": pulse.pulse_type,
            "user": pulse.user.username,
            "user_id": pulse.user.id,
            "user_avatar": request.build_absolute_uri(pulse.user.profile_picture.url) if pulse.user.profile_picture else None,
            "name": pulse.title,
            "description": pulse.description,
            "price": float(pulse.price),
            "currency": pulse.currencyType,
            "location": coords,
            "timestamp": pulse.created_at.strftime("%d %b %Y, %H:%M"),
            "is_favorite": FavoritePulse.objects.filter(
                pulse=pulse,
                user=request.user
            ).exists(),
            "images": images,
            "user_rating": user_rating,
            "reserved_periods": unavailable_ranges,  # kept for backwards compat
            "unavailable_ranges": unavailable_ranges,  # new canonical field
        }

        return JsonResponse({
            "success": True,
            "pulse": data
        })

    except Pulse.DoesNotExist:
        return JsonResponse({
            "success": False,
            "error": "Pulse not found"
        }, status=404)

    except Exception as e:
        return JsonResponse({
            "success": False,
            "error": str(e)
        }, status=400)


@login_required
def get_pulse_comments(request, pulse_id):
    if request.method == "GET":
        comments = (
            PulseComment.objects
            .filter(pulse_id=pulse_id)
            .select_related("user")
            .order_by("-pub_date")
        )

        data = []

        for comment in comments:
            data.append({
                "id": comment.id,
                "user": comment.user.username,
                "user_id": comment.user.id,
                "avatar": request.build_absolute_uri(comment.user.profile_picture.url) if comment.user.profile_picture else None,
                "content": comment.content,
                "date": comment.pub_date.strftime("%d %b %Y, %H:%M"),
                "can_delete": comment.can_delete(request.user),
            })

        return JsonResponse({
            "success": True,
            "comments": data
        })


    elif request.method == "POST":
        data = json.loads(request.body)
        content = data.get("content")
        if not content:
            return JsonResponse({
                "success": False,
                "error": "Content is required"
            })

        comment = PulseComment.objects.create(
            pulse_id=pulse_id,
            user=request.user,
            content=content

        )

        return JsonResponse({
            "success": True,
            "comment": {
                "id": comment.id,
                "user": comment.user.username,
                "user_id": comment.user.id,
                "avatar": request.build_absolute_uri(
                    comment.user.profile_picture.url) if comment.user.profile_picture else None,
                "content": comment.content,
                "date": comment.pub_date.strftime("%d %b %Y, %H:%M"),
                "can_delete": comment.can_delete(request.user),
            }
        })
    elif request.method == "DELETE":
        # get comment_id from query params or body

        comment_id = pulse_id
        if not comment_id:
            return JsonResponse({"success": False, "error": "Comment ID required"}, status=400)

        try:
            comment = PulseComment.objects.get(id=comment_id)
            if comment.user != request.user:
                return JsonResponse({"success": False, "error": "Not allowed"}, status=403)
            comment.delete()
            return JsonResponse({"success": True, "message": "Comment deleted"})
        except PulseComment.DoesNotExist:
            return JsonResponse({"success": False, "error": "Comment not found"}, status=404)
    else:
        return JsonResponse({
            "success": False,
            "error": "Invalid request method"
        }, status=405)


@login_required
def add_pulse_rating(request, pulse_id):
    if request.method != "POST":
        return JsonResponse({"success": False, "error": "Invalid request method"}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"success": False, "error": "Invalid JSON"}, status=400)

    rating_value = data.get("rating")

    if not rating_value or not (1 <= rating_value <= 10):
        return JsonResponse({"success": False, "error": "Rating must be between 1 and 10"})

    try:
        pulse = Pulse.objects.get(id=pulse_id)
    except Pulse.DoesNotExist:
        return JsonResponse({"success": False, "error": "Pulse not found"}, status=404)

    # Check if user has already rated
    rating_obj, created = PulseRating.objects.update_or_create(
        pulse=pulse,
        user=request.user,
        defaults={"rating": rating_value}
    )

    # Update pulse popularity score and total reviews
    all_ratings = PulseRating.objects.filter(pulse=pulse)
    total_reviews = all_ratings.count()
    popularity_score = all_ratings.aggregate(avg=models.Avg('rating'))['avg'] or 0

    pulse.total_reviews = total_reviews
    pulse.popularity_score = Decimal(popularity_score).quantize(Decimal('0.01'))
    pulse.save(update_fields=['total_reviews', 'popularity_score'])

    return JsonResponse({
        "success": True,
        "rating": rating_obj.rating,
        "created": created,
        "total_reviews": total_reviews,
        "popularity_score": float(pulse.popularity_score)
    })

@login_required
@csrf_exempt
def create_pulse_rental(request):
    if request.method != "POST":
        return JsonResponse({"success": False, "error": "Invalid request method."}, status=405)

    try:
        data = json.loads(request.body)
        pulse_id = data.get("pulse_id")
        start_date_str = data.get("start_date")
        end_date_str = data.get("end_date")
        proposed_price = data.get("proposed_price")
    except Exception:
        return JsonResponse({"success": False, "error": "Invalid JSON data."}, status=400)

    if not all([pulse_id, start_date_str, end_date_str, proposed_price]):
        return JsonResponse({"success": False, "error": "Missing required fields."}, status=400)

    try:
        pulse = Pulse.objects.get(id=pulse_id)
    except Pulse.DoesNotExist:
        return JsonResponse({"success": False, "error": "Pulse not found."}, status=404)

    if pulse.user == request.user:
        return JsonResponse({"success": False, "error": "You cannot propose a rental to your own pulse."}, status=403)

    start_date = parse_datetime(start_date_str) or parse_date(start_date_str)
    end_date = parse_datetime(end_date_str) or parse_date(end_date_str)

    if not start_date or not end_date or start_date > end_date:
        return JsonResponse({"success": False, "error": "Invalid rental dates."}, status=400)

    total_days = (end_date - start_date).days + 1

    try:
        proposed_price = float(proposed_price)
        if proposed_price <= 0:
            raise ValueError
    except ValueError:
        return JsonResponse({"success": False, "error": "Proposed price must be positive."}, status=400)

    proposed_total = proposed_price * total_days

    overlapping = PulseRental.objects.filter(
        pulse=pulse,
        start_date__lte=end_date,
        end_date__gte=start_date,
    ).exists()

    if overlapping:
        return JsonResponse({"success": False, "error": "Selected period overlaps with an existing reservation."}, status=400)

    rental = PulseRental.objects.create(
        pulse=pulse,
        renter=request.user,
        start_date=start_date,
        end_date=end_date,
        total_price=proposed_total,
        initial_price=proposed_total,
        status="pending",
    )

    # -------- CREATE DATABASE NOTIFICATION --------

    notification = Notification.objects.create(
        user=pulse.user,
        sender=request.user,
        type="rental_proposal",
        title="New Rental Proposal",
        message=f"{request.user.username} proposed {proposed_total} for {pulse.title}",
        pulse_id=pulse.id,
        rental_id=rental.id,
        metadata={
            "proposed_total": proposed_total
        }
    )

    # -------- SEND WEBSOCKET NOTIFICATION --------

    channel_layer = get_channel_layer()

    async_to_sync(channel_layer.group_send)(
        f"user_notifications_{pulse.user.id}",
        {
            "type": "send_rental_notification",
            "title": notification.title,
            "message": notification.message,
            "pulse_id": pulse.id,
            "rental_id": rental.id,
            "proposed_total": proposed_total,
            "renter_id": request.user.id,
            "renter_username": request.user.username,
        }
    )

    return JsonResponse({
        "success": True,
        "rental_id": rental.id,
        "total_price": proposed_total
    })

    # -------------------------------------------------
    # Send realtime WebSocket notification
    # -------------------------------------------------

    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"user_notifications_{pulse.user.id}",
        {
            "type": "send_rental_notification",  # note the new handler
            "title": "New Rental Proposal",
            "message": f"{request.user.username} proposed {proposed_total} for {pulse.title}",
            "pulse_id": pulse.id,
            "rental_id": rental.id,
            "proposed_total": proposed_total,
            "renter_id": request.user.id,
            "renter_username": request.user.username,
        }
    )

    return JsonResponse({
        "success": True,
        "rental_id": rental.id,
        "proposed_total": proposed_total
    })


def get_user_rentals(request):
    if request.method == "GET":
        rentals = PulseRental.objects.filter(pulse__user=request.user)

        data = []
        for rental in rentals:
            data.append({
                "id": rental.id,
                "pulse_title": rental.pulse.title,
                "pulse_type": rental.pulse.pulse_type,
                "renter": rental.renter.username,
                "start_date": rental.start_date,
                "end_date": rental.end_date,
                "total_price": str(rental.total_price),
                "initial_price": str(rental.initial_price),
                "status": rental.status,
            })

        return JsonResponse(data, safe=False)


@csrf_exempt
def modify_rental_status(request, rental_id):
    try:
        rental = PulseRental.objects.get(id=rental_id)
    except PulseRental.DoesNotExist:
        return JsonResponse({"error": "Rental not found"}, status=404)

    user = request.user
    is_owner = rental.pulse.user == user
    is_renter = rental.renter == user

    if request.method == "PATCH":
        if not (is_owner or is_renter):
            return JsonResponse({"error": "Unauthorized"}, status=403)

        try:
            data = json.loads(request.body)
            status = data.get("status")            # accept / decline
            new_total_price = data.get("total_price")  # counteroffer price

            notify_other_user = False

            # --- handle status update ---
            if status:
                rental.status = status
                rental.last_offer_by = None  # reset last_offer_by if accepted/declined

            # --- handle counteroffer ---
            if new_total_price is not None:
                rental.total_price = float(new_total_price)
                rental.status = "pending"  # counteroffers set status back to pending
                rental.last_offer_by = user  # track who made the last offer
                notify_other_user = True     # flag to send notification

            # calculate duration
            duration = (rental.end_date - rental.start_date).days
            if duration <= 0:
                duration = 1

            rental.save()

            # --- send notification if counteroffer was made ---
            if notify_other_user:
                other_user = rental.pulse.user if is_renter else rental.renter

                notification = Notification.objects.create(
                    user=other_user,
                    sender=user,
                    type="rental_proposal",
                    title="Rental Counteroffer",
                    message=f"{user.username} updated the rental price for {rental.pulse.title} to {rental.total_price}",
                    pulse_id=rental.pulse.id,
                    rental_id=rental.id,
                    metadata={"new_total_price": rental.total_price}
                )

                # send via WebSocket
                channel_layer = get_channel_layer()
                async_to_sync(channel_layer.group_send)(
                    f"user_notifications_{other_user.id}",
                    {
                        "type": "send_rental_notification",
                        "title": notification.title,
                        "message": notification.message,
                        "pulse_id": rental.pulse.id,
                        "rental_id": rental.id,
                        "total_price": rental.total_price,
                        "sender_id": user.id,
                        "sender_username": user.username,
                    }
                )

            return JsonResponse({
                "message": "Rental updated successfully",
                "status": rental.status,
                "days": duration,
                "total_price": rental.total_price,
                "last_offer_by": rental.last_offer_by.id if rental.last_offer_by else None
            })

        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)

    elif request.method == "DELETE":
        # only renter can cancel their proposal
        if not is_renter:
            return JsonResponse({"error": "Only the renter can delete this proposal"}, status=403)

        rental.delete()
        return JsonResponse({"message": "Proposal deleted successfully"})

    return JsonResponse({"error": "Invalid method"}, status=405)



@login_required
def get_rental_proposals(request):
    if request.method == "GET":
        user = request.user
        rentals = PulseRental.objects.filter(renter=user)

        data = []
        for rental in rentals:
            data.append({
                "id": rental.id,
                "pulse_title": rental.pulse.title,
                "pulse_type": rental.pulse.pulse_type,
                "renter": rental.renter.username,
                "start_date": rental.start_date,
                "end_date": rental.end_date,
                "total_price": str(rental.total_price),
                "last_offer_by": rental.last_offer_by.id if rental.last_offer_by else None,
                "initial_price": str(rental.initial_price),
                "status": rental.status,
            })

        return JsonResponse(data, safe=False)

@login_required
@require_POST
def add_pulse_to_favorites(request, pulse_id):
    try:
        pulse = Pulse.objects.get(id=pulse_id)

        favorite, created = FavoritePulse.objects.get_or_create(
            pulse=pulse,
            user=request.user
        )

        if not created:
            return JsonResponse({
                "success": True,
                "message": "Already in favorites",
                "favorited": True
            })

        return JsonResponse({
            "success": True,
            "message": "Added to favorites",
            "favorited": True
        })

    except Pulse.DoesNotExist:
        return JsonResponse({
            "success": False,
            "error": "Pulse not found"
        }, status=404)

    except Exception as e:
        return JsonResponse({
            "success": False,
            "error": str(e)
        }, status=400)


@login_required
@require_POST
def add_pulse_to_favorites(request, pulse_id):
    try:
        pulse = Pulse.objects.get(id=pulse_id)

        favorite, created = FavoritePulse.objects.get_or_create(
            pulse=pulse,
            user=request.user
        )

        if not created:
            return JsonResponse({
                "success": True,
                "message": "Already in favorites",
                "favorited": True
            })

        return JsonResponse({
            "success": True,
            "message": "Added to favorites",
            "favorited": True
        })

    except Pulse.DoesNotExist:
        return JsonResponse({
            "success": False,
            "error": "Pulse not found"
        }, status=404)

    except Exception as e:
        return JsonResponse({
            "success": False,
            "error": str(e)
        }, status=400)



@login_required
@require_http_methods(["DELETE"])
def delete_pulse_from_favorites(request, pulse_id):
    try:
        pulse = Pulse.objects.get(id=pulse_id)

        favorite = FavoritePulse.objects.filter(
            pulse=pulse,
            user=request.user
        ).first()

        if not favorite:
            return JsonResponse({
                "success": True,
                "message": "Not in favorites",
                "favorited": False
            })

        favorite.delete()

        return JsonResponse({
            "success": True,
            "message": "Removed from favorites",
            "favorited": False
        })

    except Pulse.DoesNotExist:
        return JsonResponse({
            "success": False,
            "error": "Pulse not found"
        }, status=404)

    except Exception as e:
        return JsonResponse({
            "success": False,
            "error": str(e)
        }, status=400)


User = get_user_model()

@csrf_exempt
@login_required
def search_users(request):
    query = request.GET.get("q", "")

    users = User.objects.filter(
        Q(username__icontains=query) |
        Q(first_name__icontains=query) |
        Q(last_name__icontains=query)
    ).exclude(id=request.user.id)[:20]

    from .models import Follow, PendingFollow, Friendship

    results = []

    for user in users:

        # Friendship check (sorted IDs like your model)
        is_friend = Friendship.objects.filter(
            user1_id=min(request.user.id, user.id),
            user2_id=max(request.user.id, user.id),
        ).exists()

        results.append({
            "id": user.id,
            "username": user.username,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "profile_picture": (
                user.profile_picture.url if user.profile_picture else None
            ),
            "private_account": user.private_account,

            "is_following": Follow.objects.filter(
                follower=request.user,
                following=user
            ).exists(),

            "pending_follow": PendingFollow.objects.filter(
                requester=request.user,
                target=user
            ).exists(),

            "is_friend": is_friend,
        })

    return JsonResponse({"users": results})



@login_required
def user_profile(request, user_id):
    if request.method == "GET":
        user = User.objects.get(id=user_id)

        is_friend = Friendship.objects.filter(
            user1_id=min(request.user.id, user.id),
            user2_id=max(request.user.id, user.id),
        ).exists()

        pulses = Pulse.objects.filter(user=user).prefetch_related('images')

        pulses_data = [
            {
                "id": p.id,
                "title": p.title,
                "pulseType": p.pulse_type,
                "category": p.category,
                "price": float(p.price),
                "currencyType": p.currencyType,
                "description": p.description,
                "images": [request.build_absolute_uri(img.image.url) for img in p.images.all()],
                "phone_number": p.phone_number,
            } for p in pulses
        ]

        user_data = {
            "id": user.id,
            "email": user.email,
            "firstName": user.first_name,
            "lastName": user.last_name,
            "username": user.username,
            "profilePicture": request.build_absolute_uri(user.profile_picture.url) if user.profile_picture else None,
            "biography": user.biography,
            "location": (
                {"lat": user.location.y, "lng": user.location.x}
                if user.location
                else None
            ),
            "visibilityRadius": user.visibility_radius,
            "quiet_hours_start": user.quiet_hours_start,
            "quiet_hours_end": user.quiet_hours_end,
            "trustScore": user.trust_score,
            "isVerified": user.is_verified,
            "onlineStatus": user.online_status,
            "private_account": user.private_account,
            "is_following": Follow.objects.filter(
                follower=request.user,
                following=user
            ).exists(),
            "pending_follow": PendingFollow.objects.filter(
                requester=request.user,
                target=user
            ).exists(),
            "is_friend": is_friend,
            "pulses": pulses_data,
        }

        return JsonResponse({"user": user_data})

    return JsonResponse({"error": "Method not allowed"}, status=405)



@csrf_exempt
@login_required
def follow_user(request, user_id):
    from .models import Follow, PendingFollow

    target = User.objects.get(id=user_id)

    #  If already following → ignore
    if Follow.objects.filter(
        follower=request.user,
        following=target
    ).exists():
        return JsonResponse({"already_following": True})

    #  If target is private → create pending request
    if target.private_account:
        PendingFollow.objects.get_or_create(
            requester=request.user,
            target=target
        )

        return JsonResponse({"status": "pending_request_created"})

    #  Public account → create follow directly
    Follow.objects.get_or_create(
        follower=request.user,
        following=target
    )

    return JsonResponse({"status": "follow_created"})


@login_required
def unfollow_user(request, user_id):
    from .models import Follow, Friendship

    target = User.objects.get(id=user_id)

    # Try to get friendship safely
    friendship = Friendship.objects.filter(
        user1_id=min(request.user.id, target.id),
        user2_id=max(request.user.id, target.id),
    ).first()

    if friendship:
        # If friendship exists → delete it
        friendship.delete()

        # Optional: recreate follow from target → user
        Follow.objects.get_or_create(
            follower=target,
            following=request.user
        )

    else:
        # No friendship → just remove follow
        Follow.objects.filter(
            follower=request.user,
            following=target
        ).delete()

        PendingFollow.objects.filter(
            requester=request.user,
            target=target
        ).delete()

    return JsonResponse({"success": True})


@csrf_exempt
@login_required
def accept_follow_request(request, request_id):
    from .models import PendingFollow, Follow

    pending = PendingFollow.objects.get(
        id=request_id,
        target=request.user
    )

    requester = pending.requester

    # Create real follow
    Follow.objects.get_or_create(
        follower=requester,
        following=request.user
    )

    # Delete pending request
    pending.delete()

    return JsonResponse({"status": "accepted"})

@csrf_exempt
@login_required
def reject_follow_request(request, request_id):
    from .models import PendingFollow

    PendingFollow.objects.filter(
        id=request_id,
        target=request.user
    ).delete()

    return JsonResponse({"status": "rejected"})

@csrf_exempt
@login_required
def get_follow_requests(request):
    from .models import PendingFollow

    requests = PendingFollow.objects.filter(
        target=request.user
    ).select_related("requester")

    data = [
        {
            "id": r.id,
            "requester": {
                "id": r.requester.id,
                "username": r.requester.username,
                "first_name": r.requester.first_name,
                "last_name": r.requester.last_name,
            }
        }
        for r in requests
    ]

    return JsonResponse({"requests": data})


from django.http import JsonResponse
from asgiref.sync import sync_to_async, async_to_sync
from django.db.models import Q
from .models import User, DirectConversation, Friendship, DirectMessage, Group_Message


# --- SYNC HELPERS ---

def handle_create_conversation_sync(request, user2_id):
    try:
        if not request.user.is_authenticated:
            return {"error": "Authentication required", "status": 401}

        # Parse JSON body
        try:
            body = json.loads(request.body)
            from_pulse = body.get("fromPulse", False)  # default to False
        except json.JSONDecodeError:
            from_pulse = False

        user1 = request.user
        try:
            user2 = User.objects.get(id=user2_id)
        except User.DoesNotExist:
            return {"error": "User not found", "status": 404}

        if user1.id == user2.id:
            return {"error": "Cannot chat with yourself", "status": 400}

        # Order users by ID for the unique_together constraint
        u_first, u_second = (user1, user2) if user1.id < user2.id else (user2, user1)

        is_friend = Friendship.objects.filter(user1_id=u_first.id, user2_id=u_second.id).exists()
        is_public = not getattr(user2, 'private_account', False)

        if is_friend or is_public or from_pulse:
            conversation, created = DirectConversation.objects.get_or_create(
                user1=u_first,
                user2=u_second
            )

            return {
                "conversation_id": conversation.id,
                "created": created,
                "status": 200
            }

        return {"error": "Privacy settings prevent messaging", "status": 403}

    except Exception as e:
        return {"error": str(e), "status": 500}


def fetch_messages_sync(request, chat_type, conversation_id):
    """Safely handles session check and message fetching in sync thread."""
    if not request.user.is_authenticated:
        return {"error": "Unauthorized", "status": 401}

    if chat_type == "direct":
        messages = DirectMessage.objects.filter(conversation_id=conversation_id).order_by('timestamp')[:50]
    else:
        messages = Group_Message.objects.filter(conversation_id=conversation_id).order_by('timestamp')[:50]

    history = [{
        "sender_id": msg.sender.id,
        "sender_username": msg.sender.username,
        "content": msg.content,
        "timestamp": msg.timestamp.isoformat(),
        "is_mine": (msg.sender.id == request.user.id),
    } for msg in messages]

    return {"history": history, "status": 200}


# --- ASYNC VIEWS ---

async def create_direct_conversation(request, user2_id):
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    # VITAL: We pass 'request' itself, NOT 'request.user'
    result = await sync_to_async(handle_create_conversation_sync, thread_sensitive=True)(
        request, user2_id
    )

    status_code = result.pop("status")
    return JsonResponse(result, status=status_code)


async def get_message_history(request, chat_type, conversation_id):
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    result = await sync_to_async(fetch_messages_sync, thread_sensitive=True)(
        request, chat_type, conversation_id
    )

    status_code = result.pop("status")
    return JsonResponse(result, status=status_code)


@login_required
def my_conversations(request):
    if request.method != "GET":
        return JsonResponse({"error": "Invalid request method"}, status=405)

    user = request.user
    results = []

    # 1️⃣ Direct Conversations
    direct_convos = DirectConversation.objects.filter(
        Q(user1=user) | Q(user2=user)
    )

    for convo in direct_convos:
        other_user = convo.user2 if convo.user1 == user else convo.user1
        last_msg = convo.messages.order_by("-timestamp").first()

        results.append({
            "id": convo.id,
            "type": "direct",
            "name": f"{other_user.first_name} {other_user.last_name}",
            "username": other_user.username,
            "last_message": last_msg.content if last_msg else "No messages yet",
            "timestamp": last_msg.timestamp.isoformat() if last_msg else convo.created_at.isoformat(),
            "unread": convo.messages.filter(is_read=False)
                                     .exclude(sender=user)
                                     .count()
        })

    # 2️⃣ Group Conversations
    group_convos = user.conversations.all()

    for convo in group_convos:
        last_msg = convo.messages.order_by("-timestamp").first()

        results.append({
            "id": convo.id,
            "type": "group",
            "name": f"Group Chat {convo.id}",  # change later if you add name field
            "last_message": last_msg.content if last_msg else "No messages yet",
            "timestamp": last_msg.timestamp.isoformat() if last_msg else convo.created_at.isoformat(),
            "unread": convo.messages.filter(is_read=False)
                                     .exclude(sender=user)
                                     .count()
        })

    # 3️⃣ Sort by most recent
    results.sort(key=lambda x: x["timestamp"], reverse=True)

    return JsonResponse(results, safe=False)



@login_required
def list_alerts(request):
    """Return all active alerts with their images"""

    # Get alerts, include user in one join, and prefetch images
    alerts = Alert.objects.filter(is_active=True)\
        .select_related("user")\
        .prefetch_related("images")\
        .order_by("-created_at")

    data = [
        {
            "id": alert.id,
            "user_id": alert.user.id,
            "user_name": alert.user.username,
            "title": alert.title,
            "description": alert.description,
            "category": alert.category,
            "category_display": alert.get_category_display(),
            "created_at": alert.created_at.isoformat(),
            "lat": float(alert.location.y),
            "lng": float(alert.location.x),
            "images": [request.build_absolute_uri(img.image.url) for img in alert.images.all()]
        }
        for alert in alerts
    ]

    return JsonResponse({"success": True, "alerts": data})


@login_required
@check_hate_speech
def create_alert(request):
    if request.method != "POST":
        return JsonResponse({"success": False, "error": "Invalid request method."}, status=405)

    should_flag = getattr(request, 'needs_review', False)
    ai_score = getattr(request, 'toxicity_score', 0.0)

    try:
        title = request.POST.get("title")
        description = request.POST.get("description")
        category = request.POST.get("category", "other")
        location_json = request.POST.get("location")

        location = None
        if location_json:
            loc = json.loads(location_json)
            lng, lat = loc["coordinates"]
            location = Point(lng, lat)

        if not title or not description:
            return JsonResponse({"success": False, "error": "Title and description are required."}, status=400)

        # 1. Create the Alert
        alert = Alert.objects.create(
            user=request.user,
            title=title,
            description=description,
            category=category,
            location=location,

            is_flagged = should_flag,
            is_approved = not should_flag,
            toxicity_score = ai_score,
        )

        # 2. Save the images
        images_files = request.FILES.getlist("images")
        saved_images = []
        for img_file in images_files:
            img_obj = AlertImage.objects.create(alert=alert, image=img_file)
            saved_images.append(request.build_absolute_uri(img_obj.image.url))

        # 3. Prepare data for WebSocket (Match your JSX keys!)
        user_avatar = None
        if hasattr(request.user, 'profile_picture') and request.user.profile_picture:
            user_avatar = request.build_absolute_uri(request.user.profile_picture.url)

        broadcast_data = {
            "id": alert.id,
            "title": alert.title,
            "description": alert.description,
            "category": alert.category,
            "category_display": alert.get_category_display(),
            "user_name": request.user.username,  # Matches a.user_name in JSX
            "user_avatar": user_avatar,
            "created_at": alert.created_at.isoformat(),
            "lat": location.y if location else None,
            "lng": location.x if location else None,
            "images": saved_images, # List of full URLs
            "image": saved_images[0] if saved_images else None,
        }

        # 4. Broadcast to Channels
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            "alerts_feed",
            {
                "type": "alert.message",
                "data": broadcast_data,
            }
        )

        return JsonResponse({
            "success": True,
            "alert_id": alert.id,
            "category_display": alert.get_category_display()
        })

    except Exception as e:
        return JsonResponse({"success": False, "error": str(e)}, status=400)


def alert_details(request, alert_id):
    alert = get_object_or_404(Alert, id=alert_id)

    # Increment views if the user is not the owner

    # Fetch all related images and build absolute URLs for the frontend
    image_urls = [
        request.build_absolute_uri(img.image.url)
        for img in alert.images.all()
    ]

    is_confirmed = False
    if request.user.is_authenticated and request.user != alert.user:
        if request.user.id not in alert.viewed_users:
            alert.views_count += 1
            alert.viewed_users.append(request.user.id)
            alert.save()

    data = {
        "id": alert.id,
        "title": alert.title,
        "description": alert.description,
        "category": alert.category,
        "category_display": alert.get_category_display(),
        "created_at": alert.created_at,
        "user": alert.user.username,
        "user_id": alert.user.id,
        "lat": alert.location.y if alert.location else None,
        "lng": alert.location.x if alert.location else None,
        "images": image_urls,
        "confirm_count": alert.confirm_count,
        "report_count": alert.report_count,
        "views_count": alert.views_count,  # <-- use the actual field
        "is_confirmed": is_confirmed,
    }

    return JsonResponse({
        "success": True,
        "alert": data
    })

@login_required
@require_POST
def confirm_alert(request, alert_id):
    alert = get_object_or_404(Alert, id=alert_id)

    try:
        AlertConfirm.objects.create(alert=alert, user=request.user)
        return JsonResponse({"success": True, "message": "Alert confirmed.", "confirm_count": alert.confirm_count + 1})
    except IntegrityError:
        # User already confirmed
        return JsonResponse({"success": False, "message": "You have already confirmed this alert."})


@login_required
@require_POST
def unconfirm_alert(request, alert_id):
    alert = get_object_or_404(Alert, id=alert_id)
    confirm = AlertConfirm.objects.filter(alert=alert, user=request.user).first()
    if confirm:
        confirm.delete()
        return JsonResponse({"success": True, "message": "Confirmation removed.", "confirm_count": alert.confirm_count - 1})
    return JsonResponse({"success": False, "message": "You had not confirmed this alert."})


@login_required
@csrf_exempt  # if you're using fetch with CSRF token
def report_alert(request, alert_id):
    if request.method != "POST":
        return JsonResponse({"success": False, "error": "Invalid method"}, status=405)

    alert = get_object_or_404(Alert, id=alert_id)

    try:
        data = json.loads(request.body)
        reason = data.get("reason")
        description = data.get("description", "")
        if not reason:
            return JsonResponse({"success": False, "error": "Reason is required"}, status=400)

        report = AlertReport.objects.create(
            alert=alert,
            user=request.user,
            reason=reason,
            description=description
        )

        # Increment report_count (your model's save already does this)
        alert.refresh_from_db()

        return JsonResponse({
            "success": True,
            "report_id": report.id,
            "report_count": alert.report_count
        })
    except Exception as e:
        return JsonResponse({"success": False, "error": str(e)}, status=500)


@login_required
def get_notifications(request):
    notifications = Notification.objects.filter(user=request.user).order_by('-created_at')[:20]
    data = []
    for n in notifications:
        data.append({
            "id": n.id,
            "type": n.type,
            "title": n.title,
            "message": n.message,
            "pulse_id": n.pulse_id,
            "rental_id": n.rental_id,
            "conversation_id": n.conversation_id,
            "sender_id": n.sender.id,
            "is_read": n.is_read,
            "created_at": n.created_at.strftime("%b %d, %H:%M"),
            "sender_name": n.sender.username if n.sender else "System"
        })

    return JsonResponse({"notifications": data}, safe=False)


@login_required
def mark_notifications_read(request):
    Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
    return JsonResponse({"status": "success"})


@login_required
def delete_notification(request, notif_id):
    if request.method != "DELETE":
        return JsonResponse({"success": False, "error": "Invalid request method"}, status=405)

    try:
        notification = Notification.objects.get(id=notif_id, user=request.user)
        notification.delete()

        return JsonResponse({
            "success": True,
            "message": "Notification deleted"
        })

    except Notification.DoesNotExist:
        return JsonResponse({
            "success": False,
            "error": "Notification not found"
        }, status=404)


def urgent_requests_list(request):
    user = request.user

    if not user.is_authenticated or not user.skills:
        return JsonResponse({"success": True, "urgent_requests": []})

    if not user.location:
        return JsonResponse({"success": True, "urgent_requests": []})

    skills = [str(s).strip() for s in user.skills if str(s).strip()]
    skill_embeddings = [_get_st_model().encode(s, convert_to_tensor=True) for s in skills]

    candidates = (
        UrgentRequest.objects
        .filter(is_active=True, location__isnull=False)
        .exclude(user=user)
        .select_related("user")
        .prefetch_related("images")
        .annotate(dist=GisDistance("location", user.location))
    )
    # Show requests where the viewer is within the poster's visibility_radius
    active_requests = [r for r in candidates if r.dist.m <= r.user.visibility_radius * 1000]
    data = []

    for obj in active_requests:
        query_text = f"{obj.title} {obj.description}".strip()
        query_emb = _get_st_model().encode(query_text, convert_to_tensor=True)

        best_score = max(
            st_util.cos_sim(query_emb, skill_emb).item()
            for skill_emb in skill_embeddings
        )

        if best_score > 0.50:
            data.append({
                "id": obj.id,
                "user_id": obj.user.id,
                "user": obj.user.username,
                "title": obj.title,
                "description": obj.description,
                "category": obj.category,
                "max_price": float(obj.max_price) if obj.max_price else None,
                "location": [obj.location.x, obj.location.y] if obj.location else None,
                "created_at": obj.created_at.isoformat(),
                "expires_at": obj.expires_at.isoformat() if obj.expires_at else None,
                "match_score": round(best_score * 100, 1),
                "images": [request.build_absolute_uri(img.image.url) for img in obj.images.all()],
            })

    data.sort(key=lambda x: x["match_score"], reverse=True)
    return JsonResponse({"success": True, "urgent_requests": data})

@require_GET
def list_all_requests(request):
    page = int(request.GET.get("page", 1))
    page_size = 15

    qs = (
        UrgentRequest.objects
        .filter(is_active=True)
        .select_related("user")
        .prefetch_related("images")
        .order_by("-created_at")
    )

    total_count = qs.count()
    total_pages = ceil(total_count / page_size)

    start = (page - 1) * page_size
    end = start + page_size

    urgent_requests = qs[start:end]

    results = []
    for req in urgent_requests:
        images = [
            request.build_absolute_uri(img.image.url)
            for img in req.images.all()
            if img.image
        ]

        location_data = None
        if req.location:
            location_data = {
                "lat": req.location.y,
                "lng": req.location.x,
            }

        results.append({
            "id": req.id,
            "user": req.user.username,
            "title": req.title,
            "description": req.description,
            "category": req.category,
            "max_price": str(req.max_price) if req.max_price else None,
            "location": location_data,
            "created_at": req.created_at.isoformat() if req.created_at else None,
            "expires_at": req.expires_at.isoformat() if req.expires_at else None,
            "images": images,
        })

    return JsonResponse({
        "results": results,
        "page": page,
        "total_pages": total_pages,
        "has_next": page < total_pages,
        "has_previous": page > 1,
    })


def urgent_request_detail(request, request_id):
    """Return a single urgent request as JSON."""
    try:
        obj = UrgentRequest.objects.get(id=request_id, is_active=True)
    except UrgentRequest.DoesNotExist:
        return JsonResponse({"success": False, "error": "Urgent request not found"}, status=404)



    data = {
        "id": obj.id,
        "user_id": obj.user.id,
        "user": obj.user.username,
        "title": obj.title,
        "description": obj.description,
        "category": obj.category,
        "max_price": float(obj.max_price) if obj.max_price else None,
        "location": [obj.location.x, obj.location.y] if obj.location else None,
        "created_at": obj.created_at.isoformat(),
        "expires_at": obj.expires_at.isoformat() if obj.expires_at else None,
    }
    return JsonResponse({"success": True, "urgent_request": data})



@login_required
@require_POST
@check_hate_speech
def create_urgent_request(request):
    data = request.POST

    should_flag = getattr(request, 'needs_review', False)
    ai_score = getattr(request, 'toxicity_score', 0.0)

    new_request = UrgentRequest.objects.create(
        user=request.user,
        description=data.get("description"),
        title=data.get("title"),
        category=data.get("category"),
        expires_at=data.get("expires_at"),
        location=Point(float(data["lng"]), float(data["lat"])) if "lng" in data and "lat" in data else None,
        max_price=data.get("max_price", 0),

        is_flagged=should_flag,
        is_approved=not should_flag,
        toxicity_score=ai_score,
    )

    images = request.FILES.getlist("images")
    for img in images:
        UrgentRequestImage.objects.create(urgent_request=new_request, image=img)

    run_hero_search_task.delay(new_request.id)

    return JsonResponse({"success": True, "id": new_request.id})


@login_required
def get_request_comments(request, request_id):
    if request.method == "GET":
        comments = (
            RequestComment.objects
            .filter(request_id=request_id)
            .select_related("user")
            .order_by("-pub_date")
        )

        data = []

        for comment in comments:
            data.append({
                "id": comment.id,
                "user": comment.user.username,
                "user_id": comment.user.id,
                "avatar": request.build_absolute_uri(comment.user.profile_picture.url) if comment.user.profile_picture else None,
                "content": comment.content,
                "date": comment.pub_date.strftime("%d %b %Y, %H:%M"),
                "can_delete": comment.can_delete(request.user),
            })

        return JsonResponse({
            "success": True,
            "comments": data
        })


    elif request.method == "POST":
        data = json.loads(request.body)
        content = data.get("content")
        if not content:
            return JsonResponse({
                "success": False,
                "error": "Content is required"
            })

        comment = RequestComment.objects.create(
            request_id=request_id,
            user=request.user,
            content=content

        )

        return JsonResponse({
            "success": True,
            "comment": {
                "id": comment.id,
                "user": comment.user.username,
                "user_id": comment.user.id,
                "avatar": request.build_absolute_uri(
                    comment.user.profile_picture.url) if comment.user.profile_picture else None,
                "content": comment.content,
                "date": comment.pub_date.strftime("%d %b %Y, %H:%M"),
                "can_delete": comment.can_delete(request.user),
            }
        })
    elif request.method == "DELETE":
        # get comment_id from query params or body

        comment_id = request_id
        if not comment_id:
            return JsonResponse({"success": False, "error": "Comment ID required"}, status=400)

        try:
            comment = RequestComment.objects.get(id=comment_id)
            if comment.user != request.user:
                return JsonResponse({"success": False, "error": "Not allowed"}, status=403)
            comment.delete()
            return JsonResponse({"success": True, "message": "Comment deleted"})
        except RequestComment.DoesNotExist:
            return JsonResponse({"success": False, "error": "Comment not found"}, status=404)
    else:
        return JsonResponse({
            "success": False,
            "error": "Invalid request method"
        }, status=405)



def admin_alert_reports(request):
    if not request.user.is_staff:
        return JsonResponse({"error": "Unauthorized"}, status=403)

    reports = AlertReport.objects.select_related("alert", "user").all()
    data = [
        {
            "id": r.id,
            "alert_id": r.alert.id,
            "alert_title": getattr(r.alert, "title", ""),
            "user_id": r.user.id,
            "user_email": r.user.email,
            "reason": r.reason,
            "description": r.description,
            "created_at": r.created_at.isoformat(),
        }
        for r in reports
    ]
    return JsonResponse({"reports": data})

@staff_member_required
@require_POST
def ban_user(request, user_id):
    """
    Deactivates a user account (Banning).
    Only accessible by staff/admin users via a POST request.
    """
    # 1. Fetch the user or return 404
    user_to_ban = get_object_or_404(User, id=user_id)

    # 2. Prevent admins from accidentally banning themselves
    if user_to_ban == request.user:
        return JsonResponse({"error": "You cannot an admin."}, status=400)

    # 3. Prevent banning other staff/superusers unless current user is superuser
    if user_to_ban.is_staff and not request.user.is_superuser:
        return JsonResponse({"error": "Insufficient permissions to ban staff."}, status=403)

    # 4. Perform the "Ban"
    user_to_ban.is_active = False
    user_to_ban.save()

    return JsonResponse({
        "message": f"User {user_to_ban.email} has been terminated.",
        "user_id": user_id,
        "status": "inactive"
    })

@staff_member_required
@require_GET
def get_posts(request):

    def get_flagged_data(model_class, extra_fields=None):

        if extra_fields is None:
            extra_fields = []

        fields = ['id', 'title', 'description', 'category', 'toxicity_score', 'created_at',
                  'user__username'] + extra_fields
        return list(model_class.objects.filter(is_flagged=True).values(*fields))

    return JsonResponse({
        "success": True,
        "flagged": {
            "pulses": get_flagged_data(Pulse, ['pulse_type']),
            "alerts": get_flagged_data(Alert),
            "urgent_requests": get_flagged_data(UrgentRequest),
        }
    })


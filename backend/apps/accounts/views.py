from django.contrib.auth import authenticate
from django.middleware.csrf import get_token
from django.views.decorators.csrf import csrf_exempt, ensure_csrf_cookie, csrf_protect
import os
from django.views.decorators.csrf import csrf_protect
from django.http import JsonResponse
from django.contrib.auth import get_user_model, login as django_login,logout as django_logout
from django.core.exceptions import ValidationError
import json

from django.views.decorators.http import require_http_methods
from google.auth.transport.requests import Request
from google.oauth2 import id_token
from django.contrib.auth.decorators import login_required
from .decorators import api_login_required
from .models import Skill, UserObject

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
                            password=User.objects.make_random_password()  # Random password
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
        }}, status=200)
    else:
        return JsonResponse({'message': 'Method not allowed'}, status=405)


@login_required
def profile(request):
    if request.method == "GET":
        user = request.user

        skills = Skill.objects.filter(user=user)
        objects = UserObject.objects.filter(owner=user)

        skills_data = [
            {
                "id": skill.id,
                "name": skill.name,
                "category": skill.category,
                "proficiency_level": skill.proficiency_level,
                "years_of_experience": skill.years_of_experience,
                "added_at": skill.added_at,
            }
            for skill in skills
        ]

        objects_data = [
            {
                "id": obj.id,
                "name": obj.name,
                "description": obj.description,
                "category": obj.category,
                "condition": obj.condition,
                "isAvailable": obj.is_available,
                "price_per_day": obj.price_per_day,
                "image": request.build_absolute_uri(obj.image.url) if obj.image else None,
                "created_at": obj.created_at,
            }
            for obj in objects
        ]

        user_data = {
            "id": user.id,
            "email": user.email,
            "firstName": user.first_name,
            "lastName": user.last_name,
            "username": user.username,
            "profilePicture": request.build_absolute_uri(user.profile_picture.url) if user.profile_picture else None,
            "biography": user.biography,
            "location": user.location,
            "distanceRadius": user.distance_radius,
            "quiet_hours_start": user.quiet_hours_start,
            "quiet_hours_end": user.quiet_hours_end,
            "trustScore": user.trust_score,
            "isVerified": user.is_verified,
            "skills": skills_data,
            "objects": objects_data,
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

        # 2. Update model fields based on React's camelCase keys
        # Use .get() to keep current values if a field is missing
        user.first_name = data.get('firstName', user.first_name)
        user.last_name = data.get('lastName', user.last_name)
        user.username = data.get('username', user.username)
        user.email = data.get('email', user.email)
        user.biography = data.get('biography', user.biography)

        # 3. Validate and save
        user.full_clean()  # Checks for things like max_length or email format
        user.save()

        # 4. Return the updated user object to sync the frontend state
        return JsonResponse({
            "message": "Success",
            "user": {
                "firstName": user.first_name,
                "lastName": user.last_name,
                "username": user.username,
                "email": user.email,
                "biography": user.biography,
                "trustScore": user.trust_score,
                "isVerified": user.is_verified,
                # Include these if you have the related logic set up
                "skills": list(user.skills.values()) if hasattr(user, 'skills') else [],
                "objects": list(user.objects.values()) if hasattr(user, 'objects') else [],
            }
        }, status=200)

    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON format"}, status=400)
    except ValidationError as e:
        return JsonResponse({"error": e.message_dict}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@login_required
def remove_skill(request, skill_id):
    if request.method != "DELETE":
        return JsonResponse({"success": False, "error": "Invalid method"}, status=405)

    try:
        skill = Skill.objects.get(id=skill_id, user=request.user)
        skill.delete()

        return JsonResponse({"success": True})

    except Skill.DoesNotExist:
        return JsonResponse(
            {"success": False, "error": "Skill not found"},
            status=404
        )
    except Exception as e:
        return JsonResponse(
            {"success": False, "error": str(e)},
            status=400
        )



@login_required
def remove_object(request, object_id):
    if request.method != "DELETE":
        return JsonResponse({"success": False, "error": "Invalid method"}, status=405)

    try:
        # We identify the object by ID and ensure it belongs to the logged-in user
        obj = UserObject.objects.get(id=object_id, owner=request.user)
        obj.delete()

        return JsonResponse({"success": True})

    except UserObject.DoesNotExist:
        return JsonResponse(
            {"success": False, "error": "Object not found"},
            status=404
        )
    except Exception as e:
        # If this triggers, check your console to see the specific error
        return JsonResponse(
            {"success": False, "error": str(e)},
            status=400
        )
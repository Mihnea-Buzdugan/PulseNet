from django.urls import path
from . import views

urlpatterns = [
    # Auth & Tokens
    path('csrf-token/', views.csrf_token, name='csrf_token'),
    path('user_login/', views.user_login, name='login'),
    path('logout/', views.logout, name='logout'),
    path('user/', views.user, name='user'),
    path('signup/', views.sign_up, name='signup'),
    path('google_login/', views.google_login, name='google_login'),

    # User Profile Data
    path('user/', views.user, name='user'),
    path('profile/', views.profile, name='profile'),
    path('update_profile/', views.update_profile, name='update_profile'),

    # Profile Pictures
    path('upload_profile_picture/', views.upload_profile_picture, name='upload_profile_picture'),
    path('delete_profile_picture/', views.delete_profile_picture, name='delete_profile_picture'),

    # --- UNIFIED PULSE SYSTEM ---
    path('add_pulse/', views.add_pulse, name='add_pulse'),
    path('remove_pulse/<int:pulse_id>/', views.remove_pulse, name='remove_pulse'),
    path('get_latest_pulses/', views.get_latest_pulses, name='get_latest_pulses'),
    path("get_nearest_pulses/", views.get_nearest_pulses, name="get_nearest_pulses"),
    path('pulse/<int:pulse_id>/', views.get_pulse_by_id, name='get_pulse_by_id'),
    path("create_pulse_rental/", views.create_pulse_rental, name="create_pulse_rental"),
    path("pulse_rentals/", views.get_user_rentals, name="get_user_rental"),
    path("pulse_rentals/<int:rental_id>/", views.modify_rental_status, name="modify_rental_status"),
    path("pulse_own_proposals/", views.get_rental_proposals, name="get_rental_proposals"),
    path('favorites/', views.get_favorite_pulses, name="get_favorite_pulses"),
    path('add_to_favorites/<int:pulse_id>/', views.add_pulse_to_favorites, name='add_to_favorites'),
    path('delete_from_favorites/<int:pulse_id>/', views.delete_pulse_from_favorites, name='delete_from_favorites'),

    # Search & Social
    path("search-users/", views.search_users, name="search-users"),
    path("follow/<int:user_id>/", views.follow_user),
    path("follow-requests/accept/<int:request_id>/", views.accept_follow_request),
    path("follow-requests/reject/<int:request_id>/", views.reject_follow_request),
    path("unfollow/<int:user_id>/", views.unfollow_user, name="unfollow-user"),
    path("follow-requests/", views.get_follow_requests),
    path("direct_conversations/create/<int:user2_id>/", views.create_direct_conversation, name="create_conversation"),
    path("user_profile/<int:user_id>/", views.user_profile, name="user_profile"),
    path("messages/history/<str:chat_type>/<int:conversation_id>/", views.get_message_history, name="chat_history"),
    path("my-conversations/", views.my_conversations, name="my_conversations"),

    # Warnings and shit
    path("alerts/", views.list_alerts, name="list_alerts"),
    path("alerts/create/", views.create_alert, name="create_alert"),
]

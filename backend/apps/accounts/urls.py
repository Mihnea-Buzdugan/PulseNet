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
    path('get_pulses/', views.get_pulses, name='get_pulses'),

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
]

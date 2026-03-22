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
    path('update_location/', views.update_location, name='update_location'),

    # Profile Pictures
    path('upload_profile_picture/', views.upload_profile_picture, name='upload_profile_picture'),
    path('delete_profile_picture/', views.delete_profile_picture, name='delete_profile_picture'),

    # --- UNIFIED PULSE SYSTEM ---
    path('add_pulse/', views.add_pulse, name='add_pulse'),
    path("update_pulse/<int:pulse_id>/", views.update_pulse, name="update_pulse"),
    path('remove_pulse/<int:pulse_id>/', views.remove_pulse, name='remove_pulse'),
    path('get_latest_pulses/', views.get_latest_pulses, name='get_latest_pulses'),
    path("get_nearest_pulses/", views.get_nearest_pulses, name="get_nearest_pulses"),
    path('get_best_pulses/', views.get_best_pulses, name="get_best_pulses"),
    path('pulse/<int:pulse_id>/', views.get_pulse_by_id, name='get_pulse_by_id'),
    path('pulse/comments/<int:pulse_id>/', views.get_pulse_comments, name='get_pulse_comments'),
    path('pulse/ratings/<int:pulse_id>/', views.add_pulse_rating, name='add_pulse_rating'),
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
    path("notifications/", views.get_notifications, name="get_notifications"),
    path("notifications/mark-read/", views.mark_notifications_read, name="mark_notifications_read"),
    path("delete_notification/<int:notif_id>/", views.delete_notification, name="delete_notification"),

    # Warnings and shit
    path("alerts/", views.list_alerts, name="list_alerts"),
    path("alerts/create/", views.create_alert, name="create_alert"),
    path("alerts/<int:alert_id>/", views.alert_details, name="alert_details"),
    path("alerts/<int:alert_id>/confirm/", views.confirm_alert, name="confirm_alert"),
    path("alerts/<int:alert_id>/unconfirm/", views.unconfirm_alert, name="unconfirm_alert"),
    path("alerts/<int:alert_id>/report/", views.report_alert, name="report_alert"),

    #Urgent requests
    path('urgent-requests/create/', views.create_urgent_request, name='create_urgent_request'),
    path("urgent-requests/", views.urgent_requests_list, name="urgent_requests_list"),
    path("urgent-requests/<int:pk>/", views.urgent_request_detail, name="urgent_request_detail"),
    path('urgent-requests/comments/<int:request_id>/', views.get_request_comments, name='get_request_comments'),
    path("list-all-requests/", views.list_all_requests, name="list_all_requests"),

    #Admin urls
    path('admin_alert_reports/', views.admin_alert_reports, name='admin_reports'),
    path('ban-user/<int:user_id>/', views.ban_user, name='ban_user'),
    path('get_posts', views.get_posts, name='get_posts'),

]

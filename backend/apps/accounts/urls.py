from django.urls import path
from . import views

urlpatterns = [
    path('csrf-token/', views.csrf_token, name='csrf_token'),
    path('user_login/', views.user_login, name='login'),
    path('logout/', views.logout, name='logout'),
    path('user/', views.user, name='user'),
    path('signup/', views.sign_up, name='signup'),
    path('google_login/', views.google_login, name='google_login'),
    path('profile/', views.profile, name='profile'),
    path('upload_profile_picture/', views.upload_profile_picture, name='upload_profile_picture'),
    path('delete_profile_picture/', views.delete_profile_picture, name='delete_profile_picture'),
    path('update_profile/', views.update_profile, name='update_profile'),
    path("remove_skill/<int:skill_id>/", views.remove_skill),
    path("remove_object/<int:object_id>/", views.remove_object),
    path('add_skill/', views.add_skill, name='add_skill'),
    path('add_object/', views.add_object, name='add_object'),
    path("search-users/", views.search_users, name="search-users"),
    path("follow/<int:user_id>/", views.follow_user),
    path("follow-requests/accept/<int:request_id>/", views.accept_follow_request),
    path("follow-requests/reject/<int:request_id>/", views.reject_follow_request),
    path("unfollow/<int:user_id>/", views.unfollow_user, name="unfollow-user"),
    path("follow-requests/", views.get_follow_requests),
]

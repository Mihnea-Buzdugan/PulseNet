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
    path('update_profile/', views.update_profile, name='update_profile'),
    path("remove_skill/<int:skill_id>/", views.remove_skill),
    path("remove_object/<int:object_id>/", views.remove_object),
]

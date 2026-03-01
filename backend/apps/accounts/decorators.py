from functools import wraps
from django.http import JsonResponse

def api_login_required(view_func):
    @wraps(view_func)
    def wrapped_view(request, *args, **kwargs):
        if request.user.is_authenticated:
            return view_func(request, *args, **kwargs)
        return JsonResponse({'error': 'Authentication credentials were not provided.'}, status=401)
    return wrapped_view
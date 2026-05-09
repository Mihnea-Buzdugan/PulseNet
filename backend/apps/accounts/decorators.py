from functools import wraps
from django.http import JsonResponse
from deep_translator import GoogleTranslator
from .utils import get_toxicity_model
from langdetect import detect, LangDetectException
BANNED_LABELS = [
    'toxic',
    'severe_toxic',
    'identity_hate',
    'threat',
    'insult',
    'obscene',
    'sexual_explicit'
]

def api_login_required(view_func):
    @wraps(view_func)
    def wrapped_view(request, *args, **kwargs):
        if request.user.is_authenticated:
            return view_func(request, *args, **kwargs)
        return JsonResponse({'error': 'Authentication credentials were not provided.'}, status=401)
    return wrapped_view


def check_hate_speech(view_func):
    @wraps(view_func)
    def wrapped_view(request, *args, **kwargs):
        if request.method == 'POST':
            title = request.POST.get('title', '')
            description = request.POST.get('description', '')
            text_to_check = f"{title} {description}".strip()

            if not text_to_check:
                return view_func(request, *args, **kwargs)

            try:
                try:
                    lang = detect(text_to_check)
                except LangDetectException:
                    lang = 'ro'

                if lang == 'en':
                    translated = text_to_check
                else:
                    translated = GoogleTranslator(source='auto', target='en').translate(text_to_check[:512])

                classifier = get_toxicity_model()
                results = classifier(translated)[0]

                scores = {res['label']: res['score'] for res in results}
                max_score = max(scores.values())

                top_label = max(scores, key=scores.get)

                if scores.get('identity_hate', 0) > 0.6 or scores.get('toxic', 0) > 0.75 or scores.get('severe_toxic', 0) > 0.5 or scores.get('threat', 0) > 0.7 or scores.get('insult', 0) > 0.8:
                    return JsonResponse({
                        "success": False,
                        "error": "Postarea încalcă politicile comunității (Limbaj inadecvat)."
                    }, status=400)

                if scores.get('identity_hate', 0) > 0.4 or scores.get('threat', 0) > 0.5:
                    request.needs_review = True
                    request.toxicity_score = max_score
                else:
                    request.needs_review = False
                    request.toxicity_score = max_score

            except Exception as e:
                print(f"[HATE SPEECH ERROR] Eroare la procesare: {e}")
                # Fallback de siguranță: lăsăm să treacă dacă pică serviciile
                request.needs_review = False
                request.toxicity_score = 0

        return view_func(request, *args, **kwargs)

    return wrapped_view


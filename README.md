Video Prezentare: https://youtu.be/8HZJOsAgoDk?si=E-NJY8HKbSjhu4X3
DOCUMENTAŢIA APLICAŢIEI PULSENET

1. MOTIVAŢIA ALEGERII TEMEI ȘI UTILITATEA APLICAŢIEI

1.1 Motivaţia Alegerii Temei

PulseNet este o aplicaţie inovatoare care combină conectivitatea socială cu serviciile de urgență comunitare. Tema a fost aleasă cu scopul de a crea o platformă care să răspundă unor nevoi reale în societatea contemporană:

1.	Conectivitate Locală: Necesitatea de a conecta oameni cu interese și nevoi comune în apropierea lor
2.	Alertă Comunitară: Importanța comunicării rapide în cazuri de urgență (vreme extremă, persoane dispărute, pericole publice)
3.	Schimb de Servicii: Facilitarea tranzacțiilor și schimbului de servicii între membri comunității
4.	Transparență și Încredere: Construirea unui sistem de rating și verificare pentru a asigura siguranța utilizatorilor

1.2 Utilitatea Aplicaţiei

PulseNet oferă mai multe funcționalități cu valoare practică:

Servicii Principale
•	Pulses (Anunțuri): Utilizatorii pot posta anunțuri despre servicii sau obiecte pe care doresc să le închirieze
•	Alerte Comunitare: Sistemul de alertare a comunității pentru situații de urgență pe bază de locație
•	Cereri Urgente: Platformă pentru cereri de ajutor urgente în comunitate
•	Mesajerie: Comunicare directă între utilizatori pentru negocieri și detalii
•	Sistem de Rating: Evaluarea utilizatorilor și a serviciilor pentru a construi o comunitate de încredere
•	AI Chat: Asistent inteligent AI pentru ajutare și recomandări

Beneficii Utilizatori
•	Acces ușor la servicii locale
•	Comunicare sigură și verificată cu encripție end to end
•	Răspuns rapid la urgențe comunitare
•	Construire de reputație prin rating
•	Posibilitate de a câștiga venituri suplimentare prin servicii


2. STRUCTURA APLICAŢIEI

2.1 Arhitectura Generală

PulseNet este o aplicaţie full-stack cu arhitectură client-server modernă:

┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (React + Vite)               │
│                    (Port 5173)                           │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ HTTP/WebSocket
                     │
┌────────────────────▼────────────────────────────────────┐
│         BACKEND (Django + Daphne)                       │
│         (Port 8000)                                     │
│                                                         │
│  ├─ WebSocket (Real-time)                               │
│  └─ Celery Tasks (Background Jobs)                      │
└────────┬──────────┬──────────┬──────────┬───────────────┘
         │          │          │          
    ┌────▼──┐  ┌────▼──┐  ┌───▼──┐  
    │ PostgreSQL  │ Redis  │ Celery 
    │ + pgvector  │ (Cache)│ (Jobs)│
    └────────┘  └────────┘  └──────┘

2.2 Componente Principale

2.2.1 Backend (Django)
•	Framework: Django 5.1.7
•	Server WebSocket: Daphne 4.2.1
•	Queue Messaging: Celery cu Redis
•	Bază de Date: PostgreSQL cu extensia pgvector
•	Geolocalități: Django GIS (GeoDjango)

2.2.2 Frontend (React)
•	Bundler: Vite 7.3.1
•	Framework CSS: Tailwind CSS 3.4.17
•	Componente UI: shadcn/ui
•	Hartă: Leaflet + React Leaflet
•	Autentificare: Google OAuth

2.2.3 Baze de Date și Cache
•	PostgreSQL: Stocare date relaționale principale
•	pgvector: Indexare și căutare vectorială AI
•	Redis: Caching și message broker pentru Celery

2.3 Organizarea Structurii de Fișiere

PulseNet/
├── backend/
│   ├── manage.py                    # Django management CLI
│   ├── requirements.txt             # Python dependencies
│   ├── Dockerfile & db.Dockerfile  # Container images
│   ├── backend/
│   │   ├── settings.py             # Django configuration
│   │   ├── urls.py                 # URL routing
│   │   ├── asgi.py                 # ASGI configuration (Daphne)
│   │   ├── celery.py               # Celery configuration
│   │   └── wsgi.py                 # WSGI configuration (Gunicorn)
│   └── apps/
│       └── accounts/
│           ├── models.py           # ORM models
│           ├── views.py            # API views
│           ├── urls.py             # Endpoint routing
│           ├── consumers.py        # WebSocket consumers
│           ├── tasks.py            # Celery async tasks
│           ├── admin.py            # Django admin
│           └── migrations/         # Database migrations
├── frontend/
│   ├── package.json                # Node dependencies
│   ├── vite.config.js              # Vite configuration
│   ├── tailwind.config.js          # Tailwind configuration
│   ├── index.html                  # HTML entry point
│   └── src/
│       ├── App.jsx                 # Root React component
│       ├── pages/                  # Page components
│       │   ├── Authentification/   # Login/Signup
│       │   ├── Pulses_pages/       # Anunțuri (Pulses)
│       │   ├── Alerts/             # Alerte comunitare
│       │   ├── Requests/           # Cereri urgente
│       │   ├── User_pages/         # Profil, chat, etc.
│       │   └── AIChat.jsx          # Chat cu AI
│       ├── components/             # Reusable components
│       └── styles/                 # CSS modules
└── docker-compose.yml              # Container orchestration


3. STRUCTURI DE DATE UTILIZATE

3.1 Modelele de Bază

3.1.1 User (Utilizator)

class User(AbstractUser):
    - email: EmailField (unic)
    - profile_picture: ImageField
    - biography: TextField (max 500 caractere)
    - location: PointField (geolocalitate - lat/long)
    - visibility_radius: PositiveIntegerField (default: 1km)
    - online_status: CharField (online/away/do_not_disturb/offline)
    - quiet_hours_start/end: TimeField
    - trust_score: FloatField (implică nivelul de încredere)
    - is_verified: BooleanField
    - skills: JSONField (lista abilități)
    - ai_embedding: VectorField (768 dimensiuni - pentru căutare AI)
    - banned_until: DateTimeField (banare temporară)
    - is_private: BooleanField
    - public_key: TextField (criptografie)


Trust Levels (calculat din trust_score):
•	Dangerous: < -100
•	Risky: -100 to 0
•	Observer: 0 to 25
•	Active: 25 to 75
•	Trusted: 75 to 150
•	Proven: 150 to 250
•	Elite: 250 to 400
•	Legend: > 400

3.1.2 Pulse (Anunț/Serviciu)

class Pulse(models.Model):
    - user: ForeignKey(User)
    - title: CharField (max 200)
    - description: TextField
    - pulse_type: CharField ("servicii" sau "obiecte")
    - category: CharField
    - location: PointField (geolocalitate)
    - address: CharField
    - price: DecimalField
    - currencyType: CharField (default "RON")
    - phone_number: CharField
    - is_available: BooleanField
    - visibility_radius: IntegerField

    - ai_embedding: VectorField (768 dimensiuni)
    - is_approved: BooleanField
    - is_flagged: BooleanField
    - toxicity_score: FloatField
    - trust_required: BooleanField
    - popularity_score: DecimalField
    - created_at: DateTimeField (auto)
    - updated_at: DateTimeField (auto)

3.1.3 PulseRental (Închiriere)

class PulseRental(models.Model):
    - pulse: ForeignKey(Pulse)
    - renter: ForeignKey(User)
    - start_date: DateTimeField
    - end_date: DateTimeField
    - total_price: DecimalField
    - initial_price: DecimalField
    - status: CharField (pending/confirmed/declined/completed)
    - created_at: DateTimeField
    - last_offer_by: ForeignKey(User)

3.1.4 Alert (Alertă Comunitară)

class Alert(models.Model):
    CATEGORIA OPTIONS: weather, severe_weather, lost, found, lost_pet, 
                       found_pet, traffic, safety, event, missing_person,
                       infrastructure, public_health, meetup, volunteer, other
    
    - user: ForeignKey(User)
    - title: CharField (max 150)
    - description: TextField
    - category: CharField (cu opțiuni predefinite)
    - location: PointField
    - address: CharField
    - ai_embedding: VectorField (768 dimensiuni)
    - embedding: VectorField (512 dimensiuni - duplicate detection)
    - is_approved: BooleanField
    - is_flagged: BooleanField
    - toxicity_score: FloatField
    - confirm_count: PositiveIntegerField (cine a confirmat)
    - report_count: PositiveIntegerField (cine a raportat)
    - views_count: PositiveIntegerField
    - viewed_users: ArrayField(IntegerField)
    - is_active: BooleanField
    - created_at: DateTimeField

3.1.5 UrgentRequest (Cerere Urgentă)

class UrgentRequest(models.Model):
    - user: ForeignKey(User)
    - title: CharField
    - description: TextField
    - category: CharField
    - location: PointField
    - max_price: DecimalField
    - currency_type: CharField
    - expires_at: DateTimeField
    - ai_embedding: VectorField
         - is_approved: BooleanField
    - is_flagged: BooleanField

3.1.6 Modelele de Relații Sociale

class Follow(models.Model):
    - follower: ForeignKey(User)
    - following: ForeignKey(User)
    - created_at: DateTimeField

class PendingFollow(models.Model):
    - requester: ForeignKey(User)
    - target: ForeignKey(User)
    - created_at: DateTimeField

class Friendship(models.Model):
    - user1: ForeignKey(User)
    - user2: ForeignKey(User)
    - created_at: DateTimeField

class DirectConversation(models.Model):
    - user1: ForeignKey(User)
    - user2: ForeignKey(User)
    - created_at: DateTimeField

class DirectMessage(models.Model):
    - conversation: ForeignKey(DirectConversation)
    - sender: ForeignKey(User)
    - content: TextField
    - timestamp: DateTimeField
    - is_read: BooleanField


3.2 Indexuri și Optimizări

Aplicația utilizează HNSW (Hierarchical Navigable Small World) pentru optimizarea căutărilor vectoriale:

# Pe modelele cu AI embedding, se creează indexuri:
HnswIndex(
    name='model_embedding_idx',
    fields=['ai_embedding'],
    m=16,                      # Conexiuni pe nod
    ef_construction=64,        # Rezoluție construcție
    opclasses=['vector_cosine_ops']  # Similitudine cosinus
)


4. DETALII TEHNICE DE IMPLEMENTARE

4.1 Tehnologii Utilizate

Backend Stack
Django: 5.1.7
  - Web framework
  - ORM pentru bază de date
  - Admin interface

Daphne: 4.2.1
  - ASGI server
  - WebSocket support

Celery: 5.6.2
  - Task queue
  - Background jobs
  - Scheduled tasks

PostgreSQL: Latest
  - Bază de date relațională
  - pgvector extensie

Redis: 7
  - Cache
  - Message broker (Celery)
  - Session storage

Torch + Sentence Transformers: 5.3.0
  - Modele de embedding AI
  - Procesare text în vectori

Channels: 4.3.2
  - WebSocket support
  - Real-time messaging

Frontend Stack
React: 19.2.4
  - UI library
  - Component-based architecture

Vite: 7.3.1
  - Build tool
  - Development server
  - Fast refresh

Tailwind CSS: 3.4.17
  - Utility-first CSS framework

shadcn/ui: 4.0.0
  - Pre-built UI components

Leaflet: 1.9.4
  - Interactive maps
  - Geolocation visualization

React Router: 7.13.1
  - Client-side routing

4.2 Fluxul de Autentificare

┌──────────────┐         ┌────────────────┐         ┌──────────────┐
│   Frontend   │         │   Backend      │         │  Google      │
│   (React)    │         │   (Django)     │         │  OAuth       │
└──────────────┘         └────────────────┘         └──────────────┘
      │                           │                        │
      │  1. Login form            │                        │
      ├──────────────────────────>│                        │
      │                           │  2. Redirect to Google OAuth
      │                           ├───────────────────────>│
      │                           │                        │
      │  3. Redirect back
      │<──────────────────────────┤<───────────────────────┤
      │                           │                        │
      │  4. Verify user           │
      │                    (backend)                       │
      │                           │                        │
      │  5. Return User Data      │                        │
      │<──────────────────────────┤                        │

4.3 Comunicare Real-time (WebSocket)

Connection Establishment

// Frontend
const socket = new WebSocket('ws://localhost:8000/ws/notifications/');

socket.onopen = () => {
    console.log('Connected');
};

socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    // Procesează mesaje
};

Backend Consumer

class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope.get("user")

        if not self.user or not self.user.is_authenticated:
            await self.close()
            return

        self.notification_group = f"user_notifications_{self.user.id}"

        await self.channel_layer.group_add(self.notification_group, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "notification_group"):
            await self.channel_layer.group_discard(self.notification_group, self.channel_name)

    async def send_notification(self, event):
        """Called by group_send for chat messages (only forwards payload to client)."""
        await self.send(
            text_data=json.dumps(
                {
                    "type": "new_message",
                    "conversation_id": event["conversation_id"],
                    "sender_id": event["sender_id"],
                    "sender_name": event["sender_name"],
                    "content": event["content"],
                }
            )
        )

    async def send_rental_notification(self, event):
        """Handler for rental proposals (forward only — DB creation should happen on the view)."""
        await self.send(
            text_data=json.dumps(
                {
                    "type": "new_rental_proposal",
                    "title": event.get("title"),
                    "message": event.get("message"),
                    "pulse_id": event.get("pulse_id"),
                    "rental_id": event.get("rental_id"),
                    "proposed_total": event.get("proposed_total"),
                    "renter_id": event.get("renter_id"),
                    "renter_username": event.get("renter_username"),
                }
            )
        )

    async def send_pet_match_notification(self, event):
        notification = event["notification"]
        metadata = notification.get("metadata", {})
        await self.send(text_data=json.dumps({
            "type": "pet_match",
            "notification_id": notification["id"],
            "title": notification["title"],
            "message": notification["message"],
            "metadata": metadata,
            "similarity_score": metadata.get("similarity_score"),
            "match_alert_id": metadata.get("match_alert_id"),
            "is_read": False,
        }))

    async def send_hero_alert(self, event):
        await self.send(
            text_data=json.dumps(
                {
                    "type": "hero_alert",


                    "notification_id": event["notification_id"],
                    "title": event["title"],
                    "message": event["message"],
                    "created_at": event["created_at"],
                    "is_read": False,

                    "sender_id": event.get("sender_id"),
                    "sender_username": event.get("sender_username"),

                    "request_id": event["request_id"],
                    "score": event["score"],

                    "metadata": event.get("metadata", {}),
                }
            )
        )

    async def send_signal_resolved(self, event):
        """Handler for signal resolution notifications."""
        await self.send(
            text_data=json.dumps(
                {
                    "type": "signal_resolved",
                    "notification_id": event.get("notification_id"),
                    "title": event.get("title"),
                    "message": event.get("message"),
                    "created_at": event.get("created_at"),
                    "metadata": event.get("metadata"),
                    "is_read": False,
                }
            )
        )

    async def alert_merged(self, event):
        await self.send(text_data=json.dumps({
            "type": "alert_merged",
            "original_alert_id": event["original_alert_id"],
            "message": event["message"],
        }))

4.4 Procesare AI 
AI Chatbot

def ask_ai(user_question, history=None, search_context="all"):
    if history is None:
        history = []

    question_vector = embedding_model.encode(user_question).tolist()

    context_text = "Database Records:\n\n"

    if search_context in ["all", "pulses"]:
        similar_pulses = Pulse.objects.filter(
            ai_embedding__isnull=False,
            is_approved=True
        ).annotate(
            distance=CosineDistance('ai_embedding', question_vector)
        ).order_by('distance')[:3]

        for p in similar_pulses:
            context_text += (
                f"- PULSE: {p.title} | Desc: {p.description} | Price: {p.price} {p.currencyType} "
                f"| Posted by: {p.user.username} {p.user.email} ({p.user.first_name} {p.user.last_name})\n"
            )


    if search_context in ["all", "alerts"]:
        similar_alerts = Alert.objects.filter(
            ai_embedding__isnull=False,
            is_approved=True
        ).annotate(
            distance=CosineDistance('ai_embedding', question_vector)
        ).order_by('distance')[:3]

        for a in similar_alerts:
            context_text += (
                f"- ALERT: {a.title} | Category: {a.get_category_display()} | Details: {a.description} "
                f"| Posted by: {a.user.username} {a.user.email} ({a.user.first_name} {a.user.last_name})\n"
            )

    if search_context in ["all", "requests"]:
        similar_requests = UrgentRequest.objects.filter(
            ai_embedding__isnull=False,
            is_approved=True
        ).annotate(
            distance=CosineDistance('ai_embedding', question_vector)
        ).order_by('distance')[:3]

        for r in similar_requests:
            context_text += (
                f"- URGENT REQUEST: {r.title} | Desc: {r.description} | Max Price: {r.max_price} "
                f"| Posted by: {r.user.username} {r.user.email} ({r.user.first_name} {r.user.last_name})\n"
            )

    if search_context in ["all", "users"]:
        similar_users = User.objects.filter(
            ai_embedding__isnull=False
        ).annotate(
            distance=CosineDistance('ai_embedding', question_vector)
        ).filter(distance__lt=0.4).order_by('distance')[:3]

        for u in similar_users:
            context_text += (
                f"- USER: {u.username} | Name: {u.first_name} {u.last_name} | {u.email}"
                f"| Skills: {u.get_skills_text()} | Trust: {u.trust_level}\n"
            )

    history_text = ""
    if history:
        history_text = "Previous conversation:\n"
        for msg in history:
            role_label = "User" if msg["role"] == "user" else "Assistant"
            history_text += f"{role_label}: {msg['content']}\n"
        history_text += "\n"


    prompt_template = PromptTemplate.from_template("""
    You are a helpful assistant for our community platform.

    Use the following relevant platform posts, listings, and updates to answer the user's question.

    {context}

    {history}Guidelines:
    1. Provide a natural, friendly, and accurate response based only on the provided context and conversation history.
    2. Do NOT mention "database", "records", or the source of the data to the user.
    3. If the user refers to something mentioned earlier in the conversation, use the conversation history to understand their intent.
    4. If the context does not contain the answer, politely say: "I couldn't find any listings or information about that on the platform."

    User Question: {question}

    Answer:
    """)

    prompt = prompt_template.format(
        context=context_text,
        history=history_text,
        question=user_question,
    )

    for chunk in llm.stream(prompt):
        yield chunk

4.5 Procese Asincrone (Celery)

Task Configurations

# backend/backend/celery.py
from celery import Celery
from celery.schedules import crontab

app = Celery(
    "backend",
    broker="redis://redis:6379/0",
)

app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()

# Periodic tasks
app.conf.beat_schedule = {
    "delete-expired-urgent-requests-every-minute": {
        "task": "apps.accounts.tasks.delete_expired_urgent_requests",
        "schedule": crontab(minute="*/1"),
    },
    "delete-old-alerts-daily": {
        "task": "apps.accounts.tasks.delete_old_alerts",
        'schedule': crontab(minute=0, hour=0),  # daily at midnight
    },

    # NEW: Run the hero search every hour at the top of the hour
    "search-heroes-hourly": {
        "task": "apps.accounts.tasks.search_heroes_for_all_active_requests",
        "schedule": crontab(minute=0),
    },

"check-weather-alerts-30-min": {
        "task": "apps.accounts.tasks.fetch_severe_weather_alerts",
        "schedule": crontab(minute="*/30"),
    },
    "delete-old-request-offers-daily": {
        "task": "apps.accounts.tasks.delete_old_request_offers",
        "schedule": crontab(minute=0, hour=1),  # daily at 1am
    },
    "delete-old-pulse-rentals-daily": {
        "task": "apps.accounts.tasks.delete_old_pulse_rentals",
        "schedule": crontab(minute=0, hour=1),  # daily at 1am
    },
}


4.6 Secvențe de Cod Relevante

Crearea unui Pulse

@login_required
@require_POST
@csrf_protect
@check_hate_speech
def add_pulse(request):
    try:
        data = request.POST

        should_flag = getattr(request, 'needs_review', False)
        ai_score = getattr(request, 'toxicity_score', 0.0)

        lat = data.get('lat')
        lng = data.get('lng')
        location_point = None
        if lat and lng:
            location_point = Point(float(lng), float(lat), srid=4326)

        trust_required = False
        price = data.get('price', 0)
        if int(price) > 1000:
            trust_required = True

        pulse = Pulse.objects.create(
            user=request.user,
            title=data.get('title'),
            description=data.get('description', ''),
            category=data.get('category', ''),
            pulse_type=data.get('pulse_type'),
            price=price,
            trust_required=trust_required,
            currencyType=data.get('currencyType', 'RON'),
            phone_number=data.get('phone_number', ''),
            location=location_point,
            is_available=data.get('is_available', 'true').lower() == 'true',

            is_flagged=should_flag,
            is_approved=not should_flag,
            toxicity_score=ai_score,
        )
        if pulse.location:
            reverse_geocode_location.delay("Pulse", pulse.id)


        images = request.FILES.getlist('images')
        for img in images:
            PulseImage.objects.create(pulse=pulse, image=img)

        first_image = pulse.images.first()
        image_url = request.build_absolute_uri(first_image.image.url) if first_image else None

        broadcast_payload = {
            "id": pulse.id,
            "type": pulse.pulse_type,
            "user": request.user.username,
            "title": pulse.title,
            "price": float(pulse.price),
            "pulse_type": pulse.pulse_type,
            "description": pulse.description,
            "popularity_score": pulse.popularity_score if hasattr(pulse, 'popularity_score') else 0,
            "total_reviews": pulse.total_reviews if hasattr(pulse, 'total_reviews') else 0,
            "currency": pulse.currencyType,
            "timestamp": pulse.created_at.isoformat(),
            "distance": None,
            "location": json.loads(pulse.location.geojson) if pulse.location else None,
            "image": image_url,
        }

        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            "pulses_feed",
            {"type": "pulse.message", "data": broadcast_payload}
        )

        update_user_trust_score_task.delay(request.user.id)

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

Chat Real-time

# Backend Consumer
class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.chat_type = self.scope["url_route"]["kwargs"]["chat_type"]
        self.conversation_id = self.scope["url_route"]["kwargs"]["conversation_id"]
        self.room_group_name = f"{self.chat_type}_{self.conversation_id}"

        user = self.scope.get("user")
        if not user or not user.is_authenticated:
            await self.close(code=4001)
            return

        self.conversation = await self._get_conversation()
        if not self.conversation:
            await self.close(code=4004)
            return

        is_participant = await self._check_participant(user, self.conversation)
        if not is_participant:
            await self.close(code=4003)
            return

        if self.chat_type == "direct":
            other_user = await self._get_other_direct_participant(user, self.conversation)
            if other_user:
                is_friend = await self._are_friends(user, other_user)
                is_public = not getattr(other_user, "is_private", False)
                if not (is_friend or is_public):
                    await self.close(code=4005)
                    return

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "room_group_name"):
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        user = self.scope["user"]
        try:
            data = json.loads(text_data)
            content = data.get("message", "").strip()
            if not content:
                return
        except json.JSONDecodeError:
            return

        message_obj = await self._create_message(user, content)

        payload = {
            "type": "chat.message",
            "message_id": message_obj.id,
            "chat_type": self.chat_type,
            "conversation_id": self.conversation_id,
            "sender_id": user.id,
            "sender_username": user.username,
            "content": message_obj.content,
            "timestamp": message_obj.timestamp.isoformat(),
        }

        await self.channel_layer.group_send(self.room_group_name, payload)

        if self.chat_type == "direct":
            other_user = await self._get_other_direct_participant(user, self.conversation)
            if other_user:

                notification_text = f"{user.username} sent a new message"
                await self._create_message_notification(
                    receiver_id=other_user.id,
                    sender_id=user.id,
                    conversation_id=self.conversation_id,
                    content=notification_text,
                    message_id=message_obj.id,
                )

                notification_group = f"user_notifications_{other_user.id}"
                await self.channel_layer.group_send(
                    notification_group,
                    {
                        "type": "send_notification",
                        "conversation_id": self.conversation_id,
                        "sender_id": user.id,
                        "sender_name": user.username,
                        "content": notification_text,
                    },
                )

    async def chat_message(self, event):
        """Standard handler for messages sent to the chat room group."""
        client_payload = {k: v for k, v in event.items() if k != "type"}
        await self.send(text_data=json.dumps(client_payload))


    @database_sync_to_async
    def _get_conversation(self):
        if self.chat_type == "group":
            return Group_Conversation.objects.filter(id=self.conversation_id).first()
        return DirectConversation.objects.filter(id=self.conversation_id).first()

    @database_sync_to_async
    def _check_participant(self, user, conversation):
        if self.chat_type == "group":
            return conversation.participants.filter(id=user.id).exists()
        return conversation.user1 == user or conversation.user2 == user

    @database_sync_to_async
    def _get_other_direct_participant(self, user, conversation):
        if self.chat_type != "direct":
            return None
        return conversation.user2 if conversation.user1 == user else conversation.user1

    @database_sync_to_async
    def _are_friends(self, user, other_user):
        return Friendship.objects.filter(
            (Q(user1=user) & Q(user2=other_user)) | (Q(user1=other_user) & Q(user2=user))
        ).exists()

    @database_sync_to_async
    def _create_message(self, user, content):
        if self.chat_type == "group":
            conv = Group_Conversation.objects.get(id=self.conversation_id)
            return Group_Message.objects.create(conversation=conv, sender=user, content=content)
        else:
            conv = DirectConversation.objects.get(id=self.conversation_id)
            return DirectMessage.objects.create(conversation=conv, sender=user, content=content)

    @database_sync_to_async
    def _create_message_notification(self, receiver_id, sender_id, conversation_id, content, message_id):
        """Create a DB notification for a chat message (sync DB call wrapped)."""
        try:
            receiver = User.objects.get(id=receiver_id)
            sender = User.objects.get(id=sender_id)

            Notification.objects.create(
                user=receiver,
                sender=sender,
                type="chat_message",
                title="New Message",
                message=content,
                conversation_id=conversation_id,
                metadata={"message_id": message_id, "preview": content},
            )
        except User.DoesNotExist:
            pass


5. RESURSE HARDWARE ȘI SOFTWARE NECESARE

5.1 Cerințe Hardware

Pentru Dezvoltare Locală (Minimum)
•	CPU: Dual-core 2.0+ GHz
•	RAM: 8 GB (minim 16 GB recomandat pentru AI)
•	Stocare: 10 GB spațiu liber (modele AI + PostgreSQL)
•	Conexiune: Banda de 5+ Mbps pentru download dependențe

Pentru Producție (Recomandat)
•	CPU: Quad-core 2.5+ GHz
•	RAM: 16+ GB
•	Stocare: 50+ GB SSD (bază de date + cache + media)
•	Rețea: Fibră optică 50+ Mbps

5.2 Cerințe Software

Server Backend
- Python 3.10+ (de preferință 3.11 sau 3.12)
- PostgreSQL 14+ (cu extensia pgvector)
- Redis 6.0+
- Node.js 18+ (pentru build frontend)

Obligatorii pe Mașina de Dezvoltare
- Git 2.30+
- Docker 20.10+ (pentru containerizare)
- Docker Compose 2.0+
- pip (Python package manager)
- npm (Node package manager)

Biblioteci Python Principale
Django==5.1.7
djangorestframework==3.14.0
channels==4.3.2
celery==5.6.2
psycopg2-binary==2.9.11
pgvector==0.4.2
torch==2.9.1
sentence-transformers==5.3.0
django-cors-headers==4.9.0
django-allauth==65.14.3
geopy==2.4.1

Dependențe Frontend
React 19.2.4
Vite 7.3.1
Tailwind CSS 3.4.17
React Router DOM 7.13.1
Leaflet 1.9.4
React Leaflet 5.0.0
JWT Decode 4.0.0
Axios (pentru HTTP requests)

5.3 Servicii Externe (Opționale)

•	Google OAuth: Pentru autentificare
5.4 Variabile de Mediu (.env)

Backend (.env)
client_id_Google
secret_Google
openweather_api_key
db_name
db_user
db_password
db_host
db_port

Frontend (.env)
VITE_GOOGLE_CLIENT_ID


6. MODALITĂŢI DE UTILIZARE

6.1 Instalare și Setup
 Start cu Docker
docker compose build
docker compose up

Aceasta va porni:
•	PostgreSQL pe port 5432
•	Redis pe port 6379
•	Backend Django pe port 8000
•	Frontend React pe port 5173
•	Celery Worker + Beat scheduler

6.2 Interfața Utilizator

6.2.1 Pagina de Login/Signup
•	Login cu email și parolă
•	Login cu Google OAuth
•	Signup
6.2.2 Marketplace (Pulses)
•	Browse Pulses: Vezi anunțuri din apropiere (hartă interactivă)
•	Create Pulse: Postează propriul anunț cu:
•	Titlu și descriere
•	Tipul (servicii/obiecte)
•	Preț și monedă
•	Imagini
•	Pulse Details: Vezi detalii complete + comentarii + rating
•	Favorites: Salvează anunțuri favorite

6.2.3 Alerte Comunitare
•	Browse Alerts: Vezi alerte active
•	Create Alert: Postează alertă urgentă cu categorie
•	Confirm/Report: Confirmă sau raportează alerte
•	Map View: Vizualizare spațială a alertelor
•	Categories: Vreme, persoane dispărute, animale, trafic, etc.

6.2.4 Cereri Urgente
•	Browse Requests: Căutare cereri urgente
•	Create Request: Postează cerere cu:
•	Descriere și buget
•	Deadline
•	Categorie
•	Offers: Utilizatorii pot oferi servicii
•	Feedback: Rating după completare

6.2.5 Comunicare
•	Direct Messages: Chat 1-on-1 real-time
•	Message Notifications: Notificări WebSocket în timp real
•	AI Assistant: Chat cu AI pentru ajutor general

6.2.6 Profil Utilizator
•	Profile Picture: Imagine de profil personalizată
•	Biography: Descriere până 500 caractere
•	Skills: Abilități și competențe
•	Trust Score: Rating din comunitate
•	Statistics: Numărul de anunțuri, feedback, etc.
•	Privacy Settings: Control geolocalități și vizibilitate
•	Online Status: Setează statusul online

6.2.7 Admin Panel
•	Moderare conținut (aprobă/respinge pulses/alerts)
•	Management utilizatori (banare, verificare)
•	Vizualizare statistici și rapoarte
•	Configurare moderare automată (toxicity scores)

7. POSIBILITĂŢI DE DEZVOLTARE VIITOARE

7.1 Funcționalități Noi Planificate

Plăți și Tranzacții
•	Integrare Stripe / PayPal pentru plăți securizate
•	Escrow service (păstrare bani până la finalizare)
•	Refund management
•	Tax reporting

Sisteme Avansate de Matching
•	ML-based recommendation engine
•	Matchmaking pentru echipe de voluntari
•	Smart notifications pentru oferte relevante

Gamification
•	Badges și achievements
•	Leaderboards pe bază de activitate
•	Points system pentru recompensări

Integrări Rețele Sociale
•	Share pulses/alerts pe Facebook/Twitter
•	Autentificare prin alte platforme (Apple, GitHub)
•	Integrare WhatsApp/Telegram pentru notificări

7.2 Optimizări Tehnice

Performance
•	Redis caching layers adicionale
•	CDN pentru imagini și assets
•	Database query optimization și sharding
•	Load balancing cu Nginx

Scalabilitate
•	Kubernetes deployment
•	Microservices architecture
•	Separate API servers
•	Read replicas pentru baza de date

Machine Learning
•	Fine-tuning de modele pentru domeniu specific
•	Time-series analysis pentru trend predictions
•	User behavior analysis și anomaly detection

7.3 Funcții de Siguranță

Background Checks
•	Verificare documente oficiale
•	KYC (Know Your Customer) integration
•	ID verification cu biometrice

Insurance și Liability
•	Coverage pentru tranzacții pe platformă
•	Dispute resolution system
•	Legal documentation generator

Moderare Umană
•	Team de moderatori
•	Appeal process pentru bănări
•	Community guidelines enforcement

7.4 Expansiune Geografică

Partnership
•	Integrare cu agențiile de urgență (112)
•	Partnership cu servicii locale
•	Integration cu platforme de transport
•	Collaboration cu organizații NGO

7.5 Analitică și Reporting

Dashboard pentru Utilizatori
•	Statistics personale (views, shares, conversions)
•	Revenue tracking (dacă vânzi servicii)
•	Reputation trends
•	Engagement metrics

Dashboard Admin
•	Community health metrics
•	Fraud detection dashboard
•	Moderation workload tracking
•	Performance monitoring


8. CONCLUZIE

PulseNet este o platformă inovatoare care combină puterea rețelelor sociale cu utilitate practică de zi cu zi. Prin combinarea de tehnologii moderne (AI, WebSockets, GIS) cu design centrat pe utilizator, aplicația creează o comunitate vibrantă unde oamenii se pot conecta, ajuta reciproc și construi relații bazate pe încredere.

Structura flexibilă a proiectului permite expansiune și personalizare ușoară pentru diferite cazuri de utilizare și piețe. Investiția în securitate, performanță și experiența utilizatorului plasează PulseNet în poziția de a deveni o soluție leader pe piața aplicațiilor comunitare.

<img width="7177" height="2696" alt="diagrama_pulsenet" src="https://github.com/user-attachments/assets/1125aea0-6c4f-43ec-b7bf-2534a51ddba1" />

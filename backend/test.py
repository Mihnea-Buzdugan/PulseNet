import random
from django.contrib.gis.geos import Point
from django.utils import timezone
from datetime import timedelta
from apps.accounts.models import Alert, User  # adjust import if needed

# Get all users
users = list(User.objects.all())
if not users:
    print("No users found! Please create some users first.")
    exit()

# Mapping of descriptions to categories
alert_samples = [
    {
        "title": "Flood Warning in Copou area",
        "description": "Please stay indoors and avoid low-lying areas.",
        "category": "severe_weather"
    },
    {
        "title": "Lost Backpack near Palas Mall",
        "description": "Black backpack with laptop and notebooks, last seen around 3 PM.",
        "category": "lost"
    },
    {
        "title": "Found Cat on Păcurari Street",
        "description": "Grey and white cat found, very friendly, waiting at shelter.",
        "category": "found_pet"
    },
    {
        "title": "Heavy Traffic on Tudor Vladimirescu Blvd",
        "description": "Expect delays up to 30 minutes, use alternative routes.",
        "category": "traffic"
    },
    {
        "title": "Community Meetup at the Botanical Garden",
        "description": "Join us for a local community meetup for gardening enthusiasts.",
        "category": "meetup"
    },
    {
        "title": "Roadworks causing delays near Nicolina",
        "description": "Road maintenance causing partial lane closures, plan ahead.",
        "category": "infrastructure"
    },
    {
        "title": "Severe Weather Alert: Thunderstorms",
        "description": "Thunderstorms expected until evening, secure outdoor items.",
        "category": "severe_weather"
    },
    {
        "title": "Missing Person reported in Podu Roș area",
        "description": "Missing adult, last seen near city park, contact authorities if seen.",
        "category": "missing_person"
    },
    {
        "title": "Health Advisory: Flu outbreak nearby",
        "description": "Local health clinic advises vaccinations and precautions.",
        "category": "public_health"
    },
    {
        "title": "Volunteer Help Needed for Local Cleanup",
        "description": "Looking for volunteers to help clean local riverbanks.",
        "category": "volunteer"
    }
]

# Create 10 random alerts
for _ in range(10):
    user = random.choice(users)
    sample = random.choice(alert_samples)

    # Random location around Iași
    lat = 47.1500 + random.random() * 0.03  # roughly 47.1500 - 47.1800
    lon = 27.5800 + random.random() * 0.03  # roughly 27.5800 - 27.6100
    location = Point(lon, lat)

    alert = Alert.objects.create(
        user=user,
        title=sample["title"],
        description=sample["description"],
        category=sample["category"],
        location=location,
        address=f"Random location near Iași ({lat:.5f}, {lon:.5f})",
        confirm_count=random.randint(0, 20),
        report_count=random.randint(0, 5),
        views_count=random.randint(0, 50),
        is_approved=True,
        is_flagged=False,
        toxicity_score=random.uniform(0, 1),
        created_at=timezone.now() - timedelta(days=random.randint(0, 7)),
    )

    print(f"Created alert: {alert.title} ({alert.get_category_display()}) by {user.email}")
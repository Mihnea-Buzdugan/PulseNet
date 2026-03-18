"""
Run from the backend directory with the venv activated:
    python test_matching.py
"""
from sentence_transformers import SentenceTransformer, util

model = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")

THRESHOLD = 0.50

requests = [
    "Am nevoie urgenta de un electrician, scurt circuit in apartament",
    "Caut urgent un instalator, teava sparta",
    "Am nevoie de cineva care stie programare Python, bug critic in productie",
    "Caut un medic sau asistent medical urgent",
    "Am nevoie de un sofer sau curierat urgent",
    # Real cases:
    "Caut o bona pentru copil de 3 ani",
    "Am nevoie de cineva care face mobila la comanda",
]

user_skills = [
    ("Alice",         "electrician, instalatii electrice, panouri solare"),
    ("Bob",           "instalator, tevi, sanitare, reparatii"),
    ("Carol",         "programare Python, Django, backend, software"),
    ("Dan",           "fotograf, editare foto, videografie"),
    ("Elena",         "medic generalist, prim ajutor, urgente"),
    ("Florin",        "bucatar, cofetarie, catering"),
    ("Gabi",          "sofer, curierat, transport marfa"),
    ("FurnitureMaker","tamplar, mobila la comanda, furniture maker"),
]

def build_request_text(title):
    return title

def get_best_score(query_emb, skills_str):
    best = 0.0
    for skill in [s.strip() for s in skills_str.split(",") if s.strip()]:
        skill_emb = model.encode(skill, convert_to_tensor=True)
        s = util.cos_sim(query_emb, skill_emb).item()
        if s > best:
            best = s
    return best

print(f"{'REQUEST':<55} {'USER':<16} {'SCORE':>6}  {'MATCH?'}")
print("-" * 95)

for req_text in requests:
    query_emb = model.encode(build_request_text(req_text), convert_to_tensor=True)
    for name, skills in user_skills:
        score = get_best_score(query_emb, skills)
        match = "YES ✓" if score > THRESHOLD else "no"
        print(f"{req_text[:54]:<55} {name:<16} {score:>6.3f}  {match}")
    print()

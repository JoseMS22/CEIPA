from app.db import SessionLocal
from app.models.category import Category
from app.repositories.category_repo import slugify

DATA = [
    {"name": "Riesgo Económico", "description": "Factores macroeconómicos y financieros."},
    {"name": "Estabilidad Política", "description": "Gobernanza, conflictos y estabilidad."},
    {"name": "Riesgo Social", "description": "Cohesión social y condiciones humanas."},
    {"name": "Seguridad", "description": "Crimen, violencia y seguridad pública."},
]

def run():
    db = SessionLocal()
    try:
        for c in DATA:
            slug = slugify(c["name"])
            exists = db.query(Category).filter_by(slug=slug).first()
            if not exists:
                db.add(Category(**c, slug=slug))
        db.commit()
        print("✅ Categorías insertadas correctamente.")
    except Exception as e:
        db.rollback()
        print(f"❌ Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    run()

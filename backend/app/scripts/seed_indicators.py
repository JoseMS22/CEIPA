from app.db import SessionLocal
from app.models.indicator import Indicator, IndicatorType, ScaleType
from app.repositories.indicator_repo import slugify

DATA = [
    {"name": "Inflación anual", "type": "DMP", "scale": "FIJA_0_10", "unit": "%", "category_id": 1,
     "source_url": "https://...", "source_summary": "Tasa de inflación anual."},
    {"name": "PIB per cápita (USD)", "type": "IMP", "scale": "FIJA_0_10", "unit": "USD", "category_id": 1},
]

def run():
    db = SessionLocal()
    try:
        for d in DATA:
            slug = slugify(d["name"])
            exists = db.query(Indicator).filter_by(slug=slug).first()
            if not exists:
                db.add(Indicator(slug=slug, **d))
        db.commit()
        print("✅ Indicadores base insertados.")
    except Exception as e:
        db.rollback(); print("❌", e)
    finally:
        db.close()

if __name__ == "__main__":
    run()

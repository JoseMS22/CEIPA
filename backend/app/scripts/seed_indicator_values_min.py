# app/scripts/seed_indicator_values_min.py
from app.db import SessionLocal
from app.models.indicator_value import IndicatorValue
from app.models.indicator import Indicator
from app.models.country import Country

def run():
    db = SessionLocal()
    try:
        # Toma 2-3 países y pon valores dummy
        countries = db.query(Country).limit(3).all()
        indicators = db.query(Indicator).all()
        for c in countries:
            for i, ind in enumerate(indicators):
                val = db.query(IndicatorValue).filter_by(country_id=c.id, indicator_id=ind.id).first()
                if not val:
                    db.add(IndicatorValue(country_id=c.id, indicator_id=ind.id, raw_value=50 + 5*i))
        db.commit()
        print("✅ Valores de ejemplo insertados (raw_value).")
    finally:
        db.close()

if __name__ == "__main__":
    run()

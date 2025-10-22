# app/scripts/seed_countries.py
import json
from pathlib import Path
from app.db import SessionLocal
from app.models.country import Country

DATA_PATH = Path(__file__).parent / "data" / "countries.json"

def run():
    db = SessionLocal()
    try:
        if not DATA_PATH.exists():
            print(f"❌ No se encontró {DATA_PATH}")
            return

        data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
        if not isinstance(data, list):
            print("❌ El archivo JSON no contiene una lista válida.")
            return

        # Contar si ya hay países registrados
        existing_count = db.query(Country).count()
        if existing_count > 0:
            print(f"ℹ️ Ya existen {existing_count} países, no se insertará nada.")
            return

        print(f"🌍 Insertando {len(data)} países...")

        for item in data:
            c = Country(
                iso2=item["iso2"],
                iso3=item["iso3"],
                name_es=item["name_es"],
                name_en=item["name_en"],
                enabled=True
            )
            db.add(c)

        db.commit()
        print("✅ Países insertados correctamente.")
    except Exception as e:
        db.rollback()
        print(f"❌ Error al insertar países: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    run()

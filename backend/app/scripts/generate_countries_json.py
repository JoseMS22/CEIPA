# app/scripts/generate_countries_json.py
from pathlib import Path
import json
import requests

# REST Countries ahora requiere 'fields' en la query
URL = (
    "https://restcountries.com/v3.1/all"
    "?fields=cca2,cca3,name,translations"
)
OUT_PATH = Path(__file__).parent / "data" / "countries.json"
OUT_PATH.parent.mkdir(parents=True, exist_ok=True)

HEADERS = {"User-Agent": "CEIPA-Risk/1.0 (contact: admin@ceipa.com)"}

def fetch_all():
    try:
        resp = requests.get(URL, headers=HEADERS, timeout=60)
    except requests.RequestException as e:
        raise RuntimeError(f"Error de red al consultar {URL}: {e}")

    # Intentar parsear JSON siempre para tener más detalle del error
    try:
        data = resp.json()
    except Exception as e:
        raise RuntimeError(
            f"Respuesta no JSON desde {URL} (HTTP {resp.status_code}): {e}"
        )

    if resp.status_code != 200:
        msg = data.get("message") if isinstance(data, dict) else str(data)[:300]
        raise RuntimeError(f"HTTP {resp.status_code} desde {URL}: {msg}")

    if not isinstance(data, list):
        raise RuntimeError(
            f"Se esperaba una lista, llegó {type(data).__name__}: {str(data)[:300]}"
        )

    return data

def normalize_country(c: dict) -> dict | None:
    iso2 = (c.get("cca2") or "").strip().lower()
    iso3 = (c.get("cca3") or "").strip().lower()

    name = c.get("name") or {}
    name_en = (name.get("common") or "").strip()

    translations = c.get("translations") or {}
    spa = translations.get("spa") or {}
    name_es = (spa.get("common") or name_en).strip()

    if not iso2 or not iso3 or not name_en:
        return None

    return {
        "iso2": iso2,
        "iso3": iso3,
        "name_es": name_es,
        "name_en": name_en,
    }

def main():
    print("Descargando países…")
    data = fetch_all()

    seen = set()
    rows = []
    for c in data:
        if not isinstance(c, dict):
            continue
        item = normalize_country(c)
        if not item:
            continue
        if item["iso3"] in seen:
            continue
        seen.add(item["iso3"])
        rows.append(item)

    rows.sort(key=lambda x: x["name_es"])
    OUT_PATH.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"✅ Archivo creado: {OUT_PATH} ({len(rows)} países)")
    # Vista previa
    print(json.dumps(rows[:5], ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()

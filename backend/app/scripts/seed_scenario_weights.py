# app/scripts/seed_scenario_weights.py
from app.db import SessionLocal
from app.models.scenario import Scenario
from app.models.weights import CategoryWeight, IndicatorWeight
from app.models.category import Category
from app.models.indicator import Indicator, IndicatorType, ScaleType
import re

def slugify(s: str) -> str:
    s = s.lower().strip()
    s = re.sub(r"[^a-z0-9\s-]", "", s)
    s = re.sub(r"\s+", "-", s)
    s = re.sub(r"-+", "-", s)
    return s

def get_or_create_category(db, name: str, description: str | None = None) -> Category:
    slug = slugify(name)
    cat = db.query(Category).filter((Category.slug == slug) | (Category.name == name)).first()
    if cat:
        return cat
    cat = Category(name=name, slug=slug, description=description)
    db.add(cat); db.commit(); db.refresh(cat)
    return cat

def get_or_create_indicator(db, name: str, t: str, s: str, unit: str, category_id: int) -> Indicator:
    slug = slugify(name)
    ind = db.query(Indicator).filter((Indicator.slug == slug) | (Indicator.name == name)).first()
    if ind:
        return ind
    ind = Indicator(
        name=name, slug=slug,
        type=IndicatorType[t],
        scale=ScaleType[s],
        min_value_imp=0 if s == "VARIABLE" else None,
        max_value_dmp=10000 if s == "VARIABLE" else None,
        unit=unit, category_id=category_id,
    )
    db.add(ind); db.commit(); db.refresh(ind)
    return ind

def get_or_activate_scenario(db, name: str, description: str | None = None) -> Scenario:
    sc = db.query(Scenario).filter(Scenario.name == name).first()
    # Apaga todos y deja este activo (si existe lo reactiva; si no, lo crea)
    db.query(Scenario).update({Scenario.active: False})
    if sc:
        sc.description = description or sc.description
        sc.active = True
        db.add(sc); db.commit(); db.refresh(sc)
        return sc
    sc = Scenario(name=name, description=description or "", active=True)
    db.add(sc); db.commit(); db.refresh(sc)
    return sc

def run():
    db = SessionLocal()
    try:
        # 1) Escenario activo único (idempotente)
        sc = get_or_activate_scenario(db, "Escenario Público", "Escenario por defecto")

        # 2) Categorías (con slug)
        cat_econ = get_or_create_category(db, "Económico")
        cat_soc  = get_or_create_category(db, "Social")
        cat_seg  = get_or_create_category(db, "Seguridad")

        # 3) Indicadores base (2 por categoría)
        inds = []
        inds.append(get_or_create_indicator(db, "Inflación", "DMP", "FIJA_0_100", "%",   cat_econ.id))
        inds.append(get_or_create_indicator(db, "PIB per cápita", "IMP", "VARIABLE", "USD", cat_econ.id))
        inds.append(get_or_create_indicator(db, "Gasto social %PIB", "IMP", "FIJA_0_100", "%", cat_soc.id))
        inds.append(get_or_create_indicator(db, "Desempleo", "DMP", "FIJA_0_100", "%",     cat_soc.id))
        inds.append(get_or_create_indicator(db, "Homicidios por 100k", "DMP", "FIJA_0_100", "tasa", cat_seg.id))
        inds.append(get_or_create_indicator(db, "Percepción de seguridad", "IMP", "FIJA_0_10", "score", cat_seg.id))

        # 4) Pesos de categorías (suman 1.0) → reemplaza los existentes del escenario
        db.query(CategoryWeight).filter_by(scenario_id=sc.id).delete()
        cw = [(cat_econ.id, 0.5), (cat_soc.id, 0.3), (cat_seg.id, 0.2)]
        for cid, w in cw:
            db.add(CategoryWeight(scenario_id=sc.id, category_id=cid, weight=w))
        db.commit()

        # 5) Pesos de indicadores (ejemplo) → reemplaza los existentes del escenario
        db.query(IndicatorWeight).filter_by(scenario_id=sc.id).delete()
        iw_vals = [0.2, 0.15, 0.15, 0.2, 0.15, 0.15]  # suma 1.0
        for ind, w in zip(inds, iw_vals):
            db.add(IndicatorWeight(scenario_id=sc.id, indicator_id=ind.id, weight=w))
        db.commit()

        print("✅ Escenario activo (get-or-create), categorías, indicadores y pesos actualizados.")
    finally:
        db.close()

if __name__ == "__main__":
    run()

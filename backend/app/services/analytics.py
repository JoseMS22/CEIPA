# app/services/analytics.py
from __future__ import annotations
from typing import Dict, List, Tuple, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.scenario import Scenario
from app.models.indicator import Indicator
from app.models.indicator_value import IndicatorValue
from app.models.weights import CategoryWeight, IndicatorWeight

# -------- helpers --------
def _get_scenario(db: Session, scenario_id: Optional[int]) -> Scenario:
    if scenario_id is None:
        sc = db.scalar(select(Scenario).where(Scenario.active.is_(True)))
        if not sc:
            raise ValueError("No hay escenario activo")
        return sc
    sc = db.get(Scenario, scenario_id)
    if not sc:
        raise ValueError("Escenario no encontrado")
    return sc

def _indicator_weights_map(db: Session, scenario_id: int) -> Dict[int, float]:
    rows = db.scalars(select(IndicatorWeight).where(IndicatorWeight.scenario_id == scenario_id)).all()
    return {r.indicator_id: float(r.weight) for r in rows}

def _category_weights_map(db: Session, scenario_id: int) -> Dict[int, float]:
    rows = db.scalars(select(CategoryWeight).where(CategoryWeight.scenario_id == scenario_id)).all()
    return {r.category_id: float(r.weight) for r in rows}

def _country_indicator_norm_map(db: Session, country_id: int) -> Dict[int, float]:
    rows = db.scalars(select(IndicatorValue).where(IndicatorValue.country_id == country_id)).all()
    return {r.indicator_id: float(r.normalized_value) for r in rows if r.normalized_value is not None}

# -------- índice por categoría --------
def category_index(db: Session, country_id: int, category_id: int, *, scenario_id: Optional[int] = None) -> dict:
    sc = _get_scenario(db, scenario_id)
    iw = _indicator_weights_map(db, sc.id)

    # Indicadores de la categoría
    inds = db.scalars(select(Indicator.id).where(Indicator.category_id == category_id)).all()
    if not inds:
        return {"country_id": country_id, "category_id": category_id, "scenario_id": sc.id, "index": None, "detail": []}

    # Valores normalizados del país
    norm_map = _country_indicator_norm_map(db, country_id)

    # Pesos/indicadores presentes y renormalización local
    pairs: List[Tuple[int, float]] = [(ind_id, iw[ind_id]) for ind_id in inds if ind_id in norm_map and ind_id in iw]
    sum_w = sum(w for _, w in pairs)

    detail = []
    if sum_w > 0:
        idx = 0.0
        for ind_id, w in pairs:
            w_local = w / sum_w
            nv = norm_map[ind_id]
            idx += nv * w_local
            detail.append({"indicator_id": ind_id, "norm_value": nv, "weight_local": w_local})
        return {"country_id": country_id, "category_id": category_id, "scenario_id": sc.id, "index": round(idx, 4), "detail": detail}

    # Sin pesos → promedio simple si hay datos
    vals = [norm_map[i] for i in inds if i in norm_map]
    if not vals:
        return {"country_id": country_id, "category_id": category_id, "scenario_id": sc.id, "index": None, "detail": []}
    avg = sum(vals) / len(vals)
    for ind_id in inds:
        if ind_id in norm_map:
            detail.append({"indicator_id": ind_id, "norm_value": norm_map[ind_id], "weight_local": 1/len(vals)})
    return {"country_id": country_id, "category_id": category_id, "scenario_id": sc.id, "index": round(avg, 4), "detail": detail}

# -------- índice global --------
def global_index(db: Session, country_id: int, *, scenario_id: Optional[int] = None) -> dict:
    sc = _get_scenario(db, scenario_id)
    cw = _category_weights_map(db, sc.id)
    if not cw:
        return {"country_id": country_id, "scenario_id": sc.id, "index": None, "detail": []}

    detail = []
    total = 0.0
    sum_w = sum(cw.values()) or 1.0
    for cat_id, w in cw.items():
        w_local = w / sum_w
        ci = category_index(db, country_id, cat_id, scenario_id=sc.id).get("index")
        detail.append({"category_id": cat_id, "index": ci, "weight": w_local})
        if ci is not None:
            total += ci * w_local
    return {"country_id": country_id, "scenario_id": sc.id, "index": round(total, 4), "detail": detail}

# -------- rankings --------
def ranking_global(db: Session, limit: int, order: str = "desc", *, scenario_id: Optional[int] = None) -> dict:
    sc = _get_scenario(db, scenario_id)
    country_ids = db.scalars(select(IndicatorValue.country_id).distinct()).all()
    rows = []
    for cid in country_ids:
        gi = global_index(db, cid, scenario_id=sc.id).get("index")
        if gi is not None:
            rows.append({"country_id": cid, "index": gi})
    rows.sort(key=lambda x: x["index"], reverse=(order.lower() != "asc"))
    return {"scenario_id": sc.id, "order": order, "items": rows[:limit]}

def ranking_by_category(db: Session, category_id: int, limit: int, order: str = "desc", *, scenario_id: Optional[int] = None) -> dict:
    sc = _get_scenario(db, scenario_id)
    country_ids = db.scalars(select(IndicatorValue.country_id).distinct()).all()
    rows = []
    for cid in country_ids:
        ci = category_index(db, cid, category_id, scenario_id=sc.id).get("index")
        if ci is not None:
            rows.append({"country_id": cid, "index": ci})
    rows.sort(key=lambda x: x["index"], reverse=(order.lower() != "asc"))
    return {"scenario_id": sc.id, "category_id": category_id, "order": order, "items": rows[:limit]}

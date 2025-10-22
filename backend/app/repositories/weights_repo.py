from sqlalchemy import select, func
from sqlalchemy.orm import Session
from app.models.weights import CategoryWeight, IndicatorWeight
from app.schemas.weights import CategoryWeightsPayload, IndicatorWeightsPayload

def upsert_category_weights(db: Session, payload: CategoryWeightsPayload):
    # borra existentes y re-inserta lo recibido (estrategia simple, atómica si está en transacción)
    db.query(CategoryWeight).filter(CategoryWeight.scenario_id == payload.scenario_id).delete()
    for it in payload.items:
        db.add(CategoryWeight(scenario_id=payload.scenario_id, category_id=it.category_id, weight=it.weight))
    db.commit()

def upsert_indicator_weights(db: Session, payload: IndicatorWeightsPayload):
    db.query(IndicatorWeight).filter(IndicatorWeight.scenario_id == payload.scenario_id).delete()
    for it in payload.items:
        db.add(IndicatorWeight(scenario_id=payload.scenario_id, indicator_id=it.indicator_id, weight=it.weight))
    db.commit()

def get_category_weights(db: Session, scenario_id: int):
    return db.scalars(select(CategoryWeight).where(CategoryWeight.scenario_id == scenario_id)).all()

def get_indicator_weights(db: Session, scenario_id: int):
    return db.scalars(select(IndicatorWeight).where(IndicatorWeight.scenario_id == scenario_id)).all()

def sum_category_weights(db: Session, scenario_id: int) -> float:
    return float(db.scalar(select(func.coalesce(func.sum(CategoryWeight.weight), 0)).where(CategoryWeight.scenario_id == scenario_id)) or 0.0)

def sum_indicator_weights(db: Session, scenario_id: int) -> float:
    return float(db.scalar(select(func.coalesce(func.sum(IndicatorWeight.weight), 0)).where(IndicatorWeight.scenario_id == scenario_id)) or 0.0)

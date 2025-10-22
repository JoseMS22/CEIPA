from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.db import get_db
from app.repositories import weights_repo as repo
from app.schemas.weights import CategoryWeightsPayload, IndicatorWeightsPayload
from .auth import require_admin

router = APIRouter(prefix="/weights", tags=["Weights"])

@router.get("/categories", dependencies=[])
def get_category_weights(scenario_id: int = Query(...), db: Session = Depends(get_db)):
    rows = repo.get_category_weights(db, scenario_id)
    return {"scenario_id": scenario_id, "sum": repo.sum_category_weights(db, scenario_id),
            "items": [{"category_id": r.category_id, "weight": float(r.weight)} for r in rows]}

@router.get("/indicators", dependencies=[])
def get_indicator_weights(scenario_id: int = Query(...), db: Session = Depends(get_db)):
    rows = repo.get_indicator_weights(db, scenario_id)
    return {"scenario_id": scenario_id, "sum": repo.sum_indicator_weights(db, scenario_id),
            "items": [{"indicator_id": r.indicator_id, "weight": float(r.weight)} for r in rows]}

@router.put("/categories", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin)])
def set_category_weights(payload: CategoryWeightsPayload, db: Session = Depends(get_db)):
    s = sum(i.weight for i in payload.items)
    if abs(s - 1.0) > 1e-6:
        raise HTTPException(422, detail="La suma de pesos de categorías debe ser 1.0")
    repo.upsert_category_weights(db, payload)
    return None

@router.put("/indicators", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin)])
def set_indicator_weights(payload: IndicatorWeightsPayload, db: Session = Depends(get_db)):
    s = sum(i.weight for i in payload.items)
    if abs(s - 1.0) > 1e-6:
        raise HTTPException(422, detail="La suma de pesos de indicadores debe ser 1.0")
    repo.upsert_indicator_weights(db, payload)
    return None

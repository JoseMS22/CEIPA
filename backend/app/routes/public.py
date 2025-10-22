# app/routes/public.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.db import get_db
from app.services import analytics

router = APIRouter(prefix="/public", tags=["Public"])

@router.get("/index/category")
def get_category_index(
    country_id: int = Query(...),
    category_id: int = Query(...),
    scenario_id: int | None = Query(None, description="Si no se envía, usa el escenario activo"),
    db: Session = Depends(get_db),
):
    try:
        return analytics.category_index(db, country_id, category_id, scenario_id=scenario_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/index/global")
def get_global_index(
    country_id: int = Query(...),
    scenario_id: int | None = Query(None, description="Si no se envía, usa el escenario activo"),
    db: Session = Depends(get_db),
):
    try:
        return analytics.global_index(db, country_id, scenario_id=scenario_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/ranking/global")
def get_global_ranking(
    limit: int = Query(10, ge=1, le=200),
    order: str = Query("desc", pattern="^(asc|desc)$"),
    scenario_id: int | None = Query(None, description="Si no se envía, usa el escenario activo"),
    db: Session = Depends(get_db),
):
    return analytics.ranking_global(db, limit=limit, order=order, scenario_id=scenario_id)

@router.get("/ranking/category")
def get_category_ranking(
    category_id: int = Query(...),
    limit: int = Query(10, ge=1, le=200),
    order: str = Query("desc", pattern="^(asc|desc)$"),
    scenario_id: int | None = Query(None, description="Si no se envía, usa el escenario activo"),
    db: Session = Depends(get_db),
):
    return analytics.ranking_by_category(db, category_id=category_id, limit=limit, order=order, scenario_id=scenario_id)

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.db import get_db
from app.schemas.indicator_value import (
    IndicatorValueCreate, IndicatorValueUpdate, IndicatorValueOut, PaginatedIndicatorValues
)
from app.repositories import indicator_value_repo as repo
from .auth import require_admin, get_current_user
from app.core.normalization import NormalizationError

router = APIRouter(prefix="/indicator-values", tags=["IndicatorValues"])

@router.get("", response_model=PaginatedIndicatorValues)
def list_indicator_values(
    country_id: int | None = Query(None),
    indicator_id: int | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=200),
    db: Session = Depends(get_db),
):
    return repo.list_values(db, country_id, indicator_id, page, limit)

@router.post("", response_model=IndicatorValueOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_admin)])
def upsert_indicator_value(payload: IndicatorValueCreate, db: Session = Depends(get_db), current=Depends(get_current_user)):
    try:
        return repo.upsert_value(db, payload, user_id=current.id if current else None)
    except NormalizationError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.patch("/{value_id}", response_model=IndicatorValueOut, dependencies=[Depends(require_admin)])
def update_indicator_value(value_id: int, payload: IndicatorValueUpdate, db: Session = Depends(get_db)):
    iv = repo.get_by_id(db, value_id)
    if not iv:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    try:
        return repo.update_value(db, iv, payload)
    except NormalizationError as e:
        raise HTTPException(status_code=422, detail=str(e))

@router.delete("/{value_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_indicator_value(value_id: int, db: Session = Depends(get_db)):
    iv = repo.get_by_id(db, value_id)
    if not iv:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    repo.delete_value(db, iv)
    return None

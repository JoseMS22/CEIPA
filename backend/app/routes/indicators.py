from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.db import get_db
from app.schemas.indicator import IndicatorCreate, IndicatorUpdate, IndicatorOut, PaginatedIndicators
from app.repositories import indicator_repo as repo
from .auth import require_admin

router = APIRouter(prefix="/indicators", tags=["Indicators"])

@router.get("", response_model=PaginatedIndicators)
def list_indicators(
    q: str | None = Query(None, description="Buscar por nombre"),
    category_id: int | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return repo.list_indicators(db, q=q, category_id=category_id, page=page, limit=limit)

@router.get("/{slug}", response_model=IndicatorOut)
def get_indicator(slug: str, db: Session = Depends(get_db)):
    ind = repo.get_by_slug(db, slug)
    if not ind: raise HTTPException(404, "Indicador no encontrado")
    return ind

@router.post("", response_model=IndicatorOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_admin)])
def create_indicator(payload: IndicatorCreate, db: Session = Depends(get_db)):
    if repo.get_by_name(db, payload.name):
        raise HTTPException(409, "Ya existe un indicador con ese nombre")
    try:
        return repo.create(db, payload)
    except ValueError as e:
        raise HTTPException(409, str(e))

@router.patch("/{slug}", response_model=IndicatorOut, dependencies=[Depends(require_admin)])
def update_indicator(slug: str, payload: IndicatorUpdate, db: Session = Depends(get_db)):
    ind = repo.get_by_slug(db, slug)
    if not ind: raise HTTPException(404, "Indicador no encontrado")
    return repo.update(db, ind, payload)

@router.delete("/{slug}", status_code=204, dependencies=[Depends(require_admin)])
def delete_indicator(slug: str, db: Session = Depends(get_db)):
    ind = repo.get_by_slug(db, slug)
    if not ind: raise HTTPException(404, "Indicador no encontrado")
    repo.delete(db, ind)
    return None

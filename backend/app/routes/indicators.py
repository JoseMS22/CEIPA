# app/api/indicators.py
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db import get_db
from app.schemas.indicator import (
    IndicatorCreate,
    IndicatorUpdate,
    IndicatorOut,
    PaginatedIndicators,
)
from app.repositories import indicator_repo as repo
from app.models.indicator import Indicator
from app.models.weights import CategoryWeight
from app.models.scenario import Scenario
from .auth import get_current_user

router = APIRouter(prefix="/indicators", tags=["Indicators"])


def category_in_active_scenario(db: Session, category_id: int) -> bool:
    """
    Igual que en categories: revisa si la categoría está en el escenario activo.
    """
    count = (
        db.query(func.count(CategoryWeight.id))
        .join(Scenario, CategoryWeight.scenario_id == Scenario.id)
        .filter(
            Scenario.active.is_(True),
            CategoryWeight.category_id == category_id,
        )
        .scalar()
        or 0
    )
    return count > 0


def ensure_can_modify_indicator(db: Session, indicator: Indicator, current) -> None:
    """
    Regla:
    - ADMIN: puede modificar siempre.
    - ANALISTA: no puede modificar si el entorno (category_id) del indicador
      está asignado al escenario activo.
    - Otros roles: 403.
    """
    if current.role == "ADMIN":
        return

    if current.role != "ANALISTA":
        raise HTTPException(
            status_code=403,
            detail="No tienes permisos para modificar indicadores.",
        )

    if category_in_active_scenario(db, indicator.category_id):
        raise HTTPException(
            status_code=403,
            detail=(
                "No puedes modificar indicadores de un entorno que está "
                "asignado al escenario activo."
            ),
        )


@router.get("", response_model=PaginatedIndicators)
def list_indicators(
    q: str | None = Query(None, description="Buscar por nombre"),
    category_id: int | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return repo.list_indicators(
        db, q=q, category_id=category_id, page=page, limit=limit
    )


@router.get("/{slug}", response_model=IndicatorOut)
def get_indicator(slug: str, db: Session = Depends(get_db)):
    ind = repo.get_by_slug(db, slug)
    if not ind:
        raise HTTPException(status_code=404, detail="Indicador no encontrado")
    return ind


@router.post(
    "",
    response_model=IndicatorOut,
    status_code=status.HTTP_201_CREATED,
)
def create_indicator(
    payload: IndicatorCreate,
    db: Session = Depends(get_db),
    current=Depends(get_current_user),
):
    # ADMIN y ANALISTA pueden crear indicadores
    if current.role not in ("ADMIN", "ANALISTA"):
        raise HTTPException(
            status_code=403,
            detail="No tienes permisos para crear indicadores.",
        )

    if repo.get_by_name(db, payload.name):
        raise HTTPException(
            status_code=409,
            detail="Ya existe un indicador con ese nombre",
        )
    try:
        return repo.create(db, payload)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.patch("/{slug}", response_model=IndicatorOut)
def update_indicator(
    slug: str,
    payload: IndicatorUpdate,
    db: Session = Depends(get_db),
    current=Depends(get_current_user),
):
    ind = repo.get_by_slug(db, slug)
    if not ind:
        raise HTTPException(status_code=404, detail="Indicador no encontrado")

    ensure_can_modify_indicator(db, ind, current)

    return repo.update(db, ind, payload)


@router.delete("/{slug}", status_code=status.HTTP_204_NO_CONTENT)
def delete_indicator(
    slug: str,
    db: Session = Depends(get_db),
    current=Depends(get_current_user),
):
    ind = repo.get_by_slug(db, slug)
    if not ind:
        raise HTTPException(status_code=404, detail="Variable no encontrada")

    ensure_can_modify_indicator(db, ind, current)

    try:
        # aquí usas tu safe_delete_indicator tal cual
        repo.safe_delete_indicator(db, ind)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

    return None

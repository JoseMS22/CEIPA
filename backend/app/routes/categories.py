# app/api/categories.py
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db import get_db
from app.schemas.category import (
    CategoryCreate,
    CategoryUpdate,
    CategoryOut,
    PaginatedCategories,
)
from app.repositories import category_repo as repo
from app.models.weights import CategoryWeight
from app.models.scenario import Scenario
from .auth import get_current_user

router = APIRouter(prefix="/categories", tags=["Categories"])


def category_in_active_scenario(db: Session, category_id: int) -> bool:
    """
    Devuelve True si esta categoría (entorno) está asignada
    al escenario activo.
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


def ensure_can_modify_category(db: Session, category_id: int, current) -> None:
    """
    Regla:
    - ADMIN: siempre puede modificar / borrar.
    - ANALISTA: NO puede modificar / borrar si la categoría está
      en el escenario activo.
    - Otros roles: 403.
    """
    if current.role == "ADMIN":
        return

    if current.role != "ANALISTA":
        raise HTTPException(
            status_code=403,
            detail="No tienes permisos para modificar entornos.",
        )

    if category_in_active_scenario(db, category_id):
        raise HTTPException(
            status_code=403,
            detail=(
                "No puedes modificar un entorno que está asignado al "
                "escenario activo."
            ),
        )


@router.get("", response_model=PaginatedCategories)
def list_categories(
    q: str | None = Query(default=None, description="Buscar por nombre"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return repo.list_categories(db, q=q, page=page, limit=limit)


@router.get("/{slug}", response_model=CategoryOut)
def get_category(slug: str, db: Session = Depends(get_db)):
    cat = repo.get_by_slug(db, slug)
    if not cat:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    return cat


@router.post(
    "",
    response_model=CategoryOut,
    status_code=status.HTTP_201_CREATED,
)
def create_category(
    payload: CategoryCreate,
    db: Session = Depends(get_db),
    current=Depends(get_current_user),
):
    # ADMIN y ANALISTA pueden crear entornos
    if current.role not in ("ADMIN", "ANALISTA"):
        raise HTTPException(
            status_code=403,
            detail="No tienes permisos para crear entornos.",
        )

    if repo.get_by_name(db, payload.name):
        raise HTTPException(
            status_code=409,
            detail="Ya existe una categoría con ese nombre",
        )
    try:
        return repo.create_category(db, payload)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.patch("/{slug}", response_model=CategoryOut)
def update_category(
    slug: str,
    payload: CategoryUpdate,
    db: Session = Depends(get_db),
    current=Depends(get_current_user),
):
    cat = repo.get_by_slug(db, slug)
    if not cat:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")

    # permisos (ADMIN todo, ANALISTA solo si NO está en escenario activo)
    ensure_can_modify_category(db, cat.id, current)

    return repo.update_category(db, cat, payload)


@router.delete(
    "/{slug}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_category(
    slug: str,
    db: Session = Depends(get_db),
    current=Depends(get_current_user),
):
    cat = repo.get_by_slug(db, slug)
    if not cat:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")

    # permisos (ADMIN todo, ANALISTA solo si NO está en escenario activo)
    ensure_can_modify_category(db, cat.id, current)

    try:
        # aquí se usa tu lógica existente con CategoryWeight, Indicator, etc.
        repo.delete_category(db, cat)
    except ValueError as e:
        # relaciones que impiden borrar
        raise HTTPException(status_code=409, detail=str(e))
    return None

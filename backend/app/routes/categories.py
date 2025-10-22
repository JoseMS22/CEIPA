from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.db import get_db
from app.schemas.category import CategoryCreate, CategoryUpdate, CategoryOut, PaginatedCategories
from app.repositories import category_repo as repo
from .auth import require_admin  # para proteger rutas

router = APIRouter(prefix="/categories", tags=["Categories"])

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

@router.post("", response_model=CategoryOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_admin)])
def create_category(payload: CategoryCreate, db: Session = Depends(get_db)):
    if repo.get_by_name(db, payload.name):
        raise HTTPException(status_code=409, detail="Ya existe una categoría con ese nombre")
    try:
        return repo.create_category(db, payload)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

@router.patch("/{slug}", response_model=CategoryOut, dependencies=[Depends(require_admin)])
def update_category(slug: str, payload: CategoryUpdate, db: Session = Depends(get_db)):
    cat = repo.get_by_slug(db, slug)
    if not cat:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    return repo.update_category(db, cat, payload)

@router.delete("/{slug}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin)])
def delete_category(slug: str, db: Session = Depends(get_db)):
    cat = repo.get_by_slug(db, slug)
    if not cat:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    repo.delete_category(db, cat)
    return None

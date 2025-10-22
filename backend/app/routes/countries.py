# app/routes/countries.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from ..db import get_db
from ..schemas.country import CountryOut, PaginatedCountries
from ..repositories import country_repo as repo

router = APIRouter(prefix="/countries", tags=["Countries"])

@router.get("", response_model=PaginatedCountries)
def list_countries(
    q: str | None = Query(default=None, description="Buscar por nombre/ISO"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    only_enabled: bool = Query(default=True),
    db: Session = Depends(get_db),
):
    return repo.list_countries(db, q=q, page=page, limit=limit, only_enabled=only_enabled)

@router.get("/{code_or_id}", response_model=CountryOut)
def get_country(code_or_id: str, db: Session = Depends(get_db)):
    """
    Permite obtener por id (numérico) o por ISO (2 o 3 letras).
    Ejemplos: /countries/cr  /countries/cri  /countries/170
    """
    country = None
    if code_or_id.isdigit():
        country = repo.get_by_id(db, int(code_or_id))
    else:
        country = repo.get_by_iso(db, code_or_id)

    if not country:
        raise HTTPException(status_code=404, detail="País no encontrado")
    return country

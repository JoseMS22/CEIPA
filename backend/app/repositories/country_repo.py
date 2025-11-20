# app/repositories/country_repo.py
from math import ceil
from sqlalchemy import select, or_, func
from sqlalchemy.orm import Session
from ..models.country import Country

def list_countries(db: Session, q: str | None, page: int, limit: int, only_enabled: bool = True):
    stmt = select(Country)
    if only_enabled:
        stmt = stmt.where(Country.enabled.is_(True))

    if q:
        q_like = f"%{q}%"
        stmt = stmt.where(or_(
            Country.name_es.ilike(q_like),
            Country.name_en.ilike(q_like),
            Country.iso2.ilike(q_like),
            Country.iso3.ilike(q_like),
        ))

    # total
    total = db.scalar(
        select(func.count()).select_from(stmt.subquery())
    ) or 0

    if limit == 0:
        rows = db.scalars(
            stmt.order_by(Country.name_es.asc(), Country.iso2.asc())
        ).all()
        return {
            "page": 1,
            "limit": 0,
            "total": total,
            "total_pages": 1,
            "items": rows,
        }

    # paginado (orden estable por nombre_es, luego iso2)
    offset = (page - 1) * limit
    rows = db.scalars(
        stmt.order_by(Country.name_es.asc(), Country.iso2.asc()).offset(offset).limit(limit)
    ).all()

    return {
        "page": page,
        "limit": limit,
        "total": total,
        "total_pages": ceil(total / limit) if limit else 1,
        "items": rows,
    }

def get_by_id(db: Session, country_id: int) -> Country | None:
    return db.get(Country, country_id)

def get_by_iso(db: Session, code: str) -> Country | None:
    c = code.strip().lower()
    if len(c) == 2:
        return db.scalar(select(Country).where(Country.iso2 == c))
    if len(c) == 3:
        return db.scalar(select(Country).where(Country.iso3 == c))
    return None

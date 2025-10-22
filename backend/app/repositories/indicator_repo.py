from math import ceil
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from app.models.indicator import Indicator
from app.schemas.indicator import IndicatorCreate, IndicatorUpdate
import re

def slugify(s: str) -> str:
    s = s.lower().strip()
    s = re.sub(r"[^a-z0-9\s-]", "", s)
    s = re.sub(r"\s+", "-", s)
    s = re.sub(r"-+", "-", s)
    return s

def list_indicators(db: Session, q: str | None, category_id: int | None, page: int, limit: int):
    stmt = select(Indicator)
    if q:
        stmt = stmt.where(Indicator.name.ilike(f"%{q}%"))
    if category_id:
        stmt = stmt.where(Indicator.category_id == category_id)

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(stmt.order_by(Indicator.name.asc()).offset((page-1)*limit).limit(limit)).all()
    return {"page": page, "limit": limit, "total": total, "total_pages": ceil(total/limit) if limit else 1, "items": rows}

def get_by_id(db: Session, indicator_id: int) -> Indicator | None:
    return db.get(Indicator, indicator_id)

def get_by_slug(db: Session, slug: str) -> Indicator | None:
    return db.scalar(select(Indicator).where(Indicator.slug == slug))

def get_by_name(db: Session, name: str) -> Indicator | None:
    return db.scalar(select(Indicator).where(Indicator.name == name))

def create(db: Session, data: IndicatorCreate) -> Indicator:
    slug = slugify(data.name)
    if get_by_slug(db, slug): raise ValueError("slug ya está en uso")
    ind = Indicator(**data.model_dump(), slug=slug)
    db.add(ind); db.commit(); db.refresh(ind)
    return ind

def update(db: Session, ind: Indicator, data: IndicatorUpdate) -> Indicator:
    payload = data.model_dump(exclude_unset=True)
    if "name" in payload and payload["name"]:
        ind.slug = slugify(payload["name"])
    for k, v in payload.items(): setattr(ind, k, v)
    db.add(ind); db.commit(); db.refresh(ind)
    return ind

def delete(db: Session, ind: Indicator) -> None:
    db.delete(ind); db.commit()

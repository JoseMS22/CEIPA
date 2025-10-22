from math import ceil
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from app.models.category import Category
from app.schemas.category import CategoryCreate, CategoryUpdate
import re

def slugify(s: str) -> str:
    s = s.lower().strip()
    s = re.sub(r"[^a-z0-9\s-]", "", s)
    s = re.sub(r"\s+", "-", s)
    s = re.sub(r"-+", "-", s)
    return s

def list_categories(db: Session, q: str | None, page: int, limit: int):
    stmt = select(Category)
    if q:
        q_like = f"%{q}%"
        stmt = stmt.where(Category.name.ilike(q_like))

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    offset = (page - 1) * limit
    rows = db.scalars(
        stmt.order_by(Category.name.asc()).offset(offset).limit(limit)
    ).all()

    return {
        "page": page,
        "limit": limit,
        "total": total,
        "total_pages": ceil(total / limit) if limit else 1,
        "items": rows,
    }

def get_by_id(db: Session, category_id: int) -> Category | None:
    return db.get(Category, category_id)

def get_by_slug(db: Session, slug: str) -> Category | None:
    return db.scalar(select(Category).where(Category.slug == slug))

def get_by_name(db: Session, name: str) -> Category | None:
    return db.scalar(select(Category).where(Category.name == name))

def create_category(db: Session, data: CategoryCreate) -> Category:
    slug = slugify(data.name)
    # Evita duplicados
    if get_by_slug(db, slug):
        raise ValueError("slug ya está en uso")
    c = Category(**data.model_dump(), slug=slug)
    db.add(c)
    db.commit()
    db.refresh(c)
    return c

def update_category(db: Session, cat: Category, data: CategoryUpdate) -> Category:
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(cat, k, v)
    if data.name:
        cat.slug = slugify(data.name)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat

def delete_category(db: Session, cat: Category) -> None:
    db.delete(cat)
    db.commit()

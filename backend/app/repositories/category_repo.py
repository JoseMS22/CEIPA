from math import ceil
from sqlalchemy import select, func
from sqlalchemy.orm import Session
import re

from app.models.category import Category
from app.schemas.category import CategoryCreate, CategoryUpdate

from app.models.weights import CategoryWeight, IndicatorWeight
from app.models.indicator import Indicator
from app.models.indicator_value import IndicatorValue  # ajusta el nombre del archivo si cambia


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


def get_by_slug(db: Session, slug: str) -> Category | None:
    return db.scalar(select(Category).where(Category.slug == slug))


def get_by_name(db: Session, name: str) -> Category | None:
    return db.scalar(select(Category).where(Category.name == name))


def create_category(db: Session, data: CategoryCreate) -> Category:
    slug = slugify(data.name)
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


def delete_category(db: Session, category: Category) -> None:
    """
    Elimina un entorno (categoría) y EN CASCADA:
    - todos sus indicadores
    - todos los pesos de esos indicadores
    - todos los valores de esos indicadores

    Solo se bloquea si la categoría está asignada a uno o más escenarios.
    """

    # 1) ¿Está asignado a escenarios? (CategoryWeight = escenario-entorno)
    assigned_count = (
        db.query(CategoryWeight)
        .filter(CategoryWeight.category_id == category.id)
        .count()
    )
    if assigned_count > 0:
        raise ValueError(
            "No se puede eliminar el entorno porque está asignado a uno o más escenarios. "
            "Primero elimínalo de esos escenarios."
        )

    # 2) Obtener IDs de indicadores EXCLUSIVAMENTE desde la tabla, sin usar category.indicators
    indicator_ids = [
        row[0]
        for row in db.query(Indicator.id)
        .filter(Indicator.category_id == category.id)
        .all()
    ]

    if indicator_ids:
        # 2.a) Borrar valores de esos indicadores
        db.query(IndicatorValue).filter(
            IndicatorValue.indicator_id.in_(indicator_ids)
        ).delete(synchronize_session=False)

        # 2.b) Borrar pesos de esos indicadores
        db.query(IndicatorWeight).filter(
            IndicatorWeight.indicator_id.in_(indicator_ids)
        ).delete(synchronize_session=False)

        # 2.c) Borrar los indicadores
        db.query(Indicator).filter(
            Indicator.id.in_(indicator_ids)
        ).delete(synchronize_session=False)

    # 3) Finalmente borrar la categoría
    db.delete(category)
    db.commit()

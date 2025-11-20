# app/repositories/indicator_repo.py
from math import ceil
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from app.models.indicator import Indicator
from app.models.indicator_value import IndicatorValue
from app.models.weights import IndicatorWeight
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
    rows = db.scalars(
        stmt.order_by(Indicator.name.asc())
            .offset((page - 1) * limit)
            .limit(limit)
    ).all()

    return {
        "page": page,
        "limit": limit,
        "total": total,
        "total_pages": ceil(total / limit) if limit else 1,
        "items": rows,
    }

def get_by_id(db: Session, indicator_id: int) -> Indicator | None:
    return db.get(Indicator, indicator_id)

def get_by_slug(db: Session, slug: str) -> Indicator | None:
    return db.scalar(select(Indicator).where(Indicator.slug == slug))

def get_by_name(db: Session, name: str) -> Indicator | None:
    return db.scalar(select(Indicator).where(Indicator.name == name))

def create(db: Session, data: IndicatorCreate) -> Indicator:
    slug = slugify(data.name)
    if get_by_slug(db, slug):
        raise ValueError("slug ya está en uso")

    # 👇 OJO: aquí mapeamos SOLO lo que existe en el modelo
    ind = Indicator(
        name=data.name,
        slug=slug,
        value_type=data.value_type,
        scale=data.scale,
        min_value=data.min_value,
        max_value=data.max_value,
        unit=data.unit,
        source_url=data.source_url,
        justification=data.justification,
        category_id=data.category_id,
    )

    db.add(ind)
    db.commit()
    db.refresh(ind)
    return ind

def update(db: Session, ind: Indicator, data: IndicatorUpdate) -> Indicator:
    payload = data.model_dump(exclude_unset=True)

    # si cambia el nombre, actualizamos el slug
    if "name" in payload and payload["name"]:
        ind.name = payload["name"]
        ind.slug = slugify(payload["name"])

    if "value_type" in payload and payload["value_type"] is not None:
        ind.value_type = payload["value_type"]

    if "scale" in payload and payload["scale"] is not None:
        ind.scale = payload["scale"]

    if "min_value" in payload:
        ind.min_value = payload["min_value"]

    if "max_value" in payload:
        ind.max_value = payload["max_value"]

    if "unit" in payload:
        ind.unit = payload["unit"]

    if "source_url" in payload:
        ind.source_url = payload["source_url"]

    if "justification" in payload:
        ind.justification = payload["justification"]

    if "category_id" in payload and payload["category_id"] is not None:
        ind.category_id = payload["category_id"]

    db.add(ind)
    db.commit()
    db.refresh(ind)
    return ind

def safe_delete_indicator(db: Session, indicator: Indicator) -> None:
    """
    Solo borra la variable si NO tiene valores.
    Si no hay valores, borra también sus pesos en escenarios.
    """
    values_count = (
        db.query(IndicatorValue)
        .filter(IndicatorValue.indicator_id == indicator.id)
        .count()
    )
    if values_count > 0:
        raise ValueError(
            "No se puede eliminar la variable porque tiene valores cargados "
            "en uno o más escenarios. Primero elimine esos valores."
        )

    # No hay valores → eliminar pesos y variable
    db.query(IndicatorWeight).filter(
        IndicatorWeight.indicator_id == indicator.id
    ).delete(synchronize_session=False)

    db.delete(indicator)
    db.commit()

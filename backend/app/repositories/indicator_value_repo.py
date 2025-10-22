from math import ceil
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from app.models.indicator_value import IndicatorValue
from app.models.indicator import Indicator
from app.schemas.indicator_value import IndicatorValueCreate, IndicatorValueUpdate
from app.core.normalization import normalize_value, NormalizationError

def _find_existing(db: Session, country_id: int, indicator_id: int):
    stmt = select(IndicatorValue).where(
        IndicatorValue.country_id == country_id,
        IndicatorValue.indicator_id == indicator_id,
    )
    return db.scalar(stmt)

def upsert_value(db: Session, payload: IndicatorValueCreate, user_id: int | None) -> IndicatorValue:
    ind = db.get(Indicator, payload.indicator_id)
    if not ind:
        raise ValueError("Indicador no existe")

    norm = normalize_value(ind, float(payload.raw_value)) if payload.raw_value is not None else None

    current = _find_existing(db, payload.country_id, payload.indicator_id)
    if current:
        current.raw_value = payload.raw_value
        current.normalized_value = norm
        db.add(current); db.commit(); db.refresh(current)
        return current

    rec = IndicatorValue(
        country_id=payload.country_id,
        indicator_id=payload.indicator_id,
        raw_value=payload.raw_value,
        normalized_value=norm,
        loaded_by=user_id,
    )
    db.add(rec); db.commit(); db.refresh(rec)
    return rec

def update_value(db: Session, iv: IndicatorValue, payload: IndicatorValueUpdate) -> IndicatorValue:
    if "raw_value" in payload.model_dump(exclude_unset=True):
        iv.raw_value = payload.raw_value
        ind = db.get(Indicator, iv.indicator_id)
        iv.normalized_value = normalize_value(ind, float(iv.raw_value)) if iv.raw_value is not None else None
    db.add(iv); db.commit(); db.refresh(iv)
    return iv

def list_values(
    db: Session,
    country_id: int | None,
    indicator_id: int | None,
    page: int,
    limit: int,
):
    stmt = select(IndicatorValue)
    if country_id:
        stmt = stmt.where(IndicatorValue.country_id == country_id)
    if indicator_id:
        stmt = stmt.where(IndicatorValue.indicator_id == indicator_id)

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(
        stmt.order_by(IndicatorValue.id.desc()).offset((page-1)*limit).limit(limit)
    ).all()

    return {
        "page": page, "limit": limit, "total": total,
        "total_pages": ceil(total/limit) if limit else 1, "items": rows
    }

def get_by_id(db: Session, value_id: int) -> IndicatorValue | None:
    return db.get(IndicatorValue, value_id)

def delete_value(db: Session, iv: IndicatorValue) -> None:
    db.delete(iv); db.commit()

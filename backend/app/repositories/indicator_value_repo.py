# app/repositories/indicator_value_repo.py
from math import ceil
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from app.models.indicator_value import IndicatorValue
from app.models.indicator import Indicator
from app.schemas.indicator_value import IndicatorValueCreate, IndicatorValueUpdate
from app.core.normalization import normalize_value, NormalizationError


def _find_existing(db: Session, scenario_id: int, country_id: int, indicator_id: int):
  """Busca un value de ese escenario + país + indicador."""
  stmt = select(IndicatorValue).where(
      IndicatorValue.scenario_id == scenario_id,
      IndicatorValue.country_id == country_id,
      IndicatorValue.indicator_id == indicator_id,
  )
  return db.scalar(stmt)


def upsert_value(db: Session, payload: IndicatorValueCreate, user_id: int | None) -> IndicatorValue:
  # 1. validar que exista el indicador
  ind = db.get(Indicator, payload.indicator_id)
  if not ind:
      raise ValueError("Indicador no existe")

  # 2. validar escala + normalizar (si hay raw)
  if payload.raw_value is not None:
      raw = float(payload.raw_value)

      # usamos los min / max del indicador si existen
      min_val = getattr(ind, "min_value", None)
      max_val = getattr(ind, "max_value", None)

      if min_val is not None and raw < min_val:
          raise NormalizationError(
              f"El valor {raw} está por debajo del mínimo permitido ({min_val}) "
              f"para el indicador '{ind.name}'."
          )
      if max_val is not None and raw > max_val:
          raise NormalizationError(
              f"El valor {raw} está por encima del máximo permitido ({max_val}) "
              f"para el indicador '{ind.name}'."
          )

      norm = normalize_value(ind, raw)
  else:
      norm = None

  # 3. ver si YA existe ese value para ese escenario
  current = _find_existing(
      db,
      payload.scenario_id,
      payload.country_id,
      payload.indicator_id,
  )
  if current:
      current.raw_value = payload.raw_value
      current.normalized_value = norm
      db.add(current)
      db.commit()
      db.refresh(current)
      return current

  # 4. si no existe, lo creamos
  rec = IndicatorValue(
      scenario_id=payload.scenario_id,
      country_id=payload.country_id,
      indicator_id=payload.indicator_id,
      raw_value=payload.raw_value,
      normalized_value=norm,
      loaded_by=user_id,
  )
  db.add(rec)
  db.commit()
  db.refresh(rec)
  return rec


def update_value(db: Session, iv: IndicatorValue, payload: IndicatorValueUpdate) -> IndicatorValue:
  data = payload.model_dump(exclude_unset=True)
  if "raw_value" in data:
      iv.raw_value = data["raw_value"]

      ind = db.get(Indicator, iv.indicator_id)

      if iv.raw_value is not None:
          raw = float(iv.raw_value)
          min_val = getattr(ind, "min_value", None)
          max_val = getattr(ind, "max_value", None)

          if min_val is not None and raw < min_val:
              raise NormalizationError(
                  f"El valor {raw} está por debajo del mínimo permitido ({min_val}) "
                  f"para el indicador '{ind.name}'."
              )
          if max_val is not None and raw > max_val:
              raise NormalizationError(
                  f"El valor {raw} está por encima del máximo permitido ({max_val}) "
                  f"para el indicador '{ind.name}'."
              )

          iv.normalized_value = normalize_value(ind, raw)
      else:
          iv.normalized_value = None

  db.add(iv)
  db.commit()
  db.refresh(iv)
  return iv


def list_values(
  db: Session,
  scenario_id: int | None,
  country_id: int | None,
  indicator_id: int | None,
  page: int,
  limit: int,
):
  stmt = select(IndicatorValue)
  if scenario_id:
      stmt = stmt.where(IndicatorValue.scenario_id == scenario_id)
  if country_id:
      stmt = stmt.where(IndicatorValue.country_id == country_id)
  if indicator_id:
      stmt = stmt.where(IndicatorValue.indicator_id == indicator_id)

  total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
  rows = db.scalars(
      stmt.order_by(IndicatorValue.id.desc())
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


def get_by_id(db: Session, value_id: int) -> IndicatorValue | None:
  return db.get(IndicatorValue, value_id)


def delete_value(db: Session, iv: IndicatorValue) -> None:
  db.delete(iv)
  db.commit()

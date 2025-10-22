from math import ceil
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from app.models.scenario import Scenario
from app.schemas.scenario import ScenarioCreate, ScenarioUpdate

def list_scenarios(db: Session, q: str | None, page: int, limit: int, only_active: bool | None):
    stmt = select(Scenario)
    if q:
        stmt = stmt.where(Scenario.name.ilike(f"%{q}%"))
    if only_active is True:
        stmt = stmt.where(Scenario.active.is_(True))
    elif only_active is False:
        stmt = stmt.where(Scenario.active.is_(False))

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(stmt.order_by(Scenario.name.asc()).offset((page-1)*limit).limit(limit)).all()
    return {"page": page, "limit": limit, "total": total, "total_pages": ceil(total/limit) if limit else 1, "items": rows}

def get_by_id(db: Session, scenario_id: int) -> Scenario | None:
    return db.get(Scenario, scenario_id)

def get_by_name(db: Session, name: str) -> Scenario | None:
    return db.scalar(select(Scenario).where(Scenario.name == name))

def create(db: Session, data: ScenarioCreate, user_id: int | None) -> Scenario:
    # Si llega active=True, apagamos cualquier otro antes de insertar
    if data.active:
        db.query(Scenario).update({Scenario.active: False})
    sc = Scenario(**data.model_dump(), created_by=user_id)
    db.add(sc)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        # Si chocó con el índice único (caso carrera), forzamos exclusividad y reintentamos
        db.query(Scenario).update({Scenario.active: False})
        sc.active = True
        db.add(sc)
        db.commit()
    db.refresh(sc)
    return sc

def update(db: Session, sc: Scenario, data: ScenarioUpdate) -> Scenario:
    payload = data.model_dump(exclude_unset=True)
    # Si piden activar este escenario, desactiva los demás primero
    if "active" in payload and payload["active"] is True:
        db.query(Scenario).update({Scenario.active: False})
        sc.active = True
        payload.pop("active", None)  # ya lo aplicamos
    for k, v in payload.items():
        setattr(sc, k, v)
    db.add(sc)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        # mismísima estrategia anti-carrera
        db.query(Scenario).update({Scenario.active: False})
        sc.active = True
        db.add(sc)
        db.commit()
    db.refresh(sc)
    return sc

def delete(db: Session, sc: Scenario) -> None:
    db.delete(sc); db.commit()

def set_active_exclusive(db: Session, scenario_id: int) -> None:
    db.query(Scenario).update({Scenario.active: False})
    target = db.get(Scenario, scenario_id)
    if target:
        target.active = True
        db.add(target)
    db.commit()
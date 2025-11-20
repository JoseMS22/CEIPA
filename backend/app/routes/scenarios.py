from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.db import get_db
from app.schemas.scenario import ScenarioCreate, ScenarioUpdate, ScenarioOut, PaginatedScenarios
from app.repositories import scenario_repo as repo
from .auth import get_current_user
from app.models.scenario import Scenario

router = APIRouter(prefix="/scenarios", tags=["Scenarios"])


# -------------------------------------------------
# LISTAR
# -------------------------------------------------
@router.get("", response_model=PaginatedScenarios)
def list_scenarios(
    q: str | None = Query(None),
    only_active: bool | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return repo.list_scenarios(db, q=q, page=page, limit=limit, only_active=only_active)


# -------------------------------------------------
# ESCENARIO ACTIVO
# -------------------------------------------------
@router.get("/active", response_model=ScenarioOut)
def get_active_scenario(db: Session = Depends(get_db)):
    sc = db.query(Scenario).filter(Scenario.active.is_(True)).first()
    if not sc:
        raise HTTPException(status_code=404, detail="No hay escenario activo")
    return sc


# -------------------------------------------------
# GET SCENARIO
# -------------------------------------------------
@router.get("/{scenario_id}", response_model=ScenarioOut)
def get_scenario(scenario_id: int, db: Session = Depends(get_db)):
    sc = repo.get_by_id(db, scenario_id)
    if not sc:
        raise HTTPException(status_code=404, detail="Escenario no encontrado")
    return sc


# -------------------------------------------------
# CREAR ESCENARIO (ADMIN Y ANALISTA)
# -------------------------------------------------
@router.post("", response_model=ScenarioOut, status_code=status.HTTP_201_CREATED)
def create_scenario(
    payload: ScenarioCreate,
    db: Session = Depends(get_db),
    current=Depends(get_current_user)
):
    # si el nombre ya existe
    if repo.get_by_name(db, payload.name):
        raise HTTPException(status_code=409, detail="Ya existe un escenario con ese nombre")

    # ANALISTA solo puede crear escenarios inactivos
    if current.role == "ANALISTA":
        payload.active = False

    return repo.create(db, payload, user_id=current.id)


# -------------------------------------------------
# EDITAR ESCENARIO (ADMIN total — ANALISTA limitado)
# -------------------------------------------------
@router.patch("/{scenario_id}", response_model=ScenarioOut)
def update_scenario(
    scenario_id: int,
    payload: ScenarioUpdate,
    db: Session = Depends(get_db),
    current=Depends(get_current_user)
):
    sc = repo.get_by_id(db, scenario_id)
    if not sc:
        raise HTTPException(status_code=404, detail="Escenario no encontrado")

    # ANALISTA no puede tocar el escenario activo
    if current.role == "ANALISTA" and sc.active:
        raise HTTPException(
            status_code=403,
            detail="Solo el administrador puede modificar el escenario activo."
        )

    # ANALISTA no puede activar/desactivar
    if current.role == "ANALISTA":
        payload.active = sc.active

    # Si cambia nombre → validar repetido
    if payload.name:
        other = repo.get_by_name(db, payload.name)
        if other and other.id != sc.id:
            raise HTTPException(status_code=409, detail="Nombre ya está en uso")

    return repo.update(db, sc, payload)


# -------------------------------------------------
# ELIMINAR (ADMIN puede todo — ANALISTA solo inactivos)
# -------------------------------------------------
@router.delete("/{scenario_id}", status_code=204)
def delete_scenario(
    scenario_id: int,
    db: Session = Depends(get_db),
    current=Depends(get_current_user)
):
    sc = repo.get_by_id(db, scenario_id)
    if not sc:
        raise HTTPException(status_code=404, detail="Escenario no encontrado")

    # ANALISTA no puede eliminar activos
    if current.role == "ANALISTA" and sc.active:
        raise HTTPException(
            status_code=403,
            detail="No puedes eliminar el escenario activo."
        )

    try:
        repo.delete(db, sc)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

    return None


# -------------------------------------------------
# QUITAR ENTORNO DEL ESCENARIO
# -------------------------------------------------
@router.delete("/{scenario_id}/categories/{category_id}", status_code=204)
def remove_category_from_scenario(
    scenario_id: int,
    category_id: int,
    db: Session = Depends(get_db),
    current=Depends(get_current_user)
):
    sc = repo.get_by_id(db, scenario_id)
    if not sc:
        raise HTTPException(status_code=404, detail="Escenario no encontrado")

    # ANALISTA no puede modificar escenarios activos
    if current.role == "ANALISTA" and sc.active:
        raise HTTPException(status_code=403, detail="No puedes modificar el escenario activo.")

    repo.remove_category_from_scenario(db, scenario_id, category_id)
    return None


# -------------------------------------------------
# ACTIVAR ESCENARIO (solo ADMIN)
# -------------------------------------------------
@router.post("/{scenario_id}/activate", status_code=204)
def activate_scenario(
    scenario_id: int,
    db: Session = Depends(get_db),
    current=Depends(get_current_user)
):
    if current.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Solo el administrador puede activar escenarios.")

    sc = repo.get_by_id(db, scenario_id)
    if not sc:
        raise HTTPException(status_code=404, detail="Escenario no encontrado")

    repo.set_active_exclusive(db, scenario_id)
    return None

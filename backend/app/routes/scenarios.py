from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.db import get_db
from app.schemas.scenario import ScenarioCreate, ScenarioUpdate, ScenarioOut, PaginatedScenarios
from app.repositories import scenario_repo as repo
from .auth import require_admin, get_current_user
from app.models.scenario import Scenario  # <-- IMPORTA EL MODELO

router = APIRouter(prefix="/scenarios", tags=["Scenarios"])

@router.get("", response_model=PaginatedScenarios)
def list_scenarios(
    q: str | None = Query(None, description="Buscar por nombre"),
    only_active: bool | None = Query(None, description="True/False para filtrar activos"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return repo.list_scenarios(db, q=q, page=page, limit=limit, only_active=only_active)

# --- define primero la ruta estática /active ---
@router.get("/active", response_model=ScenarioOut)
def get_active_scenario(db: Session = Depends(get_db)):
    sc = db.query(Scenario).filter(Scenario.active.is_(True)).first()
    if not sc:
        raise HTTPException(status_code=404, detail="No hay escenario activo")
    return sc
# ------------------------------------------------

@router.get("/{scenario_id}", response_model=ScenarioOut)
def get_scenario(scenario_id: int, db: Session = Depends(get_db)):
    sc = repo.get_by_id(db, scenario_id)
    if not sc:
        raise HTTPException(status_code=404, detail="Escenario no encontrado")
    return sc

@router.post("", response_model=ScenarioOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_admin)])
def create_scenario(payload: ScenarioCreate, db: Session = Depends(get_db), current=Depends(get_current_user)):
    if repo.get_by_name(db, payload.name):
        raise HTTPException(status_code=409, detail="Ya existe un escenario con ese nombre")
    return repo.create(db, payload, user_id=current.id if current else None)

@router.patch("/{scenario_id}", response_model=ScenarioOut, dependencies=[Depends(require_admin)])
def update_scenario(scenario_id: int, payload: ScenarioUpdate, db: Session = Depends(get_db)):
    sc = repo.get_by_id(db, scenario_id)
    if not sc:
        raise HTTPException(status_code=404, detail="Escenario no encontrado")
    if payload.name and (other := repo.get_by_name(db, payload.name)) and other.id != sc.id:
        raise HTTPException(status_code=409, detail="Nombre ya está en uso")
    return repo.update(db, sc, payload)

@router.delete("/{scenario_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_scenario(scenario_id: int, db: Session = Depends(get_db)):
    sc = repo.get_by_id(db, scenario_id)
    if not sc:
        raise HTTPException(status_code=404, detail="Escenario no encontrado")
    repo.delete(db, sc)
    return None

@router.post("/{scenario_id}/activate", status_code=204, dependencies=[Depends(require_admin)])
def activate_scenario(scenario_id: int, db: Session = Depends(get_db)):
    sc = repo.get_by_id(db, scenario_id)
    if not sc:
        raise HTTPException(status_code=404, detail="Escenario no encontrado")
    repo.set_active_exclusive(db, scenario_id)
    return None

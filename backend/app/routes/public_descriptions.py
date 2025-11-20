# app/routes/public_descriptions.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db        # ✅ igual que en main.py
from app.models.public_description import PublicDescription
from app.schemas.public_description import (
    PublicDescriptionRead,
    PublicDescriptionCreate,
    PublicDescriptionUpdate,
    PublicDescriptionKey,
)
from .auth import require_admin


router = APIRouter(prefix="/public-descriptions", tags=["Public Descriptions"])


# =====================
#   LISTAR TODAS
# =====================
@router.get("", response_model=list[PublicDescriptionRead])
def list_public_descriptions(db: Session = Depends(get_db)):
    return db.query(PublicDescription).all()


# =====================
#   OBTENER UNA POR KEY
# =====================
@router.get("/{key}", response_model=PublicDescriptionRead)
def get_public_description(key: PublicDescriptionKey, db: Session = Depends(get_db)):
    obj = db.query(PublicDescription).filter(PublicDescription.key == key).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Descripción no encontrada")
    return obj


# =====================
#   UPSERT (crear o actualizar)
# =====================
@router.put("/{key}", response_model=PublicDescriptionRead, dependencies=[Depends(require_admin)])
def upsert_public_description(
    key: PublicDescriptionKey,
    payload: PublicDescriptionUpdate,
    db: Session = Depends(get_db),
):
    obj = db.query(PublicDescription).filter(PublicDescription.key == key).first()

    if obj is None:
        obj = PublicDescription(key=key, content=payload.content)
        db.add(obj)
    else:
        obj.content = payload.content

    db.commit()
    db.refresh(obj)
    return obj


# =====================
#   BORRAR
# =====================
@router.delete("/{key}", status_code=204, dependencies=[Depends(require_admin)])
def delete_public_description(key: PublicDescriptionKey, db: Session = Depends(get_db)):
    obj = db.query(PublicDescription).filter(PublicDescription.key == key).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Descripción no encontrada")

    db.delete(obj)
    db.commit()

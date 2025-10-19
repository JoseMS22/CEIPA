# app/routes/users.py
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from ..db import get_db
from ..models.user import User
from ..schemas.user import UserCreate, UserUpdate, UserOut, PaginatedUsers
from .auth import get_current_user, require_admin, require_self_or_admin

from math import ceil
from fastapi import Query

from app.core.security import hash_password
from pydantic import BaseModel
from app.core.password_policy import validate_password_strength

router = APIRouter(prefix="/users", tags=["users"])


def get_user_or_404(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return user


class PaginatedUsers(BaseModel):
    page: int
    limit: int
    total: int
    total_pages: int
    items: List[UserOut]

@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_admin)])
def create_user(payload: UserCreate, db: Session = Depends(get_db)):
    
    # 🔹 Normalizar antes de guardar
    payload.email = payload.email.lower().strip()
    if payload.name:
        payload.name = payload.name.strip()

    if payload.password is not None:
        validate_password_strength(payload.password)
        payload.password = hash_password(payload.password)

    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=payload.password,
        password_update_datetime=datetime.utcnow(),  # primera vez que se establece
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        # normalmente es por UNIQUE(email)
        raise HTTPException(status_code=409, detail="Email ya está registrado")
    db.refresh(user)
    return user


@router.get("/paged", response_model=PaginatedUsers, dependencies=[Depends(require_admin)])
def list_users_paged(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
):
    # total de registros en la tabla
    total = db.query(User).count()
    
    # calcular desplazamiento (offset)
    offset = (page - 1) * limit

    # obtener usuarios de la página actual
    users = (
        db.query(User)
        .order_by(User.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    total_pages = ceil(total / limit)

    # Convertimos a UserOut para asegurar que NO salga password_hash
    items = [UserOut.model_validate(u).model_dump() for u in users]

    return {
        "page": page,
        "limit": limit,
        "total": total,
        "total_pages": total_pages,
        "items": items,
    }


# -------- Detalle (ADMIN o dueño) --------
@router.get("/{user_id}", response_model=UserOut)
def get_user_detail(
    user_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_self_or_admin),
):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return u


@router.put("/{user_id}", response_model=UserOut)
@router.patch("/{user_id}", response_model=UserOut)
def update_user(user_id: int, payload: UserUpdate, db: Session = Depends(get_db), current=Depends(require_self_or_admin)):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    # Solo ADMIN puede cambiar 'role'
    if payload.role is not None:
        if current.role != "ADMIN":
            raise HTTPException(status_code=403, detail="Solo ADMIN puede cambiar el rol")
        u.role = payload.role

    # Normalizar si vienen
    if payload.name is not None:
        u.name = payload.name.strip()
    if payload.email is not None:
        u.email = payload.email.lower().strip()
    if payload.password is not None:
        validate_password_strength(payload.password)
        u.password_hash = hash_password(payload.password)
        u.password_update_datetime = datetime.utcnow()

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Email ya está registrado")

    db.refresh(u)
    return u


# -------- Delete (solo ADMIN) --------
@router.delete("/{user_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_user(user_id: int, db: Session = Depends(get_db)):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    db.delete(u)
    db.commit()
    return None

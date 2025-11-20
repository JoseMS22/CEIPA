# app/routes/auth.py
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
    Response,
    Request,
    Cookie
)
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import Optional
from app.config import settings

from app.db import get_db
from app.models.user import User as UserModel
from app.schemas.user import UserOut
from app.core.security import verify_password, create_access_token, decode_token

router = APIRouter(prefix="/auth", tags=["auth"])

# -----------------------------
# 1) FUNCIÓN que lee token del Header o Cookie
# -----------------------------
def get_token_from_request(
    request: Request,
    token_cookie: Optional[str] = Cookie(default=None, alias="token"),
) -> str:
    """Lee el JWT desde Authorization o cookie."""
    # 1️⃣ Prioriza Authorization: Bearer ...
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        return auth_header.split(" ", 1)[1]
    # 2️⃣ Si no hay header, prueba cookie
    if token_cookie:
        return token_cookie
    # 3️⃣ Ninguno → no autenticado
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token no encontrado",
        headers={"WWW-Authenticate": "Bearer"},
    )

# -----------------------------
# 2) DEPENDENCIA JWT
# -----------------------------
def get_current_user(
    token: str = Depends(get_token_from_request),
    db: Session = Depends(get_db),
) -> UserModel:
    sub = decode_token(token)
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
        )

    user = db.get(UserModel, int(sub))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado",
        )
    return user

# -----------------------------
# 3) GUARDAS DE ROL
# -----------------------------
def require_admin(current: UserModel = Depends(get_current_user)) -> UserModel:
    if current.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Requiere rol ADMIN",
        )
    return current


def require_admin_or_analyst(
    current: UserModel = Depends(get_current_user),
) -> UserModel:
    if current.role not in ("ADMIN", "ANALISTA"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Requiere rol ADMIN o ANALISTA",
        )
    return current


def require_self_or_admin(
    user_id: int,
    current: UserModel = Depends(get_current_user),
) -> UserModel:
    if current.role == "ADMIN":
        return current
    if current.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo puedes modificar tu propio usuario",
        )
    return current

# -----------------------------
# 4) LOGIN
# -----------------------------
@router.post("/login")
def login(
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
    response: Response = None,
):
    email = form.username.lower().strip()
    password = form.password

    user = db.query(UserModel).filter(UserModel.email == email).first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas",
        )

    token = create_access_token(
        subject=str(user.id),
        extra={"role": user.role, "email": user.email},
    )

    secure_flag = settings.APP_ENV == "production"

    # ✅ Guarda token en cookie (para frontend)
    response.set_cookie(
        key="token",
        value=token,
        httponly=True,
        secure=secure_flag,       # True en producción con HTTPS
        samesite="Lax",     # permite 3000 → 8000
        path="/",
        max_age=60 * 60 * 8,
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "role": user.role,
        },
    }

# -----------------------------
# 5) LOGOUT
# -----------------------------
@router.post("/logout")
def logout(response: Response):

    secure_flag = settings.APP_ENV == "production"

    response.set_cookie(
        key="token",
        value="",
        max_age=0,
        expires=0,
        path="/",
        httponly=True,
        secure=secure_flag,  # prod => True
        samesite="lax",
    )
    return {"ok": True}


# -----------------------------
# 6) QUIÉN SOY
# -----------------------------
@router.get("/me", response_model=UserOut)
def me(current: UserModel = Depends(get_current_user)):
    return current

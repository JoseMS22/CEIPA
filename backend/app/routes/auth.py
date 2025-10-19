# app/routes/auth.py
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.user import User as UserModel
from app.schemas.user import UserOut
from app.schemas.auth import Token
from app.core.security import verify_password, create_access_token, decode_token

router = APIRouter(prefix="/auth", tags=["auth"])

# 👉 importante: apunta a tu ruta real de login (incluye el prefijo /api/v1)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

# -----------------------------
# 1) DEPENDENCIA JWT (defínela primero)
# -----------------------------
def get_current_user(
    token: str = Depends(oauth2_scheme),
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
# 2) GUARDAS DE ROL
# -----------------------------
def require_admin(current: UserModel = Depends(get_current_user)) -> UserModel:
    if current.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Requiere rol ADMIN",
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
# 3) LOGIN (form-data: username=email, password=...)
# -----------------------------
@router.post("/login", response_model=Token)
def login(
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    email = form.username.lower().strip()  # Swagger envía email en "username"
    password = form.password

    user = db.query(UserModel).filter(UserModel.email == email).first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas",
        )

    token = create_access_token(
        subject=str(user.id),
        extra={"role": user.role, "email": user.email},  # opcional
    )
    return {"access_token": token, "token_type": "bearer"}

# -----------------------------
# 4) QUIÉN SOY
# -----------------------------
@router.get("/me", response_model=UserOut)
def me(current: UserModel = Depends(get_current_user)):
    return current

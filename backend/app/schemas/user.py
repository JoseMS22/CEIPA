from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field
from pydantic import ConfigDict  # Pydantic v2
from typing import List

ROLE_PATTERN = "^(ADMIN|ANALISTA|PUBLICO)$"

# Campos compartidos
class UserBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    email: EmailStr


# Crear (entrada)  ➜ incluye contraseña en texto plano (se hashea antes de guardar)
class UserCreate(UserBase):
    password: str = Field(..., min_length=6, max_length=128)
    # Solo un ADMIN puede establecer este campo; si no se envía, default PUBLICO
    role: Optional[str] = Field(default="PUBLICO", pattern=ROLE_PATTERN)


# Actualizar (entrada) ➜ todos opcionales; si viene password, la hasheas y actualizas la fecha
class UserUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=120)
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=6, max_length=128)
    role: Optional[str] = Field(None, pattern=ROLE_PATTERN)  # Solo ADMIN puede cambiarlo


# Leer/Responder (salida) ➜ NUNCA exponer password ni hash
class UserOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str
    created_at: datetime
    password_update_datetime: Optional[datetime] = None

    # Pydantic v2
    model_config = ConfigDict(from_attributes=True)

class PaginatedUsers(BaseModel):
    page: int
    limit: int
    total: int
    total_pages: int
    items: List[UserOut]
# app/schemas/public_description.py

from enum import Enum
from pydantic import BaseModel


class PublicDescriptionKey(str, Enum):
    HERO = "hero"
    CATEGORY_CHART = "chart_category"
    GLOBAL_CHART = "chart_global"


# -----------------------
#  Base (solo contenido)
# -----------------------
class PublicDescriptionBase(BaseModel):
    content: str


# -----------------------
#  Para crear desde código (si algún día lo usas)
# -----------------------
class PublicDescriptionCreate(PublicDescriptionBase):
    key: PublicDescriptionKey


# -----------------------
#  Para actualizar vía API (PUT /{key})
#  👉 SOLO necesita "content"
# -----------------------
class PublicDescriptionUpdate(BaseModel):
    content: str


# -----------------------
#  Lo que respondemos al frontend
# -----------------------
class PublicDescriptionRead(PublicDescriptionBase):
    id: int
    key: PublicDescriptionKey

    class Config:
        orm_mode = True

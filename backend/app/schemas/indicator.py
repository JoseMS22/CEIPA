# app/schemas/indicator.py
from pydantic import BaseModel, Field, ConfigDict, model_validator
from typing import List, Literal, Optional
from datetime import datetime

IndicatorType = Literal["IMP", "DMP"]
ScaleType = Literal["FIJA_0_10", "FIJA_0_100", "VARIABLE"]

class IndicatorBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=160)
    description: str | None = Field(default=None, max_length=600)

    # 👇 ahora sí el nombre NUEVO que está en tu model
    value_type: IndicatorType = "DMP"

    # 👇 mismo nombre que en el model
    scale: ScaleType = "FIJA_0_10"

    # 👇 los dos ahora son OPCIONALES
    min_value: float | None = None
    max_value: float | None = None

    # 👇 la querías opcional
    unit: str | None = Field(default=None, max_length=40)

    source_url: str | None = Field(default=None, max_length=400)
    justification: str | None = Field(default=None, max_length=1500)

    category_id: int

    @model_validator(mode="after")
    def _validate_variable_scale(self):
        # solo si de verdad dijo VARIABLE
        if self.scale == "VARIABLE":
            if self.min_value is None or self.max_value is None:
                raise ValueError("Para escala VARIABLE se requieren min_value y max_value.")
            if float(self.max_value) <= float(self.min_value):
                raise ValueError("max_value debe ser mayor que min_value.")
        return self


class IndicatorCreate(IndicatorBase):
    # con esto ya basta: name, category_id y value_type se validan arriba
    pass


class IndicatorUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    value_type: IndicatorType | None = None
    scale: ScaleType | None = None
    min_value: float | None = None
    max_value: float | None = None
    unit: str | None = Field(default=None, max_length=40)
    source_url: str | None = Field(default=None, max_length=400)
    justification: str | None = Field(default=None, max_length=1500)
    category_id: int | None = None

    @model_validator(mode="after")
    def _validate_variable_scale(self):
        # aquí es PATCH, así que hay que ser más permisivos
        # si el PATCH trae scale=VARIABLE, entonces sí exigimos los 2
        if self.scale == "VARIABLE":
            if self.min_value is None or self.max_value is None:
                raise ValueError("Para escala VARIABLE se requieren min_value y max_value.")
            if float(self.max_value) <= float(self.min_value):
                raise ValueError("max_value debe ser mayor que min_value.")
        return self


class IndicatorOut(IndicatorBase):
    id: int
    slug: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PaginatedIndicators(BaseModel):
    page: int
    limit: int
    total: int
    total_pages: int
    items: List[IndicatorOut]

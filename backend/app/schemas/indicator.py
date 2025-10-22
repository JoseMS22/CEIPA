from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator
from typing import List, Literal
from datetime import datetime

IndicatorType = Literal["IMP", "DMP"]
ScaleType = Literal["FIJA_0_10", "FIJA_0_100", "VARIABLE"]

class IndicatorBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=160)
    description: str | None = Field(default=None, max_length=600)
    type: IndicatorType
    scale: ScaleType = "FIJA_0_10"
    max_value_dmp: float | None = None
    min_value_imp: float | None = None
    unit: str = Field(..., min_length=1, max_length=40)
    source_url: str | None = Field(default=None, max_length=400)
    source_summary: str | None = Field(default=None, max_length=600)
    category_id: int

    @model_validator(mode="after")
    def _validate_variable_scale(self):
        if self.scale == "VARIABLE":
            if self.min_value_imp is None or self.max_value_dmp is None:
                raise ValueError("Para escala VARIABLE se requieren min_value_imp y max_value_dmp.")
            if float(self.max_value_dmp) <= float(self.min_value_imp):
                raise ValueError("max_value_dmp debe ser mayor que min_value_imp.")
        return self

class IndicatorCreate(IndicatorBase):
    pass

class IndicatorUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    type: IndicatorType | None = None
    scale: ScaleType | None = None
    max_value_dmp: float | None = None
    min_value_imp: float | None = None
    unit: str | None = None
    source_url: str | None = None
    source_summary: str | None = None
    category_id: int | None = None

    @model_validator(mode="after")
    def _validate_variable_scale(self):
        # Solo valida si scale queda en VARIABLE tras el patch
        scale = self.scale
        # si no viene scale, no podemos decidir aquí; la lógica final se validará en el repo al aplicar sobre el modelo actual
        if scale == "VARIABLE":
            if self.min_value_imp is None or self.max_value_dmp is None:
                raise ValueError("Para escala VARIABLE se requieren min_value_imp y max_value_dmp.")
            if float(self.max_value_dmp) <= float(self.min_value_imp):
                raise ValueError("max_value_dmp debe ser mayor que min_value_imp.")
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

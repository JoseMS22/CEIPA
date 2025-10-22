from pydantic import BaseModel, Field, ConfigDict, confloat
from typing import List
from datetime import datetime

class IndicatorValueBase(BaseModel):
    country_id: int
    indicator_id: int
    raw_value: confloat(ge=-1e15, le=1e15) | None = None

class IndicatorValueCreate(IndicatorValueBase):
    pass

class IndicatorValueUpdate(BaseModel):
    raw_value: confloat(ge=-1e15, le=1e15) | None = None

class IndicatorValueOut(IndicatorValueBase):
    id: int
    normalized_value: float | None
    loaded_by: int | None
    loaded_at: datetime
    model_config = ConfigDict(from_attributes=True)

class PaginatedIndicatorValues(BaseModel):
    page: int
    limit: int
    total: int
    total_pages: int
    items: List[IndicatorValueOut]

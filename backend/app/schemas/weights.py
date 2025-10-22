from pydantic import BaseModel, Field, conlist
from typing import List

class CategoryWeightIn(BaseModel):
    category_id: int
    weight: float = Field(..., ge=0.0, le=1.0)

class IndicatorWeightIn(BaseModel):
    indicator_id: int
    weight: float = Field(..., ge=0.0, le=1.0)

class CategoryWeightsPayload(BaseModel):
    scenario_id: int
    items: conlist(CategoryWeightIn, min_length=1)

class IndicatorWeightsPayload(BaseModel):
    scenario_id: int
    items: conlist(IndicatorWeightIn, min_length=1)

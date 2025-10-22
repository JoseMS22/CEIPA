from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import List

class ScenarioBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    active: bool = True

class ScenarioCreate(ScenarioBase):
    pass

class ScenarioUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    active: bool | None = None

class ScenarioOut(ScenarioBase):
    id: int
    created_by: int | None = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class PaginatedScenarios(BaseModel):
    page: int
    limit: int
    total: int
    total_pages: int
    items: List[ScenarioOut]

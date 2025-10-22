# app/schemas/category.py
from pydantic import BaseModel, Field, ConfigDict, constr
from typing import List
from datetime import datetime

class CategoryBase(BaseModel):
    name: constr(strip_whitespace=True, min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=500)

class CategoryCreate(CategoryBase):
    pass

class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=500)

class CategoryOut(CategoryBase):
    id: int
    slug: str
    created_at: datetime       # <-- antes estaba str
    updated_at: datetime       # <-- antes estaba str
    model_config = ConfigDict(from_attributes=True)

class PaginatedCategories(BaseModel):
    page: int
    limit: int
    total: int
    total_pages: int
    items: List[CategoryOut]

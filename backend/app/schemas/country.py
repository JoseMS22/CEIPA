# app/schemas/country.py
from pydantic import BaseModel, Field, constr, ConfigDict

ISO2 = constr(min_length=2, max_length=2)
ISO3 = constr(min_length=3, max_length=3)

class CountryOut(BaseModel):
    id: int
    iso2: str
    iso3: str
    name_es: str
    name_en: str
    enabled: bool
    model_config = ConfigDict(from_attributes=True)

class CountryListQuery(BaseModel):
    q: str | None = Field(default=None, description="Buscar por nombre/ISO")
    page: int = Field(default=1, ge=1)
    limit: int = Field(default=20, ge=1, le=100)
    only_enabled: bool = Field(default=True)

class PaginatedCountries(BaseModel):
    page: int
    limit: int
    total: int
    total_pages: int
    items: list[CountryOut]

# app/models/country.py
from datetime import datetime
from sqlalchemy import String, Integer, Boolean, DateTime, func, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column
from ..db import Base

class Country(Base):
    __tablename__ = "countries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    # ISO 3166-1 (en minúsculas para uniformidad)
    iso2: Mapped[str] = mapped_column(String(2), unique=True, index=True, nullable=False)
    iso3: Mapped[str] = mapped_column(String(3), unique=True, index=True, nullable=False)

    name_es: Mapped[str] = mapped_column(String(120), index=True, nullable=False)
    name_en: Mapped[str] = mapped_column(String(120), index=True, nullable=False)

    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("name_es", name="uq_countries_name_es"),
        UniqueConstraint("name_en", name="uq_countries_name_en"),
        Index("idx_countries_names", "name_es", "name_en"),
    )

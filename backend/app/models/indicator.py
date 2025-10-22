from datetime import datetime
from sqlalchemy import String, Integer, DateTime, Enum as SQLEnum, ForeignKey, Numeric, func, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from enum import StrEnum
from app.db import Base

class IndicatorType(StrEnum):
    IMP = "IMP"  # “mayor es mejor”
    DMP = "DMP"  # “menor es mejor”

class ScaleType(StrEnum):
    FIJA_0_10 = "FIJA_0_10"
    FIJA_0_100 = "FIJA_0_100"
    VARIABLE = "VARIABLE"

class Indicator(Base):
    __tablename__ = "indicators"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False, unique=True, index=True)
    slug: Mapped[str] = mapped_column(String(160), nullable=False, unique=True, index=True)

    type: Mapped[IndicatorType] = mapped_column(SQLEnum(IndicatorType, name="indicator_type"), nullable=False)
    scale: Mapped[ScaleType] = mapped_column(SQLEnum(ScaleType, name="indicator_scale"), nullable=False, default=ScaleType.FIJA_0_10)

    # referencias para normalización (opcionales según tipo/escala)
    max_value_dmp: Mapped[float | None] = mapped_column(Numeric(14, 4), nullable=True)  # usado si DMP
    min_value_imp: Mapped[float | None] = mapped_column(Numeric(14, 4), nullable=True)  # usado si IMP

    unit: Mapped[str] = mapped_column(String(40), nullable=False)         # ej: %, USD, índice, etc.
    source_url: Mapped[str | None] = mapped_column(String(400), nullable=True)
    source_summary: Mapped[str | None] = mapped_column(String(600), nullable=True)

    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), nullable=False)
    category = relationship("Category", backref="indicators")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("name", name="uq_indicators_name"),
        UniqueConstraint("slug", name="uq_indicators_slug"),
        Index("idx_indicators_name_slug", "name", "slug"),
        Index("idx_indicators_category", "category_id"),
    )

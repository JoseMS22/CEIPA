from datetime import datetime
from sqlalchemy import (
    Integer, DateTime, ForeignKey, Numeric, func,
    UniqueConstraint, Index, CheckConstraint
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db import Base

class IndicatorValue(Base):
    __tablename__ = "indicator_values"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    country_id: Mapped[int]   = mapped_column(ForeignKey("countries.id"), nullable=False)
    indicator_id: Mapped[int] = mapped_column(ForeignKey("indicators.id"), nullable=False)

    raw_value:        Mapped[float | None] = mapped_column(Numeric(18, 6), nullable=True)
    normalized_value: Mapped[float | None] = mapped_column(Numeric(6, 4),  nullable=True)

    loaded_at:  Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    loaded_by:  Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    # Relaciones de conveniencia (opcionales)
    country   = relationship("Country", lazy="joined")
    indicator = relationship("Indicator", lazy="joined")

    __table_args__ = (
        UniqueConstraint("country_id", "indicator_id", name="uq_country_indicator"),
        Index("idx_indicator_values_country", "country_id"),
        Index("idx_indicator_values_indicator", "indicator_id"),
        CheckConstraint(
            "normalized_value IS NULL OR (normalized_value >= 0 AND normalized_value <= 5)",
            name="ck_norm_0_5",
        ),
    )

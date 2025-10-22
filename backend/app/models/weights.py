from sqlalchemy import Integer, ForeignKey, Numeric, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.db import Base

class CategoryWeight(Base):
    __tablename__ = "category_weights"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    scenario_id: Mapped[int] = mapped_column(ForeignKey("scenarios.id"), nullable=False)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), nullable=False)
    weight: Mapped[float] = mapped_column(Numeric(6, 4), nullable=False)  # 0..1

    __table_args__ = (UniqueConstraint("scenario_id", "category_id", name="uq_scenario_category"),)

class IndicatorWeight(Base):
    __tablename__ = "indicator_weights"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    scenario_id: Mapped[int] = mapped_column(ForeignKey("scenarios.id"), nullable=False)
    indicator_id: Mapped[int] = mapped_column(ForeignKey("indicators.id"), nullable=False)
    weight: Mapped[float] = mapped_column(Numeric(6, 4), nullable=False)  # 0..1

    __table_args__ = (UniqueConstraint("scenario_id", "indicator_id", name="uq_scenario_indicator"),)

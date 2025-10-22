from datetime import datetime
from sqlalchemy import String, Integer, DateTime, Boolean, ForeignKey, func, UniqueConstraint, Index, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db import Base

class Scenario(Base):
    __tablename__ = "scenarios"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False, unique=True, index=True)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # relaciones de conveniencia (no obligatorias)
    creator = relationship("User", backref="scenarios", lazy="joined")

    __table_args__ = (
        UniqueConstraint("name", name="uq_scenarios_name"),
        Index("idx_scenarios_name_active", "name", "active"),
        # 👉 Este índice garantiza que solo haya 1 fila con active = true
        Index("uq_one_active_scenario", "active", unique=True, postgresql_where=text("active = true")),
    )

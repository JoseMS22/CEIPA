# app/models/public_description.py
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, Text, func, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.db import Base


class PublicDescription(Base):
    __tablename__ = "public_descriptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    # clave lógica para identificar qué texto es
    key: Mapped[str] = mapped_column(String(50), nullable=False, unique=True, index=True)
    # contenido HTML / texto largo
    content: Mapped[str] = mapped_column(Text, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("key", name="uq_public_descriptions_key"),
    )

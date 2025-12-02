"""add public_descriptions table

Revision ID: e9208946abd6
Revises: 1ba8f361ad5b
Create Date: 2025-11-16 06:19:22.268715

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e9208946abd6"
down_revision: Union[str, None] = "1ba8f361ad5b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    # 👉 Si la tabla ya existe (por intentos previos o por create_all), no la volvemos a crear
    if "public_descriptions" in insp.get_table_names():
        # ya que estamos aquí, intentamos limpiar los índices viejos de indicator_values si existen
        idx_names = {idx["name"] for idx in insp.get_indexes("indicator_values")}
        if "idx_indicator_values_country" in idx_names:
            op.drop_index("idx_indicator_values_country", table_name="indicator_values")
        if "idx_indicator_values_scenario" in idx_names:
            op.drop_index("idx_indicator_values_scenario", table_name="indicator_values")
        return

    # --- tabla nueva ---
    op.create_table(
        "public_descriptions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("key", sa.String(length=50), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("key", name="uq_public_descriptions_key"),
    )

    # índices de la tabla nueva
    op.create_index(
        op.f("ix_public_descriptions_id"),
        "public_descriptions",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_public_descriptions_key"),
        "public_descriptions",
        ["key"],
        unique=True,
    )

    # borrar índices viejos de indicator_values solo si existen
    idx_names = {idx["name"] for idx in insp.get_indexes("indicator_values")}
    if "idx_indicator_values_country" in idx_names:
        op.drop_index("idx_indicator_values_country", table_name="indicator_values")
    if "idx_indicator_values_scenario" in idx_names:
        op.drop_index("idx_indicator_values_scenario", table_name="indicator_values")


def downgrade() -> None:
    # dejamos el downgrade como estaba
    op.create_index(
        "idx_indicator_values_scenario",
        "indicator_values",
        ["scenario_id"],
        unique=False,
    )
    op.create_index(
        "idx_indicator_values_country",
        "indicator_values",
        ["country_id"],
        unique=False,
    )
    op.drop_index(op.f("ix_public_descriptions_key"), table_name="public_descriptions")
    op.drop_index(op.f("ix_public_descriptions_id"), table_name="public_descriptions")
    op.drop_table("public_descriptions")

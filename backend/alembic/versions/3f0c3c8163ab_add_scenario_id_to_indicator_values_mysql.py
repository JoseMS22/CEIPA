from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = "3f0c3c8163ab"          # 👈 el ID que inventamos
down_revision = "e9208946abd6"     # 👈 la migración anterior
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    dialect = bind.dialect.name

    # Solo nos interesa en MySQL (ya no usamos Postgres en prod)
    if dialect != "mysql":
        return

    inspector = inspect(bind)
    columns = [c["name"] for c in inspector.get_columns("indicator_values")]

    # Si por alguna razón la columna ya existe, no hacemos nada
    if "scenario_id" in columns:
        return

    # 1) agregar columna scenario_id como nullable primero
    op.add_column(
        "indicator_values",
        sa.Column("scenario_id", sa.Integer(), nullable=True),
    )

    # 2) rellenar filas existentes con un escenario por defecto (id=1)
    op.execute("UPDATE indicator_values SET scenario_id = 1 WHERE scenario_id IS NULL")

    # 3) volver NOT NULL
    op.alter_column(
        "indicator_values",
        "scenario_id",
        existing_type=sa.Integer(),
        nullable=False,
    )

    # 4) agregar FK hacia scenarios.id
    op.create_foreign_key(
        "fk_indicator_values_scenario",
        "indicator_values",
        "scenarios",
        ["scenario_id"],
        ["id"],
    )

    # 5) quitar el unique viejo (country + indicator) si existe
    op.drop_constraint(
        "uq_country_indicator",
        "indicator_values",
        type_="unique",
    )

    # 6) crear el unique nuevo (scenario + country + indicator)
    op.create_unique_constraint(
        "uq_scenario_country_indicator",
        "indicator_values",
        ["scenario_id", "country_id", "indicator_id"],
    )

    # 7) índice nuevo para scenario_id
    op.create_index(
        "idx_indicator_values_scenario",
        "indicator_values",
        ["scenario_id"],
    )


def downgrade():
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect != "mysql":
        return

    op.drop_index("idx_indicator_values_scenario", table_name="indicator_values")

    op.drop_constraint(
        "uq_scenario_country_indicator",
        "indicator_values",
        type_="unique",
    )

    op.create_unique_constraint(
        "uq_country_indicator",
        "indicator_values",
        ["country_id", "indicator_id"],
    )

    op.drop_constraint(
        "fk_indicator_values_scenario",
        "indicator_values",
        type_="foreignkey",
    )

    op.drop_column("indicator_values", "scenario_id")

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = "7f0a9c123abc"            # 👈 nuevo ID inventado
down_revision = "3f0c3c8163ab"       # 👈 la migración que hiciste antes
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    dialect = bind.dialect.name

    # Solo nos interesa en MySQL (tu prod actual)
    if dialect != "mysql":
        return

    inspector = inspect(bind)
    columns = [c["name"] for c in inspector.get_columns("indicator_values")]

    # Si la columna ya existe por cualquier razón, no hacemos nada
    if "scenario_id" in columns:
        return

    # 1) agregar columna scenario_id como nullable primero
    op.add_column(
        "indicator_values",
        sa.Column("scenario_id", sa.Integer(), nullable=True),
    )

    # 2) rellenar filas existentes con un escenario por defecto (id=1)
    #    Ajusta el 1 si tienes otro id de escenario que deba ser el “por defecto”
    op.execute("UPDATE indicator_values SET scenario_id = 1 WHERE scenario_id IS NULL")

    # 3) volver NOT NULL
    op.alter_column(
        "indicator_values",
        "scenario_id",
        existing_type=sa.Integer(),
        nullable=False,
    )

    # 4) agregar FK hacia scenarios.id (si no existiera)
    #    Si ya existiera con ese nombre, esto lanzaría error, pero como
    #    antes no teníamos la columna, en tu caso no debería estar.
    op.create_foreign_key(
        "fk_indicator_values_scenario",
        "indicator_values",
        "scenarios",
        ["scenario_id"],
        ["id"],
    )

    # 5) intentar quitar el unique viejo (country + indicator) si existe
    #    Lo hacemos de forma segura: revisamos los constraints primero.
    uniques = inspector.get_unique_constraints("indicator_values")
    unique_names = {u["name"] for u in uniques if u.get("name")}

    if "uq_country_indicator" in unique_names:
        op.drop_constraint(
            "uq_country_indicator",
            "indicator_values",
            type_="unique",
        )

    # 6) crear el unique nuevo (scenario + country + indicator) si no existe
    if "uq_scenario_country_indicator" not in unique_names:
        op.create_unique_constraint(
            "uq_scenario_country_indicator",
            "indicator_values",
            ["scenario_id", "country_id", "indicator_id"],
        )

    # 7) índice nuevo para scenario_id (solo si no existe)
    indexes = inspector.get_indexes("indicator_values")
    index_names = {idx["name"] for idx in indexes if idx.get("name")}

    if "idx_indicator_values_scenario" not in index_names:
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

    # Aquí el downgrade es “inverso”, pero solo si existiera todo
    inspector = inspect(bind)

    indexes = inspector.get_indexes("indicator_values")
    index_names = {idx["name"] for idx in indexes if idx.get("name")}

    if "idx_indicator_values_scenario" in index_names:
        op.drop_index("idx_indicator_values_scenario", table_name="indicator_values")

    uniques = inspector.get_unique_constraints("indicator_values")
    unique_names = {u["name"] for u in uniques if u.get("name")}

    if "uq_scenario_country_indicator" in unique_names:
        op.drop_constraint(
            "uq_scenario_country_indicator",
            "indicator_values",
            type_="unique",
        )

    if "uq_country_indicator" not in unique_names:
        op.create_unique_constraint(
            "uq_country_indicator",
            "indicator_values",
            ["country_id", "indicator_id"],
        )

    columns = [c["name"] for c in inspector.get_columns("indicator_values")]
    if "scenario_id" in columns:
        # Si existe FK, la quitamos primero
        fks = inspector.get_foreign_keys("indicator_values")
        fk_names = {fk["name"] for fk in fks if fk.get("name")}

        if "fk_indicator_values_scenario" in fk_names:
            op.drop_constraint(
                "fk_indicator_values_scenario",
                "indicator_values",
                type_="foreignkey",
            )

        op.drop_column("indicator_values", "scenario_id")

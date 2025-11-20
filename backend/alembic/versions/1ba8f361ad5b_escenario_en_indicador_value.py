from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "1ba8f361ad5b"
down_revision = "11cc14a3108a"
branch_labels = None
depends_on = None


def upgrade():
    # 1) agregar columna PERO nullable primero
    op.add_column(
        "indicator_values",
        sa.Column("scenario_id", sa.Integer(), nullable=True),
    )

    # 2) rellenar las filas viejas con un escenario por defecto (ajusta el 1 si ocupás otro)
    op.execute("UPDATE indicator_values SET scenario_id = 1 WHERE scenario_id IS NULL")

    # 3) volver NOT NULL
    op.alter_column(
        "indicator_values",
        "scenario_id",
        existing_type=sa.Integer(),
        nullable=False,
    )

    # 4) agregar FK
    op.create_foreign_key(
        "fk_indicator_values_scenario",
        "indicator_values",
        "scenarios",
        ["scenario_id"],
        ["id"],
    )

    # 5) quitar el unique viejo si existe (country + indicator)
    #    algunos entornos lo pueden no tener, así que lo envolvemos en SQL crudo
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM   pg_constraint
                WHERE  conname = 'uq_country_indicator'
            ) THEN
                ALTER TABLE indicator_values
                DROP CONSTRAINT uq_country_indicator;
            END IF;
        END$$;
        """
    )

    # 6) crear el unique nuevo (scenario + country + indicator)
    op.create_unique_constraint(
        "uq_scenario_country_indicator",
        "indicator_values",
        ["scenario_id", "country_id", "indicator_id"],
    )

    # 7) índices
    #    estos ya existen en tu tabla original, así que mejor NO volver a crearlos.
    #    Si quieres un índice nuevo para scenario_id sí lo creamos:
    op.create_index(
        "idx_indicator_values_scenario",
        "indicator_values",
        ["scenario_id"],
    )


def downgrade():
    # borrar índice de scenario
    op.drop_index("idx_indicator_values_scenario", table_name="indicator_values")

    # borrar unique nuevo
    op.drop_constraint(
        "uq_scenario_country_indicator",
        "indicator_values",
        type_="unique",
    )

    # volver a crear el unique viejo
    op.create_unique_constraint(
        "uq_country_indicator",
        "indicator_values",
        ["country_id", "indicator_id"],
    )

    # borrar FK
    op.drop_constraint(
        "fk_indicator_values_scenario",
        "indicator_values",
        type_="foreignkey",
    )

    # borrar columna
    op.drop_column("indicator_values", "scenario_id")

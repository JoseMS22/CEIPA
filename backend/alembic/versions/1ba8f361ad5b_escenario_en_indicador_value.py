from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "1ba8f361ad5b"
down_revision = "11cc14a3108a"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    dialect = bind.dialect.name

    # 👉 En MySQL (y otros motores), NO hacemos nada aquí.
    # La estructura actual de indicator_values ya incluye scenario_id
    # y el unique correcto, así que esta migración es solo para
    # bases antiguas en Postgres.
    if dialect != "postgresql":
        return

    # --- A partir de aquí, solo se ejecuta en Postgres ---

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
    #    esto es SQL específico de Postgres, por eso solo lo corremos en ese dialecto
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

    # 7) índice nuevo para scenario_id
    op.create_index(
        "idx_indicator_values_scenario",
        "indicator_values",
        ["scenario_id"],
    )


def downgrade():
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect != "postgresql":
        # En MySQL u otros, no tocamos nada
        return

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

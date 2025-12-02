"""unique active scenario

Revision ID: a9b248e9a423
Revises: fdfffaeaf02f
Create Date: 2025-10-21 22:06:42.094302

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a9b248e9a423'
down_revision: Union[str, None] = 'fdfffaeaf02f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        # Solo crear el índice parcial si estamos en Postgres
        op.create_index(
            'uq_one_active_scenario',
            'scenarios',
            ['active'],
            unique=True,
            postgresql_where=sa.text('active = true')
        )
    # En MySQL no hace nada (la unicidad del activo se maneja en la app)


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.drop_index(
            'uq_one_active_scenario',
            table_name='scenarios',
            postgresql_where=sa.text('active = true')
        )
    # En MySQL tampoco hará nada porque no se creó

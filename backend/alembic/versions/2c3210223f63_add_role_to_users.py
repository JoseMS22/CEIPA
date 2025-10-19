"""add role to users

Revision ID: 2c3210223f63
Revises: 10187504c50b
Create Date: 2025-10-18 22:26:51.730008
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "2c3210223f63"
down_revision = "10187504c50b"
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 1) Agregar la columna con un default a nivel DB para NO romper filas existentes
    op.add_column(
        "users",
        sa.Column("role", sa.String(length=20), nullable=False, server_default="PUBLICO"),
    )
    # 2) (Opcional) Quitar el default a nivel DB; la app ya tiene default Python
    op.alter_column("users", "role", server_default=None)
    # 3) Índice por si filtras por rol
    op.create_index("ix_users_role", "users", ["role"])

def downgrade() -> None:
    op.drop_index("ix_users_role", table_name="users")
    op.drop_column("users", "role")

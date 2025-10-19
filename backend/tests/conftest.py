# tests/conftest.py
import os
import uuid
import subprocess
import pytest
import psycopg

# ⚠️ IMPORTANTE:
# No importes nada de app.* aquí arriba. Lo haremos DESPUÉS de crear la BD temporal
# y de setear DB_NAME para que la app use esa BD.

# -----------------------------
# Helpers para armar URLs con settings
# -----------------------------
def _load_settings():
    # cargar settings sin importar app.main
    from app.config import settings
    return settings

def _admin_conn_url() -> str:
    s = _load_settings()
    return f"postgresql://{s.DB_USER}:{s.DB_PASSWORD}@{s.DB_HOST}:{s.DB_PORT}/postgres"

def _current_db_name() -> str:
    # el DB_NAME actual (el real, antes de test) para componer el nombre temporal
    return _load_settings().DB_NAME


# -----------------------------
# BD temporal por sesión
# -----------------------------
@pytest.fixture(scope="session")
def test_database():
    """
    Crea una BD temporal, aplica migraciones Alembic y la borra al final.
    Además exporta DB_NAME a esa BD antes de importar la app.
    """
    base_name = _current_db_name()
    suffix = uuid.uuid4().hex[:6]
    test_db_name = f"{base_name}_test_{suffix}"
    admin_url = _admin_conn_url()

    # 1) Crear DB temporal (autocommit=True y SQL como str)
    with psycopg.connect(admin_url, autocommit=True) as conn:
        conn.execute("SELECT 1")
        conn.execute(f'DROP DATABASE IF EXISTS "{test_db_name}" WITH (FORCE)')
        conn.execute(f'CREATE DATABASE "{test_db_name}"')

    # 2) Forzar a la app a usar la BD temporal ANTES de importar app.*
    os.environ["DB_NAME"] = test_db_name

    # 3) Correr migraciones Alembic contra la BD temporal
    # Usamos 'alembic upgrade head' en /app para que tome alembic.ini/env.py
    subprocess.run(["alembic", "upgrade", "head"], check=True, cwd="/app")

    try:
        yield test_db_name
    finally:
        # 4) Dropear la BD de test
        with psycopg.connect(admin_url, autocommit=True) as conn:
            conn.execute(f'DROP DATABASE IF EXISTS "{test_db_name}" WITH (FORCE)')


# -----------------------------
# TestClient (una sola instancia)
# -----------------------------
@pytest.fixture(scope="session")
def client(test_database):
    # Ahora sí, importar la app ya apuntando a la BD temporal
    from fastapi.testclient import TestClient
    from app.main import app
    return TestClient(app)


# -----------------------------
# Semilla de admin para tests
# -----------------------------
@pytest.fixture(scope="session")
def seed_admin(client):
    """
    Crea un admin 'admin@ceipa.com' si no existe (sobre la BD temporal migrada).
    Usa la propia sesión de la app.
    """
    from app.db import SessionLocal
    from app.models.user import User
    from app.core.security import hash_password

    db = SessionLocal()
    try:
        u = db.query(User).filter(User.email == "admin@ceipa.com").first()
        if not u:
            u = User(
                name="Admin",
                email="admin@ceipa.com",
                role="ADMIN",
                password_hash=hash_password("Admin#12345"),
            )
            db.add(u)
            db.commit()
    finally:
        db.close()


# -----------------------------
# Credenciales y token
# -----------------------------
@pytest.fixture(scope="session")
def admin_creds(seed_admin):
    return {"username": "admin@ceipa.com", "password": "Admin#12345"}

@pytest.fixture()
def admin_token(client, admin_creds):
    r = client.post("/api/v1/auth/login", data=admin_creds)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


# -----------------------------
# Utilidad para emails únicos
# -----------------------------
@pytest.fixture()
def unique_email():
    return f"test_{uuid.uuid4().hex[:10]}@example.com"

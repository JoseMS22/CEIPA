# app/main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from .config import settings
from .db import get_db
from .routes.users import router as users_router
from .routes.auth import router as auth_router
from .routes.countries import router as countries_router
from .routes.categories import router as categories_router
from .routes.indicators import router as indicators_router
from .routes.scenarios import router as scenarios_router
from .routes.weights import router as weights_router
from .routes.indicator_values import router as indicator_values_router
from .routes.public import router as public_router



# ==========================================
# 🔹 Lifespan: se ejecuta al iniciar y cerrar la app
# ==========================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    # 👉 Aquí podrías abrir conexiones, cargar cache o inicializar servicios
    # No hagas Base.metadata.create_all() aquí (usa Alembic para migraciones)
    yield
    # 👉 Aquí cerrarías recursos (conexiones, tareas en segundo plano, etc.)


# ==========================================
# 🔹 Instancia principal de la aplicación FastAPI
# ==========================================
app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="API CEIPA Risk — Gestión de riesgos e indicadores",
    lifespan=lifespan,
)


# ==========================================
# 🔹 Configuración de CORS (para conexión con el frontend)
# ==========================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================
# 🔹 Health checks
# ==========================================
@app.get("/health", tags=["system"])
def health():
    """Verifica que la API está corriendo correctamente."""
    return {
        "status": "ok",
        "environment": settings.APP_ENV,
        "app": settings.APP_NAME,
    }


@app.get("/db/health", tags=["system"])
def db_health(db: Session = Depends(get_db)):
    """Verifica conexión a la base de datos."""
    ok = db.execute(text("SELECT 1")).scalar() == 1
    return {"database": settings.DB_NAME, "ok": ok}


# ==========================================
# 🔹 Registro de routers (modular)
# ==========================================
API_PREFIX = "/api/v1"

# Ejemplo: /api/v1/users
app.include_router(users_router, prefix=API_PREFIX)
app.include_router(auth_router, prefix=API_PREFIX)
app.include_router(countries_router, prefix=API_PREFIX)
app.include_router(categories_router, prefix=API_PREFIX)
app.include_router(indicators_router, prefix=API_PREFIX)
app.include_router(scenarios_router, prefix=API_PREFIX)
app.include_router(weights_router, prefix=API_PREFIX)
app.include_router(indicator_values_router, prefix=API_PREFIX)
app.include_router(public_router, prefix=API_PREFIX)
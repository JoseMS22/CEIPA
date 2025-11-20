from pydantic_settings import BaseSettings
from typing import List
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent  # /app
ENV_PATH = BASE_DIR / ".env"                       # /app/.env

class Settings(BaseSettings):
    APP_NAME: str
    APP_ENV: str
    DATABASE_URL: str
    JWT_SECRET: str
    JWT_ALGORITHM: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int
    CORS_ORIGINS: List[str]

    class Config:
        env_file = str(ENV_PATH)
        extra = "ignore"

settings = Settings()

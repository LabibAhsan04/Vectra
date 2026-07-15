import os
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_ENV = Path(__file__).resolve().parent.parent / ".env"


def is_production() -> bool:
    env = os.getenv("ENV", "").strip().lower()
    return bool(os.getenv("RAILWAY_ENVIRONMENT")) or env in {"production", "prod"}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ROOT_ENV),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    polygon_api_key: str = ""
    finnhub_api_key: str = ""
    alpha_vantage_key: str = ""
    openrouter_api_key: str = ""
    openrouter_model: str = "openrouter/free"
    database_url: str = ""
    app_version: str = "0.2.0"
    allowed_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    cache_ttl_seconds: int = 60
    port: int = 8000
    rate_limit_enabled: bool | None = None

    def rate_limit_active(self) -> bool:
        if self.rate_limit_enabled is not None:
            return self.rate_limit_enabled
        return is_production()


settings = Settings()

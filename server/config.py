from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_ENV = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ROOT_ENV),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    polygon_api_key: str = ""
    finnhub_api_key: str = ""
    alpha_vantage_key: str = ""
    news_api_key: str = ""
    anthropic_api_key: str = ""
    openrouter_api_key: str = ""
    database_url: str = "sqlite:///./stocks.db"
    allowed_origins: str = "http://localhost:3000"
    cache_ttl_seconds: int = 60
    port: int = 8000


settings = Settings()

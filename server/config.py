from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    polygon_api_key: str = ""
    finnhub_api_key: str = ""
    alpha_vantage_key: str = ""
    news_api_key: str = ""
    anthropic_api_key: str = ""
    database_url: str = "sqlite:///./stocks.db"
    allowed_origins: str = "http://localhost:3000"
    cache_ttl_seconds: int = 60
    port: int = 8000


settings = Settings()

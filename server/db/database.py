import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")


def _sqlite_path(url: str) -> str | None:
    if not url.startswith("sqlite:"):
        return None
    if url.startswith("sqlite:////"):
        return url.replace("sqlite:///", "", 1)
    if url.startswith("sqlite:///"):
        return url.replace("sqlite:///", "", 1)
    return None


def _is_persistent_sqlite(url: str) -> bool:
    path = _sqlite_path(url)
    if not path:
        return False
    normalized = path.replace("\\", "/")
    return normalized.startswith("/data/") or "/data/" in normalized or normalized.endswith("data/stocks.db")


def resolve_database_url() -> str:
    """Pick a SQLite path that survives Railway redeploys when a volume is mounted."""
    explicit = os.getenv("DATABASE_URL", "").strip()
    volume = os.getenv("RAILWAY_VOLUME_MOUNT_PATH", "").strip()
    on_railway = bool(os.getenv("RAILWAY_ENVIRONMENT"))

    if volume:
        db_path = Path(volume) / "stocks.db"
        db_path.parent.mkdir(parents=True, exist_ok=True)
        return f"sqlite:///{db_path}"

    if on_railway:
        if explicit and explicit.startswith("postgresql"):
            return explicit
        if explicit and _is_persistent_sqlite(explicit):
            return explicit
        db_path = Path("/data/stocks.db")
        db_path.parent.mkdir(parents=True, exist_ok=True)
        return f"sqlite:///{db_path}"

    if explicit:
        return explicit

    server_data = Path(__file__).resolve().parent.parent / "data" / "stocks.db"
    server_data.parent.mkdir(parents=True, exist_ok=True)
    return f"sqlite:///{server_data}"


DATABASE_URL = resolve_database_url()

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

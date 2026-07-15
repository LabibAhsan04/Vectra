import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")


def resolve_database_url() -> str:
    """Pick a SQLite path that survives Railway redeploys when a volume is mounted."""
    explicit = os.getenv("DATABASE_URL", "").strip()
    if explicit:
        return explicit

    volume = os.getenv("RAILWAY_VOLUME_MOUNT_PATH", "").strip()
    if volume:
        db_path = Path(volume) / "stocks.db"
        db_path.parent.mkdir(parents=True, exist_ok=True)
        return f"sqlite:///{db_path}"

    # Railway deploy without explicit DATABASE_URL — default to /data when on Railway.
    if os.getenv("RAILWAY_ENVIRONMENT"):
        db_path = Path("/data/stocks.db")
        db_path.parent.mkdir(parents=True, exist_ok=True)
        return f"sqlite:///{db_path}"

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

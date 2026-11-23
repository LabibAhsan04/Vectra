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


def _is_writable_dir(path: Path) -> bool:
    try:
        path.mkdir(parents=True, exist_ok=True)
        probe = path / ".vectra_write_probe"
        probe.write_text("ok", encoding="utf-8")
        probe.unlink(missing_ok=True)
        return True
    except OSError:
        return False


def _writable_data_dir() -> Path:
    """Prefer persistent mounts; fall back to /tmp for read-only root filesystems."""
    candidates: list[Path] = []

    volume = os.getenv("RAILWAY_VOLUME_MOUNT_PATH", "").strip()
    if volume:
        candidates.append(Path(volume))

    explicit_dir = os.getenv("VECTRA_DATA_DIR", "").strip()
    if explicit_dir:
        candidates.append(Path(explicit_dir))

    candidates.extend(
        [
            Path("/data"),
            Path(__file__).resolve().parent.parent / "data",
            Path("/tmp/vectra"),
        ]
    )

    for path in candidates:
        if _is_writable_dir(path):
            return path

    fallback = Path("/tmp/vectra")
    fallback.mkdir(parents=True, exist_ok=True)
    return fallback


def resolve_database_url() -> str:
    """Resolve DB URL. SQLite always lands on a writable directory (/tmp when root is RO)."""
    explicit = os.getenv("DATABASE_URL", "").strip()
    on_railway = bool(os.getenv("RAILWAY_ENVIRONMENT"))

    if explicit and explicit.startswith("postgresql"):
        return explicit

    if explicit and explicit.startswith("sqlite:"):
        path = _sqlite_path(explicit)
        if path:
            parent = Path(path).parent
            if _is_writable_dir(parent):
                return explicit
            # Explicit SQLite path not writable (read-only root) → relocate under /tmp
            relocated = Path("/tmp/vectra") / Path(path).name
            _is_writable_dir(relocated.parent)
            return f"sqlite:///{relocated}"

    if on_railway and not explicit:
        # Prefer /data when the volume is mounted and writable; else /tmp
        data_dir = _writable_data_dir()
        return f"sqlite:///{data_dir / 'stocks.db'}"

    if explicit:
        return explicit

    data_dir = _writable_data_dir()
    return f"sqlite:///{data_dir / 'stocks.db'}"


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

from models.stock import Base
from models import signal_history  # noqa: F401 — register tables
from db.database import engine


def create_tables() -> None:
    Base.metadata.create_all(bind=engine)

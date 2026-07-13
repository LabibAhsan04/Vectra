"""Create tables and apply lightweight SQLite column migrations."""

from __future__ import annotations

from sqlalchemy import text

from models.stock import Base
from models import signal_history  # noqa: F401 — register tables
from db.database import engine


def _migrate_watchlist_columns() -> None:
    if not str(engine.url).startswith("sqlite"):
        return
    with engine.begin() as conn:
        rows = conn.execute(text("PRAGMA table_info(watchlist)")).fetchall()
        if not rows:
            return
        names = {row[1] for row in rows}
        alters = []
        if "company_name" not in names:
            alters.append("ALTER TABLE watchlist ADD COLUMN company_name VARCHAR(255)")
        if "exchange" not in names:
            alters.append("ALTER TABLE watchlist ADD COLUMN exchange VARCHAR(64)")
        if "asset_type" not in names:
            alters.append("ALTER TABLE watchlist ADD COLUMN asset_type VARCHAR(64)")
        for stmt in alters:
            conn.execute(text(stmt))


def create_tables() -> None:
    Base.metadata.create_all(bind=engine)
    _migrate_watchlist_columns()

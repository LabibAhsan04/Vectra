"""Background jobs — daily signal snapshots."""

from __future__ import annotations

import logging
from datetime import date, datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session

from db.database import SessionLocal
from models.stock import WatchlistItem
from services.database import get_latest_signal, save_signal
from services.market_data import get_stock_quote

logger = logging.getLogger("vectra.scheduler")
_scheduler: BackgroundScheduler | None = None


def _has_snapshot_today(db: Session, ticker: str) -> bool:
    row = get_latest_signal(db, ticker)
    if not row or not row.timestamp:
        return False
    ts = row.timestamp
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    return ts.date() == date.today()


def run_daily_snapshots() -> None:
    db = SessionLocal()
    try:
        tickers = {
            row.ticker.upper()
            for row in db.query(WatchlistItem.ticker).distinct().all()
        }
        for symbol in sorted(tickers):
            if _has_snapshot_today(db, symbol):
                continue
            try:
                quote = get_stock_quote(symbol)
                latest = get_latest_signal(db, symbol)
                if not latest:
                    continue
                save_signal(
                    db,
                    ticker=symbol,
                    price=quote.price,
                    final_score=latest.final_score,
                    final_label=latest.final_label,
                    scores={
                        "momentum": latest.momentum_score,
                        "technical": latest.technical_score,
                        "sentiment": latest.sentiment_score,
                        "fundamentals": latest.fundamentals_score,
                        "growth": latest.growth_score,
                    },
                    explanation=latest.explanation or "",
                    data_sources=latest.data_sources or "",
                    timestamp=datetime.now(timezone.utc),
                )
                logger.info("Daily snapshot saved for %s", symbol)
            except Exception as exc:
                logger.warning("Daily snapshot failed for %s: %s", symbol, exc)
    finally:
        db.close()


def start_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        return
    _scheduler = BackgroundScheduler(timezone="UTC")
    _scheduler.add_job(run_daily_snapshots, "cron", hour=22, minute=0, id="daily_snapshots")
    _scheduler.start()
    logger.info("Scheduler started (daily snapshots at 22:00 UTC)")


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None

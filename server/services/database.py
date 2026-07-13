"""SQLite helpers for signals, news items, and alerts."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from models.signal_history import AlertRecord, NewsItemRecord, SignalRecord


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def save_signal(
    db: Session,
    *,
    ticker: str,
    price: float,
    final_score: int,
    final_label: str,
    scores: dict[str, int],
    explanation: str,
    data_sources: list[str] | str | None = None,
    timestamp: datetime | None = None,
) -> SignalRecord:
    sources = data_sources
    if isinstance(sources, list):
        sources = "; ".join(sources)
    row = SignalRecord(
        ticker=ticker.upper(),
        timestamp=timestamp or _utcnow(),
        price=float(price),
        final_score=int(final_score),
        final_label=final_label,
        momentum_score=int(scores.get("momentum", 50)),
        technical_score=int(scores.get("technical", 50)),
        sentiment_score=int(scores.get("sentiment", 50)),
        fundamentals_score=int(scores.get("fundamentals", 50)),
        growth_score=int(scores.get("growth", 50)),
        explanation=explanation,
        data_sources=sources or "",
        created_at=_utcnow(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def get_signal_history(db: Session, ticker: str, limit: int = 50) -> list[SignalRecord]:
    return (
        db.query(SignalRecord)
        .filter(SignalRecord.ticker == ticker.upper())
        .order_by(SignalRecord.timestamp.desc())
        .limit(limit)
        .all()
    )


def get_latest_signal(db: Session, ticker: str) -> SignalRecord | None:
    return (
        db.query(SignalRecord)
        .filter(SignalRecord.ticker == ticker.upper())
        .order_by(SignalRecord.timestamp.desc())
        .first()
    )


def save_news_items(
    db: Session,
    ticker: str,
    items: list[dict[str, Any]],
) -> int:
    symbol = ticker.upper()
    count = 0
    for item in items:
        title = str(item.get("title") or item.get("headline") or "").strip()
        if not title:
            continue
        row = NewsItemRecord(
            ticker=symbol,
            title=title,
            source=str(item.get("source") or "")[:128],
            url=str(item.get("url") or "")[:1024],
            published_at=item.get("published_at") or item.get("publishedAt"),
            relevance_tag=str(item.get("relevance_tag") or item.get("relevance") or ""),
            relevance_score=int(item.get("relevance_score") or 50),
            sentiment_label=str(item.get("sentiment_label") or item.get("sentiment") or "neutral"),
            sentiment_score=float(item.get("sentiment_score") or 0.0),
        )
        db.add(row)
        count += 1
    if count:
        db.commit()
    return count


def get_recent_news(db: Session, ticker: str, limit: int = 20) -> list[NewsItemRecord]:
    return (
        db.query(NewsItemRecord)
        .filter(NewsItemRecord.ticker == ticker.upper())
        .order_by(NewsItemRecord.id.desc())
        .limit(limit)
        .all()
    )


def save_alert(
    db: Session,
    *,
    ticker: str,
    alert_type: str,
    message: str,
    old_value: str | None = None,
    new_value: str | None = None,
) -> AlertRecord:
    row = AlertRecord(
        ticker=ticker.upper(),
        timestamp=_utcnow(),
        alert_type=alert_type,
        message=message,
        old_value=old_value,
        new_value=new_value,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def get_recent_alerts(
    db: Session,
    ticker: str | None = None,
    limit: int = 20,
) -> list[AlertRecord]:
    query = db.query(AlertRecord)
    if ticker:
        query = query.filter(AlertRecord.ticker == ticker.upper())
    return query.order_by(AlertRecord.timestamp.desc()).limit(limit).all()


def get_all_signals(db: Session, ticker: str | None = None, limit: int = 500) -> list[SignalRecord]:
    query = db.query(SignalRecord)
    if ticker:
        query = query.filter(SignalRecord.ticker == ticker.upper())
    return query.order_by(SignalRecord.timestamp.asc()).limit(limit).all()

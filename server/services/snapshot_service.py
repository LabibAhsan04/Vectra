"""Batch watchlist snapshot for Home and ticker bar."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from schemas.stock_schema import SignalHistoryPoint, StockQuote, WatchlistSnapshotItem
from services.database import get_latest_signal
from services.market_data import get_stock_quote
from services.quick_signal import compute_quick_signal


def build_watchlist_snapshot(db: Session, tickers: list[str]) -> list[WatchlistSnapshotItem]:
    items: list[WatchlistSnapshotItem] = []
    for raw in tickers:
        symbol = raw.strip().upper()
        if not symbol:
            continue
        quote: StockQuote | None = None
        signal_point: SignalHistoryPoint | None = None
        saved_signal: SignalHistoryPoint | None = None
        try:
            quote = get_stock_quote(symbol)
        except Exception:
            pass

        try:
            latest_row = get_latest_signal(db, symbol)
            if latest_row:
                saved_signal = SignalHistoryPoint(
                    timestamp=latest_row.timestamp,
                    finalScore=latest_row.final_score,
                    finalLabel=latest_row.final_label,
                    price=latest_row.price,
                )
        except Exception:
            pass

        try:
            quick = compute_quick_signal(symbol, quote=quote)
            if quick:
                score, label, price = quick
                signal_point = SignalHistoryPoint(
                    timestamp=datetime.now(tz=timezone.utc),
                    finalScore=score,
                    finalLabel=label,
                    price=price,
                )
        except Exception:
            if saved_signal:
                signal_point = saved_signal

        signal_changed_at = None
        if signal_point and saved_signal:
            if (
                signal_point.finalLabel != saved_signal.finalLabel
                or signal_point.finalScore != saved_signal.finalScore
            ):
                signal_changed_at = signal_point.timestamp

        items.append(
            WatchlistSnapshotItem(
                ticker=symbol,
                quote=quote,
                latestSignal=signal_point,
                signalChangedAt=signal_changed_at,
            )
        )
    return items

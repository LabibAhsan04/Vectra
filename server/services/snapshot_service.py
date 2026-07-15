"""Batch watchlist snapshot for Home and ticker bar."""

from __future__ import annotations

from sqlalchemy.orm import Session

from schemas.stock_schema import SignalHistoryPoint, StockQuote, WatchlistSnapshotItem
from services.database import get_latest_signal, get_signal_history
from services.market_data import get_stock_quote


def build_watchlist_snapshot(db: Session, tickers: list[str]) -> list[WatchlistSnapshotItem]:
    items: list[WatchlistSnapshotItem] = []
    for raw in tickers:
        symbol = raw.strip().upper()
        if not symbol:
            continue
        quote: StockQuote | None = None
        signal_point: SignalHistoryPoint | None = None
        previous_point: SignalHistoryPoint | None = None
        try:
            quote = get_stock_quote(symbol)
        except Exception:
            pass
        try:
            history = get_signal_history(db, symbol, limit=2)
            if history:
                latest = history[0]
                signal_point = SignalHistoryPoint(
                    timestamp=latest.timestamp,
                    finalScore=latest.final_score,
                    finalLabel=latest.final_label,
                    price=latest.price,
                )
                if len(history) > 1:
                    prev = history[1]
                    previous_point = SignalHistoryPoint(
                        timestamp=prev.timestamp,
                        finalScore=prev.final_score,
                        finalLabel=prev.final_label,
                        price=prev.price,
                    )
            else:
                latest_row = get_latest_signal(db, symbol)
                if latest_row:
                    signal_point = SignalHistoryPoint(
                        timestamp=latest_row.timestamp,
                        finalScore=latest_row.final_score,
                        finalLabel=latest_row.final_label,
                        price=latest_row.price,
                    )
        except Exception:
            pass

        signal_changed_at = None
        if signal_point and previous_point:
            if (
                signal_point.finalLabel != previous_point.finalLabel
                or signal_point.finalScore != previous_point.finalScore
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

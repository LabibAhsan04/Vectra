"""Peer / sector comparison for a ticker."""

from __future__ import annotations

from services.market_data import get_stock_quote
from services.database import get_latest_signal
from services.news_service import _COMPETITOR_TICKERS  # noqa: PLC2701
from sqlalchemy.orm import Session


def get_peers_for(ticker: str, limit: int = 4) -> list[str]:
    symbol = ticker.strip().upper()
    peers = list(_COMPETITOR_TICKERS.get(symbol, []))
    if "SPY" not in peers:
        peers.append("SPY")
    return peers[:limit]


def build_peer_comparison(db: Session, ticker: str) -> dict:
    symbol = ticker.strip().upper()
    peers = get_peers_for(symbol)
    rows = []
    target_quote = get_stock_quote(symbol)
    target_signal = get_latest_signal(db, symbol)

    for peer in [symbol, *peers]:
        try:
            quote = get_stock_quote(peer)
            signal = get_latest_signal(db, peer)
            rows.append(
                {
                    "ticker": peer,
                    "companyName": quote.companyName,
                    "price": quote.price,
                    "changePct": quote.changePct,
                    "peRatio": quote.peRatio,
                    "marketCap": quote.marketCap,
                    "finalScore": signal.final_score if signal else None,
                    "finalLabel": signal.final_label if signal else None,
                    "isTarget": peer == symbol,
                }
            )
        except Exception:
            continue

    sector_avg_change = None
    peer_changes = [r["changePct"] for r in rows if not r["isTarget"] and r["changePct"] is not None]
    if peer_changes:
        sector_avg_change = round(sum(peer_changes) / len(peer_changes), 2)

    return {
        "ticker": symbol,
        "targetChangePct": target_quote.changePct,
        "sectorAvgChangePct": sector_avg_change,
        "vsSector": (
            round(target_quote.changePct - sector_avg_change, 2)
            if sector_avg_change is not None
            else None
        ),
        "peers": rows,
    }

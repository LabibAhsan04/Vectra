"""Snapshot, compare, export, peers, earnings."""

from __future__ import annotations

import csv
import io
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.orm import Session

from db.database import get_db
from schemas.stock_schema import (
    CompareResponse,
    CompareTickerRow,
    EarningsEvent,
    PeerComparisonResponse,
    PeerRow,
    WatchlistSnapshotItem,
)
from services.database import get_latest_signal
from services.earnings_service import get_upcoming_earnings
from services.market_data import get_price_history, get_stock_quote
from services.peer_service import build_peer_comparison
from services.signal_engine import market_snapshot_flags
from services.snapshot_service import build_watchlist_snapshot

router = APIRouter(tags=["tools"])


@router.get("/watchlist/snapshot", response_model=list[WatchlistSnapshotItem])
def watchlist_snapshot(
    tickers: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
) -> list[WatchlistSnapshotItem]:
    symbols = [t.strip().upper() for t in tickers.split(",") if t.strip()]
    if not symbols:
        raise HTTPException(status_code=400, detail="At least one ticker is required.")
    if len(symbols) > 20:
        raise HTTPException(status_code=400, detail="Maximum 20 tickers per snapshot request.")
    return build_watchlist_snapshot(db, symbols)


@router.get("/peers/{ticker}", response_model=PeerComparisonResponse)
def peer_comparison(ticker: str, db: Session = Depends(get_db)) -> PeerComparisonResponse:
    payload = build_peer_comparison(db, ticker)
    return PeerComparisonResponse(
        ticker=payload["ticker"],
        targetChangePct=payload["targetChangePct"],
        sectorAvgChangePct=payload.get("sectorAvgChangePct"),
        vsSector=payload.get("vsSector"),
        peers=[PeerRow.model_validate(row) for row in payload["peers"]],
    )


@router.get("/earnings/{ticker}", response_model=list[EarningsEvent])
def earnings_calendar(ticker: str) -> list[EarningsEvent]:
    return [EarningsEvent.model_validate(e) for e in get_upcoming_earnings(ticker)]


@router.get("/compare", response_model=CompareResponse)
def compare_tickers(
    tickers: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
) -> CompareResponse:
    symbols = [t.strip().upper() for t in tickers.split(",") if t.strip()]
    if len(symbols) < 2:
        raise HTTPException(status_code=400, detail="Provide at least 2 tickers to compare.")
    if len(symbols) > 5:
        raise HTTPException(status_code=400, detail="Maximum 5 tickers per comparison.")

    rows: list[CompareTickerRow] = []
    for symbol in symbols:
        try:
            quote = get_stock_quote(symbol)
            signal = get_latest_signal(db, symbol)
            rsi_val = None
            rel_vol = None
            try:
                history = get_price_history(symbol, "3M")
                closes = [p.close for p in history.points]
                volumes = [float(p.volume or 0) for p in history.points]
                flags = market_snapshot_flags(closes=closes, volumes=volumes)
                rsi_val = flags.get("rsi")
                rel_vol = flags.get("relativeVolume")
            except Exception:
                pass
            rows.append(
                CompareTickerRow(
                    ticker=symbol,
                    companyName=quote.companyName,
                    price=quote.price,
                    changePct=quote.changePct,
                    peRatio=quote.peRatio,
                    finalScore=signal.final_score if signal else None,
                    finalLabel=signal.final_label if signal else None,
                    rsi=rsi_val,
                    relativeVolume=rel_vol,
                )
            )
        except Exception:
            continue
    if len(rows) < 2:
        raise HTTPException(status_code=502, detail="Could not load enough tickers for comparison.")
    return CompareResponse(tickers=rows)


@router.get("/export/watchlist.csv")
def export_watchlist_csv(
    tickers: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    items = build_watchlist_snapshot(
        db, [t.strip().upper() for t in tickers.split(",") if t.strip()]
    )
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        ["ticker", "price", "change_pct", "signal_score", "signal_label", "signal_changed_at"]
    )
    for item in items:
        q = item.quote
        s = item.latestSignal
        writer.writerow(
            [
                item.ticker,
                q.price if q else "",
                q.changePct if q else "",
                s.finalScore if s else "",
                s.finalLabel if s else "",
                item.signalChangedAt.isoformat() if item.signalChangedAt else "",
            ]
        )
    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="vectra-watchlist.csv"'},
    )


@router.get("/export/signals/{ticker}.csv")
def export_signals_csv(ticker: str, db: Session = Depends(get_db)) -> StreamingResponse:
    from services.database import get_signal_history

    symbol = ticker.strip().upper()
    rows = get_signal_history(db, symbol, limit=200)
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["timestamp", "ticker", "price", "final_score", "final_label"])
    for row in reversed(rows):
        writer.writerow([row.timestamp, row.ticker, row.price, row.final_score, row.final_label])
    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="vectra-signals-{symbol}.csv"'
        },
    )


@router.get("/share/{ticker}")
def share_snapshot(ticker: str, db: Session = Depends(get_db)) -> Response:
    symbol = ticker.strip().upper()
    try:
        quote = get_stock_quote(symbol)
        signal = get_latest_signal(db, symbol)
        payload = {
            "ticker": symbol,
            "generatedAt": datetime.now(tz=timezone.utc).isoformat(),
            "quote": quote.model_dump(mode="json"),
            "signal": (
                {
                    "finalScore": signal.final_score,
                    "finalLabel": signal.final_label,
                    "timestamp": signal.timestamp.isoformat() if signal.timestamp else None,
                }
                if signal
                else None
            ),
            "disclaimer": "Research use only. Not financial advice.",
        }
        return Response(
            content=json.dumps(payload, indent=2),
            media_type="application/json",
            headers={"Content-Disposition": f'inline; filename="vectra-{symbol}-snapshot.json"'},
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Unable to build snapshot for {symbol}.") from exc

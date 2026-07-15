"""Snapshot, peers, and earnings."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from db.database import get_db
from schemas.stock_schema import (
    EarningsEvent,
    PeerComparisonResponse,
    PeerRow,
    WatchlistSnapshotItem,
)
from services.earnings_service import get_upcoming_earnings
from services.peer_service import build_peer_comparison
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

"""Watchlist CRUD backed by SQLite."""

from __future__ import annotations

import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from db.database import get_db
from models.stock import AppSetting, WatchlistItem
from schemas.stock_schema import WatchlistAddRequest, WatchlistItemResponse

router = APIRouter(tags=["watchlist"])

_TICKER_RE = re.compile(r"^[A-Z][A-Z0-9.\-]{0,9}$")
_DEFAULT_WATCHLIST = ["NVDA", "MSFT", "GOOGL", "META", "AMZN"]
_SEED_FLAG = "watchlist_seeded"


def _normalize_ticker(raw: str) -> str:
    ticker = raw.strip().upper()
    if not ticker or not _TICKER_RE.match(ticker):
        raise HTTPException(
            status_code=400,
            detail="Ticker must be 1–10 characters (letters, numbers, . or -)",
        )
    return ticker


def ensure_watchlist_seeded(db: Session) -> None:
    """Seed defaults once per database. Empty lists after user deletes stay empty."""
    flag = db.query(AppSetting).filter(AppSetting.key == _SEED_FLAG).first()
    if flag:
        return

    now = datetime.now(tz=timezone.utc)
    if db.query(WatchlistItem).count() == 0:
        for symbol in _DEFAULT_WATCHLIST:
            db.add(WatchlistItem(ticker=symbol, added_at=now))

    db.add(AppSetting(key=_SEED_FLAG, value="1"))
    db.commit()


def _to_response(item: WatchlistItem) -> WatchlistItemResponse:
    added = item.added_at or datetime.now(tz=timezone.utc)
    if added.tzinfo is None:
        added = added.replace(tzinfo=timezone.utc)
    return WatchlistItemResponse(ticker=item.ticker, addedAt=added)


@router.get("/watchlist", response_model=list[WatchlistItemResponse])
def list_watchlist(db: Session = Depends(get_db)) -> list[WatchlistItemResponse]:
    ensure_watchlist_seeded(db)
    items = (
        db.query(WatchlistItem)
        .order_by(WatchlistItem.added_at.asc(), WatchlistItem.id.asc())
        .all()
    )
    return [_to_response(item) for item in items]


@router.post("/watchlist", response_model=WatchlistItemResponse, status_code=201)
def add_watchlist_item(
    body: WatchlistAddRequest,
    db: Session = Depends(get_db),
) -> WatchlistItemResponse:
    ensure_watchlist_seeded(db)
    ticker = _normalize_ticker(body.ticker)

    existing = db.query(WatchlistItem).filter(WatchlistItem.ticker == ticker).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"{ticker} is already on your watchlist")

    item = WatchlistItem(ticker=ticker, added_at=datetime.now(tz=timezone.utc))
    db.add(item)
    db.commit()
    db.refresh(item)
    return _to_response(item)


@router.delete("/watchlist/{ticker}", status_code=204, response_class=Response)
def remove_watchlist_item(ticker: str, db: Session = Depends(get_db)) -> Response:
    symbol = _normalize_ticker(ticker)
    item = db.query(WatchlistItem).filter(WatchlistItem.ticker == symbol).first()
    if not item:
        raise HTTPException(status_code=404, detail=f"{symbol} is not on your watchlist")
    db.delete(item)
    db.commit()
    return Response(status_code=204)

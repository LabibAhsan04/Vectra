"""Watchlist CRUD backed by SQLite (max 15 symbols)."""

from __future__ import annotations

import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from db.database import get_db
from models.stock import AppSetting, WatchlistItem
from schemas.stock_schema import (
    SymbolSearchResult,
    WatchlistAddRequest,
    WatchlistItemResponse,
)
from services.market_data import get_stock_quote
from services.symbol_search import search_symbols

router = APIRouter(tags=["watchlist"])

_TICKER_RE = re.compile(r"^[A-Z][A-Z0-9.\-]{0,9}$")
_DEFAULT_WATCHLIST = [
    "NVDA",
    "MSFT",
    "GOOGL",
    "META",
    "AMZN",
    "AAPL",
    "TSLA",
    "AMD",
    "AVGO",
    "CRM",
]
_WATCHLIST_LIMIT = 15
_SEED_FLAG = "watchlist_seeded_v2"


def _normalize_ticker(raw: str) -> str:
    ticker = raw.strip().upper()
    if not ticker or not _TICKER_RE.match(ticker):
        raise HTTPException(
            status_code=400,
            detail="Ticker must be 1–10 characters (letters, numbers, . or -)",
        )
    return ticker


def _watchlist_query(db: Session):
    """Single shared watchlist for all visitors (no per-user scoping)."""
    return db.query(WatchlistItem).filter(WatchlistItem.user_id.is_(None))


def ensure_watchlist_seeded(db: Session) -> None:
    """Seed defaults once. Empty lists after user deletes stay empty."""
    flag = db.query(AppSetting).filter(AppSetting.key == _SEED_FLAG).first()
    if flag:
        return

    now = datetime.now(tz=timezone.utc)
    existing = {row.ticker for row in _watchlist_query(db).with_entities(WatchlistItem.ticker).all()}
    if len(existing) == 0:
        for symbol in _DEFAULT_WATCHLIST:
            db.add(
                WatchlistItem(
                    ticker=symbol,
                    user_id=None,
                    company_name=None,
                    exchange="US",
                    asset_type="Stock",
                    added_at=now,
                )
            )
    else:
        count = len(existing)
        for symbol in _DEFAULT_WATCHLIST:
            if symbol in existing:
                continue
            if count >= _WATCHLIST_LIMIT:
                break
            db.add(
                WatchlistItem(
                    ticker=symbol,
                    user_id=None,
                    company_name=None,
                    exchange="US",
                    asset_type="Stock",
                    added_at=now,
                )
            )
            count += 1

    db.add(AppSetting(key=_SEED_FLAG, value="1"))
    if db.query(AppSetting).filter(AppSetting.key == "watchlist_seeded").first() is None:
        db.add(AppSetting(key="watchlist_seeded", value="1"))
    db.commit()


def _to_response(item: WatchlistItem) -> WatchlistItemResponse:
    added = item.added_at or datetime.now(tz=timezone.utc)
    if added.tzinfo is None:
        added = added.replace(tzinfo=timezone.utc)
    return WatchlistItemResponse(
        ticker=item.ticker,
        companyName=item.company_name,
        exchange=item.exchange,
        assetType=item.asset_type,
        addedAt=added,
    )


@router.get("/watchlist", response_model=list[WatchlistItemResponse])
def list_watchlist(db: Session = Depends(get_db)) -> list[WatchlistItemResponse]:
    ensure_watchlist_seeded(db)
    items = (
        _watchlist_query(db)
        .order_by(WatchlistItem.added_at.asc(), WatchlistItem.id.asc())
        .limit(_WATCHLIST_LIMIT)
        .all()
    )
    return [_to_response(item) for item in items]


@router.get("/watchlist/search", response_model=list[SymbolSearchResult])
def search_watchlist_symbols(
    q: str = Query(..., min_length=1, max_length=64),
) -> list[SymbolSearchResult]:
    if len(q.strip()) < 2:
        return []
    try:
        rows = search_symbols(q, limit=10)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="Data temporarily unavailable. Try refreshing in a few minutes.",
        ) from exc
    return [SymbolSearchResult.model_validate(row) for row in rows]


@router.post("/watchlist", response_model=WatchlistItemResponse, status_code=201)
def add_watchlist_item(
    body: WatchlistAddRequest,
    db: Session = Depends(get_db),
) -> WatchlistItemResponse:
    ensure_watchlist_seeded(db)
    ticker = _normalize_ticker(body.ticker)

    existing = _watchlist_query(db).filter(WatchlistItem.ticker == ticker).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail="This ticker is already in your watchlist.",
        )

    count = _watchlist_query(db).count()
    if count >= _WATCHLIST_LIMIT:
        raise HTTPException(
            status_code=400,
            detail="Watchlist limit reached. Remove a ticker before adding another.",
        )

    company_name = (body.companyName or "").strip() or None
    exchange = (body.exchange or "").strip() or None
    asset_type = (body.assetType or "").strip() or None

    try:
        quote = get_stock_quote(ticker)
        company_name = company_name or (quote.companyName or None)
    except HTTPException as exc:
        if exc.status_code in {404, 400, 502}:
            raise HTTPException(
                status_code=404,
                detail="Ticker not found or not supported by current data provider.",
            ) from exc
        if exc.status_code == 429:
            raise HTTPException(
                status_code=429,
                detail="Data provider rate limit reached. Try again shortly.",
            ) from exc
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=404,
            detail="Ticker not found or not supported by current data provider.",
        ) from exc

    item = WatchlistItem(
        ticker=ticker,
        user_id=None,
        company_name=company_name,
        exchange=exchange or "US",
        asset_type=asset_type or "Stock",
        added_at=datetime.now(tz=timezone.utc),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return _to_response(item)


@router.delete("/watchlist/{ticker}", status_code=204, response_class=Response)
def remove_watchlist_item(ticker: str, db: Session = Depends(get_db)) -> Response:
    symbol = _normalize_ticker(ticker)
    item = _watchlist_query(db).filter(WatchlistItem.ticker == symbol).first()
    if not item:
        raise HTTPException(status_code=404, detail=f"{symbol} is not on your watchlist")
    db.delete(item)
    db.commit()
    return Response(status_code=204)

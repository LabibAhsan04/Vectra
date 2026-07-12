"""Market data helpers — Polygon primary, Finnhub fallback."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from fastapi import HTTPException
from polygon import RESTClient
import finnhub

from config import settings
from schemas.stock_schema import StockQuote

_polygon_client: RESTClient | None = None
_finnhub_client: finnhub.Client | None = None


def _get_polygon() -> RESTClient:
    global _polygon_client
    if _polygon_client is None:
        if not settings.polygon_api_key:
            raise HTTPException(
                status_code=500,
                detail="POLYGON_API_KEY is not configured",
            )
        _polygon_client = RESTClient(api_key=settings.polygon_api_key)
    return _polygon_client


def _get_finnhub() -> finnhub.Client:
    global _finnhub_client
    if _finnhub_client is None:
        if not settings.finnhub_api_key:
            raise HTTPException(
                status_code=500,
                detail="FINNHUB_API_KEY is not configured",
            )
        _finnhub_client = finnhub.Client(api_key=settings.finnhub_api_key)
    return _finnhub_client


def _quote_from_polygon(symbol: str) -> StockQuote:
    client = _get_polygon()
    details = client.get_ticker_details(symbol)

    end = date.today()
    start = end - timedelta(days=400)
    bars = list(
        client.get_aggs(
            symbol,
            1,
            "day",
            start,
            end,
            adjusted=True,
            sort="asc",
            limit=50000,
        )
    )
    if len(bars) < 1:
        raise ValueError(f"No price data available for '{symbol}'")

    latest = bars[-1]
    previous = bars[-2] if len(bars) >= 2 else None

    price = float(latest.close)
    prior_close = float(previous.close) if previous else float(latest.open)
    change = price - prior_close
    change_pct = (change / prior_close * 100.0) if prior_close else 0.0

    highs = [float(b.high) for b in bars if b.high is not None]
    lows = [float(b.low) for b in bars if b.low is not None]

    ts_ms = getattr(latest, "timestamp", None)
    if isinstance(ts_ms, (int, float)):
        timestamp = datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc)
    else:
        timestamp = datetime.now(tz=timezone.utc)

    return StockQuote(
        ticker=symbol,
        companyName=getattr(details, "name", None) or symbol,
        price=round(price, 2),
        change=round(change, 2),
        changePct=round(change_pct, 2),
        volume=int(latest.volume or 0),
        marketCap=float(getattr(details, "market_cap", None) or 0.0),
        peRatio=0.0,
        weekHigh52=round(max(highs), 2) if highs else price,
        weekLow52=round(min(lows), 2) if lows else price,
        timestamp=timestamp,
    )


def _quote_from_finnhub(symbol: str) -> StockQuote:
    client = _get_finnhub()
    quote = client.quote(symbol)
    profile = client.company_profile2(symbol=symbol) or {}

    price = float(quote.get("c") or 0)
    if price <= 0:
        raise ValueError(f"No Finnhub quote for '{symbol}'")

    change = float(quote.get("d") or 0)
    change_pct = float(quote.get("dp") or 0)
    timestamp = datetime.now(tz=timezone.utc)
    ts = quote.get("t")
    if isinstance(ts, (int, float)) and ts > 0:
        timestamp = datetime.fromtimestamp(ts, tz=timezone.utc)

    market_cap = float(profile.get("marketCapitalization") or 0) * 1_000_000

    return StockQuote(
        ticker=symbol,
        companyName=str(profile.get("name") or symbol),
        price=round(price, 2),
        change=round(change, 2),
        changePct=round(change_pct, 2),
        volume=0,
        marketCap=market_cap,
        peRatio=0.0,
        weekHigh52=round(float(quote.get("h") or price), 2),
        weekLow52=round(float(quote.get("l") or price), 2),
        timestamp=timestamp,
    )


def get_stock_quote(ticker: str) -> StockQuote:
    """Return a StockQuote. Prefer Polygon; fall back to Finnhub on errors/rate limits."""
    symbol = ticker.strip().upper()
    if not symbol:
        raise HTTPException(status_code=400, detail="Ticker is required")

    polygon_error: Exception | None = None
    try:
        return _quote_from_polygon(symbol)
    except Exception as exc:
        polygon_error = exc

    try:
        return _quote_from_finnhub(symbol)
    except Exception as finnhub_error:
        detail = (
            f"Unable to fetch quote for '{symbol}'. "
            f"Polygon: {polygon_error}; Finnhub: {finnhub_error}"
        )
        raise HTTPException(status_code=502, detail=detail) from finnhub_error

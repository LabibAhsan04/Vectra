"""Polygon.io market data helpers (free-tier friendly endpoints)."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from fastapi import HTTPException
from polygon import RESTClient

from config import settings
from schemas.stock_schema import StockQuote

_client: RESTClient | None = None


def _get_client() -> RESTClient:
    global _client
    if _client is None:
        if not settings.polygon_api_key:
            raise HTTPException(
                status_code=500,
                detail="POLYGON_API_KEY is not configured",
            )
        _client = RESTClient(api_key=settings.polygon_api_key)
    return _client


def get_stock_quote(ticker: str) -> StockQuote:
    """Return a StockQuote for ticker using previous-close + daily aggregates.

    Snapshot endpoints require a paid Polygon plan, so free-tier flows use
    aggregates instead (typically prior session / delayed data).
    """
    symbol = ticker.strip().upper()
    if not symbol:
        raise HTTPException(status_code=400, detail="Ticker is required")

    client = _get_client()

    try:
        details = client.get_ticker_details(symbol)
    except Exception as exc:
        raise HTTPException(
            status_code=404,
            detail=f"Ticker '{symbol}' not found",
        ) from exc

    end = date.today()
    start = end - timedelta(days=400)
    try:
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
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to fetch price history from Polygon: {exc}",
        ) from exc

    if len(bars) < 1:
        raise HTTPException(
            status_code=404,
            detail=f"No price data available for '{symbol}'",
        )

    latest = bars[-1]
    previous = bars[-2] if len(bars) >= 2 else None

    price = float(latest.close)
    prior_close = float(previous.close) if previous else float(latest.open)
    change = price - prior_close
    change_pct = (change / prior_close * 100.0) if prior_close else 0.0

    highs = [float(b.high) for b in bars if b.high is not None]
    lows = [float(b.low) for b in bars if b.low is not None]

    company_name = getattr(details, "name", None) or symbol
    market_cap = float(getattr(details, "market_cap", None) or 0.0)

    # Polygon free tier does not expose a simple trailing P/E on ticker details.
    pe_ratio = 0.0

    ts_ms = getattr(latest, "timestamp", None)
    if isinstance(ts_ms, (int, float)):
        timestamp = datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc)
    else:
        timestamp = datetime.now(tz=timezone.utc)

    return StockQuote(
        ticker=symbol,
        companyName=company_name,
        price=round(price, 2),
        change=round(change, 2),
        changePct=round(change_pct, 2),
        volume=int(latest.volume or 0),
        marketCap=market_cap,
        peRatio=pe_ratio,
        weekHigh52=round(max(highs), 2) if highs else price,
        weekLow52=round(min(lows), 2) if lows else price,
        timestamp=timestamp,
    )

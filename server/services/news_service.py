"""Finnhub company news helpers."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException
import finnhub

from config import settings
from schemas.stock_schema import NewsItem

_client: finnhub.Client | None = None


def _get_client() -> finnhub.Client:
    global _client
    if _client is None:
        if not settings.finnhub_api_key:
            raise HTTPException(
                status_code=500,
                detail="FINNHUB_API_KEY is not configured",
            )
        _client = finnhub.Client(api_key=settings.finnhub_api_key)
    return _client


def _unix_timestamp(value: Any) -> float | None:
    """Return a positive unix timestamp, or None if missing/invalid.

    Note: bool is a subclass of int in Python, so reject bool explicitly.
    """
    if type(value) is not int and type(value) is not float:
        return None
    if value <= 0:
        return None
    return float(value)


def get_company_news(ticker: str, limit: int = 10) -> list[NewsItem]:
    """Return the most recent company news headlines for a ticker."""
    symbol = ticker.strip().upper()
    if not symbol:
        raise HTTPException(status_code=400, detail="Ticker is required")

    client = _get_client()
    end = datetime.now(tz=timezone.utc).date()
    start = end - timedelta(days=14)

    try:
        raw_items = client.company_news(
            symbol,
            _from=start.isoformat(),
            to=end.isoformat(),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to fetch news from Finnhub: {exc}",
        ) from exc

    if not isinstance(raw_items, list):
        raise HTTPException(status_code=502, detail="Unexpected Finnhub response")

    # Drop undated items so sort order matches the timestamps we display
    dated_items: list[tuple[float, dict[str, Any]]] = []
    for item in raw_items:
        if not isinstance(item, dict):
            continue
        ts = _unix_timestamp(item.get("datetime"))
        if ts is None:
            continue
        dated_items.append((ts, item))

    dated_items.sort(key=lambda pair: pair[0], reverse=True)

    news: list[NewsItem] = []
    for ts, item in dated_items:
        headline = (item.get("headline") or "").strip()
        url = (item.get("url") or "").strip()
        if not headline or not url:
            continue

        news.append(
            NewsItem(
                headline=headline,
                source=(item.get("source") or "Unknown").strip() or "Unknown",
                url=url,
                publishedAt=datetime.fromtimestamp(ts, tz=timezone.utc),
                # Sentiment scoring arrives in Phase 5
                sentiment="neutral",
                sentimentScore=0.0,
            )
        )
        if len(news) >= limit:
            break

    return news

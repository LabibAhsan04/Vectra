"""Finnhub company news with relevance classification + short cache."""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException
import finnhub

from config import settings
from schemas.stock_schema import NewsItem

_client: finnhub.Client | None = None
_news_cache: dict[str, tuple[datetime, list[NewsItem]]] = {}
_NEWS_CACHE_MINUTES = 20

# Known aliases help company-vs-sector classification for common tech names.
_COMPANY_ALIASES: dict[str, list[str]] = {
    "NVDA": ["nvidia", "nvidia corporation"],
    "MSFT": ["microsoft"],
    "GOOGL": ["alphabet", "google"],
    "GOOG": ["alphabet", "google"],
    "META": ["meta platforms", "facebook", "instagram"],
    "AMZN": ["amazon", "aws"],
    "AAPL": ["apple"],
    "TSLA": ["tesla"],
    "AMD": ["advanced micro devices"],
    "AVGO": ["broadcom"],
    "CRM": ["salesforce"],
    "PLTR": ["palantir"],
    "ORCL": ["oracle"],
    "INTC": ["intel"],
    "QCOM": ["qualcomm"],
    "ARM": ["arm holdings"],
    "SMCI": ["supermicro", "super micro"],
}

_MARKET_PATTERNS = [
    r"\bnasdaq\b",
    r"\bs&p\b",
    r"\bs&p 500\b",
    r"\bdow jones\b",
    r"\betf\b",
    r"\bspy\b",
    r"\bqqq\b",
    r"\bwall street\b",
    r"\bfederal reserve\b",
    r"\binterest rates?\b",
]
_SECTOR_PATTERNS = [
    r"\bsemiconductor",
    r"\bchip maker",
    r"\bai\b",
    r"\bartificial intelligence\b",
    r"\btech sector\b",
    r"\bcloud\b",
]
_COMPETITOR_TICKERS = {
    "NVDA": ["AMD", "INTC", "AVGO", "TSM", "ARM", "SMCI", "AMZN", "MSFT", "GOOGL", "META"],
    "MSFT": ["GOOGL", "AMZN", "ORCL", "CRM", "AAPL"],
    "GOOGL": ["MSFT", "META", "AMZN", "AAPL"],
    "AMZN": ["MSFT", "GOOGL", "WMT"],
    "AAPL": ["MSFT", "GOOGL"],
    "AMD": ["NVDA", "INTC"],
    "META": ["GOOGL", "SNAP"],
}


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
    if type(value) is not int and type(value) is not float:
        return None
    if value <= 0:
        return None
    return float(value)


def _aliases_for(ticker: str, company_name: str = "") -> list[str]:
    aliases = [ticker.lower(), *_COMPANY_ALIASES.get(ticker.upper(), [])]
    name = (company_name or "").strip().lower()
    if name and name not in aliases:
        aliases.append(name)
        # first token often enough ("Nvidia Corp" → nvidia)
        first = name.split()[0]
        if len(first) > 2:
            aliases.append(first)
    return aliases


def classify_news_relevance(
    headline: str,
    ticker: str,
    *,
    company_name: str = "",
) -> tuple[str, str]:
    """Return (relevance, section) for a headline."""
    text = headline.lower()
    symbol = ticker.upper()
    aliases = _aliases_for(symbol, company_name)

    company_hit = any(
        (a == symbol.lower() and re.search(rf"\b{re.escape(a)}\b", text))
        or (a != symbol.lower() and a in text)
        for a in aliases
    )

    competitor_hit = False
    for rival in _COMPETITOR_TICKERS.get(symbol, []):
        rival_aliases = _aliases_for(rival)
        if any(a in text for a in rival_aliases):
            competitor_hit = True
            break

    etf_hit = bool(re.search(r"\betf\b|\bspy\b|\bqqq\b", text))
    broad_market = any(re.search(p, text) for p in _MARKET_PATTERNS)
    sector_hit = any(re.search(p, text) for p in _SECTOR_PATTERNS)

    # Company mention wins even if sector terms appear.
    if company_hit:
        return "company", "company"
    if competitor_hit:
        return "competitor", "market"
    if etf_hit:
        return "etf", "market"
    if broad_market:
        return "market", "market"
    if sector_hit:
        return "sector", "market"
    # Finnhub company_news is usually about the symbol; keep as company by default.
    return "company", "company"


def get_company_news(
    ticker: str,
    limit: int = 10,
    *,
    company_name: str = "",
) -> list[NewsItem]:
    """Return recent headlines with relevance tags (cached ~20 minutes)."""
    symbol = ticker.strip().upper()
    if not symbol:
        raise HTTPException(status_code=400, detail="Ticker is required")

    cache_key = f"{symbol}:{limit}:{company_name.strip().lower()}"
    cached = _news_cache.get(cache_key)
    if cached is not None:
        expires_at, items = cached
        if datetime.now(tz=timezone.utc) < expires_at:
            return items

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
        detail = str(exc)
        if "429" in detail or "rate" in detail.lower():
            # Prefer stale cache on rate limit if present.
            if cached is not None:
                return cached[1]
            raise HTTPException(
                status_code=429,
                detail="News provider rate limit hit. Try again shortly — cached data will appear when available.",
            ) from exc
        raise HTTPException(
            status_code=502,
            detail=f"Failed to fetch news from Finnhub: {exc}",
        ) from exc

    if not isinstance(raw_items, list):
        raise HTTPException(status_code=502, detail="Unexpected Finnhub response")

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

        relevance, section = classify_news_relevance(
            headline,
            symbol,
            company_name=company_name,
        )
        news.append(
            NewsItem(
                headline=headline,
                source=(item.get("source") or "Unknown").strip() or "Unknown",
                url=url,
                publishedAt=datetime.fromtimestamp(ts, tz=timezone.utc),
                sentiment="neutral",
                sentimentScore=0.0,
                relevance=relevance,
                section=section,
            )
        )
        if len(news) >= max(limit * 2, 16):
            # Fetch a bit extra so UI can still split company vs market.
            break

    # Prefer company section first when returning a flat list for older callers.
    company_first = [n for n in news if n.section == "company"] + [
        n for n in news if n.section != "company"
    ]
    result = company_first[: max(limit, 12)]

    _news_cache[cache_key] = (
        datetime.now(tz=timezone.utc) + timedelta(minutes=_NEWS_CACHE_MINUTES),
        result,
    )
    return result

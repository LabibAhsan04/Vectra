"""Classify headlines and fetch company / market / watchlist news."""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Any, Sequence

from fastapi import HTTPException
import finnhub

from config import settings
from schemas.stock_schema import NewsItem

_client: finnhub.Client | None = None
_news_cache: dict[str, tuple[datetime, list[NewsItem]]] = {}
_NEWS_CACHE_MINUTES = 20

_COMPANY_ALIASES: dict[str, list[str]] = {
    "NVDA": ["nvidia", "nvidia corporation"],
    "MSFT": ["microsoft", "microsoft corporation"],
    "GOOGL": ["google", "alphabet", "alphabet inc.", "goog"],
    "GOOG": ["google", "alphabet", "alphabet inc.", "googl"],
    "META": ["meta", "meta platforms"],
    "AMZN": ["amazon", "amazon.com"],
    "AAPL": ["apple", "apple inc."],
    "TSLA": ["tesla", "tesla inc."],
    "AMD": ["advanced micro devices"],
    "AVGO": ["broadcom"],
    "CRM": ["salesforce"],
    "PLTR": ["palantir"],
    "NFLX": ["netflix"],
    "ORCL": ["oracle"],
    "INTC": ["intel"],
    "QCOM": ["qualcomm"],
    "ARM": ["arm holdings"],
    "SMCI": ["supermicro", "super micro", "super micro computer"],
    "TSM": ["taiwan semiconductor", "tsmc"],
    "IBM": ["international business machines"],
}

_MARKET_PATTERNS = [
    r"\bnasdaq\b",
    r"\bs&p\b",
    r"\bs&p 500\b",
    r"\bdow jones\b",
    r"\betf\b",
    r"\bspy\b",
    r"\bqqq\b",
    r"\bvoo\b",
    r"\bvanguard\b",
    r"\brobinhood\b",
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

_MARKET_SEED_SYMBOLS = ["SPY", "QQQ", "NVDA", "MSFT", "AAPL", "AMZN", "META", "GOOGL", "AMD", "TSLA"]


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
        first = name.split()[0]
        if len(first) > 2:
            aliases.append(first)
    return aliases


def detect_related_ticker(headline: str, candidates: Sequence[str]) -> str | None:
    """Return the first watchlist ticker whose aliases appear in the headline."""
    text = headline.lower()
    for symbol in candidates:
        aliases = _aliases_for(symbol)
        hit = any(
            (a == symbol.lower() and re.search(rf"\b{re.escape(a)}\b", text))
            or (a != symbol.lower() and a in text)
            for a in aliases
        )
        if hit:
            return symbol.upper()
    return None


def classify_news_relevance(
    headline: str,
    ticker: str,
    *,
    company_name: str = "",
) -> tuple[str, str, int]:
    """Return (relevance, section, relevance_score 0–100)."""
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

    etf_hit = bool(re.search(r"\betf\b|\bspy\b|\bqqq\b|\bvoo\b", text))
    broad_market = any(re.search(p, text) for p in _MARKET_PATTERNS)
    sector_hit = any(re.search(p, text) for p in _SECTOR_PATTERNS)

    if company_hit:
        score = 95
        if broad_market or sector_hit:
            score = 85
        return "company", "company", score
    if competitor_hit:
        return "competitor", "market", 55
    if etf_hit:
        return "etf", "market", 40
    if broad_market:
        return "market", "market", 45
    if sector_hit:
        return "sector", "market", 50
    return "market", "market", 35


def _headline_sentiment(headline: str) -> str:
    lower = headline.lower()
    bullish = ("surge", "jump", "beat", "record", "rally", "upgrade", "growth", "gain")
    bearish = ("fall", "drop", "miss", "cut", "lawsuit", "probe", "downgrade", "slump", "loss")
    score = sum(1 for w in bullish if w in lower) - sum(1 for w in bearish if w in lower)
    if score > 0:
        return "bullish"
    if score < 0:
        return "bearish"
    return "neutral"


def _items_from_raw(
    raw_items: list[Any],
    *,
    classify_ticker: str,
    company_name: str = "",
    related_ticker: str | None = None,
    limit: int,
) -> list[NewsItem]:
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
    seen_urls: set[str] = set()
    for ts, item in dated_items:
        headline = (item.get("headline") or "").strip()
        url = (item.get("url") or "").strip()
        if not headline or not url or url in seen_urls:
            continue
        seen_urls.add(url)
        relevance, section, relevance_score = classify_news_relevance(
            headline,
            classify_ticker,
            company_name=company_name,
        )
        news.append(
            NewsItem(
                headline=headline,
                source=(item.get("source") or "Unknown").strip() or "Unknown",
                url=url,
                publishedAt=datetime.fromtimestamp(ts, tz=timezone.utc),
                sentiment=_headline_sentiment(headline),
                sentimentScore=0.0,
                relevance=relevance,
                relevanceScore=relevance_score,
                section=section,
                relatedTicker=related_ticker,
            )
        )
        if len(news) >= limit:
            break
    return news


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

    cache_key = f"company:{symbol}:{limit}:{company_name.strip().lower()}"
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
            if cached is not None:
                return cached[1]
            raise HTTPException(
                status_code=429,
                detail=(
                    "Data provider rate limit reached. Showing cached results when available."
                ),
            ) from exc
        raise HTTPException(
            status_code=502,
            detail="No recent news found for this ticker.",
        ) from exc

    if not isinstance(raw_items, list):
        raise HTTPException(status_code=502, detail="No recent news found for this ticker.")

    news = _items_from_raw(
        raw_items,
        classify_ticker=symbol,
        company_name=company_name,
        related_ticker=symbol,
        limit=max(limit * 2, 16),
    )
    company_first = [n for n in news if n.section == "company"] + [
        n for n in news if n.section != "company"
    ]
    result = company_first[: max(limit, 12)]
    _news_cache[cache_key] = (
        datetime.now(tz=timezone.utc) + timedelta(minutes=_NEWS_CACHE_MINUTES),
        result,
    )
    return result


def get_market_news(limit: int = 20) -> list[NewsItem]:
    """Broad market / sector overview news for Home mode."""
    cache_key = f"market:{limit}"
    cached = _news_cache.get(cache_key)
    if cached is not None:
        expires_at, items = cached
        if datetime.now(tz=timezone.utc) < expires_at:
            return items

    client = _get_client()
    collected: list[NewsItem] = []
    seen: set[str] = set()

    try:
        general = client.general_news("general", min_id=0)
        if isinstance(general, list):
            for item in _items_from_raw(
                general,
                classify_ticker="SPY",
                related_ticker=None,
                limit=limit,
            ):
                if item.url in seen:
                    continue
                seen.add(item.url)
                # Prefer market/sector tags for general feed.
                if item.relevance == "company":
                    item = item.model_copy(
                        update={"relevance": "market", "section": "market", "relevanceScore": 50}
                    )
                collected.append(item)
    except Exception as exc:
        detail = str(exc)
        if "429" in detail or "rate" in detail.lower():
            if cached is not None:
                return cached[1]
            raise HTTPException(
                status_code=429,
                detail=(
                    "Data provider rate limit reached. Showing cached results when available."
                ),
            ) from exc

    end = datetime.now(tz=timezone.utc).date()
    start = end - timedelta(days=7)
    for seed in _MARKET_SEED_SYMBOLS:
        if len(collected) >= limit:
            break
        try:
            raw = client.company_news(seed, _from=start.isoformat(), to=end.isoformat())
        except Exception:
            continue
        if not isinstance(raw, list):
            continue
        for item in _items_from_raw(
            raw,
            classify_ticker=seed,
            related_ticker=seed,
            limit=4,
        ):
            if item.url in seen:
                continue
            seen.add(item.url)
            collected.append(item)
            if len(collected) >= limit:
                break

    collected.sort(key=lambda n: n.publishedAt, reverse=True)
    result = collected[:limit]
    if not result:
        raise HTTPException(status_code=502, detail="Market news temporarily unavailable.")

    _news_cache[cache_key] = (
        datetime.now(tz=timezone.utc) + timedelta(minutes=_NEWS_CACHE_MINUTES),
        result,
    )
    return result


def get_watchlist_news(tickers: Sequence[str], limit: int = 20) -> list[NewsItem]:
    """Combined recent news across watchlist symbols for Home mode."""
    symbols = [t.strip().upper() for t in tickers if t and t.strip()]
    if not symbols:
        return []

    cache_key = f"watchlist:{','.join(symbols)}:{limit}"
    cached = _news_cache.get(cache_key)
    if cached is not None:
        expires_at, items = cached
        if datetime.now(tz=timezone.utc) < expires_at:
            return items

    per = max(3, limit // max(len(symbols), 1) + 1)
    collected: list[NewsItem] = []
    seen: set[str] = set()
    for symbol in symbols:
        try:
            items = get_company_news(symbol, limit=per)
        except HTTPException:
            continue
        for item in items:
            if item.url in seen:
                continue
            seen.add(item.url)
            related = detect_related_ticker(item.headline, symbols) or symbol
            collected.append(
                item.model_copy(update={"relatedTicker": related})
            )

    collected.sort(key=lambda n: n.publishedAt, reverse=True)
    result = collected[:limit]
    _news_cache[cache_key] = (
        datetime.now(tz=timezone.utc) + timedelta(minutes=_NEWS_CACHE_MINUTES),
        result,
    )
    return result

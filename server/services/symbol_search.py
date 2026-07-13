"""Finnhub symbol search with short cache + fallback list."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import finnhub
from fastapi import HTTPException

from config import settings

_client: finnhub.Client | None = None
_search_cache: dict[str, tuple[datetime, list[dict[str, Any]]]] = {}
_CACHE_HOURS = 24

_FALLBACK_TICKERS: list[dict[str, str]] = [
    {"symbol": "NVDA", "description": "NVIDIA Corp", "displaySymbol": "NVDA", "type": "Common Stock"},
    {"symbol": "AAPL", "description": "Apple Inc", "displaySymbol": "AAPL", "type": "Common Stock"},
    {"symbol": "MSFT", "description": "Microsoft Corp", "displaySymbol": "MSFT", "type": "Common Stock"},
    {"symbol": "AMD", "description": "Advanced Micro Devices Inc", "displaySymbol": "AMD", "type": "Common Stock"},
    {"symbol": "TSLA", "description": "Tesla Inc", "displaySymbol": "TSLA", "type": "Common Stock"},
    {"symbol": "AMZN", "description": "Amazon.com Inc", "displaySymbol": "AMZN", "type": "Common Stock"},
    {"symbol": "META", "description": "Meta Platforms Inc", "displaySymbol": "META", "type": "Common Stock"},
    {"symbol": "GOOGL", "description": "Alphabet Inc Class A", "displaySymbol": "GOOGL", "type": "Common Stock"},
    {"symbol": "GOOG", "description": "Alphabet Inc Class C", "displaySymbol": "GOOG", "type": "Common Stock"},
    {"symbol": "PLTR", "description": "Palantir Technologies Inc", "displaySymbol": "PLTR", "type": "Common Stock"},
    {"symbol": "AVGO", "description": "Broadcom Inc", "displaySymbol": "AVGO", "type": "Common Stock"},
    {"symbol": "CRM", "description": "Salesforce Inc", "displaySymbol": "CRM", "type": "Common Stock"},
    {"symbol": "NFLX", "description": "Netflix Inc", "displaySymbol": "NFLX", "type": "Common Stock"},
    {"symbol": "INTC", "description": "Intel Corp", "displaySymbol": "INTC", "type": "Common Stock"},
    {"symbol": "ARM", "description": "Arm Holdings plc", "displaySymbol": "ARM", "type": "Common Stock"},
    {"symbol": "SMCI", "description": "Super Micro Computer Inc", "displaySymbol": "SMCI", "type": "Common Stock"},
    {"symbol": "TSM", "description": "Taiwan Semiconductor Manufacturing", "displaySymbol": "TSM", "type": "Common Stock"},
    {"symbol": "QCOM", "description": "QUALCOMM Inc", "displaySymbol": "QCOM", "type": "Common Stock"},
    {"symbol": "ORCL", "description": "Oracle Corp", "displaySymbol": "ORCL", "type": "Common Stock"},
    {"symbol": "IBM", "description": "International Business Machines", "displaySymbol": "IBM", "type": "Common Stock"},
    {"symbol": "SPY", "description": "SPDR S&P 500 ETF Trust", "displaySymbol": "SPY", "type": "ETP"},
    {"symbol": "QQQ", "description": "Invesco QQQ Trust", "displaySymbol": "QQQ", "type": "ETP"},
    {"symbol": "VOO", "description": "Vanguard S&P 500 ETF", "displaySymbol": "VOO", "type": "ETP"},
]


def _get_client() -> finnhub.Client | None:
    global _client
    if not settings.finnhub_api_key:
        return None
    if _client is None:
        _client = finnhub.Client(api_key=settings.finnhub_api_key)
    return _client


def _fallback_search(query: str, limit: int = 10) -> list[dict[str, Any]]:
    q = query.strip().lower()
    hits: list[dict[str, Any]] = []
    for row in _FALLBACK_TICKERS:
        hay = f"{row['symbol']} {row['description']}".lower()
        if q in hay:
            hits.append(
                {
                    "symbol": row["symbol"],
                    "companyName": row["description"],
                    "exchange": "US",
                    "assetType": row["type"],
                }
            )
        if len(hits) >= limit:
            break
    return hits


def search_symbols(query: str, limit: int = 10) -> list[dict[str, Any]]:
    """Search tickers by symbol/company name. Requires query length >= 2."""
    q = query.strip()
    if len(q) < 2:
        return []

    cache_key = f"{q.lower()}:{limit}"
    cached = _search_cache.get(cache_key)
    if cached is not None:
        expires_at, items = cached
        if datetime.now(tz=timezone.utc) < expires_at:
            return items

    client = _get_client()
    results: list[dict[str, Any]] = []
    if client is not None:
        try:
            raw = client.symbol_lookup(q)
            for item in (raw.get("result") or [])[: max(limit * 2, 20)]:
                if not isinstance(item, dict):
                    continue
                symbol = str(item.get("symbol") or "").strip().upper()
                if not symbol or ":" in symbol:
                    # Skip international prefixed symbols for simplicity.
                    continue
                results.append(
                    {
                        "symbol": symbol.split(".")[0] if "." in symbol and len(symbol) > 5 else symbol,
                        "companyName": str(item.get("description") or "").strip() or symbol,
                        "exchange": "US",
                        "assetType": str(item.get("type") or "Stock").strip() or "Stock",
                    }
                )
                if len(results) >= limit:
                    break
        except Exception as exc:
            detail = str(exc)
            if "429" in detail or "rate" in detail.lower():
                raise HTTPException(
                    status_code=429,
                    detail="Data provider rate limit reached. Try again shortly.",
                ) from exc
            results = []

    if not results:
        results = _fallback_search(q, limit=limit)

    # Deduplicate by symbol
    seen: set[str] = set()
    unique: list[dict[str, Any]] = []
    for item in results:
        sym = item["symbol"]
        if sym in seen:
            continue
        seen.add(sym)
        unique.append(item)
        if len(unique) >= limit:
            break

    _search_cache[cache_key] = (
        datetime.now(tz=timezone.utc) + timedelta(hours=_CACHE_HOURS),
        unique,
    )
    return unique

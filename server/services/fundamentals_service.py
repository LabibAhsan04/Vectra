"""Finnhub basic financials for richer fundamental scoring."""

from __future__ import annotations

from typing import Any

from services.market_data import _get_finnhub

_metrics_cache: dict[str, tuple[float, dict[str, Any]]] = {}
_CACHE_SECONDS = 3600


def get_fundamental_metrics(symbol: str) -> dict[str, Any]:
    """Return normalized fundamental metrics (P/E, margins, growth) when available."""
    import time

    key = symbol.strip().upper()
    cached = _metrics_cache.get(key)
    if cached and time.time() - cached[0] < _CACHE_SECONDS:
        return cached[1]

    metrics: dict[str, Any] = {
        "peRatio": 0.0,
        "revenueGrowthYoY": None,
        "profitMargin": None,
        "debtToEquity": None,
        "roe": None,
        "available": False,
    }
    try:
        client = _get_finnhub()
        payload = client.company_basic_financials(key, "all") or {}
        m = payload.get("metric") or {}
        pe = m.get("peBasicExclExtraTTM") or m.get("peTTM")
        if pe is not None and float(pe) > 0:
            metrics["peRatio"] = round(float(pe), 2)
        for src, dst in (
            ("revenueGrowthTTMYoy", "revenueGrowthYoY"),
            ("netProfitMarginTTM", "profitMargin"),
            ("totalDebt/totalEquityQuarterly", "debtToEquity"),
            ("roeTTM", "roe"),
        ):
            val = m.get(src)
            if val is not None:
                try:
                    metrics[dst] = round(float(val), 2)
                except (TypeError, ValueError):
                    pass
        metrics["available"] = bool(
            metrics["peRatio"] or any(metrics[k] is not None for k in ("revenueGrowthYoY", "profitMargin", "roe"))
        )
    except Exception:
        pass

    _metrics_cache[key] = (time.time(), metrics)
    return metrics

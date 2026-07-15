"""Lightweight deterministic signal for watchlist snapshots (no AI layer)."""

from __future__ import annotations

from typing import TYPE_CHECKING

from services.fundamentals_service import get_fundamental_metrics
from services.market_data import get_price_history, get_stock_quote
from services.news_service import get_company_news
from services.scoring import compute_composite_score, normalize_factor_scores, signal_from_score
from services.signal_engine import build_factor_scores_from_market

if TYPE_CHECKING:
    from schemas.stock_schema import StockQuote


def compute_quick_signal(
    ticker: str,
    *,
    quote: StockQuote | None = None,
) -> tuple[int, str, float] | None:
    """Return (final_score, final_label, price) using the same scoring engine as /analyze."""
    symbol = ticker.strip().upper()
    if not symbol:
        return None

    try:
        if quote is None:
            quote = get_stock_quote(symbol)
    except Exception:
        return None

    closes: list[float] = []
    volumes: list[float] = []
    try:
        history = get_price_history(symbol, "3M")
        closes = [p.close for p in history.points]
        volumes = [float(p.volume or 0) for p in history.points]
    except Exception:
        closes = []
        volumes = []

    company_headlines: list[str] = []
    market_headlines: list[str] = []
    company_bullish = 0
    company_bearish = 0
    company_neutral = 0
    try:
        news = get_company_news(symbol, limit=8, company_name=quote.companyName)
        company_items = [item for item in news if item.section == "company"]
        market_items = [item for item in news if item.section != "company"]
        company_headlines = [item.headline for item in company_items]
        market_headlines = [item.headline for item in market_items]
        company_bullish = sum(1 for item in company_items if item.sentiment == "bullish")
        company_bearish = sum(1 for item in company_items if item.sentiment == "bearish")
        company_neutral = sum(1 for item in company_items if item.sentiment == "neutral")
    except Exception:
        pass

    fundamentals: dict = {}
    try:
        fundamentals = get_fundamental_metrics(symbol)
    except Exception:
        fundamentals = {}

    pe_ratio = quote.peRatio or fundamentals.get("peRatio") or 0.0
    fundamentals_available = bool(
        quote.marketCap > 0
        or pe_ratio > 0
        or fundamentals.get("available")
    )

    if closes:
        factor_scores, _ = build_factor_scores_from_market(
            closes=closes,
            volumes=volumes,
            change_pct=quote.changePct,
            company_headlines=company_headlines,
            market_headlines=market_headlines,
            fundamentals_available=fundamentals_available,
            pe_ratio=pe_ratio,
            revenue_growth_yoy=fundamentals.get("revenueGrowthYoY"),
            profit_margin=fundamentals.get("profitMargin"),
            roe=fundamentals.get("roe"),
            company_bullish=company_bullish,
            company_bearish=company_bearish,
            company_neutral=company_neutral,
        )
    else:
        factor_scores, _ = build_factor_scores_from_market(
            closes=[quote.price, quote.price * (1 - quote.changePct / 100.0)],
            volumes=[1.0, 1.0],
            change_pct=quote.changePct,
            company_headlines=company_headlines,
            market_headlines=market_headlines,
            fundamentals_available=fundamentals_available,
            pe_ratio=pe_ratio,
            revenue_growth_yoy=fundamentals.get("revenueGrowthYoY"),
            profit_margin=fundamentals.get("profitMargin"),
            roe=fundamentals.get("roe"),
            company_bullish=company_bullish,
            company_bearish=company_bearish,
            company_neutral=company_neutral,
        )

    factor_scores = normalize_factor_scores(factor_scores)
    overall = compute_composite_score(
        factor_scores,
        fundamentals_available=fundamentals_available,
    )
    label = signal_from_score(overall)
    return overall, label, quote.price

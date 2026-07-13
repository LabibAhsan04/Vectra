"""Research-signal orchestration: scoring + AI explanation + response assembly."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Sequence

from fastapi import HTTPException

from services.ai_explainer import explain_signal_with_openrouter
from services.scoring import (
    SCORE_FORMULA,
    build_data_limitations,
    build_score_breakdown,
    build_what_could_change,
    build_why_this_signal,
    compute_composite_score,
    normalize_factor_scores,
    score_interpretation,
    signal_display,
    signal_from_score,
)
from services.signal_engine import build_factor_scores_from_market, market_snapshot_flags


def _sources_used(*, used_openrouter: bool, fundamentals_available: bool) -> list[str]:
    sources = [
        "Finnhub price data",
        "company/news feeds",
        "internal signal engine",
        "OpenRouter explanation layer",
    ]
    if not used_openrouter:
        sources[-1] = "OpenRouter explanation layer (template fallback)"
    if fundamentals_available:
        sources.insert(2, "limited company profile metrics")
    return sources


async def get_ai_analysis(
    ticker: str,
    price: float,
    change_pct: float,
    pe_ratio: float,
    headlines: list[str],
    *,
    company_headlines: Sequence[str] | None = None,
    market_headlines: Sequence[str] | None = None,
    company_news_count: int = 0,
    market_news_count: int = 0,
    fundamentals_available: bool = False,
    closes: Sequence[float] | None = None,
    volumes: Sequence[float] | None = None,
    force: bool = False,
) -> dict[str, Any]:
    """Build a transparent research signal and attach an explanation."""
    symbol = ticker.strip().upper()
    if not symbol:
        raise HTTPException(status_code=400, detail="Ticker is required")

    company_list = list(company_headlines or [])
    market_list = list(market_headlines or [])
    if not company_list and not market_list and headlines:
        company_list = list(headlines)

    closes_f = list(closes or [])
    volumes_f = list(volumes or [])
    if closes_f:
        factor_scores, contributions = build_factor_scores_from_market(
            closes=closes_f,
            volumes=volumes_f,
            change_pct=change_pct,
            company_headlines=company_list,
            market_headlines=market_list,
            fundamentals_available=fundamentals_available,
        )
        flags = market_snapshot_flags(closes=closes_f, volumes=volumes_f)
    else:
        # Quote-only fallback when history is unavailable.
        factor_scores, contributions = build_factor_scores_from_market(
            closes=[price, price * (1 - change_pct / 100.0)],
            volumes=[1.0, 1.0],
            change_pct=change_pct,
            company_headlines=company_list,
            market_headlines=market_list,
            fundamentals_available=fundamentals_available,
        )
        flags = {}

    factor_scores = normalize_factor_scores(factor_scores)
    overall = compute_composite_score(
        factor_scores,
        fundamentals_available=fundamentals_available,
    )
    signal = signal_from_score(overall)
    meta = signal_display(signal)
    why = build_why_this_signal(
        factor_scores,
        change_pct=change_pct,
        fundamentals_available=fundamentals_available,
        company_news_count=company_news_count or len(company_list),
    )
    breakdown = build_score_breakdown(
        factor_scores,
        contributions=contributions,
        fundamentals_available=fundamentals_available,
    )
    data_limits = build_data_limitations(
        fundamentals_available=fundamentals_available,
        used_template=False,
    )

    explanation = await explain_signal_with_openrouter(
        {
            "ticker": symbol,
            "finalScore": overall,
            "overallScore": overall,
            "signal": signal,
            "scores": factor_scores,
            "scoreBreakdown": breakdown,
            "whyThisSignal": why,
            "fundamentalsAvailable": fundamentals_available,
            "changePct": change_pct,
            "price": price,
            "companyHeadlines": company_list,
            "marketHeadlines": market_list,
            "dataLimitations": data_limits,
            "force": force,
            "peRatio": pe_ratio,
        }
    )
    used_openrouter = explanation.get("explanationSource") == "openrouter"
    data_limits = build_data_limitations(
        fundamentals_available=fundamentals_available,
        used_template=not used_openrouter,
    )

    return {
        "ticker": symbol,
        "overallScore": overall,
        "signal": signal,
        "signalLabel": meta["label"],
        "signalShort": meta["short"],
        "signalTone": meta["tone"],
        "analysisText": explanation["analysisText"],
        "scoreInterpretation": score_interpretation(overall, signal),
        "scores": factor_scores,
        "scoreBreakdown": breakdown,
        "scoreFormula": SCORE_FORMULA,
        "newsItems": [
            {"headline": h, "sentiment": "neutral"} for h in (company_list + market_list)[:10]
        ],
        "keyRisks": explanation.get("keyRisks") or [],
        "keyCatalysts": explanation.get("keyCatalysts") or [],
        "whyThisSignal": why,
        "whatCouldChange": build_what_could_change(
            signal,
            fundamentals_available=fundamentals_available,
        ),
        "dataLimitations": data_limits,
        "fundamentalsAvailable": fundamentals_available,
        "sourcesUsed": _sources_used(
            used_openrouter=used_openrouter,
            fundamentals_available=fundamentals_available,
        ),
        "explanationSource": explanation.get("explanationSource", "template"),
        "marketFlags": flags,
        "generatedAt": datetime.now(tz=timezone.utc),
    }

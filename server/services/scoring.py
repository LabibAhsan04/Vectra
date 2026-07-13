"""Transparent, reproducible research-signal scoring."""

from __future__ import annotations

from typing import Any, Mapping

# Explicit weights — must remain reproducible in UI.
FACTOR_WEIGHTS: dict[str, float] = {
    "momentum": 0.25,
    "technical": 0.25,
    "sentiment": 0.20,
    "fundamentals": 0.15,
    "growth": 0.15,
}

SCORE_FORMULA = (
    "Final Score = Momentum×0.25 + Technical×0.25 + Sentiment×0.20 "
    "+ Fundamentals×0.15 + Growth×0.15"
)

STRONG_BULLISH_THRESHOLD = 80
BULLISH_THRESHOLD = 65
BEARISH_THRESHOLD = 40
STRONG_BEARISH_THRESHOLD = 20

SIGNAL_DISPLAY: dict[str, dict[str, str]] = {
    "strong_bullish": {
        "label": "Strong Bullish",
        "short": "Strong Bullish",
        "tone": "bullish",
        "evidence": "current evidence is strongly bullish",
    },
    "bullish": {
        "label": "Bullish Signal",
        "short": "Bullish",
        "tone": "bullish",
        "evidence": "current evidence is bullish",
    },
    "neutral": {
        "label": "Neutral Signal",
        "short": "Neutral",
        "tone": "neutral",
        "evidence": "current evidence is mixed / cautious",
    },
    "bearish": {
        "label": "Bearish Signal",
        "short": "Bearish",
        "tone": "bearish",
        "evidence": "current evidence is cautious",
    },
    "strong_bearish": {
        "label": "Strong Bearish",
        "short": "Strong Bearish",
        "tone": "bearish",
        "evidence": "current evidence is strongly cautious",
    },
    # Legacy API codes mapped for cache/back-compat.
    "strong_buy": {
        "label": "Strong Bullish",
        "short": "Strong Bullish",
        "tone": "bullish",
        "evidence": "current evidence is strongly bullish",
    },
    "buy": {
        "label": "Bullish Signal",
        "short": "Bullish",
        "tone": "bullish",
        "evidence": "current evidence is bullish",
    },
    "hold": {
        "label": "Neutral Signal",
        "short": "Neutral",
        "tone": "neutral",
        "evidence": "current evidence is mixed / cautious",
    },
    "sell": {
        "label": "Bearish Signal",
        "short": "Bearish",
        "tone": "bearish",
        "evidence": "current evidence is cautious",
    },
    "strong_sell": {
        "label": "Strong Bearish",
        "short": "Strong Bearish",
        "tone": "bearish",
        "evidence": "current evidence is strongly cautious",
    },
}


def clamp_score(value: Any, default: int = 50) -> int:
    try:
        score = int(round(float(value)))
    except (TypeError, ValueError):
        return default
    return max(0, min(100, score))


def normalize_factor_scores(scores: Mapping[str, Any] | None) -> dict[str, int]:
    raw = scores if isinstance(scores, Mapping) else {}
    return {key: clamp_score(raw.get(key)) for key in FACTOR_WEIGHTS}


def effective_weights(*, fundamentals_available: bool) -> dict[str, float]:
    if fundamentals_available:
        return dict(FACTOR_WEIGHTS)
    remaining = 1.0 - FACTOR_WEIGHTS["fundamentals"]
    return {
        key: (0.0 if key == "fundamentals" else weight / remaining)
        for key, weight in FACTOR_WEIGHTS.items()
    }


def compute_composite_score(
    scores: Mapping[str, Any] | None,
    *,
    fundamentals_available: bool = True,
) -> int:
    """Weighted average of factor scores (reproducible from category scores)."""
    normalized = normalize_factor_scores(scores)
    weights = effective_weights(fundamentals_available=fundamentals_available)
    if not fundamentals_available:
        normalized = {**normalized, "fundamentals": min(normalized["fundamentals"], 45)}
    total = sum(normalized[key] * weights[key] for key in FACTOR_WEIGHTS)
    return clamp_score(total)


def signal_from_score(score: int) -> str:
    if score >= STRONG_BULLISH_THRESHOLD:
        return "strong_bullish"
    if score >= BULLISH_THRESHOLD:
        return "bullish"
    if score <= STRONG_BEARISH_THRESHOLD:
        return "strong_bearish"
    if score <= BEARISH_THRESHOLD:
        return "bearish"
    return "neutral"


def signal_display(signal: str) -> dict[str, str]:
    return SIGNAL_DISPLAY.get(signal, SIGNAL_DISPLAY["neutral"])


def score_interpretation(score: int, signal: str) -> str:
    meta = signal_display(signal)
    return (
        f"{score}/100 indicates {meta['evidence']} based on momentum, "
        "technicals, sentiment, growth, and fundamentals/data quality."
    )


def score_bucket(score: int) -> str:
    if score >= 80:
        return "80–100 Strong Bullish"
    if score >= 65:
        return "65–79 Bullish"
    if score >= 45:
        return "45–64 Neutral"
    if score >= 30:
        return "30–44 Bearish"
    return "0–29 Strong Bearish"


def build_score_breakdown(
    scores: Mapping[str, int],
    *,
    contributions: Mapping[str, list[str]] | None = None,
    fundamentals_available: bool = False,
) -> list[dict[str, Any]]:
    """Per-factor score rows for the 'Why this score?' UI."""
    weights = effective_weights(fundamentals_available=fundamentals_available)
    contrib = contributions or {}
    rows: list[dict[str, Any]] = []
    for key in FACTOR_WEIGHTS:
        value = clamp_score(scores.get(key, 50))
        rows.append(
            {
                "key": key,
                "label": (
                    "Fundamentals/Data Quality"
                    if key == "fundamentals"
                    else key.capitalize()
                ),
                "score": value,
                "weight": round(weights[key], 4),
                "weightedPoints": round(value * weights[key], 2),
                "notes": list(contrib.get(key, [])),
            }
        )
    return rows


def build_why_this_signal(
    scores: Mapping[str, int],
    *,
    change_pct: float,
    fundamentals_available: bool,
    company_news_count: int,
) -> list[str]:
    reasons: list[str] = []
    if change_pct <= -2:
        reasons.append(
            f"Near-term price change is weak ({change_pct:+.2f}% on the latest session)."
        )
    elif change_pct >= 2:
        reasons.append(
            f"Near-term price momentum is improving ({change_pct:+.2f}% on the latest session)."
        )

    technical = scores.get("technical", 50)
    momentum = scores.get("momentum", 50)
    sentiment = scores.get("sentiment", 50)
    growth = scores.get("growth", 50)

    if technical < 45:
        reasons.append("Technical trend structure looks soft relative to recent averages.")
    elif technical >= 65:
        reasons.append("Technical indicators currently support an upward trend structure.")

    if momentum < 45:
        reasons.append("Momentum score is weak, suggesting limited follow-through.")
    elif momentum >= 65:
        reasons.append("Momentum score is firm, suggesting improving participation.")

    if sentiment < 45:
        reasons.append("News sentiment is mixed-to-cautious across recent headlines.")
    elif sentiment >= 65:
        reasons.append("Company-relevant news tone is comparatively constructive.")

    if not fundamentals_available:
        reasons.append(
            "Fundamental data is limited in this version, so the signal relies mainly on "
            "price momentum, technical indicators, and recent news."
        )

    if growth < 45:
        reasons.append("Confirmed growth/catalyst inputs are limited in current data.")
    elif growth >= 65:
        reasons.append("Available catalyst/growth inputs are comparatively supportive.")

    if company_news_count == 0:
        reasons.append("Company-specific news coverage is limited for the lookback window.")

    return reasons[:6] or [
        "Composite score blends momentum, technicals, sentiment, growth, and data quality."
    ]


def build_what_could_change(
    signal: str,
    *,
    fundamentals_available: bool,
) -> list[str]:
    items = [
        "Improved price momentum above recent moving-average structure.",
        "Stronger company-specific news with clearer directional tone.",
        "Higher relative volume alongside constructive price movement.",
    ]
    if signal in {"bearish", "strong_bearish", "neutral", "sell", "strong_sell", "hold"}:
        items.insert(
            0,
            "A sustained recovery in technical trend (MA20/MA50 alignment) would support a firmer reading.",
        )
    if signal in {"bullish", "strong_bullish", "neutral", "buy", "strong_buy", "hold"}:
        items.append(
            "A breakdown in momentum or persistently cautious news tone could soften the signal."
        )
    if not fundamentals_available:
        items.append(
            "Access to reliable earnings, revenue, or guidance data would refine Fundamentals/Data Quality."
        )
    return items[:5]


def build_data_limitations(*, fundamentals_available: bool, used_template: bool) -> list[str]:
    limits = [
        "Free-tier market and news APIs can be delayed, incomplete, or rate-limited.",
        "Vectra provides evidence-based research signals only. It does not provide financial advice or execute trades.",
    ]
    if not fundamentals_available:
        limits.insert(
            0,
            "Fundamental data is limited in this version, so the signal relies mainly on "
            "price momentum, technical indicators, and recent news.",
        )
    if used_template:
        limits.append(
            "Explanation used the deterministic template fallback (OpenRouter unavailable or rate-limited)."
        )
    return limits

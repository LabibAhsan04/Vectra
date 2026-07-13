"""Composite 0–100 score and research-signal mapping."""

from __future__ import annotations

from typing import Any, Mapping

# Weights sum to 1.0 — tilt slightly toward fundamentals + momentum.
FACTOR_WEIGHTS: dict[str, float] = {
    "momentum": 0.20,
    "fundamentals": 0.25,
    "sentiment": 0.20,
    "technical": 0.20,
    "growth": 0.15,
}

STRONG_BUY_THRESHOLD = 80
BUY_THRESHOLD = 65
SELL_THRESHOLD = 40
STRONG_SELL_THRESHOLD = 20

# Display copy for research product voice.
SIGNAL_DISPLAY: dict[str, dict[str, str]] = {
    "strong_buy": {
        "label": "Strong Bullish (STRONG BUY)",
        "short": "Strong Bullish",
        "tone": "bullish",
        "evidence": "current evidence is strongly bullish",
    },
    "buy": {
        "label": "Bullish Signal (BUY)",
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
        "label": "Bearish Signal (SELL)",
        "short": "Bearish",
        "tone": "bearish",
        "evidence": "current evidence is cautious",
    },
    "strong_sell": {
        "label": "Strong Bearish (STRONG SELL)",
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


def compute_composite_score(
    scores: Mapping[str, Any] | None,
    *,
    fundamentals_available: bool = True,
) -> int:
    """Weighted average of factor scores, rounded to 0–100.

    When fundamentals are unavailable, redistribute that weight across the
    remaining factors so a missing data pillar does not dominate the signal.
    """
    normalized = normalize_factor_scores(scores)
    if fundamentals_available:
        weights = FACTOR_WEIGHTS
    else:
        # Keep fundamentals visible as a low-confidence mid score, but don't
        # let it drive the composite as if company filings were present.
        remaining = 1.0 - FACTOR_WEIGHTS["fundamentals"]
        weights = {
            key: (0.0 if key == "fundamentals" else weight / remaining)
            for key, weight in FACTOR_WEIGHTS.items()
        }
        normalized = {
            **normalized,
            "fundamentals": clamp_score(normalized.get("fundamentals", 45), 45),
        }
    total = sum(normalized[key] * weights[key] for key in FACTOR_WEIGHTS)
    return clamp_score(total)


def signal_from_score(score: int) -> str:
    if score >= STRONG_BUY_THRESHOLD:
        return "strong_buy"
    if score >= BUY_THRESHOLD:
        return "buy"
    if score <= STRONG_SELL_THRESHOLD:
        return "strong_sell"
    if score <= SELL_THRESHOLD:
        return "sell"
    return "hold"


def signal_display(signal: str) -> dict[str, str]:
    return SIGNAL_DISPLAY.get(signal, SIGNAL_DISPLAY["hold"])


def score_interpretation(score: int, signal: str) -> str:
    meta = signal_display(signal)
    return (
        f"{score}/100 indicates {meta['evidence']} based on momentum, "
        "sentiment, technicals, growth, and available fundamental/data-quality inputs."
    )


def build_why_this_signal(
    scores: Mapping[str, int],
    *,
    change_pct: float,
    fundamentals_available: bool,
    company_news_count: int,
) -> list[str]:
    reasons: list[str] = []
    momentum = scores.get("momentum", 50)
    technical = scores.get("technical", 50)
    sentiment = scores.get("sentiment", 50)
    growth = scores.get("growth", 50)
    fundamentals = scores.get("fundamentals", 50)

    if change_pct <= -2:
        reasons.append(
            f"Near-term price change is weak ({change_pct:+.2f}% on the latest session)."
        )
    elif change_pct >= 2:
        reasons.append(
            f"Near-term price momentum is improving ({change_pct:+.2f}% on the latest session)."
        )

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
        reasons.append("News sentiment is comparatively constructive.")

    if not fundamentals_available:
        reasons.append(
            "Fundamental filings data is limited in this version, so the signal leans on "
            "market momentum, technicals, and news sentiment."
        )
    elif fundamentals < 45:
        reasons.append("Available company data quality/fundamental inputs are soft.")

    if growth < 45:
        reasons.append("Confirmed growth inputs are limited or weak in the current model inputs.")
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
    if signal in {"sell", "strong_sell", "hold"}:
        items.insert(
            0,
            "A sustained recovery in technical trend (MA20/MA50 alignment) would support a firmer reading.",
        )
    if signal in {"buy", "strong_buy", "hold"}:
        items.append(
            "A breakdown in momentum or a shift to persistently cautious news tone could soften the signal."
        )
    if not fundamentals_available:
        items.append(
            "Access to reliable earnings, revenue, or guidance data would refine Fundamentals/Data Quality."
        )
    else:
        items.append("Updated earnings or guidance data that changes growth/fundamental quality.")
    return items[:5]


def build_data_limitations(*, fundamentals_available: bool, used_template: bool) -> list[str]:
    limits = [
        "Free-tier market and news APIs can be delayed, incomplete, or rate-limited.",
        "This output is a research signal for education — not financial advice and not a trade instruction.",
    ]
    if not fundamentals_available:
        limits.insert(
            0,
            "Fundamental data (revenue growth, margins, debt) is unavailable or incomplete in the current free API tier.",
        )
    if used_template:
        limits.append(
            "Explanation text used the deterministic template fallback (OpenRouter unavailable or rate-limited)."
        )
    return limits

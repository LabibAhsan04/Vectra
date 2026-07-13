"""Composite 0–100 score from factor scores."""

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

BUY_THRESHOLD = 65
SELL_THRESHOLD = 40


def clamp_score(value: Any, default: int = 50) -> int:
    try:
        score = int(round(float(value)))
    except (TypeError, ValueError):
        return default
    return max(0, min(100, score))


def normalize_factor_scores(scores: Mapping[str, Any] | None) -> dict[str, int]:
    raw = scores if isinstance(scores, Mapping) else {}
    return {key: clamp_score(raw.get(key)) for key in FACTOR_WEIGHTS}


def compute_composite_score(scores: Mapping[str, Any] | None) -> int:
    """Weighted average of factor scores, rounded to 0–100."""
    normalized = normalize_factor_scores(scores)
    total = sum(normalized[key] * weight for key, weight in FACTOR_WEIGHTS.items())
    return clamp_score(total)


def signal_from_score(score: int) -> str:
    if score >= BUY_THRESHOLD:
        return "buy"
    if score <= SELL_THRESHOLD:
        return "sell"
    return "hold"

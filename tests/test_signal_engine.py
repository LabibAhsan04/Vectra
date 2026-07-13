"""Unit tests for transparent scoring / signal mapping."""

from services.scoring import (
    compute_composite_score,
    normalize_factor_scores,
    signal_from_score,
)
from services.signal_engine import build_factor_scores_from_market


def test_bullish_case_from_thresholds():
    score = compute_composite_score(
        {
            "momentum": 80,
            "technical": 80,
            "sentiment": 75,
            "fundamentals": 50,
            "growth": 70,
        },
        fundamentals_available=False,
    )
    assert score >= 65
    assert signal_from_score(score) in {"bullish", "strong_bullish"}


def test_bearish_case_from_thresholds():
    score = compute_composite_score(
        {
            "momentum": 20,
            "technical": 25,
            "sentiment": 30,
            "fundamentals": 45,
            "growth": 30,
        },
        fundamentals_available=False,
    )
    assert score <= 40
    assert signal_from_score(score) in {"bearish", "strong_bearish"}


def test_neutral_case():
    score = compute_composite_score(
        {
            "momentum": 50,
            "technical": 50,
            "sentiment": 50,
            "fundamentals": 45,
            "growth": 50,
        },
        fundamentals_available=False,
    )
    assert 41 <= score <= 64
    assert signal_from_score(score) == "neutral"


def test_missing_fundamentals_does_not_dominate():
    low_fund = normalize_factor_scores(
        {
            "momentum": 70,
            "technical": 70,
            "sentiment": 70,
            "fundamentals": 10,
            "growth": 70,
        }
    )
    with_fund = compute_composite_score(low_fund, fundamentals_available=True)
    without = compute_composite_score(low_fund, fundamentals_available=False)
    # When unavailable, fundamentals weight is redistributed → higher composite than a 10.
    assert without > with_fund


def test_no_news_still_scores():
    scores, notes = build_factor_scores_from_market(
        closes=[100 + i * 0.5 for i in range(60)],
        volumes=[1_000_000] * 60,
        change_pct=1.2,
        company_headlines=[],
        market_headlines=[],
        fundamentals_available=False,
    )
    assert set(scores) == {
        "momentum",
        "technical",
        "sentiment",
        "fundamentals",
        "growth",
    }
    assert any("limited company-specific news" in n.lower() for n in notes["sentiment"])


def test_final_score_reproducible_from_weights():
    scores = {
        "momentum": 66,
        "technical": 60,
        "sentiment": 50,
        "fundamentals": 45,
        "growth": 50,
    }
    # fundamentals available → use base weights
    expected = round(66 * 0.25 + 60 * 0.25 + 50 * 0.20 + 45 * 0.15 + 50 * 0.15)
    assert compute_composite_score(scores, fundamentals_available=True) == expected

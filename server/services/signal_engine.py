"""Deterministic signal construction from quotes, history, and news."""

from __future__ import annotations

from typing import Any, Sequence

from services.indicators import average_volume, rsi, simple_moving_average
from services.scoring import clamp_score, normalize_factor_scores


def _headline_tone(text: str) -> int:
    lower = text.lower()
    bullish = ("surge", "jump", "beat", "record", "rally", "upgrade", "growth", "strong")
    bearish = ("fall", "drop", "miss", "cut", "lawsuit", "probe", "downgrade", "weak", "slump")
    score = 0
    score += sum(1 for w in bullish if w in lower)
    score -= sum(1 for w in bearish if w in lower)
    return score


def build_factor_scores_from_market(
    *,
    closes: Sequence[float],
    volumes: Sequence[float],
    change_pct: float,
    company_headlines: Sequence[str],
    market_headlines: Sequence[str],
    fundamentals_available: bool,
) -> tuple[dict[str, int], dict[str, list[str]]]:
    """Return (factor_scores, per-factor contribution notes)."""
    notes: dict[str, list[str]] = {
        "momentum": [],
        "technical": [],
        "sentiment": [],
        "fundamentals": [],
        "growth": [],
    }

    closes_f = [float(c) for c in closes if c is not None]
    vols_f = [float(v) for v in volumes if v is not None]
    price = closes_f[-1] if closes_f else 0.0
    ma20 = simple_moving_average(closes_f, 20)
    ma50 = simple_moving_average(closes_f, 50)
    avg_vol = average_volume(vols_f, 20)
    latest_vol = vols_f[-1] if vols_f else None
    rsi_val = rsi(closes_f, 14)

    # --- Momentum ---
    momentum = 50
    if change_pct > 0:
        momentum += 15
        notes["momentum"].append("+15 daily change is positive")
    elif change_pct < 0:
        momentum -= 15
        notes["momentum"].append("-15 daily change is negative")
    else:
        notes["momentum"].append("0 daily change is flat")

    if ma20 is not None:
        if price > ma20:
            momentum += 20
            notes["momentum"].append("+20 price is above MA20")
        else:
            momentum -= 15
            notes["momentum"].append("-15 price is below MA20")

    if latest_vol is not None and avg_vol and avg_vol > 0:
        if latest_vol >= avg_vol:
            momentum += 10
            notes["momentum"].append("+10 relative volume is above normal")
        else:
            momentum -= 5
            notes["momentum"].append("-5 relative volume is below normal")

    # --- Technical ---
    technical = 50
    if ma50 is not None:
        if price > ma50:
            technical += 20
            notes["technical"].append("+20 price is above MA50")
        else:
            technical -= 15
            notes["technical"].append("-15 price is below MA50")
    if ma20 is not None and ma50 is not None:
        if ma20 > ma50:
            technical += 10
            notes["technical"].append("+10 MA20 is above MA50 (short-term structure firmer)")
        else:
            technical -= 10
            notes["technical"].append("-10 MA20 is below MA50 (short-term structure softer)")
    if rsi_val is not None:
        if rsi_val >= 70:
            technical -= 10
            notes["technical"].append("-10 RSI is near/overbought")
        elif rsi_val <= 30:
            technical += 10
            notes["technical"].append("+10 RSI is near/oversold (mean-reversion context)")
        else:
            notes["technical"].append(f"0 RSI is mid-range ({rsi_val:.0f})")

    # --- Sentiment (company news weighted more than market) ---
    sentiment = 50
    company_tone = sum(_headline_tone(h) for h in company_headlines)
    market_tone = sum(_headline_tone(h) for h in market_headlines)
    if company_tone > 0:
        sentiment += min(20, 10 * company_tone)
        notes["sentiment"].append("+10+ constructive company-news language")
    elif company_tone < 0:
        sentiment -= min(20, 10 * abs(company_tone))
        notes["sentiment"].append("-10+ cautious company-news language")
    else:
        notes["sentiment"].append("0 company-news tone is mixed/neutral")

    if market_tone > 0:
        sentiment += 5
        notes["sentiment"].append("+5 supportive sector/market context")
    elif market_tone < 0:
        sentiment -= 10
        notes["sentiment"].append("-10 competitor/sector pressure mentioned in contextual news")

    if not company_headlines:
        sentiment -= 5
        notes["sentiment"].append("-5 limited company-specific news in lookback window")

    # --- Fundamentals / data quality ---
    if fundamentals_available:
        fundamentals = 55
        notes["fundamentals"].append("Limited company profile metrics available")
    else:
        fundamentals = 45
        notes["fundamentals"].append(
            "Fundamental data limited in current free API tier"
        )
        notes["fundamentals"].append(
            "Score constrained due to missing confirmed fundamentals"
        )

    # --- Growth / catalysts (from language clues only — no invented filings) ---
    growth = 50
    joined = " ".join([*company_headlines, *market_headlines]).lower()
    if any(w in joined for w in ("ai", "growth", "expansion", "demand", "cloud")):
        growth += 8
        notes["growth"].append("+8 potential tech/sector tailwind mentioned in headlines")
    if any(w in joined for w in ("slowdown", "cut", "layoff", "guidance cut", "lawsuit")):
        growth -= 8
        notes["growth"].append("-8 cautious catalyst language found in headlines")
    if not company_headlines:
        notes["growth"].append(
            "No confirmed company-specific growth update found in current data"
        )
    else:
        notes["growth"].append(
            "Growth score uses headline context only — not confirmed filings"
        )

    scores = normalize_factor_scores(
        {
            "momentum": momentum,
            "technical": technical,
            "sentiment": sentiment,
            "fundamentals": fundamentals,
            "growth": growth,
        }
    )
    # Keep notes even if clamped.
    return scores, notes


def market_snapshot_flags(
    *,
    closes: Sequence[float],
    volumes: Sequence[float],
) -> dict[str, Any]:
    closes_f = [float(c) for c in closes]
    vols_f = [float(v) for v in volumes]
    price = closes_f[-1] if closes_f else None
    ma20 = simple_moving_average(closes_f, 20)
    ma50 = simple_moving_average(closes_f, 50)
    avg_vol = average_volume(vols_f, 20)
    latest_vol = vols_f[-1] if vols_f else None
    rel_vol = None
    if latest_vol is not None and avg_vol and avg_vol > 0:
        rel_vol = round(latest_vol / avg_vol, 2)
    return {
        "price": price,
        "ma20": ma20,
        "ma50": ma50,
        "avgVolume20": avg_vol,
        "latestVolume": latest_vol,
        "relativeVolume": rel_vol,
        "volumeSpike": bool(
            latest_vol is not None and avg_vol and latest_vol >= 2 * avg_vol
        ),
        "aboveMa20": bool(price is not None and ma20 is not None and price > ma20),
        "belowMa20": bool(price is not None and ma20 is not None and price < ma20),
        "aboveMa50": bool(price is not None and ma50 is not None and price > ma50),
        "belowMa50": bool(price is not None and ma50 is not None and price < ma50),
        "rsi": rsi(closes_f, 14),
    }

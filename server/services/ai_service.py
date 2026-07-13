"""OpenRouter LLM analysis for stock quotes + news."""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import HTTPException

from config import settings
from services.scoring import (
    compute_composite_score,
    normalize_factor_scores,
    signal_from_score,
)

SYSTEM_PROMPT = """
You are a quantitative financial analyst AI. You will be given data about a
stock and must return a structured JSON analysis. Be factual and balanced.
Always note that this is for educational purposes only.

Return ONLY valid JSON in this exact format:
{
  "overallScore": <0-100 integer>,
  "signal": "buy" | "hold" | "sell",
  "analysisText": "<2-3 sentence plain English recommendation>",
  "scores": {
    "momentum": <0-100>,
    "fundamentals": <0-100>,
    "sentiment": <0-100>,
    "technical": <0-100>,
    "growth": <0-100>
  },
  "newsItems": [
    { "headline": "<exact headline>", "sentiment": "bullish" | "bearish" | "neutral" }
  ],
  "keyRisks": ["", ""],
  "keyCatalysts": ["", ""]
}
"""

_OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
_DEFAULT_MODEL = "openai/gpt-4o-mini"

# Simple in-memory cache: ticker -> (expires_at_iso, payload)
_analysis_cache: dict[str, tuple[datetime, dict[str, Any]]] = {}
_CACHE_MINUTES = 10


def _build_user_prompt(
    ticker: str,
    price: float,
    change_pct: float,
    pe: float,
    revenue_growth: float,
    headlines: list[str],
) -> str:
    news_block = "\n".join(f"- {h}" for h in headlines) or "- (no recent headlines)"
    return f"""
Analyze {ticker}:
Current price: ${price} | Daily change: {change_pct:+.2f}%
P/E ratio: {pe} | Revenue growth YoY: {revenue_growth}%
Latest news headlines:
{news_block}

Provide your JSON analysis now.
"""


def _extract_json(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", cleaned)
    if fence:
        cleaned = fence.group(1).strip()
    return json.loads(cleaned)


def _normalize_sentiment(value: Any) -> str:
    sentiment = str(value or "neutral").strip().lower()
    if sentiment in {"bullish", "bearish", "neutral"}:
        return sentiment
    return "neutral"


def _get_cached(ticker: str) -> dict[str, Any] | None:
    entry = _analysis_cache.get(ticker)
    if not entry:
        return None
    expires_at, payload = entry
    if datetime.now(tz=timezone.utc) >= expires_at:
        _analysis_cache.pop(ticker, None)
        return None

    # Re-apply current scoring rules so older cache entries stay consistent
    scores = normalize_factor_scores(payload.get("scores"))
    overall = compute_composite_score(scores)
    refreshed = {
        **payload,
        "scores": scores,
        "overallScore": overall,
        "signal": signal_from_score(overall),
    }
    _analysis_cache[ticker] = (expires_at, refreshed)
    return refreshed


def _set_cache(ticker: str, payload: dict[str, Any]) -> None:
    from datetime import timedelta

    _analysis_cache[ticker] = (
        datetime.now(tz=timezone.utc) + timedelta(minutes=_CACHE_MINUTES),
        payload,
    )


async def get_ai_analysis(
    ticker: str,
    price: float,
    change_pct: float,
    pe_ratio: float,
    headlines: list[str],
    revenue_growth: float = 0.0,
    *,
    force: bool = False,
) -> dict[str, Any]:
    symbol = ticker.strip().upper()
    if not symbol:
        raise HTTPException(status_code=400, detail="Ticker is required")
    if not settings.openrouter_api_key:
        raise HTTPException(
            status_code=500,
            detail="OPENROUTER_API_KEY is not configured",
        )

    if not force:
        cached = _get_cached(symbol)
        if cached is not None:
            return cached

    model = settings.openrouter_model or _DEFAULT_MODEL
    prompt = _build_user_prompt(
        ticker=symbol,
        price=price,
        change_pct=change_pct,
        pe=pe_ratio,
        revenue_growth=revenue_growth,
        headlines=headlines[:10],
    )

    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Vectra Stock Dashboard",
    }
    body = {
        "model": model,
        "temperature": 0.2,
        "max_tokens": 1200,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(_OPENROUTER_URL, headers=headers, json=body)
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to reach OpenRouter: {exc}",
        ) from exc

    if response.status_code == 401:
        raise HTTPException(status_code=502, detail="OpenRouter API key rejected")
    if response.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail=f"OpenRouter error ({response.status_code}): {response.text[:300]}",
        )

    try:
        content = response.json()["choices"][0]["message"]["content"]
        raw = _extract_json(content)
    except (KeyError, IndexError, TypeError, json.JSONDecodeError) as exc:
        raise HTTPException(
            status_code=502,
            detail="Model returned invalid analysis JSON",
        ) from exc

    scores_raw = raw.get("scores") if isinstance(raw.get("scores"), dict) else {}
    news_raw = raw.get("newsItems") if isinstance(raw.get("newsItems"), list) else []
    factor_scores = normalize_factor_scores(scores_raw)
    overall_score = compute_composite_score(factor_scores)

    payload: dict[str, Any] = {
        "ticker": symbol,
        "overallScore": overall_score,
        "signal": signal_from_score(overall_score),
        "analysisText": str(raw.get("analysisText") or "").strip()
        or "No analysis text returned.",
        "scores": factor_scores,
        "newsItems": [
            {
                "headline": str(item.get("headline") or "").strip(),
                "sentiment": _normalize_sentiment(item.get("sentiment")),
            }
            for item in news_raw
            if isinstance(item, dict) and str(item.get("headline") or "").strip()
        ],
        "keyRisks": [
            str(r).strip()
            for r in (raw.get("keyRisks") or [])
            if str(r).strip()
        ][:5],
        "keyCatalysts": [
            str(c).strip()
            for c in (raw.get("keyCatalysts") or [])
            if str(c).strip()
        ][:5],
        "generatedAt": datetime.now(tz=timezone.utc),
    }

    _set_cache(symbol, payload)
    return payload

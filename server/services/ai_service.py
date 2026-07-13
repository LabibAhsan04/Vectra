"""OpenRouter LLM analysis for research-signal explanations."""

from __future__ import annotations

import json
import re
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from fastapi import HTTPException

from config import settings
from services.scoring import (
    build_data_limitations,
    build_what_could_change,
    build_why_this_signal,
    compute_composite_score,
    normalize_factor_scores,
    score_interpretation,
    signal_display,
    signal_from_score,
)

SYSTEM_PROMPT = """
You are a research analyst for Vectra, an evidence-based stock SIGNAL intelligence tool.
You explain research signals. You do NOT give trading commands or financial advice.

Hard rules:
1. Use ONLY the structured inputs provided (prices, changes, pe if marked available,
   headlines, factor scores, computed signal). Do not invent earnings, revenue growth,
   margins, debt, analyst ratings, price targets, or company performance facts.
2. If fundamentals_available is false, explicitly say fundamental data is limited and
   do NOT claim stagnant/accelerating revenue, profits, margins, or balance-sheet facts.
3. Never use the isolated command words: buy, sell, hold, guaranteed, price target,
   financial advice, "you should invest", "good idea to buy".
4. Prefer research phrasing: "current evidence is bullish/cautious", "momentum is improving",
   "short-term signal is weak", "risk remains elevated".
5. The explanation MUST match the provided signalLabel and overallScore. Do not contradict them.
6. Cover briefly: current signal, main evidence, main risks, data limitations, and that
   this is not financial advice.

Return ONLY valid JSON:
{
  "analysisText": "<3-5 sentence research explanation>",
  "scores": {
    "momentum": <0-100>,
    "fundamentals": <0-100>,
    "sentiment": <0-100>,
    "technical": <0-100>,
    "growth": <0-100>
  },
  "newsItems": [
    { "headline": "<exact headline from input>", "sentiment": "bullish" | "bearish" | "neutral" }
  ],
  "keyRisks": ["...", "..."],
  "keyCatalysts": ["...", "..."]
}
"""

_OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
_DEFAULT_MODEL = "openai/gpt-4o-mini"

_analysis_cache: dict[str, tuple[datetime, dict[str, Any]]] = {}
_CACHE_MINUTES = 45  # keep explanations until force refresh / signal refresh window


def _build_user_prompt(
    ticker: str,
    price: float,
    change_pct: float,
    pe: float,
    pe_available: bool,
    fundamentals_available: bool,
    headlines: list[str],
    company_news_count: int,
    market_news_count: int,
    signal: str,
    overall_score: int,
    factor_scores: dict[str, int],
) -> str:
    meta = signal_display(signal)
    news_block = "\n".join(f"- {h}" for h in headlines) or "- (no recent headlines)"
    pe_line = f"P/E ratio: {pe}" if pe_available else "P/E ratio: unavailable"
    fund_line = (
        "fundamentals_available: true"
        if fundamentals_available
        else "fundamentals_available: false (do not invent revenue/earnings claims)"
    )
    return f"""
Explain the research signal for {ticker}.

Computed overallScore: {overall_score}
Computed signal code: {signal}
Display label: {meta['label']}
Evidence phrasing to match: {meta['evidence']}

Market snapshot:
- Price: ${price}
- Daily change: {change_pct:+.2f}%
- {pe_line}
- {fund_line}
- Company-relevant headlines in window: {company_news_count}
- Market/sector headlines in window: {market_news_count}

Suggested factor scores (you may adjust modestly, but stay consistent with the signal):
{json.dumps(factor_scores)}

Headlines:
{news_block}

Write analysisText that matches the computed signal (score {overall_score}/100, {meta['label']}).
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


def _heuristic_factor_scores(
    *,
    change_pct: float,
    pe_ratio: float,
    pe_available: bool,
    fundamentals_available: bool,
    headlines: list[str],
) -> dict[str, int]:
    # Simple deterministic seed scores when LLM is unavailable or as prompt hints.
    momentum = 50 + max(-25, min(25, int(change_pct * 4)))
    technical = 48 + max(-20, min(20, int(change_pct * 3)))
    bullish_words = ("surge", "jump", "beat", "record", "growth", "rally", "upgrade")
    bearish_words = ("fall", "drop", "miss", "cut", "lawsuit", "probe", "downgrade", "weak")
    joined = " ".join(headlines).lower()
    sentiment = 50
    sentiment += sum(4 for w in bullish_words if w in joined)
    sentiment -= sum(4 for w in bearish_words if w in joined)
    sentiment = max(20, min(80, sentiment))

    if fundamentals_available and pe_available and pe_ratio > 0:
        # Soft heuristic only — not a valuation verdict.
        fundamentals = 55 if 5 <= pe_ratio <= 40 else 45
    else:
        fundamentals = 45  # limited data quality marker

    growth = 50
    if any(w in joined for w in ("ai", "growth", "expand", "demand")):
        growth += 8
    if any(w in joined for w in ("slowdown", "cut", "layoff", "guidance cut")):
        growth -= 8

    return normalize_factor_scores(
        {
            "momentum": momentum,
            "fundamentals": fundamentals,
            "sentiment": sentiment,
            "technical": technical,
            "growth": growth,
        }
    )


def _template_analysis_text(
    ticker: str,
    score: int,
    signal: str,
    *,
    fundamentals_available: bool,
    why: list[str],
) -> str:
    meta = signal_display(signal)
    why_clause = (why[0] if why else "mixed factor inputs across the model").rstrip(".")
    if why_clause and why_clause[0].isupper():
        why_clause = why_clause[0].lower() + why_clause[1:]
    fund_clause = (
        "Fundamental data is limited in this version, so this score relies more heavily "
        "on market momentum, technical indicators, and news sentiment."
        if not fundamentals_available
        else "Available company data inputs were incorporated into Fundamentals/Data Quality."
    )
    return (
        f"{ticker} is currently showing a {meta['label']} with a score of {score}/100. "
        f"This means {meta['evidence']}, mainly because {why_clause}. "
        f"{fund_clause} "
        "This is a research signal, not a trade recommendation."
    )


def _sources_used(*, used_openrouter: bool, fundamentals_available: bool) -> list[str]:
    sources = [
        "Finnhub / Polygon price snapshot",
        "Finnhub company news",
        "Internal technical + momentum scoring engine",
    ]
    if fundamentals_available:
        sources.append("Limited company profile metrics (when available)")
    if used_openrouter:
        sources.append("OpenRouter explanation model")
    else:
        sources.append("Deterministic template explanation (OpenRouter fallback)")
    return sources


def _assemble_payload(
    *,
    symbol: str,
    factor_scores: dict[str, int],
    analysis_text: str,
    news_items: list[dict[str, str]],
    key_risks: list[str],
    key_catalysts: list[str],
    change_pct: float,
    fundamentals_available: bool,
    company_news_count: int,
    used_openrouter: bool,
) -> dict[str, Any]:
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
        company_news_count=company_news_count,
    )
    return {
        "ticker": symbol,
        "overallScore": overall,
        "signal": signal,
        "signalLabel": meta["label"],
        "signalShort": meta["short"],
        "signalTone": meta["tone"],
        "analysisText": analysis_text.strip(),
        "scoreInterpretation": score_interpretation(overall, signal),
        "scores": factor_scores,
        "newsItems": news_items,
        "keyRisks": key_risks[:5],
        "keyCatalysts": key_catalysts[:5],
        "whyThisSignal": why,
        "whatCouldChange": build_what_could_change(
            signal,
            fundamentals_available=fundamentals_available,
        ),
        "dataLimitations": build_data_limitations(
            fundamentals_available=fundamentals_available,
            used_template=not used_openrouter,
        ),
        "fundamentalsAvailable": fundamentals_available,
        "sourcesUsed": _sources_used(
            used_openrouter=used_openrouter,
            fundamentals_available=fundamentals_available,
        ),
        "explanationSource": "openrouter" if used_openrouter else "template",
        "generatedAt": datetime.now(tz=timezone.utc),
    }


def _get_cached(ticker: str) -> dict[str, Any] | None:
    entry = _analysis_cache.get(ticker)
    if not entry:
        return None
    expires_at, payload = entry
    if datetime.now(tz=timezone.utc) >= expires_at:
        _analysis_cache.pop(ticker, None)
        return None

    scores = normalize_factor_scores(payload.get("scores"))
    fundamentals_available = bool(payload.get("fundamentalsAvailable", False))
    overall = compute_composite_score(
        scores,
        fundamentals_available=fundamentals_available,
    )
    signal = signal_from_score(overall)
    meta = signal_display(signal)
    refreshed = {
        **payload,
        "scores": scores,
        "overallScore": overall,
        "signal": signal,
        "signalLabel": meta["label"],
        "signalShort": meta["short"],
        "signalTone": meta["tone"],
        "scoreInterpretation": score_interpretation(overall, signal),
    }
    _analysis_cache[ticker] = (expires_at, refreshed)
    return refreshed


def _set_cache(ticker: str, payload: dict[str, Any]) -> None:
    _analysis_cache[ticker] = (
        datetime.now(tz=timezone.utc) + timedelta(minutes=_CACHE_MINUTES),
        payload,
    )


def _strip_forbidden_trade_words(text: str) -> str:
    """Soft cleanup so template/LLM slips don't read like trade orders."""
    replacements = [
        (r"\byou should (buy|sell|hold)\b", "current evidence suggests caution"),
        (r"\bgood idea to buy\b", "evidence is not a personal investment directive"),
        (r"\bfinancial advice\b", "research commentary"),
        (r"\bprice target\b", "price outlook context"),
        (r"\bguaranteed\b", "uncertain"),
    ]
    cleaned = text
    for pattern, repl in replacements:
        cleaned = re.sub(pattern, repl, cleaned, flags=re.IGNORECASE)
    return cleaned


async def get_ai_analysis(
    ticker: str,
    price: float,
    change_pct: float,
    pe_ratio: float,
    headlines: list[str],
    *,
    company_news_count: int = 0,
    market_news_count: int = 0,
    fundamentals_available: bool = False,
    force: bool = False,
) -> dict[str, Any]:
    symbol = ticker.strip().upper()
    if not symbol:
        raise HTTPException(status_code=400, detail="Ticker is required")

    pe_available = fundamentals_available and pe_ratio > 0
    seed_scores = _heuristic_factor_scores(
        change_pct=change_pct,
        pe_ratio=pe_ratio,
        pe_available=pe_available,
        fundamentals_available=fundamentals_available,
        headlines=headlines,
    )

    if not force:
        cached = _get_cached(symbol)
        if cached is not None:
            return cached

    # Even without OpenRouter, always return a usable research payload.
    if not settings.openrouter_api_key:
        overall_seed = compute_composite_score(
            seed_scores,
            fundamentals_available=fundamentals_available,
        )
        signal_seed = signal_from_score(overall_seed)
        why = build_why_this_signal(
            seed_scores,
            change_pct=change_pct,
            fundamentals_available=fundamentals_available,
            company_news_count=company_news_count,
        )
        payload = _assemble_payload(
            symbol=symbol,
            factor_scores=seed_scores,
            analysis_text=_template_analysis_text(
                symbol,
                overall_seed,
                signal_seed,
                fundamentals_available=fundamentals_available,
                why=why,
            ),
            news_items=[
                {"headline": h, "sentiment": "neutral"} for h in headlines[:8]
            ],
            key_risks=[
                "Market and sector volatility can reverse short-term evidence quickly.",
                "Free-tier data may omit important company fundamentals.",
            ],
            key_catalysts=[
                "Clearer company-specific news flow",
                "Improved technical trend confirmation",
            ],
            change_pct=change_pct,
            fundamentals_available=fundamentals_available,
            company_news_count=company_news_count,
            used_openrouter=False,
        )
        _set_cache(symbol, payload)
        return payload

    overall_hint = compute_composite_score(
        seed_scores,
        fundamentals_available=fundamentals_available,
    )
    signal_hint = signal_from_score(overall_hint)
    model = settings.openrouter_model or _DEFAULT_MODEL
    prompt = _build_user_prompt(
        ticker=symbol,
        price=price,
        change_pct=change_pct,
        pe=pe_ratio,
        pe_available=pe_available,
        fundamentals_available=fundamentals_available,
        headlines=headlines[:10],
        company_news_count=company_news_count,
        market_news_count=market_news_count,
        signal=signal_hint,
        overall_score=overall_hint,
        factor_scores=seed_scores,
    )

    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://vectra-green.vercel.app",
        "X-Title": "Vectra Research Signals",
    }
    body = {
        "model": model,
        "temperature": 0.2,
        "max_tokens": 1400,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
    }

    used_openrouter = False
    raw: dict[str, Any] = {}
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(_OPENROUTER_URL, headers=headers, json=body)
        if response.status_code < 400:
            content = response.json()["choices"][0]["message"]["content"]
            raw = _extract_json(content)
            used_openrouter = True
    except (httpx.HTTPError, KeyError, IndexError, TypeError, json.JSONDecodeError):
        used_openrouter = False
        raw = {}

    if used_openrouter:
        scores_raw = raw.get("scores") if isinstance(raw.get("scores"), dict) else {}
        factor_scores = normalize_factor_scores({**seed_scores, **scores_raw})
        if not fundamentals_available:
            # Cap invented confidence when filings aren't available.
            factor_scores["fundamentals"] = min(factor_scores["fundamentals"], 50)
        news_raw = raw.get("newsItems") if isinstance(raw.get("newsItems"), list) else []
        news_items = [
            {
                "headline": str(item.get("headline") or "").strip(),
                "sentiment": _normalize_sentiment(item.get("sentiment")),
            }
            for item in news_raw
            if isinstance(item, dict) and str(item.get("headline") or "").strip()
        ] or [{"headline": h, "sentiment": "neutral"} for h in headlines[:8]]
        key_risks = [
            str(r).strip()
            for r in (raw.get("keyRisks") or [])
            if str(r).strip()
        ][:5] or [
            "Evidence can change quickly with new headlines or price structure.",
            "Data limitations in free market APIs may omit material facts.",
        ]
        key_catalysts = [
            str(c).strip()
            for c in (raw.get("keyCatalysts") or [])
            if str(c).strip()
        ][:5] or [
            "Stronger company-specific information flow",
            "Improved technical confirmation",
        ]
        overall = compute_composite_score(
            factor_scores,
            fundamentals_available=fundamentals_available,
        )
        signal = signal_from_score(overall)
        why = build_why_this_signal(
            factor_scores,
            change_pct=change_pct,
            fundamentals_available=fundamentals_available,
            company_news_count=company_news_count,
        )
        analysis_text = _strip_forbidden_trade_words(
            str(raw.get("analysisText") or "").strip()
        )
        if not analysis_text:
            analysis_text = _template_analysis_text(
                symbol,
                overall,
                signal,
                fundamentals_available=fundamentals_available,
                why=why,
            )
        # Ensure score/label appear when model omits them.
        meta = signal_display(signal)
        if meta["short"].split()[0].lower() not in analysis_text.lower() and str(overall) not in analysis_text:
            analysis_text = (
                f"{symbol} is currently showing a {meta['label']} with a score of "
                f"{overall}/100. "
            ) + analysis_text
        if "research signal" not in analysis_text.lower() and "not a trade" not in analysis_text.lower():
            analysis_text += " This is a research signal, not a trade recommendation."
    else:
        factor_scores = seed_scores
        overall = compute_composite_score(
            factor_scores,
            fundamentals_available=fundamentals_available,
        )
        signal = signal_from_score(overall)
        why = build_why_this_signal(
            factor_scores,
            change_pct=change_pct,
            fundamentals_available=fundamentals_available,
            company_news_count=company_news_count,
        )
        analysis_text = _template_analysis_text(
            symbol,
            overall,
            signal,
            fundamentals_available=fundamentals_available,
            why=why,
        )
        news_items = [{"headline": h, "sentiment": "neutral"} for h in headlines[:8]]
        key_risks = [
            "Market and sector volatility can reverse short-term evidence quickly.",
            "Free-tier data may omit important company fundamentals.",
        ]
        key_catalysts = [
            "Clearer company-specific news flow",
            "Improved technical trend confirmation",
        ]

    payload = _assemble_payload(
        symbol=symbol,
        factor_scores=factor_scores,
        analysis_text=analysis_text,
        news_items=news_items,
        key_risks=key_risks,
        key_catalysts=key_catalysts,
        change_pct=change_pct,
        fundamentals_available=fundamentals_available,
        company_news_count=company_news_count,
        used_openrouter=used_openrouter,
    )
    _set_cache(symbol, payload)
    return payload

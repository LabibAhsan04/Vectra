"""OpenRouter explanation layer — explains structured scores, never invents filings."""

from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

from config import settings
from services.scoring import signal_display

_OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
_DEFAULT_MODEL = "openrouter/free"
_CACHE_MINUTES = 45
_explanation_cache: dict[str, tuple[datetime, str, str]] = {}

SYSTEM_PROMPT = """
You are a research analyst for Vectra, an evidence-based stock SIGNAL intelligence tool.
You ONLY explain structured research signals. You do NOT give financial advice or trade commands.

Hard rules:
1. Use ONLY the structured JSON evidence. Do NOT invent earnings, partnerships, product launches,
   revenue growth, margins, debt, analyst upgrades, or other filings unless present in the input.
2. If fundamentalsAvailable is false, say fundamental data is limited.
3. Never use the words: buy, sell, hold, BUY, SELL, HOLD, guaranteed, price target,
   investor action, should invest, good entry, upside (unless evidence explicitly uses it).
4. Use research phrasing: "Bullish Signal", "Neutral Signal", "Bearish Signal",
   current evidence, signal strength, short-term momentum, market context, limited data.
5. Match the provided finalScore and signalLabel (public research labels only).
6. Keep explanation under 150 words.
7. keyCatalysts must ONLY use evidence-based phrasing (price/volume/MA/sector headlines).
   Do not invent upcoming earnings, product releases, or partnerships.
8. keyRisks must be evidence-based (limited data, MA softness, mixed sentiment, sector volatility).

Return ONLY valid JSON:
{
  "analysisText": "<under 150 words>",
  "keyRisks": ["...", "..."],
  "keyCatalysts": ["...", "..."]
}
"""

_SAFE_CATALYSTS = [
    "Positive price momentum and increased volume",
    "Sector-level AI and semiconductor demand tailwinds",
    "Company-specific news could strengthen the signal if confirmed",
    "Improved technical structure if price remains above moving averages",
]

_SAFE_RISKS = [
    "Limited fundamental data reduces confidence",
    "Neutral sentiment may weaken the signal",
    "MA20 below MA50 may indicate short-term technical softness",
    "Sector volatility could increase risk",
    "Broad market news may not directly reflect company-specific strength",
]


def signal_hash(ticker: str, final_score: int, signal_label: str) -> str:
    raw = f"{ticker.upper()}|{final_score}|{signal_label}"
    return hashlib.sha256(raw.encode()).hexdigest()[:24]


def get_cached_explanation(ticker: str, signal_hash_value: str) -> str | None:
    key = f"{ticker.upper()}:{signal_hash_value}"
    entry = _explanation_cache.get(key)
    if not entry:
        return None
    expires_at, text, _source = entry
    if datetime.now(tz=timezone.utc) >= expires_at:
        _explanation_cache.pop(key, None)
        return None
    return text


def set_cached_explanation(
    ticker: str,
    signal_hash_value: str,
    text: str,
    *,
    source: str,
) -> None:
    key = f"{ticker.upper()}:{signal_hash_value}"
    _explanation_cache[key] = (
        datetime.now(tz=timezone.utc) + timedelta(minutes=_CACHE_MINUTES),
        text,
        source,
    )


def _pick_catalysts(signal_data: dict[str, Any]) -> list[str]:
    scores = signal_data.get("scores") or {}
    picks: list[str] = []
    if int(scores.get("momentum", 50)) >= 55:
        picks.append(_SAFE_CATALYSTS[0])
    if int(scores.get("growth", 50)) >= 55:
        picks.append(_SAFE_CATALYSTS[1])
    picks.append(_SAFE_CATALYSTS[2])
    if int(scores.get("technical", 50)) >= 50:
        picks.append(_SAFE_CATALYSTS[3])
    # Dedupe preserve order
    seen: set[str] = set()
    out: list[str] = []
    for item in picks:
        if item not in seen:
            seen.add(item)
            out.append(item)
    return out[:4] or _SAFE_CATALYSTS[:3]


def _pick_risks(signal_data: dict[str, Any]) -> list[str]:
    scores = signal_data.get("scores") or {}
    picks: list[str] = []
    if not signal_data.get("fundamentalsAvailable", False):
        picks.append(_SAFE_RISKS[0])
    if int(scores.get("sentiment", 50)) <= 55:
        picks.append(_SAFE_RISKS[1])
    notes = " ".join(
        str(n)
        for row in (signal_data.get("scoreBreakdown") or [])
        for n in (row.get("notes") or [])
    ).lower()
    if "ma20 is below ma50" in notes or int(scores.get("technical", 50)) < 50:
        picks.append(_SAFE_RISKS[2])
    picks.append(_SAFE_RISKS[3])
    if signal_data.get("marketHeadlines"):
        picks.append(_SAFE_RISKS[4])
    seen: set[str] = set()
    out: list[str] = []
    for item in picks:
        if item not in seen:
            seen.add(item)
            out.append(item)
    return out[:4] or _SAFE_RISKS[:3]


def generate_template_explanation(signal_data: dict[str, Any]) -> str:
    ticker = str(signal_data.get("ticker", "")).upper()
    score = int(signal_data.get("finalScore") or signal_data.get("overallScore") or 50)
    signal = str(signal_data.get("signal") or "neutral")
    meta = signal_display(signal)
    label = meta["label"]
    scores = signal_data.get("scores") or {}
    momentum = int(scores.get("momentum", 50))
    technical = int(scores.get("technical", 50))
    sentiment = int(scores.get("sentiment", 50))
    growth = int(scores.get("growth", 50))

    drivers: list[str] = []
    if momentum >= max(technical, sentiment, growth):
        drivers.append(
            "The strongest driver is momentum, supported by near-term price action "
            "and relative volume context"
        )
    elif technical >= max(momentum, sentiment, growth):
        drivers.append(
            "The strongest driver is technical structure from moving-average and RSI context"
        )
    else:
        drivers.append("Evidence is mixed across momentum, technicals, and sentiment")

    mid = (
        f"Technical evidence is {'moderately positive' if technical >= 55 else 'mixed'}, "
        f"while sentiment and growth signals are "
        f"{'constructive' if min(sentiment, growth) >= 55 else 'mixed'}."
    )
    fund = (
        "Fundamental data is limited, so this signal relies mainly on price action, "
        "technical indicators, and recent news context."
    )
    return (
        f"The current evidence for {ticker} shows a {label} with a {score}/100 score. "
        f"{drivers[0]}. {mid} {fund}"
    )


def _extract_json(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", cleaned)
    if fence:
        cleaned = fence.group(1).strip()
    return json.loads(cleaned)


def _strip_forbidden(text: str) -> str:
    patterns = [
        (r"\b(strong\s+)?buy\b", "bullish evidence"),
        (r"\b(strong\s+)?sell\b", "bearish evidence"),
        (r"\bhold\b", "neutral evidence"),
        (r"\bbuy zone\b", "constructive zone"),
        (r"\bgood entry\b", "improving technical context"),
        (r"\binvestor action\b", "research context"),
        (r"\byou should (buy|sell|invest)\b", "the evidence alone is not a personal directive"),
        (r"\bprice target\b", "price outlook context"),
        (r"\bguaranteed\b", "uncertain"),
    ]
    cleaned = text
    for pattern, repl in patterns:
        cleaned = re.sub(pattern, repl, cleaned, flags=re.IGNORECASE)
    return cleaned


def _sanitize_list(items: list[str], *, fallback: list[str]) -> list[str]:
    forbidden = re.compile(
        r"\b(buy|sell|hold|earnings|partnership|product launch|revenue growth|"
        r"price target|guaranteed|should invest)\b",
        re.I,
    )
    cleaned = [_strip_forbidden(i) for i in items if i and not forbidden.search(i)]
    return (cleaned or fallback)[:4]


def _word_count(text: str) -> int:
    return len(re.findall(r"\b\w+\b", text))


async def explain_signal_with_openrouter(signal_data: dict[str, Any]) -> dict[str, Any]:
    """Return {analysisText, keyRisks, keyCatalysts, explanationSource}."""
    ticker = str(signal_data.get("ticker", "")).upper()
    score = int(signal_data.get("finalScore") or signal_data.get("overallScore") or 50)
    signal = str(signal_data.get("signal") or "neutral")
    meta = signal_display(signal)
    label = meta["label"]
    hash_value = signal_hash(ticker, score, label)

    default_risks = _pick_risks(signal_data)
    default_catalysts = _pick_catalysts(signal_data)

    cached = get_cached_explanation(ticker, hash_value)
    if cached and not signal_data.get("force"):
        return {
            "analysisText": cached,
            "keyRisks": default_risks,
            "keyCatalysts": default_catalysts,
            "explanationSource": "cache",
        }

    template = generate_template_explanation(signal_data)

    if not settings.openrouter_api_key:
        set_cached_explanation(ticker, hash_value, template, source="template")
        return {
            "analysisText": template,
            "keyRisks": default_risks,
            "keyCatalysts": default_catalysts,
            "explanationSource": "template",
        }

    model = settings.openrouter_model or _DEFAULT_MODEL
    user_payload = {
        "ticker": ticker,
        "finalScore": score,
        "signalLabel": label,
        "factorScores": signal_data.get("scores") or {},
        "scoreBreakdown": signal_data.get("scoreBreakdown") or [],
        "whyThisSignal": signal_data.get("whyThisSignal") or [],
        "fundamentalsAvailable": bool(signal_data.get("fundamentalsAvailable", False)),
        "changePct": signal_data.get("changePct"),
        "companyHeadlines": (signal_data.get("companyHeadlines") or [])[:8],
        "marketHeadlines": (signal_data.get("marketHeadlines") or [])[:6],
        "allowedCatalystExamples": _SAFE_CATALYSTS,
        "allowedRiskExamples": _SAFE_RISKS,
    }
    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://vectra-green.vercel.app",
        "X-Title": "Vectra Research Signals",
    }
    body = {
        "model": model,
        "temperature": 0.2,
        "max_tokens": 700,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    "Explain this structured research signal using public Bullish/Neutral/"
                    "Bearish Signal wording only. Do not invent facts.\n"
                    + json.dumps(user_payload, default=str)
                ),
            },
        ],
    }

    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            response = await client.post(_OPENROUTER_URL, headers=headers, json=body)
        if response.status_code >= 400:
            raise RuntimeError(f"OpenRouter HTTP {response.status_code}")
        content = response.json()["choices"][0]["message"]["content"]
        raw = _extract_json(content)
        text = _strip_forbidden(str(raw.get("analysisText") or "").strip())
        if not text or _word_count(text) > 170:
            text = template
        risks = _sanitize_list(
            [str(r).strip() for r in (raw.get("keyRisks") or []) if str(r).strip()],
            fallback=default_risks,
        )
        catalysts = _sanitize_list(
            [str(c).strip() for c in (raw.get("keyCatalysts") or []) if str(c).strip()],
            fallback=default_catalysts,
        )
        set_cached_explanation(ticker, hash_value, text, source="openrouter")
        return {
            "analysisText": text,
            "keyRisks": risks,
            "keyCatalysts": catalysts,
            "explanationSource": "openrouter",
        }
    except Exception:
        set_cached_explanation(ticker, hash_value, template, source="template")
        return {
            "analysisText": template,
            "keyRisks": default_risks,
            "keyCatalysts": default_catalysts,
            "explanationSource": "template",
        }

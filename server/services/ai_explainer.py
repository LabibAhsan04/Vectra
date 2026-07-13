"""OpenRouter explanation layer — explains structured scores, never invents filings."""

from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

from config import settings
from services.scoring import score_interpretation, signal_display

_OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
_DEFAULT_MODEL = "openrouter/free"
_CACHE_MINUTES = 45
_explanation_cache: dict[str, tuple[datetime, str, str]] = {}

SYSTEM_PROMPT = """
You are a research analyst for Vectra, an evidence-based stock SIGNAL intelligence tool.
You ONLY explain structured research signals. You do NOT give financial advice or trade commands.

Hard rules:
1. Use ONLY the structured JSON evidence provided. Do NOT invent: revenue growth, profit growth,
   partnerships, earnings, analyst upgrades, product launches, margins, debt, customer deals,
   market share, or future predictions unless those exact facts appear in the input evidence.
2. If fundamentalsAvailable is false, say fundamental data is limited. Do not claim company
   fundamentals you were not given.
3. Never use: buy, sell, hold, guaranteed, price target, financial advice,
   "you should invest", or similar trade instructions.
4. Use research phrasing: Bullish / Neutral / Bearish research signal, momentum, risks, limitations.
5. Match the provided finalScore and signalLabel. Do not contradict them.
6. Explain both supportive evidence and risks. Beginner-friendly language.
7. Keep explanation under 150 words.

Return ONLY valid JSON:
{
  "analysisText": "<under 150 words>",
  "keyRisks": ["...", "..."],
  "keyCatalysts": ["...", "..."]
}
"""


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


def generate_template_explanation(signal_data: dict[str, Any]) -> str:
    ticker = str(signal_data.get("ticker", "")).upper()
    score = int(signal_data.get("finalScore") or signal_data.get("overallScore") or 50)
    signal = str(signal_data.get("signal") or "neutral")
    meta = signal_display(signal)
    fundamentals_available = bool(signal_data.get("fundamentalsAvailable", False))
    why = signal_data.get("whyThisSignal") or signal_data.get("why") or []
    why_clause = (why[0] if why else "mixed evidence across the scoring model").rstrip(".")
    if why_clause and why_clause[0].isupper():
        why_clause = why_clause[0].lower() + why_clause[1:]
    fund_clause = (
        "Fundamental data is limited in this version, so this reading relies mainly on "
        "price momentum, technical indicators, and recent news."
        if not fundamentals_available
        else "Available company data inputs were incorporated into Fundamentals/Data Quality."
    )
    return (
        f"{ticker} currently shows a {meta['label']} with a score of {score}/100. "
        f"This means {meta['evidence']}, mainly because {why_clause}. "
        f"{fund_clause} "
        "Vectra generates research signals only — not financial advice."
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
        (r"\byou should (buy|sell|invest)\b", "the evidence alone is not a personal directive"),
        (r"\bfinancial advice\b", "research commentary"),
        (r"\bprice target\b", "price outlook context"),
        (r"\bguaranteed\b", "uncertain"),
    ]
    cleaned = text
    for pattern, repl in patterns:
        cleaned = re.sub(pattern, repl, cleaned, flags=re.IGNORECASE)
    return cleaned


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

    cached = get_cached_explanation(ticker, hash_value)
    if cached and not signal_data.get("force"):
        return {
            "analysisText": cached,
            "keyRisks": signal_data.get("keyRisks") or [],
            "keyCatalysts": signal_data.get("keyCatalysts") or [],
            "explanationSource": "cache",
        }

    template = generate_template_explanation(signal_data)
    default_risks = [
        "Market and sector volatility can reverse short-term evidence quickly.",
        "Free-tier data may omit important company fundamentals.",
    ]
    default_catalysts = [
        "Clearer company-specific news flow",
        "Improved technical trend confirmation",
    ]

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
        "signal": signal,
        "signalLabel": label,
        "scoreInterpretation": score_interpretation(score, signal),
        "factorScores": signal_data.get("scores") or {},
        "scoreBreakdown": signal_data.get("scoreBreakdown") or [],
        "whyThisSignal": signal_data.get("whyThisSignal") or [],
        "fundamentalsAvailable": bool(signal_data.get("fundamentalsAvailable", False)),
        "changePct": signal_data.get("changePct"),
        "price": signal_data.get("price"),
        "companyHeadlines": (signal_data.get("companyHeadlines") or [])[:8],
        "marketHeadlines": (signal_data.get("marketHeadlines") or [])[:6],
        "dataLimitations": signal_data.get("dataLimitations") or [],
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
                    "Explain this structured research signal. Do not invent facts.\n"
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
        risks = [
            str(r).strip()
            for r in (raw.get("keyRisks") or [])
            if str(r).strip()
        ][:5] or default_risks
        catalysts = [
            str(c).strip()
            for c in (raw.get("keyCatalysts") or [])
            if str(c).strip()
        ][:5] or default_catalysts
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

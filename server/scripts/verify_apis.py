#!/usr/bin/env python3
"""Verify all external API keys configured in .env."""

from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(ROOT / ".env")


def ok(name: str, detail: str = "") -> None:
    suffix = f" — {detail}" if detail else ""
    print(f"  ✓ {name}{suffix}")


def fail(name: str, detail: str) -> None:
    print(f"  ✗ {name}: {detail}")


def missing(name: str) -> bool:
    value = os.getenv(name, "").strip()
    if not value or value.startswith("your_"):
        fail(name, "not set in .env (copy .env.example and add your key)")
        return True
    return False


def test_polygon() -> bool:
    print("\n[Polygon.io]")
    if missing("POLYGON_API_KEY"):
        return False
    try:
        from polygon import RESTClient

        client = RESTClient(api_key=os.environ["POLYGON_API_KEY"])
        # Free tier: previous-day aggregate (snapshots often require a paid plan)
        aggs = list(client.get_previous_close_agg("NVDA"))
        if not aggs:
            fail("POLYGON_API_KEY", "no previous-close data returned")
            return False
        price = aggs[0].close
        ok("POLYGON_API_KEY", f"NVDA previous close ${price:.2f}")
        return True
    except Exception as exc:
        fail("POLYGON_API_KEY", str(exc))
        return False


def test_finnhub() -> bool:
    print("\n[Finnhub]")
    if missing("FINNHUB_API_KEY"):
        return False
    try:
        import finnhub

        client = finnhub.Client(api_key=os.environ["FINNHUB_API_KEY"])
        quote = client.quote("NVDA")
        if quote.get("c") is None:
            fail("FINNHUB_API_KEY", "unexpected response")
            return False
        ok("FINNHUB_API_KEY", f"NVDA current price ${quote['c']:.2f}")
        return True
    except Exception as exc:
        fail("FINNHUB_API_KEY", str(exc))
        return False


def test_openrouter() -> bool:
    print("\n[OpenRouter]")
    if missing("OPENROUTER_API_KEY"):
        return False
    try:
        import httpx

        response = httpx.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {os.environ['OPENROUTER_API_KEY']}",
                "Content-Type": "application/json",
            },
            json={
                "model": "openai/gpt-4o-mini",
                "messages": [{"role": "user", "content": "Reply with the single word: ok"}],
                "max_tokens": 16,
            },
            timeout=30,
        )
        if response.status_code == 401:
            fail("OPENROUTER_API_KEY", "unauthorized — check the key")
            return False
        response.raise_for_status()
        text = response.json()["choices"][0]["message"]["content"].strip()
        ok("OPENROUTER_API_KEY", f"model responded: {text[:40]}")
        return True
    except Exception as exc:
        fail("OPENROUTER_API_KEY", str(exc))
        return False


def test_anthropic() -> bool:
    print("\n[Anthropic Claude] (optional if OpenRouter is set)")
    value = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if not value or value.startswith("your_") or value.startswith("sk-ant-your"):
        ok("ANTHROPIC_API_KEY", "skipped — using OpenRouter instead")
        return True
    try:
        import anthropic

        client = anthropic.Anthropic(api_key=value)
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=32,
            messages=[{"role": "user", "content": "Reply with the single word: ok"}],
        )
        text = message.content[0].text.strip()
        ok("ANTHROPIC_API_KEY", f"model responded: {text[:40]}")
        return True
    except Exception as exc:
        fail("ANTHROPIC_API_KEY", str(exc))
        return False


def test_alpha_vantage() -> bool:
    print("\n[Alpha Vantage]")
    if missing("ALPHA_VANTAGE_KEY"):
        return False
    try:
        import httpx

        response = httpx.get(
            "https://www.alphavantage.co/query",
            params={
                "function": "GLOBAL_QUOTE",
                "symbol": "NVDA",
                "apikey": os.environ["ALPHA_VANTAGE_KEY"],
            },
            timeout=15,
        )
        response.raise_for_status()
        data = response.json()
        if "Global Quote" not in data and "Note" in data:
            fail("ALPHA_VANTAGE_KEY", data["Note"])
            return False
        ok("ALPHA_VANTAGE_KEY", "GLOBAL_QUOTE endpoint reachable")
        return True
    except Exception as exc:
        fail("ALPHA_VANTAGE_KEY", str(exc))
        return False


def test_news_api() -> bool:
    print("\n[NewsAPI]")
    if missing("NEWS_API_KEY"):
        return False
    try:
        import httpx

        response = httpx.get(
            "https://newsapi.org/v2/top-headlines",
            params={"category": "business", "pageSize": 1, "apiKey": os.environ["NEWS_API_KEY"]},
            timeout=15,
        )
        response.raise_for_status()
        data = response.json()
        if data.get("status") != "ok":
            fail("NEWS_API_KEY", data.get("message", "unknown error"))
            return False
        ok("NEWS_API_KEY", f"{data.get('totalResults', 0)} business headlines available")
        return True
    except Exception as exc:
        fail("NEWS_API_KEY", str(exc))
        return False


def main() -> int:
    print("Vectra — API key verification")
    print(f"Loading env from: {ROOT / '.env'}")

    results = [
        test_polygon(),
        test_finnhub(),
        test_openrouter(),
        test_anthropic(),
        test_alpha_vantage(),
        test_news_api(),
    ]

    passed = sum(results)
    total = len(results)
    print(f"\nResult: {passed}/{total} APIs verified")

    if passed == 0:
        print("\nAdd your keys to .env (see .env.example) and run again:")
        print("  cd server && python scripts/verify_apis.py")
        return 1

    if passed < total:
        print("\nSome keys failed or are missing. Fix .env and re-run.")
        return 1

    print("\nAll API keys verified. Phase 1 complete.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

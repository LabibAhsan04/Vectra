"""Upcoming earnings / catalyst dates from Finnhub."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from services.market_data import _get_finnhub

_cache: dict[str, tuple[datetime, list[dict]]] = {}
_CACHE_MINUTES = 60


def get_upcoming_earnings(ticker: str, days_ahead: int = 45) -> list[dict]:
    symbol = ticker.strip().upper()
    cache_key = f"{symbol}:{days_ahead}"
    now = datetime.now(tz=timezone.utc)
    cached = _cache.get(cache_key)
    if cached and now < cached[0]:
        return cached[1]

    events: list[dict] = []
    try:
        client = _get_finnhub()
        start = date.today()
        end = start + timedelta(days=days_ahead)
        raw = client.earnings_calendar(
            _from=start.isoformat(),
            to=end.isoformat(),
            symbol=symbol,
            international=False,
        )
        calendar = raw.get("earningsCalendar") if isinstance(raw, dict) else []
        if isinstance(calendar, list):
            for item in calendar:
                if not isinstance(item, dict):
                    continue
                if (item.get("symbol") or "").upper() != symbol:
                    continue
                day = str(item.get("date") or "")
                hour = str(item.get("hour") or "").strip()
                events.append(
                    {
                        "ticker": symbol,
                        "date": day,
                        "eventType": "earnings",
                        "epsEstimate": item.get("epsEstimate"),
                        "revenueEstimate": item.get("revenueEstimate"),
                        "hour": hour,
                        "label": "Earnings report",
                    }
                )
    except Exception:
        pass

    events.sort(key=lambda e: e.get("date") or "")
    _cache[cache_key] = (now + timedelta(minutes=_CACHE_MINUTES), events)
    return events

"""Market data helpers — Polygon primary, Finnhub/Alpha Vantage fallbacks."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException
from polygon import RESTClient
import finnhub
import httpx

from config import settings
from schemas.stock_schema import StockQuote, PriceHistory

_polygon_client: RESTClient | None = None
_finnhub_client: finnhub.Client | None = None

# ticker|range -> (expires_at, payload)
_history_cache: dict[str, tuple[datetime, PriceHistory]] = {}
_HISTORY_CACHE_MINUTES = 15


def _get_polygon() -> RESTClient:
    global _polygon_client
    if _polygon_client is None:
        if not settings.polygon_api_key:
            raise HTTPException(
                status_code=500,
                detail="POLYGON_API_KEY is not configured",
            )
        _polygon_client = RESTClient(api_key=settings.polygon_api_key)
    return _polygon_client


def _get_finnhub() -> finnhub.Client:
    global _finnhub_client
    if _finnhub_client is None:
        if not settings.finnhub_api_key:
            raise HTTPException(
                status_code=500,
                detail="FINNHUB_API_KEY is not configured",
            )
        _finnhub_client = finnhub.Client(api_key=settings.finnhub_api_key)
    return _finnhub_client


def _quote_from_polygon(symbol: str) -> StockQuote:
    client = _get_polygon()
    details = client.get_ticker_details(symbol)

    end = date.today()
    start = end - timedelta(days=400)
    bars = list(
        client.get_aggs(
            symbol,
            1,
            "day",
            start,
            end,
            adjusted=True,
            sort="asc",
            limit=50000,
        )
    )
    if len(bars) < 1:
        raise ValueError(f"No price data available for '{symbol}'")

    latest = bars[-1]
    previous = bars[-2] if len(bars) >= 2 else None

    price = float(latest.close)
    prior_close = float(previous.close) if previous else float(latest.open)
    change = price - prior_close
    change_pct = (change / prior_close * 100.0) if prior_close else 0.0

    highs = [float(b.high) for b in bars if b.high is not None]
    lows = [float(b.low) for b in bars if b.low is not None]

    ts_ms = getattr(latest, "timestamp", None)
    if isinstance(ts_ms, (int, float)):
        timestamp = datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc)
    else:
        timestamp = datetime.now(tz=timezone.utc)

    return StockQuote(
        ticker=symbol,
        companyName=getattr(details, "name", None) or symbol,
        price=round(price, 2),
        change=round(change, 2),
        changePct=round(change_pct, 2),
        volume=int(latest.volume or 0),
        marketCap=float(getattr(details, "market_cap", None) or 0.0),
        peRatio=0.0,
        weekHigh52=round(max(highs), 2) if highs else price,
        weekLow52=round(min(lows), 2) if lows else price,
        timestamp=timestamp,
    )


def _quote_from_finnhub(symbol: str) -> StockQuote:
    client = _get_finnhub()
    quote = client.quote(symbol)
    profile = client.company_profile2(symbol=symbol) or {}

    price = float(quote.get("c") or 0)
    if price <= 0:
        raise ValueError(f"No Finnhub quote for '{symbol}'")

    change = float(quote.get("d") or 0)
    change_pct = float(quote.get("dp") or 0)
    timestamp = datetime.now(tz=timezone.utc)
    ts = quote.get("t")
    if isinstance(ts, (int, float)) and ts > 0:
        timestamp = datetime.fromtimestamp(ts, tz=timezone.utc)

    market_cap = float(profile.get("marketCapitalization") or 0) * 1_000_000

    return StockQuote(
        ticker=symbol,
        companyName=str(profile.get("name") or symbol),
        price=round(price, 2),
        change=round(change, 2),
        changePct=round(change_pct, 2),
        volume=0,
        marketCap=market_cap,
        peRatio=0.0,
        weekHigh52=round(float(quote.get("h") or price), 2),
        weekLow52=round(float(quote.get("l") or price), 2),
        timestamp=timestamp,
    )


def get_stock_quote(ticker: str) -> StockQuote:
    """Return a StockQuote. Prefer Polygon; fall back to Finnhub on errors/rate limits."""
    symbol = ticker.strip().upper()
    if not symbol:
        raise HTTPException(status_code=400, detail="Ticker is required")

    polygon_error: Exception | None = None
    try:
        return _quote_from_polygon(symbol)
    except Exception as exc:
        polygon_error = exc

    try:
        return _quote_from_finnhub(symbol)
    except Exception as finnhub_error:
        detail = (
            f"Unable to fetch quote for '{symbol}'. "
            f"Polygon: {polygon_error}; Finnhub: {finnhub_error}"
        )
        raise HTTPException(status_code=502, detail=detail) from finnhub_error


_RANGE_DAYS: dict[str, int] = {
    "1M": 31,
    "3M": 93,
    "6M": 186,
    "1Y": 370,
    "5Y": 365 * 5 + 10,
}


def _bar_timestamp(bar: object) -> datetime:
    ts_ms = getattr(bar, "timestamp", None)
    if isinstance(ts_ms, (int, float)):
        return datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc)
    return datetime.now(tz=timezone.utc)


def _safe_float(value: object, default: float | None = None) -> float | None:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _point_from_ohlc(
    day: str,
    open_: object,
    high: object,
    low: object,
    close: object,
    volume: object = 0,
) -> dict[str, Any] | None:
    close_v = _safe_float(close)
    if close_v is None:
        return None
    open_v = _safe_float(open_, close_v)
    high_v = _safe_float(high, close_v)
    low_v = _safe_float(low, close_v)
    assert open_v is not None and high_v is not None and low_v is not None
    high_v = max(high_v, open_v, close_v, low_v)
    low_v = min(low_v, open_v, close_v, high_v)
    try:
        vol = int(volume or 0)
    except (TypeError, ValueError):
        vol = 0
    return {
        "date": day,
        "open": round(open_v, 2),
        "high": round(high_v, 2),
        "low": round(low_v, 2),
        "close": round(close_v, 2),
        "volume": vol,
    }


def _dedupe_points(points: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_date: dict[str, dict[str, Any]] = {}
    for point in points:
        day = str(point.get("date") or "")
        if day:
            by_date[day] = point
    return [by_date[day] for day in sorted(by_date)]


def _filter_points_by_days(
    points: list[dict[str, Any]], days: int
) -> list[dict[str, Any]]:
    if not points:
        return points
    cutoff = (date.today() - timedelta(days=days)).isoformat()
    return [p for p in points if str(p["date"]) >= cutoff]


def _get_cached_history(cache_key: str) -> PriceHistory | None:
    entry = _history_cache.get(cache_key)
    if not entry:
        return None
    expires_at, payload = entry
    if datetime.now(tz=timezone.utc) >= expires_at:
        _history_cache.pop(cache_key, None)
        return None
    return payload


def _set_cached_history(cache_key: str, payload: PriceHistory) -> None:
    _history_cache[cache_key] = (
        datetime.now(tz=timezone.utc) + timedelta(minutes=_HISTORY_CACHE_MINUTES),
        payload,
    )


def _history_from_polygon(symbol: str, range_key: str, days: int) -> PriceHistory:
    client = _get_polygon()
    end = date.today()
    start = end - timedelta(days=days)
    bars = list(
        client.get_aggs(
            symbol,
            1,
            "day",
            start,
            end,
            adjusted=True,
            sort="asc",
            limit=50000,
        )
    )
    if not bars:
        raise ValueError(f"No Polygon history for '{symbol}'")

    points: list[dict[str, Any]] = []
    for bar in bars:
        ts = _bar_timestamp(bar)
        point = _point_from_ohlc(
            ts.date().isoformat(),
            getattr(bar, "open", None),
            getattr(bar, "high", None),
            getattr(bar, "low", None),
            getattr(bar, "close", None),
            getattr(bar, "volume", 0),
        )
        if point:
            points.append(point)

    points = _dedupe_points(points)
    if not points:
        raise ValueError(f"No usable Polygon history for '{symbol}'")

    return PriceHistory(ticker=symbol, range=range_key, points=points)


def _history_from_finnhub(symbol: str, range_key: str, days: int) -> PriceHistory:
    client = _get_finnhub()
    end = int(datetime.now(tz=timezone.utc).timestamp())
    start = end - days * 24 * 60 * 60
    candles = client.stock_candles(symbol, "D", start, end) or {}
    if candles.get("s") != "ok":
        raise ValueError(f"No Finnhub history for '{symbol}' (status={candles.get('s')})")

    timestamps = candles.get("t") or []
    opens = candles.get("o") or []
    highs = candles.get("h") or []
    lows = candles.get("l") or []
    closes = candles.get("c") or []
    volumes = candles.get("v") or []

    points: list[dict[str, Any]] = []
    for i, ts in enumerate(timestamps):
        if i >= len(closes):
            break
        day = datetime.fromtimestamp(int(ts), tz=timezone.utc).date().isoformat()
        point = _point_from_ohlc(
            day,
            opens[i] if i < len(opens) else None,
            highs[i] if i < len(highs) else None,
            lows[i] if i < len(lows) else None,
            closes[i],
            volumes[i] if i < len(volumes) else 0,
        )
        if point:
            points.append(point)

    points = _dedupe_points(points)
    if not points:
        raise ValueError(f"Empty Finnhub history for '{symbol}'")

    return PriceHistory(ticker=symbol, range=range_key, points=points)


def _history_from_alpha_vantage(
    symbol: str, range_key: str, days: int
) -> PriceHistory:
    if not settings.alpha_vantage_key:
        raise ValueError("ALPHA_VANTAGE_KEY is not configured")

    # compact ≈ 100 trading days; full needed for 1Y/5Y
    outputsize = "full" if days > 120 else "compact"
    response = httpx.get(
        "https://www.alphavantage.co/query",
        params={
            "function": "TIME_SERIES_DAILY",
            "symbol": symbol,
            "outputsize": outputsize,
            "apikey": settings.alpha_vantage_key,
        },
        timeout=30.0,
    )
    response.raise_for_status()
    data = response.json()

    if "Note" in data or "Information" in data:
        raise ValueError(str(data.get("Note") or data.get("Information")))
    if "Error Message" in data:
        raise ValueError(str(data["Error Message"]))

    series = data.get("Time Series (Daily)")
    if not isinstance(series, dict) or not series:
        raise ValueError(f"No Alpha Vantage history for '{symbol}'")

    points: list[dict[str, Any]] = []
    for day, bar in series.items():
        if not isinstance(bar, dict):
            continue
        point = _point_from_ohlc(
            day,
            bar.get("1. open"),
            bar.get("2. high"),
            bar.get("3. low"),
            bar.get("4. close"),
            bar.get("5. volume"),
        )
        if point:
            points.append(point)

    points = _filter_points_by_days(_dedupe_points(points), days)
    if not points:
        raise ValueError(f"Empty Alpha Vantage history for '{symbol}'")

    return PriceHistory(ticker=symbol, range=range_key, points=points)


def _friendly_history_error(
    symbol: str,
    polygon_error: Exception | None,
    finnhub_error: Exception | None,
    alpha_error: Exception | None,
) -> str:
    parts = [str(e) for e in (polygon_error, finnhub_error, alpha_error) if e]
    joined = " | ".join(parts)
    if "429" in joined:
        return (
            f"Market data rate limit hit while loading {symbol}. "
            "Wait a minute and try again — cached charts will load faster."
        )
    if "403" in joined:
        return (
            f"Unable to load {symbol} history from available providers. "
            "Polygon may be rate-limited and Finnhub candles require a paid plan."
        )
    return f"Unable to fetch history for '{symbol}'. {joined[:280]}"


def get_price_history(ticker: str, range_key: str = "3M") -> PriceHistory:
    """Daily OHLCV history: Polygon → Finnhub → Alpha Vantage, with short cache."""
    symbol = ticker.strip().upper()
    if not symbol:
        raise HTTPException(status_code=400, detail="Ticker is required")

    key = range_key.strip().upper()
    if key not in _RANGE_DAYS:
        allowed = ", ".join(_RANGE_DAYS)
        raise HTTPException(
            status_code=400,
            detail=f"Invalid range '{range_key}'. Use one of: {allowed}",
        )

    cache_key = f"{symbol}|{key}"
    cached = _get_cached_history(cache_key)
    if cached is not None:
        return cached

    days = _RANGE_DAYS[key]
    errors: list[Exception] = []

    for loader in (
        lambda: _history_from_polygon(symbol, key, days),
        lambda: _history_from_finnhub(symbol, key, days),
        lambda: _history_from_alpha_vantage(symbol, key, days),
    ):
        try:
            history = loader()
            _set_cached_history(cache_key, history)
            return history
        except Exception as exc:
            errors.append(exc)

    polygon_error = errors[0] if len(errors) > 0 else None
    finnhub_error = errors[1] if len(errors) > 1 else None
    alpha_error = errors[2] if len(errors) > 2 else None
    raise HTTPException(
        status_code=502,
        detail=_friendly_history_error(
            symbol, polygon_error, finnhub_error, alpha_error
        ),
    )

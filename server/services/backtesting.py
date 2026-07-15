"""Backtesting-lite over saved signal history and forward returns."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from typing import Any, Sequence

from services.scoring import score_bucket, signal_display


def _forward_return(closes: Sequence[float], index: int, horizon: int) -> float | None:
    if index < 0 or index + horizon >= len(closes):
        return None
    start = closes[index]
    end = closes[index + horizon]
    if start == 0:
        return None
    return (end - start) / start * 100.0


def _align_signal_to_close_index(
    signal_ts: datetime,
    dates: Sequence[str],
) -> int | None:
    """Find the last close on or before the signal date."""
    if not dates:
        return None
    target = signal_ts.date().isoformat() if hasattr(signal_ts, "date") else str(signal_ts)[:10]
    best = None
    for i, d in enumerate(dates):
        day = str(d)[:10]
        if day <= target:
            best = i
        else:
            break
    return best


def run_backtest(
    signals: Sequence[Any],
    *,
    dates: Sequence[str],
    closes: Sequence[float],
    benchmark_closes: Sequence[float] | None = None,
    benchmark_dates: Sequence[str] | None = None,
) -> dict[str, Any]:
    """Compute forward-return stats by label and score bucket."""
    by_label: dict[str, list[dict[str, float | None]]] = defaultdict(list)
    by_bucket: dict[str, list[float]] = defaultdict(list)
    tested = 0

    for row in signals:
        ts = getattr(row, "timestamp", None) or getattr(row, "created_at", None)
        if ts is None:
            continue
        idx = _align_signal_to_close_index(ts, dates)
        if idx is None:
            continue
        r1 = _forward_return(closes, idx, 1)
        r5 = _forward_return(closes, idx, 5)
        r20 = _forward_return(closes, idx, 20)
        if r1 is None and r5 is None and r20 is None:
            continue
        label = getattr(row, "final_label", "neutral")
        score = int(getattr(row, "final_score", 50))
        display = signal_display(label).get("short", label)
        by_label[display].append({"r1": r1, "r5": r5, "r20": r20})
        if r5 is not None:
            by_bucket[score_bucket(score)].append(r5)
            tested += 1
        elif r1 is not None:
            tested += 1

    def _avg(values: list[float | None]) -> float | None:
        nums = [v for v in values if v is not None]
        if not nums:
            return None
        return round(sum(nums) / len(nums), 3)

    label_rows = []
    for label, rows in sorted(by_label.items()):
        r1s = [r["r1"] for r in rows]
        r5s = [r["r5"] for r in rows]
        r20s = [r["r20"] for r in rows]
        wins = [v for v in r5s if v is not None]
        win_rate = (
            round(100.0 * sum(1 for v in wins if v > 0) / len(wins), 1) if wins else None
        )
        label_rows.append(
            {
                "signalLabel": label,
                "count": len(rows),
                "avg1dReturn": _avg(r1s),  # type: ignore[arg-type]
                "avg5dReturn": _avg(r5s),  # type: ignore[arg-type]
                "avg20dReturn": _avg(r20s),  # type: ignore[arg-type]
                "winRate5d": win_rate,
            }
        )

    bucket_order = [
        "80–100 Bullish (strong)",
        "65–79 Bullish",
        "45–64 Neutral",
        "30–44 Bearish",
        "0–29 Bearish (strong)",
    ]
    bucket_rows = []
    for name in bucket_order:
        vals = by_bucket.get(name, [])
        bucket_rows.append(
            {
                "bucket": name,
                "count": len(vals),
                "avg5dReturn": round(sum(vals) / len(vals), 3) if vals else None,
            }
        )

    benchmark: dict[str, Any] | None = None
    if benchmark_closes and benchmark_dates and len(benchmark_closes) >= 21:
        spy_returns: list[float] = []
        for i in range(min(len(benchmark_closes) - 20, len(closes) - 20)):
            r = _forward_return(benchmark_closes, i, 5)
            if r is not None:
                spy_returns.append(r)
        if spy_returns:
            benchmark = {
                "symbol": "SPY",
                "avg5dReturn": round(sum(spy_returns) / len(spy_returns), 3),
                "periods": len(spy_returns),
            }

    return {
        "signalsTested": tested,
        "byLabel": label_rows,
        "byBucket": bucket_rows,
        "benchmark": benchmark,
        "disclaimer": (
            "Backtesting is historical analysis only and does not guarantee future performance."
        ),
    }

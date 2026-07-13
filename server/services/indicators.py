"""Technical indicator helpers for the signal engine."""

from __future__ import annotations

from typing import Sequence


def simple_moving_average(values: Sequence[float], window: int) -> float | None:
    if window <= 0 or len(values) < window:
        return None
    subset = values[-window:]
    return sum(subset) / window


def average_volume(volumes: Sequence[float], window: int = 20) -> float | None:
    if window <= 0 or len(volumes) < window:
        return None
    subset = volumes[-window:]
    return sum(subset) / window


def rsi(closes: Sequence[float], period: int = 14) -> float | None:
    """Wilder-style RSI using simple average of gains/losses for the window."""
    if period <= 0 or len(closes) < period + 1:
        return None
    gains = 0.0
    losses = 0.0
    window = closes[-(period + 1) :]
    for i in range(1, len(window)):
        delta = window[i] - window[i - 1]
        if delta >= 0:
            gains += delta
        else:
            losses -= delta
    avg_gain = gains / period
    avg_loss = losses / period
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return 100.0 - (100.0 / (1.0 + rs))

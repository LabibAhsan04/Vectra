"""Unit tests for Vectra technical indicators."""

from services.indicators import average_volume, rsi, simple_moving_average


def test_simple_moving_average_basic():
    values = [1.0, 2.0, 3.0, 4.0, 5.0]
    assert simple_moving_average(values, 3) == 4.0


def test_simple_moving_average_insufficient():
    assert simple_moving_average([1.0, 2.0], 5) is None


def test_average_volume():
    volumes = [10, 20, 30, 40, 50]
    assert average_volume(volumes, 5) == 30.0


def test_rsi_all_gains():
    # Strictly rising series → RSI near 100
    closes = [float(i) for i in range(1, 20)]
    value = rsi(closes, 14)
    assert value is not None
    assert value > 90


def test_rsi_mixed_window():
    closes = [10, 11, 10.5, 11.5, 11, 12, 11.5, 12.5, 12, 13, 12.5, 13.5, 13, 14, 13.5]
    value = rsi(closes, 14)
    assert value is not None
    assert 0 < value < 100

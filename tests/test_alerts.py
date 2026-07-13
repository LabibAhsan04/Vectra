"""Unit tests for alert generation."""

from datetime import datetime
from types import SimpleNamespace

from services.alerts import evaluate_alerts


class FakeSession:
    def __init__(self, previous=None):
        self.previous = previous
        self.added = []

    def add(self, row):
        self.added.append(row)

    def commit(self):
        return None

    def refresh(self, row):
        if getattr(row, "id", None) is None:
            row.id = len(self.added)
        if getattr(row, "timestamp", None) is None:
            row.timestamp = datetime.utcnow()


def test_label_change_alert(monkeypatch):
    previous = SimpleNamespace(
        final_label="neutral",
        final_score=55,
        momentum_score=50,
        sentiment_score=50,
        price=100.0,
    )
    db = FakeSession(previous)

    monkeypatch.setattr(
        "services.alerts.get_latest_signal",
        lambda _db, _ticker: previous,
    )

    created = evaluate_alerts(
        db,
        ticker="NVDA",
        new_score=70,
        new_label="bullish",
        new_scores={
            "momentum": 72,
            "technical": 68,
            "sentiment": 55,
            "fundamentals": 45,
            "growth": 55,
        },
        flags={"aboveMa20": True},
    )
    assert any(a["alertType"] == "label_change" for a in created)
    assert "Neutral" in created[0]["message"] or "Bullish" in created[0]["message"]


def test_score_jump_alert(monkeypatch):
    previous = SimpleNamespace(
        final_label="neutral",
        final_score=50,
        momentum_score=50,
        sentiment_score=50,
        price=100.0,
    )
    db = FakeSession(previous)
    monkeypatch.setattr(
        "services.alerts.get_latest_signal",
        lambda _db, _ticker: previous,
    )
    created = evaluate_alerts(
        db,
        ticker="AMD",
        new_score=70,
        new_label="neutral",
        new_scores={
            "momentum": 50,
            "technical": 50,
            "sentiment": 50,
            "fundamentals": 45,
            "growth": 50,
        },
        flags={},
    )
    assert any(a["alertType"] == "score_jump" for a in created)


def test_volume_spike_alert(monkeypatch):
    previous = SimpleNamespace(
        final_label="bullish",
        final_score=70,
        momentum_score=70,
        sentiment_score=60,
        price=100.0,
    )
    db = FakeSession(previous)
    monkeypatch.setattr(
        "services.alerts.get_latest_signal",
        lambda _db, _ticker: previous,
    )
    created = evaluate_alerts(
        db,
        ticker="NVDA",
        new_score=70,
        new_label="bullish",
        new_scores={
            "momentum": 70,
            "technical": 65,
            "sentiment": 60,
            "fundamentals": 45,
            "growth": 55,
        },
        flags={"volumeSpike": True},
    )
    assert any(a["alertType"] == "volume_spike" for a in created)

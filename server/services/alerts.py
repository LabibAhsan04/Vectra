"""Dashboard alert generation from signal transitions and market flags."""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from services.database import get_latest_signal, save_alert
from services.scoring import signal_display


def _sentiment_bucket(score: int) -> str:
    if score >= 60:
        return "bullish"
    if score <= 40:
        return "bearish"
    return "neutral"


def evaluate_alerts(
    db: Session,
    *,
    ticker: str,
    new_score: int,
    new_label: str,
    new_scores: dict[str, int],
    flags: dict[str, Any] | None = None,
) -> list[dict[str, str]]:
    """Compare against previous persisted signal and create dashboard alerts."""
    symbol = ticker.upper()
    previous = get_latest_signal(db, symbol)
    created: list[dict[str, str]] = []
    flags = flags or {}

    def emit(alert_type: str, message: str, old: str | None = None, new: str | None = None) -> None:
        row = save_alert(
            db,
            ticker=symbol,
            alert_type=alert_type,
            message=message,
            old_value=old,
            new_value=new,
        )
        created.append(
            {
                "id": str(row.id),
                "ticker": symbol,
                "alertType": alert_type,
                "message": message,
                "oldValue": old or "",
                "newValue": new or "",
                "timestamp": row.timestamp.isoformat() if row.timestamp else "",
            }
        )

    if previous is None:
        return created

    old_label = previous.final_label
    old_score = previous.final_score
    old_momentum = previous.momentum_score
    old_sentiment = previous.sentiment_score

    if old_label != new_label:
        short_old = signal_display(old_label).get("label", "Neutral Signal")
        short_new = signal_display(new_label).get("label", "Neutral Signal")
        reason = "factor evidence shifted"
        if new_scores.get("momentum", 50) > old_momentum + 5:
            reason = "momentum improved"
        elif new_scores.get("momentum", 50) < old_momentum - 5:
            reason = "momentum weakened"
        if flags.get("aboveMa20"):
            reason += " and price moved above MA20"
        elif flags.get("belowMa50"):
            reason += " and price dropped below MA50"
        emit(
            "label_change",
            f"{symbol} changed from {short_old} to {short_new} because {reason}.",
            old=short_old,
            new=short_new,
        )

    if abs(new_score - old_score) >= 15:
        emit(
            "score_jump",
            f"{symbol} final score moved {new_score - old_score:+d} points "
            f"({old_score} → {new_score}).",
            old=str(old_score),
            new=str(new_score),
        )

    new_momentum = int(new_scores.get("momentum", 50))
    if abs(new_momentum - old_momentum) >= 20:
        emit(
            "momentum_jump",
            f"{symbol} momentum score moved {new_momentum - old_momentum:+d} points "
            f"({old_momentum} → {new_momentum}).",
            old=str(old_momentum),
            new=str(new_momentum),
        )

    old_bucket = _sentiment_bucket(old_sentiment)
    new_bucket = _sentiment_bucket(int(new_scores.get("sentiment", 50)))
    if {old_bucket, new_bucket} == {"bullish", "bearish"}:
        emit(
            "sentiment_flip",
            f"{symbol} sentiment flipped from {old_bucket} to {new_bucket}.",
            old=old_bucket,
            new=new_bucket,
        )

    if flags.get("volumeSpike"):
        emit(
            "volume_spike",
            f"{symbol} volume is about 2× (or more) above its recent average.",
        )

    if flags.get("crossedAboveMa20"):
        emit("ma_cross", f"{symbol} price crossed above MA20.")
    if flags.get("crossedBelowMa20"):
        emit("ma_cross", f"{symbol} price crossed below MA20.")
    if flags.get("crossedAboveMa50"):
        emit("ma_cross", f"{symbol} price crossed above MA50.")
    if flags.get("crossedBelowMa50"):
        emit("ma_cross", f"{symbol} price crossed below MA50.")

    return created

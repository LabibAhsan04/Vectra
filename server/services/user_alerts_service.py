"""User-defined alert rules (price / score thresholds)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from models.user import UserAlertRule
from services.database import save_alert


def list_rules(db: Session, user_id: int, ticker: str | None = None) -> list[UserAlertRule]:
    query = db.query(UserAlertRule).filter(
        UserAlertRule.user_id == user_id,
        UserAlertRule.active.is_(True),
    )
    if ticker:
        query = query.filter(UserAlertRule.ticker == ticker.upper())
    return query.order_by(UserAlertRule.created_at.desc()).all()


def create_rule(
    db: Session,
    *,
    user_id: int,
    ticker: str,
    rule_type: str,
    threshold: float,
) -> UserAlertRule:
    allowed = {"price_above", "price_below", "score_above", "score_below"}
    if rule_type not in allowed:
        raise ValueError(f"Invalid rule_type. Use one of: {', '.join(sorted(allowed))}")
    row = UserAlertRule(
        user_id=user_id,
        ticker=ticker.upper(),
        rule_type=rule_type,
        threshold=float(threshold),
        active=True,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def delete_rule(db: Session, user_id: int, rule_id: int) -> bool:
    row = (
        db.query(UserAlertRule)
        .filter(UserAlertRule.id == rule_id, UserAlertRule.user_id == user_id)
        .first()
    )
    if not row:
        return False
    db.delete(row)
    db.commit()
    return True


def evaluate_user_rules(
    db: Session,
    *,
    ticker: str,
    price: float,
    score: int,
    user_id: int | None = None,
) -> int:
    """Evaluate active rules; returns count triggered."""
    symbol = ticker.upper()
    query = db.query(UserAlertRule).filter(
        UserAlertRule.active.is_(True),
        UserAlertRule.ticker == symbol,
    )
    if user_id is not None:
        query = query.filter(UserAlertRule.user_id == user_id)
    rules = query.all()
    now = datetime.now(timezone.utc)
    cooldown = timedelta(hours=6)
    triggered = 0

    for rule in rules:
        if rule.last_triggered_at and now - rule.last_triggered_at.replace(tzinfo=timezone.utc) < cooldown:
            continue
        hit = False
        message = ""
        if rule.rule_type == "price_above" and price >= rule.threshold:
            hit = True
            message = f"{symbol} price ${price:.2f} crossed above ${rule.threshold:.2f}"
        elif rule.rule_type == "price_below" and price <= rule.threshold:
            hit = True
            message = f"{symbol} price ${price:.2f} crossed below ${rule.threshold:.2f}"
        elif rule.rule_type == "score_above" and score >= rule.threshold:
            hit = True
            message = f"{symbol} signal score {score} crossed above {rule.threshold:.0f}"
        elif rule.rule_type == "score_below" and score <= rule.threshold:
            hit = True
            message = f"{symbol} signal score {score} crossed below {rule.threshold:.0f}"
        if hit:
            save_alert(
                db,
                ticker=symbol,
                alert_type=f"user_{rule.rule_type}",
                message=message,
                old_value=str(rule.threshold),
                new_value=str(price if "price" in rule.rule_type else score),
            )
            rule.last_triggered_at = now
            triggered += 1
    if triggered:
        db.commit()
    return triggered

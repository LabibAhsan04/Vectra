from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db.database import get_db
from schemas.stock_schema import UserAlertRuleRequest, UserAlertRuleResponse
from services.auth_service import get_current_user
from services.user_alerts_service import create_rule, delete_rule, list_rules

router = APIRouter(tags=["user-alerts"])


@router.get("/user-alerts", response_model=list[UserAlertRuleResponse])
def get_user_alerts(
    ticker: str | None = None,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> list[UserAlertRuleResponse]:
    rows = list_rules(db, user.id, ticker=ticker)
    return [
        UserAlertRuleResponse(
            id=row.id,
            ticker=row.ticker,
            ruleType=row.rule_type,
            threshold=row.threshold,
            active=row.active,
            createdAt=row.created_at,
        )
        for row in rows
    ]


@router.post("/user-alerts", response_model=UserAlertRuleResponse, status_code=201)
def add_user_alert(
    body: UserAlertRuleRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> UserAlertRuleResponse:
    try:
        row = create_rule(
            db,
            user_id=user.id,
            ticker=body.ticker,
            rule_type=body.ruleType,
            threshold=body.threshold,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return UserAlertRuleResponse(
        id=row.id,
        ticker=row.ticker,
        ruleType=row.rule_type,
        threshold=row.threshold,
        active=row.active,
        createdAt=row.created_at,
    )


@router.delete("/user-alerts/{rule_id}", status_code=204)
def remove_user_alert(
    rule_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> None:
    if not delete_rule(db, user.id, rule_id):
        raise HTTPException(status_code=404, detail="Alert rule not found.")

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from db.database import get_db
from schemas.stock_schema import (
    AuthLoginRequest,
    AuthRegisterRequest,
    AuthTokenResponse,
    AuthUserResponse,
)
from services.auth_service import (
    authenticate_user,
    create_access_token,
    get_current_user,
    register_user,
)

router = APIRouter(tags=["auth"])


@router.post("/auth/register", response_model=AuthTokenResponse, status_code=201)
def register(body: AuthRegisterRequest, db: Session = Depends(get_db)) -> AuthTokenResponse:
    user = register_user(db, email=body.email, password=body.password, name=body.name)
    token = create_access_token(user.id)
    return AuthTokenResponse(
        token=token,
        user=AuthUserResponse(id=user.id, email=user.email, name=user.name),
    )


@router.post("/auth/login", response_model=AuthTokenResponse)
def login(body: AuthLoginRequest, db: Session = Depends(get_db)) -> AuthTokenResponse:
    user = authenticate_user(db, email=body.email, password=body.password)
    token = create_access_token(user.id)
    return AuthTokenResponse(
        token=token,
        user=AuthUserResponse(id=user.id, email=user.email, name=user.name),
    )


@router.get("/auth/me", response_model=AuthUserResponse)
def me(user=Depends(get_current_user)) -> AuthUserResponse:
    return AuthUserResponse(id=user.id, email=user.email, name=user.name)

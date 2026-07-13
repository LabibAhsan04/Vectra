import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db import init_db
from routers import analysis, news, stocks, watchlist

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

app = FastAPI(title="Vectra — AI Stock Dashboard", version="0.1.0")

_allowed_origins = [
    origin.strip().rstrip("/")
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
    if origin.strip()
]
_origin_regex_raw = os.getenv("ALLOWED_ORIGIN_REGEX")
if _origin_regex_raw is None:
    # Default: allow Vercel production + preview URLs
    _origin_regex: str | None = r"https://.*\.vercel\.app"
else:
    # Empty string disables the regex allowlist
    _origin_regex = _origin_regex_raw.strip() or None

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_origin_regex=_origin_regex,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(stocks.router, prefix="/api")
app.include_router(news.router, prefix="/api")
app.include_router(analysis.router, prefix="/api")
app.include_router(watchlist.router, prefix="/api")


@app.on_event("startup")
async def startup() -> None:
    init_db.create_tables()


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}

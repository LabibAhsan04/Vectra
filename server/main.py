import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db import init_db
from routers import analysis, news, stocks, watchlist

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

app = FastAPI(title="Vectra — AI Stock Dashboard", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")],
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

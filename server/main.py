import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from config import is_production, settings
from db import init_db
from middleware.rate_limit import RateLimitMiddleware
from routers import analysis, news, stocks, tools, watchlist, ws
from services.scheduler import start_scheduler, stop_scheduler

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

_prod = is_production()
STATIC_DIR = Path(__file__).resolve().parent / "static"

app = FastAPI(
    title="Vectra — Stock Signal Dashboard",
    version=settings.app_version,
    docs_url=None if _prod else "/docs",
    redoc_url=None if _prod else "/redoc",
    openapi_url=None if _prod else "/openapi.json",
)

_allowed_origins = [
    origin.strip().rstrip("/")
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        settings.allowed_origins,
    ).split(",")
    if origin.strip()
]
_origin_regex_raw = os.getenv("ALLOWED_ORIGIN_REGEX")
if _origin_regex_raw is None:
    _origin_regex: str | None = r"https://.*\.vercel\.app"
else:
    _origin_regex = _origin_regex_raw.strip() or None

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_origin_regex=_origin_regex,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RateLimitMiddleware, enabled=settings.rate_limit_active())

app.include_router(stocks.router, prefix="/api")
app.include_router(news.router, prefix="/api")
app.include_router(analysis.router, prefix="/api")
app.include_router(watchlist.router, prefix="/api")
app.include_router(tools.router, prefix="/api")
app.include_router(ws.router, prefix="/api")


@app.on_event("startup")
async def startup() -> None:
    from db.database import DATABASE_URL

    init_db.create_tables()
    start_scheduler()
    if not _prod:
        print(f"Vectra DB: {DATABASE_URL}")


@app.on_event("shutdown")
async def shutdown() -> None:
    stop_scheduler()


@app.get("/health")
async def health() -> dict[str, str]:
    from db.database import DATABASE_URL

    db_kind = "postgresql" if DATABASE_URL.startswith("postgresql") else "sqlite"
    payload: dict[str, str] = {
        "status": "ok",
        "version": settings.app_version,
        "database": db_kind,
    }
    if not _prod and db_kind == "sqlite":
        payload["databasePath"] = DATABASE_URL.replace("sqlite:///", "")
    return payload


def _mount_spa() -> None:
    """Serve the Vite build from ./static when present (Docker single-container)."""
    if not STATIC_DIR.is_dir() or not (STATIC_DIR / "index.html").is_file():
        return

    assets_dir = STATIC_DIR / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/")
    async def spa_root() -> FileResponse:
        return FileResponse(STATIC_DIR / "index.html")

    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str) -> FileResponse:
        # Prefer real static files (logo, favicon, etc.); otherwise SPA index.
        candidate = (STATIC_DIR / full_path).resolve()
        try:
            candidate.relative_to(STATIC_DIR.resolve())
        except ValueError:
            return FileResponse(STATIC_DIR / "index.html")
        if candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(STATIC_DIR / "index.html")


_mount_spa()

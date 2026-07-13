from fastapi import APIRouter, HTTPException, Query

from schemas.stock_schema import NewsItem
from services.market_data import get_stock_quote
from services.news_service import get_company_news, get_market_news, get_watchlist_news

router = APIRouter(tags=["news"])


@router.get("/news/market", response_model=list[NewsItem])
async def read_market_news(
    limit: int = Query(default=20, ge=1, le=40),
) -> list[NewsItem]:
    """Broad market / sector headlines for Home mode."""
    try:
        return get_market_news(limit=limit)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="Market news temporarily unavailable.",
        ) from exc


@router.get("/news/watchlist", response_model=list[NewsItem])
async def read_watchlist_news(
    tickers: str = Query(default="", description="Comma-separated tickers"),
    limit: int = Query(default=20, ge=1, le=40),
) -> list[NewsItem]:
    """Combined headlines for the current watchlist (Home mode)."""
    symbols = [t.strip().upper() for t in tickers.split(",") if t.strip()]
    try:
        return get_watchlist_news(symbols, limit=limit)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="Watchlist news temporarily unavailable.",
        ) from exc


@router.get("/news/{ticker}", response_model=list[NewsItem])
@router.get("/stock/{ticker}/news", response_model=list[NewsItem])
async def read_news(
    ticker: str,
    limit: int = Query(default=12, ge=1, le=25),
) -> list[NewsItem]:
    """Return recent headlines with company vs market/sector relevance tags."""
    # Protect reserved paths if routing order ever changes.
    if ticker.lower() in {"market", "watchlist"}:
        raise HTTPException(status_code=404, detail="Not found")
    try:
        company_name = ""
        try:
            company_name = get_stock_quote(ticker).companyName
        except HTTPException:
            company_name = ""
        return get_company_news(ticker, limit=limit, company_name=company_name)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="No recent news found for this ticker.",
        ) from exc

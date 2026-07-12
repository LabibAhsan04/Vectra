from fastapi import APIRouter, HTTPException, Query

from schemas.stock_schema import NewsItem
from services.news_service import get_company_news

router = APIRouter(tags=["news"])


@router.get("/news/{ticker}", response_model=list[NewsItem])
@router.get("/stock/{ticker}/news", response_model=list[NewsItem])
async def read_news(
    ticker: str,
    limit: int = Query(default=10, ge=1, le=25),
) -> list[NewsItem]:
    """Return recent company news headlines for a ticker via Finnhub."""
    try:
        return get_company_news(ticker, limit=limit)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

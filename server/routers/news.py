from fastapi import APIRouter, HTTPException, Query

from schemas.stock_schema import NewsItem
from services.market_data import get_stock_quote
from services.news_service import get_company_news

router = APIRouter(tags=["news"])


@router.get("/news/{ticker}", response_model=list[NewsItem])
@router.get("/stock/{ticker}/news", response_model=list[NewsItem])
async def read_news(
    ticker: str,
    limit: int = Query(default=12, ge=1, le=25),
) -> list[NewsItem]:
    """Return recent headlines with company vs market/sector relevance tags."""
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
        raise HTTPException(status_code=502, detail=str(exc)) from exc

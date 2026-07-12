from fastapi import APIRouter, HTTPException

from schemas.stock_schema import StockQuote
from services.market_data import get_stock_quote

router = APIRouter(tags=["stocks"])


@router.get("/stock/{ticker}", response_model=StockQuote)
async def read_stock(ticker: str) -> StockQuote:
    """Return the latest available quote for a ticker via Polygon.io."""
    try:
        return get_stock_quote(ticker)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

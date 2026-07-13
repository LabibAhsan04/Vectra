from fastapi import APIRouter, HTTPException, Query

from schemas.stock_schema import PriceHistory, StockQuote
from services.market_data import get_price_history, get_stock_quote

router = APIRouter(tags=["stocks"])


@router.get("/stock/{ticker}", response_model=StockQuote)
async def read_stock(ticker: str) -> StockQuote:
    """Return the latest available quote for a ticker."""
    try:
        return get_stock_quote(ticker)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/stock/{ticker}/history", response_model=PriceHistory)
async def read_stock_history(
    ticker: str,
    range: str = Query(
        "3M",
        alias="range",
        description="1M, 3M, 6M, 1Y, or 5Y",
    ),
) -> PriceHistory:
    """Return daily OHLCV bars for charting."""
    try:
        return get_price_history(ticker, range)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

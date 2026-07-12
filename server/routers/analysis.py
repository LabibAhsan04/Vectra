from fastapi import APIRouter, HTTPException

from schemas.stock_schema import AIAnalysisResponse, AnalyzeRequest
from services.ai_service import get_ai_analysis
from services.market_data import get_stock_quote
from services.news_service import get_company_news

router = APIRouter(tags=["analysis"])


@router.post("/analyze", response_model=AIAnalysisResponse)
async def analyze_stock(body: AnalyzeRequest) -> AIAnalysisResponse:
    """Run LLM analysis for a ticker using quote + recent headlines."""
    ticker = body.ticker.strip().upper()
    if not ticker:
        raise HTTPException(status_code=400, detail="Ticker is required")

    try:
        quote = get_stock_quote(ticker)
        news = get_company_news(ticker, limit=8)
        headlines = [item.headline for item in news]

        result = await get_ai_analysis(
            ticker=ticker,
            price=quote.price,
            change_pct=quote.changePct,
            pe_ratio=quote.peRatio,
            headlines=headlines,
            force=body.force,
        )
        return AIAnalysisResponse.model_validate(result)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

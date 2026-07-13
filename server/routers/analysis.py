from fastapi import APIRouter, HTTPException

from schemas.stock_schema import AIAnalysisResponse, AnalyzeRequest
from services.ai_service import get_ai_analysis
from services.market_data import get_stock_quote
from services.news_service import get_company_news

router = APIRouter(tags=["analysis"])


@router.post("/analyze", response_model=AIAnalysisResponse)
async def analyze_stock(body: AnalyzeRequest) -> AIAnalysisResponse:
    """Run research-signal analysis for a ticker using quote + recent headlines."""
    ticker = body.ticker.strip().upper()
    if not ticker:
        raise HTTPException(status_code=400, detail="Ticker is required")

    try:
        quote = get_stock_quote(ticker)
        news = get_company_news(ticker, limit=12, company_name=quote.companyName)
        headlines = [item.headline for item in news]
        company_news_count = sum(1 for item in news if item.section == "company")
        market_news_count = sum(1 for item in news if item.section != "company")

        # Free-tier quotes rarely include reliable filing-based fundamentals
        # (revenue growth, margins). PE alone is not enough to invent claims.
        fundamentals_available = False

        result = await get_ai_analysis(
            ticker=ticker,
            price=quote.price,
            change_pct=quote.changePct,
            pe_ratio=quote.peRatio,
            headlines=headlines,
            company_news_count=company_news_count,
            market_news_count=market_news_count,
            fundamentals_available=fundamentals_available,
            force=body.force,
        )
        return AIAnalysisResponse.model_validate(result)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

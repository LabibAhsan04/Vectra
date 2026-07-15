from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db.database import get_db
from schemas.stock_schema import (
    AIAnalysisResponse,
    AlertResponse,
    AnalyzeRequest,
    SignalHistoryPoint,
)
from services.ai_service import get_ai_analysis
from services.alerts import evaluate_alerts
from services.backtesting import run_backtest
from services.database import (
    get_all_signals,
    get_latest_signal,
    get_recent_alerts,
    get_signal_history,
    save_news_items,
    save_signal,
)
from services.fundamentals_service import get_fundamental_metrics
from services.market_data import get_price_history, get_stock_quote
from services.news_service import get_company_news

router = APIRouter(tags=["analysis"])


@router.post("/analyze", response_model=AIAnalysisResponse)
async def analyze_stock(
    body: AnalyzeRequest,
    db: Session = Depends(get_db),
) -> AIAnalysisResponse:
    """Run research-signal analysis for a ticker using quote + history + news."""
    ticker = body.ticker.strip().upper()
    if not ticker:
        raise HTTPException(status_code=400, detail="Ticker is required")

    try:
        quote = get_stock_quote(ticker)
        news = get_company_news(ticker, limit=12, company_name=quote.companyName)
        company_news = [item for item in news if item.section == "company"]
        market_news = [item for item in news if item.section != "company"]
        closes: list[float] = []
        volumes: list[float] = []
        try:
            history = get_price_history(ticker, "3M")
            closes = [p.close for p in history.points]
            volumes = [float(p.volume or 0) for p in history.points]
        except Exception:
            closes = []
            volumes = []

        fundamentals = get_fundamental_metrics(ticker)
        pe_ratio = quote.peRatio or fundamentals.get("peRatio") or 0.0
        fundamentals_available = bool(
            quote.marketCap > 0
            or pe_ratio > 0
            or fundamentals.get("available")
        )
        company_bullish = sum(1 for i in company_news if i.sentiment == "bullish")
        company_bearish = sum(1 for i in company_news if i.sentiment == "bearish")
        company_neutral = sum(1 for i in company_news if i.sentiment == "neutral")

        result = await get_ai_analysis(
            ticker=ticker,
            price=quote.price,
            change_pct=quote.changePct,
            pe_ratio=pe_ratio,
            revenue_growth_yoy=fundamentals.get("revenueGrowthYoY"),
            profit_margin=fundamentals.get("profitMargin"),
            roe=fundamentals.get("roe"),
            headlines=[item.headline for item in news],
            company_headlines=[item.headline for item in company_news],
            market_headlines=[item.headline for item in market_news],
            company_news_count=len(company_news),
            market_news_count=len(market_news),
            fundamentals_available=fundamentals_available,
            company_bullish=company_bullish,
            company_bearish=company_bearish,
            company_neutral=company_neutral,
            closes=closes,
            volumes=volumes,
            force=body.force,
        )

        flags = dict(result.get("marketFlags") or {})
        # Detect MA crosses vs previous close when we have history.
        if len(closes) >= 2 and flags:
            prev_price = closes[-2]
            ma20 = flags.get("ma20")
            ma50 = flags.get("ma50")
            price = flags.get("price")
            if ma20 is not None and price is not None:
                flags["crossedAboveMa20"] = prev_price <= ma20 < price
                flags["crossedBelowMa20"] = prev_price >= ma20 > price
            if ma50 is not None and price is not None:
                flags["crossedAboveMa50"] = prev_price <= ma50 < price
                flags["crossedBelowMa50"] = prev_price >= ma50 > price

        new_score = int(result["overallScore"])
        new_label = str(result["signal"])
        previous = get_latest_signal(db, ticker)
        should_persist = (
            body.force
            or previous is None
            or previous.final_score != new_score
            or previous.final_label != new_label
        )

        if should_persist:
            evaluate_alerts(
                db,
                ticker=ticker,
                new_score=new_score,
                new_label=new_label,
                new_scores=dict(result["scores"]),
                flags=flags,
            )
            save_signal(
                db,
                ticker=ticker,
                price=quote.price,
                final_score=new_score,
                final_label=new_label,
                scores=dict(result["scores"]),
                explanation=str(result.get("analysisText") or ""),
                data_sources=list(result.get("sourcesUsed") or []),
            )
            save_news_items(
                db,
                ticker,
                [
                    {
                        "headline": item.headline,
                        "source": item.source,
                        "url": item.url,
                        "publishedAt": item.publishedAt,
                        "relevance": item.relevance,
                        "relevance_score": item.relevanceScore,
                        "sentiment": item.sentiment,
                        "sentiment_score": item.sentimentScore,
                    }
                    for item in news
                ],
            )

        # Drop non-schema field before validation.
        result.pop("marketFlags", None)
        return AIAnalysisResponse.model_validate(result)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="Data temporarily unavailable. Try refreshing in a few minutes.",
        ) from exc


@router.get("/signals/{ticker}/history", response_model=list[SignalHistoryPoint])
def signal_history(ticker: str, db: Session = Depends(get_db)) -> list[SignalHistoryPoint]:
    rows = get_signal_history(db, ticker, limit=60)
    return [
        SignalHistoryPoint(
            timestamp=row.timestamp,
            finalScore=row.final_score,
            finalLabel=row.final_label,
            price=row.price,
        )
        for row in reversed(rows)
    ]


@router.get("/alerts", response_model=list[AlertResponse])
def list_alerts(
    ticker: str | None = None,
    db: Session = Depends(get_db),
) -> list[AlertResponse]:
    rows = get_recent_alerts(db, ticker=ticker, limit=25)
    return [
        AlertResponse(
            id=row.id,
            ticker=row.ticker,
            timestamp=row.timestamp,
            alertType=row.alert_type,
            message=row.message,
            oldValue=row.old_value,
            newValue=row.new_value,
        )
        for row in rows
    ]


@router.get("/backtest/{ticker}")
def backtest_ticker(ticker: str, db: Session = Depends(get_db)) -> dict:
    symbol = ticker.strip().upper()
    rows = get_all_signals(db, ticker=symbol, limit=500)
    if not rows:
        return {
            "signalsTested": 0,
            "byLabel": [],
            "byBucket": [],
            "disclaimer": (
                "Backtesting is historical analysis only and does not guarantee future performance."
            ),
            "message": "No saved signals yet. Run signal analysis a few times first.",
        }
    try:
        history = get_price_history(symbol, "1Y")
        dates = [p.date for p in history.points]
        closes = [p.close for p in history.points]
        spy_closes: list[float] = []
        spy_dates: list[str] = []
        try:
            spy_history = get_price_history("SPY", "1Y")
            spy_dates = [p.date for p in spy_history.points]
            spy_closes = [p.close for p in spy_history.points]
        except Exception:
            pass
    except Exception:
        return {
            "signalsTested": 0,
            "byLabel": [],
            "byBucket": [],
            "disclaimer": (
                "Backtesting is historical analysis only and does not guarantee future performance."
            ),
            "message": "Price history unavailable for forward-return backtest.",
        }
    return run_backtest(
        rows,
        dates=dates,
        closes=closes,
        benchmark_closes=spy_closes,
        benchmark_dates=spy_dates,
    )

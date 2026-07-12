from datetime import datetime

from pydantic import BaseModel, Field


class StockQuote(BaseModel):
    ticker: str
    companyName: str
    price: float
    change: float
    changePct: float
    volume: int
    marketCap: float
    peRatio: float
    weekHigh52: float
    weekLow52: float
    timestamp: datetime


class NewsItem(BaseModel):
    headline: str
    source: str
    url: str
    publishedAt: datetime
    sentiment: str = "neutral"
    sentimentScore: float = 0.0


class FactorScores(BaseModel):
    momentum: int = Field(ge=0, le=100)
    fundamentals: int = Field(ge=0, le=100)
    sentiment: int = Field(ge=0, le=100)
    technical: int = Field(ge=0, le=100)
    growth: int = Field(ge=0, le=100)


class NewsSentiment(BaseModel):
    headline: str
    sentiment: str


class AnalyzeRequest(BaseModel):
    ticker: str
    force: bool = False


class AIAnalysisResponse(BaseModel):
    ticker: str
    overallScore: int = Field(ge=0, le=100)
    signal: str
    analysisText: str
    scores: FactorScores
    newsItems: list[NewsSentiment] = []
    keyRisks: list[str] = []
    keyCatalysts: list[str] = []
    generatedAt: datetime

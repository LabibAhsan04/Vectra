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


class PricePoint(BaseModel):
    date: str
    open: float
    high: float
    low: float
    close: float
    volume: int = 0


class PriceHistory(BaseModel):
    ticker: str
    range: str
    points: list[PricePoint]


class NewsItem(BaseModel):
    headline: str
    source: str
    url: str
    publishedAt: datetime
    sentiment: str = "neutral"
    sentimentScore: float = 0.0
    relevance: str = "company"  # company | sector | market | competitor | etf
    relevanceScore: int = Field(default=50, ge=0, le=100)
    section: str = "company"  # company | market
    relatedTicker: str | None = None


class FactorScores(BaseModel):
    momentum: int = Field(ge=0, le=100)
    fundamentals: int = Field(ge=0, le=100)
    sentiment: int = Field(ge=0, le=100)
    technical: int = Field(ge=0, le=100)
    growth: int = Field(ge=0, le=100)


class ScoreBreakdownRow(BaseModel):
    key: str
    label: str
    score: int
    weight: float
    weightedPoints: float
    notes: list[str] = []


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
    signalLabel: str = "Neutral Signal"
    signalShort: str = "Neutral"
    signalTone: str = "neutral"
    analysisText: str
    scoreInterpretation: str = ""
    scores: FactorScores
    scoreBreakdown: list[ScoreBreakdownRow] = []
    scoreFormula: str = ""
    newsItems: list[NewsSentiment] = []
    keyRisks: list[str] = []
    keyCatalysts: list[str] = []
    whyThisSignal: list[str] = []
    whatCouldChange: list[str] = []
    dataLimitations: list[str] = []
    fundamentalsAvailable: bool = False
    sourcesUsed: list[str] = []
    explanationSource: str = "template"
    generatedAt: datetime


class SignalHistoryPoint(BaseModel):
    timestamp: datetime
    finalScore: int
    finalLabel: str
    price: float


class AlertResponse(BaseModel):
    id: int
    ticker: str
    timestamp: datetime
    alertType: str
    message: str
    oldValue: str | None = None
    newValue: str | None = None


class WatchlistAddRequest(BaseModel):
    ticker: str = Field(min_length=1, max_length=10)
    companyName: str | None = None
    exchange: str | None = None
    assetType: str | None = None


class WatchlistItemResponse(BaseModel):
    ticker: str
    companyName: str | None = None
    exchange: str | None = None
    assetType: str | None = None
    addedAt: datetime


class SymbolSearchResult(BaseModel):
    symbol: str
    companyName: str
    exchange: str = "US"
    assetType: str = "Stock"

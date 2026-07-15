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


class QuickStats(BaseModel):
    rsi: float | None = None
    relativeVolume: float | None = None
    aboveMa20: bool | None = None
    aboveMa50: bool | None = None


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
    quickStats: QuickStats | None = None
    dataQuality: str = "Limited"
    mainDriver: str = "Momentum"
    confidence: str = "Medium"
    riskLevel: str = "Medium"
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


class WatchlistSnapshotItem(BaseModel):
    ticker: str
    quote: StockQuote | None = None
    latestSignal: SignalHistoryPoint | None = None
    signalChangedAt: datetime | None = None


class AuthRegisterRequest(BaseModel):
    email: str
    password: str = Field(min_length=8)
    name: str = ""


class AuthLoginRequest(BaseModel):
    email: str
    password: str


class AuthUserResponse(BaseModel):
    id: int
    email: str
    name: str | None = None


class AuthTokenResponse(BaseModel):
    token: str
    user: AuthUserResponse


class UserAlertRuleRequest(BaseModel):
    ticker: str
    ruleType: str
    threshold: float


class UserAlertRuleResponse(BaseModel):
    id: int
    ticker: str
    ruleType: str
    threshold: float
    active: bool
    createdAt: datetime


class PeerRow(BaseModel):
    ticker: str
    companyName: str
    price: float
    changePct: float
    peRatio: float
    marketCap: float
    finalScore: int | None = None
    finalLabel: str | None = None
    isTarget: bool = False


class PeerComparisonResponse(BaseModel):
    ticker: str
    targetChangePct: float
    sectorAvgChangePct: float | None = None
    vsSector: float | None = None
    peers: list[PeerRow]


class EarningsEvent(BaseModel):
    ticker: str
    date: str
    eventType: str
    epsEstimate: float | None = None
    revenueEstimate: float | None = None
    hour: str = ""
    label: str


class CompareTickerRow(BaseModel):
    ticker: str
    companyName: str
    price: float
    changePct: float
    peRatio: float
    finalScore: int | None = None
    finalLabel: str | None = None
    rsi: float | None = None
    relativeVolume: float | None = None


class CompareResponse(BaseModel):
    tickers: list[CompareTickerRow]


class SymbolSearchResult(BaseModel):
    symbol: str
    companyName: str
    exchange: str = "US"
    assetType: str = "Stock"

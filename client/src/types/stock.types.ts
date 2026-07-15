export interface StockQuote {
  ticker: string;
  companyName: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  marketCap: number;
  peRatio: number;
  weekHigh52: number;
  weekLow52: number;
  timestamp: string;
}

export type ChartRange = '1M' | '3M' | '6M' | '1Y' | '5Y';

export interface PricePoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PriceHistory {
  ticker: string;
  range: ChartRange | string;
  points: PricePoint[];
}

export type NewsRelevance =
  | 'company'
  | 'sector'
  | 'market'
  | 'competitor'
  | 'etf';

export interface NewsItem {
  headline: string;
  source: string;
  url: string;
  publishedAt: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  sentimentScore: number;
  relevance?: NewsRelevance | string;
  relevanceScore?: number;
  section?: 'company' | 'market' | string;
  relatedTicker?: string | null;
}

export type ResearchSignal =
  | 'strong_bullish'
  | 'bullish'
  | 'neutral'
  | 'bearish'
  | 'strong_bearish'
  | 'strong_buy'
  | 'buy'
  | 'hold'
  | 'sell'
  | 'strong_sell';

export interface ScoreBreakdownRow {
  key: string;
  label: string;
  score: number;
  weight: number;
  weightedPoints: number;
  notes: string[];
}

export interface AIAnalysis {
  ticker: string;
  overallScore: number;
  signal: ResearchSignal | string;
  signalLabel?: string;
  signalShort?: string;
  signalTone?: 'bullish' | 'neutral' | 'bearish' | string;
  analysisText: string;
  scoreInterpretation?: string;
  scores: {
    momentum: number;
    fundamentals: number;
    sentiment: number;
    technical: number;
    growth: number;
  };
  scoreBreakdown?: ScoreBreakdownRow[];
  scoreFormula?: string;
  newsItems: Array<{
    headline: string;
    sentiment: 'bullish' | 'bearish' | 'neutral';
  }>;
  keyRisks: string[];
  keyCatalysts: string[];
  whyThisSignal?: string[];
  whatCouldChange?: string[];
  dataLimitations?: string[];
  fundamentalsAvailable?: boolean;
  quickStats?: {
    rsi?: number | null;
    relativeVolume?: number | null;
    aboveMa20?: boolean | null;
    aboveMa50?: boolean | null;
  };
  dataQuality?: string;
  mainDriver?: string;
  confidence?: string;
  riskLevel?: string;
  sourcesUsed?: string[];
  explanationSource?: 'openrouter' | 'template' | 'cache' | string;
  generatedAt: string;
}

export interface SignalHistoryPoint {
  timestamp: string;
  finalScore: number;
  finalLabel: string;
  price: number;
}

export interface SignalAlert {
  id: number;
  ticker: string;
  timestamp: string;
  alertType: string;
  message: string;
  oldValue?: string | null;
  newValue?: string | null;
}

export interface BacktestResult {
  signalsTested: number;
  byLabel: Array<{
    signalLabel: string;
    count: number;
    avg1dReturn: number | null;
    avg5dReturn: number | null;
    avg20dReturn: number | null;
    winRate5d: number | null;
  }>;
  byBucket: Array<{
    bucket: string;
    count: number;
    avg5dReturn: number | null;
  }>;
  disclaimer: string;
  message?: string;
}

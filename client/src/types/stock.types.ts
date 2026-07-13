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
  section?: 'company' | 'market' | string;
}

export type ResearchSignal =
  | 'strong_buy'
  | 'buy'
  | 'hold'
  | 'sell'
  | 'strong_sell';

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
  sourcesUsed?: string[];
  explanationSource?: 'openrouter' | 'template' | string;
  generatedAt: string;
}

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

export interface NewsItem {
  headline: string;
  source: string;
  url: string;
  publishedAt: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  sentimentScore: number;
}

export interface AIAnalysis {
  ticker: string;
  overallScore: number;
  signal: 'buy' | 'hold' | 'sell';
  analysisText: string;
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
  generatedAt: string;
}

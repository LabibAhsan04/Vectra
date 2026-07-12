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
  generatedAt: string;
}

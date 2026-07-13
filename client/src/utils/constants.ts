export const DEFAULT_TICKERS = [
  'NVDA',
  'MSFT',
  'GOOGL',
  'META',
  'AMZN',
  'AAPL',
  'TSLA',
  'AMD',
  'AVGO',
  'CRM',
] as const;

export const WATCHLIST_LIMIT = 15;

export const REFRESH_INTERVAL_MS = 60_000;

export const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

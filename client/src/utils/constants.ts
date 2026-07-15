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

/** Free API tier — poll live UI data at most once per minute. */
export const FREE_PLAN_REFRESH_MS = 60_000;

export const REFRESH_INTERVAL_MS = FREE_PLAN_REFRESH_MS;

export const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

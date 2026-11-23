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

function resolveApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_URL;
  if (typeof configured === 'string' && configured.trim().length > 0) {
    return configured.trim().replace(/\/$/, '');
  }
  // Production / Docker image: same-origin API (FastAPI serves the SPA)
  if (import.meta.env.PROD) return '';
  return 'http://localhost:8000';
}

export const API_BASE_URL = resolveApiBaseUrl();

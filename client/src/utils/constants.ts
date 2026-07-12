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
  'PLTR',
  'SNOW',
  'ORCL',
  'IBM',
  'INTC',
  'QCOM',
  'MU',
  'ARM',
  'SMCI',
  'AI',
] as const;

export const REFRESH_INTERVAL_MS = 60_000;

export const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

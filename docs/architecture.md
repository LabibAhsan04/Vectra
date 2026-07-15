# Vectra Architecture

Vectra is a full-stack **research-signal** platform (not a trading bot).

```
Browser (React / Vercel)
        │  HTTPS
        ▼
FastAPI API (Railway)
        │
        ├─ market_data.py  → Polygon / Finnhub / Alpha Vantage
        ├─ news_service.py → Finnhub news + relevance scoring
        ├─ indicators.py   → MA / RSI / volume averages
        ├─ signal_engine.py→ Factor scores + contribution notes
        ├─ scoring.py      → Weighted final score + Bullish/Neutral/Bearish label
        ├─ ai_explainer.py → OpenRouter explanation (or template fallback)
        ├─ alerts.py       → Dashboard alerts on label/score shifts
        ├─ backtesting.py  → Forward-return analysis on saved signals
        └─ database.py     → SQLite (signals, news_items, alerts, watchlist)
```

## Data flow

1. **APIs** fetch quote, history, and news.
2. **Normalization** maps provider payloads into shared schemas.
3. **Indicators** derive MA20/MA50, RSI, relative volume.
4. **Signal engine** builds category scores with explicit contribution notes.
5. **Scoring** computes a reproducible final score and research label.
6. **OpenRouter** (optional) explains the structured payload only — it does not invent fundamentals or change the score.
7. **Database** persists signal snapshots, classified news, and alerts.
8. **UI** renders Signal Analysis, history, alerts, news, peer comparison, and backtesting-lite.

## Production safety

- Interactive API docs are disabled on Railway / `ENV=production`.
- Per-IP rate limiting protects `/api/analyze`, snapshots, and WebSocket routes.
- All market-data and AI keys remain server-side only.

## Caching

| Data | Typical TTL |
|------|-------------|
| Quotes | 30–60 seconds |
| Price history | ~15 minutes |
| News | ~20 minutes |
| OpenRouter explanations | ~45 minutes (keyed by ticker + score + label) |
| Company profile inputs | up to 24 hours when available |

## Fallback behavior

- **Finnhub rate limit:** return cached news/quotes when available; show a friendly warning; do not crash the UI.
- **Alpha Vantage rate limit:** continue with Finnhub/Polygon when possible.
- **OpenRouter failure / missing key:** deterministic template explanation from the score breakdown.
- **All APIs fail:** graceful empty state — “Data temporarily unavailable. Try refreshing in a few minutes.”

## Product rule

Vectra only generates evidence-based **Bullish / Neutral / Bearish** research signals. It does not provide financial advice and does not execute trades.

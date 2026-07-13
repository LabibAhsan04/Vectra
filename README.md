# Vectra

Vectra is an evidence-based stock intelligence platform that analyzes price momentum, technical indicators, news relevance, and AI-assisted explanations to generate transparent bullish, neutral, or bearish research signals.

> **Disclaimer:** Vectra is for educational and research purposes only. It does not provide financial advice and does not execute trades.

## Overview

Vectra demonstrates a production-minded CS/fintech portfolio stack: live market APIs, a transparent scoring engine, SQLite persistence, OpenRouter explanations with anti-hallucination guards, caching, alerts, backtesting-lite, pytest coverage, and Vercel + Railway deployment.

| Vectra does | Vectra does not |
|-------------|-----------------|
| Score evidence across momentum, technicals, sentiment, growth, data quality | Execute trades |
| Label **Bullish / Neutral / Bearish** research signals | Give buy/sell/hold advice or price targets |
| Explain scores with OpenRouter (or a template fallback) | Let the LLM invent fundamentals or override scores |
| Split company vs market/sector news with relevance scores | Guarantee outcomes |

Live app: [vectra-green.vercel.app](https://vectra-green.vercel.app)

## Features

- Live quotes, charts (MA20/MA50 toggles), and watchlist
- Transparent **Signal Analysis** with score circle, formula, and contribution notes
- Company News vs Market & Sector News + relevance tags (`Company`, `Sector`, `Competitor`, `Market`, `ETF`)
- SQLite signal history, dashboard alerts, and backtesting-lite (1D/5D/20D)
- OpenRouter explanation layer with template fallback and ~45 min cache
- Graceful rate-limit/empty states

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React, TypeScript, Vite, Tailwind, Zustand, Recharts → Vercel |
| Backend | Python, FastAPI, SQLAlchemy, SQLite → Railway |
| Data | Finnhub, Polygon, Alpha Vantage (optional) |
| AI | OpenRouter (`openrouter/free` default) |
| Tests | pytest |

## Architecture

See [docs/architecture.md](docs/architecture.md).

```
APIs → normalize → indicators → signal engine → OpenRouter explain → SQLite → UI
```

## How the Signal Engine Works

Weights (reproducible in the UI):

```
Final Score = Momentum×0.25 + Technical×0.25 + Sentiment×0.20
            + Fundamentals×0.15 + Growth×0.15
```

Thresholds: Strong Bullish ≥80, Bullish ≥65, Neutral mid-range, Bearish ≤40, Strong Bearish ≤20.

Full methodology: [docs/scoring_methodology.md](docs/scoring_methodology.md).

## Data Sources

- **Price / history:** Polygon → Finnhub → Alpha Vantage fallback
- **News:** Finnhub company feed, then relevance-classified
- **Explanations:** OpenRouter; template fallback if missing/rate-limited

## OpenRouter AI Explanation Layer

- Uses only structured evidence (scores, notes, headlines already fetched)
- Must not invent revenue, earnings, margins, partnerships, or analyst upgrades
- Must not use buy/sell/hold, guaranteed, or price-target language
- Cached ~45 minutes per ticker + score + label; template if OpenRouter fails

## Database Schema

SQLite tables (plus watchlist):

- `signals` — score snapshot, factor scores, explanation, sources
- `news_items` — headlines with relevance + sentiment
- `alerts` — label/score/volume/MA transition messages

## Backtesting-Lite

Saved signals are aligned to price history for forward returns (1 / 5 / 20 trading days), win rate by label, and averages by score bucket. Historical only — not a performance guarantee.

## Screenshots

Add local screenshots under `docs/screenshots/` after deploy (dashboard, Signal Analysis, news split, backtesting).

## Setup Instructions

```bash
cp .env.example .env
cp client/.env.example client/.env
```

Put API keys in the **root** `.env` (server-side only). Never commit `.env`.

## Environment Variables

| Variable | Where | Notes |
|----------|-------|-------|
| `POLYGON_API_KEY` | server / Railway | Quotes/history |
| `FINNHUB_API_KEY` | server / Railway | Quotes/news |
| `ALPHA_VANTAGE_KEY` | server / Railway | History fallback |
| `OPENROUTER_API_KEY` | server / Railway | Explanations |
| `OPENROUTER_MODEL` | server / Railway | Default `openrouter/free` |
| `ALLOWED_ORIGINS` | Railway | Include Vercel URL |
| `DATABASE_URL` | Railway | SQLite path |
| `VITE_API_URL` | Vercel | Railway API base URL (no trailing slash) |

## How to Run Locally

```bash
# API
cd server
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000

# UI (second terminal)
cd client
npm install
npm run dev -- --host 127.0.0.1 --port 3000
```

- API health: http://127.0.0.1:8000/health  
- App: http://127.0.0.1:3000  

### Tests

```bash
cd server && source .venv/bin/activate
pip install -r requirements.txt
cd ..
pytest
```

## Deployment

### Backend — Railway

1. Deploy from GitHub with **Root Directory** = `server`
2. Set API keys + `ALLOWED_ORIGINS` (include production Vercel URL)
3. Optional volume: `DATABASE_URL=sqlite:////data/stocks.db`

### Frontend — Vercel

1. **Root Directory** = `client`
2. Set `VITE_API_URL` to the Railway URL (no trailing slash)
3. Redeploy API if CORS origins change

**Secrets never ship to the browser** — only `VITE_API_URL` is public.

## Limitations

- Free API tiers rate-limit and often omit full fundamentals
- Signal quality depends on news coverage and price history availability
- SQLite on ephemeral hosts loses data unless a volume is mounted
- Backtesting needs multiple saved signal snapshots over time

## Disclaimer

Vectra is for educational and research purposes only. It does not provide financial advice and does not execute trades.

## Future Improvements

- Richer fundamental ingestion (earnings transcripts / filings)
- Multi-ticker watchlist score refresh
- Persistent alert notifications (email/webhook)
- Longer horizon backtests and walk-forward evaluation
- Auth + per-user watchlists

## License

MIT

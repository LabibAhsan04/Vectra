# Vectra

<p align="center">
  <img src="client/public/vectra-logo.png" alt="Vectra — Real-time signals" width="320" />
</p>

**Evidence-based stock signal intelligence** — a full-stack research dashboard that scores momentum, technicals, sentiment, fundamentals, and catalysts, then explains the result with transparent math and an AI layer.

[![Live Demo](https://img.shields.io/badge/demo-vectra--green.vercel.app-22c55e)](https://vectra-green.vercel.app)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> **Disclaimer:** Vectra is for educational and research purposes only. It does not provide financial advice and does not execute trades.

---

## Why Vectra?

Most stock dashboards either dump raw data or hide the logic behind a black-box “AI score.” Vectra sits in the middle:

| Vectra does | Vectra does not |
|-------------|-----------------|
| Score evidence across 5 weighted factors | Execute trades |
| Show the formula, weights, and contribution notes | Invent fundamentals or override scores with AI |
| Label **Bullish / Neutral / Bearish** research signals | Give buy/sell instructions as financial advice |
| Split company vs market news with relevance tags | Guarantee outcomes |

**Live app:** [vectra-green.vercel.app](https://vectra-green.vercel.app)

---

## Features

### Market & watchlist
- Live quotes (Finnhub-first) with WebSocket refresh (~60s on free tier)
- Watchlist ticker bar with **BUY / HOLD / SELL** badges (refreshes every minute)
- Batch watchlist snapshot API — one request for Home + ticker bar
- Persistent shared watchlist (SQLite + Railway volume, or PostgreSQL)

### Charts & indicators
- Price history (1M → 5Y) with MA20, MA50, Bollinger Bands, MACD, volume
- Dark / light theme

### Signal engine
- Deterministic 5-factor scoring (Momentum, Technical, Sentiment, Fundamentals, Growth)
- Finnhub fundamentals: P/E, revenue growth, margins, ROE
- OpenRouter explanations with anti-hallucination guards + template fallback
- Peer comparison vs sector competitors + SPY
- Earnings calendar card

### News & alerts
- Company vs Market & Sector news with relevance classification
- System alerts (score changes, MA crosses, volume spikes)

### Research tools
- Signal history chart + daily auto-snapshots
- Backtesting-lite with SPY benchmark comparison

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, Zustand, Recharts |
| Backend | Python 3.12, FastAPI, SQLAlchemy |
| Database | SQLite (local / Railway volume) or PostgreSQL |
| Data | Finnhub, Polygon, Alpha Vantage (fallback) |
| AI | OpenRouter |
| Deploy | Vercel (UI) + Railway (API) |
| CI | GitHub Actions (pytest + TypeScript) |

---

## Architecture

```
Market APIs → normalize → indicators → signal engine → OpenRouter explain → DB → React UI
```

See [docs/architecture.md](docs/architecture.md) and [docs/scoring_methodology.md](docs/scoring_methodology.md).

### Scoring formula

```
Final = Momentum×0.25 + Technical×0.25 + Sentiment×0.20
      + Fundamentals×0.15 + Growth×0.15
```

Thresholds: Strong Bullish ≥80 · Bullish ≥65 · Neutral mid-range · Bearish ≤40 · Strong Bearish ≤20.

---

## Quick start

### 1. Clone & configure

```bash
git clone https://github.com/LabibAhsan04/Vectra.git
cd Vectra
cp .env.example .env
cp client/.env.example client/.env
```

Add your API keys to the **root** `.env` only. **Never commit `.env`.**

### 2. Run locally

```bash
# Terminal 1 — API
cd server
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000

# Terminal 2 — UI
cd client
npm install
npm run dev -- --host 127.0.0.1 --port 3000
```

- API: http://127.0.0.1:8000/health  
- App: http://127.0.0.1:3000  
- API docs (dev only): http://127.0.0.1:8000/docs  

### 3. Tests

```bash
cd server && source .venv/bin/activate && pip install -r requirements.txt
cd .. && pytest
cd client && npx tsc -p tsconfig.app.json --noEmit
```

---

## Environment variables

| Variable | Where | Required | Notes |
|----------|-------|----------|-------|
| `POLYGON_API_KEY` | server | Yes | Quotes / history |
| `FINNHUB_API_KEY` | server | Yes | Quotes / news / fundamentals |
| `OPENROUTER_API_KEY` | server | Recommended | AI explanations |
| `OPENROUTER_MODEL` | server | No | Default `openrouter/free` |
| `ALPHA_VANTAGE_KEY` | server | No | History fallback |
| `DATABASE_URL` | server | No | Auto-resolves; see below |
| `ALLOWED_ORIGINS` | server | Prod | Include your Vercel URL |
| `ALLOWED_ORIGIN_REGEX` | server | Prod | Default allows `*.vercel.app` |
| `RATE_LIMIT_ENABLED` | server | No | Auto `true` on Railway |
| `VITE_API_URL` | Vercel | Prod | Railway API URL (no trailing slash) |

**Only `VITE_API_URL` is public** in the browser bundle. All API keys stay server-side.

### Database

| Environment | Path |
|-------------|------|
| Local dev | `server/data/stocks.db` (auto-created) |
| Railway | Mount volume at `/data` → uses `/data/stocks.db` |
| PostgreSQL | `DATABASE_URL=postgresql://user:pass@host:5432/vectra` |

---

## Deployment

### Backend — Railway

1. Connect GitHub repo, set **Root Directory** = `server`
2. Add API keys + `ALLOWED_ORIGINS` (your Vercel URL)
3. Mount a **volume at `/data`** for persistent SQLite
4. Health check: `/health`

Production defaults (no extra config needed on Railway):

- API docs (`/docs`) **disabled**
- Rate limiting **enabled** (protects OpenRouter + market-data quotas)
- Database path hidden from `/health`

### Frontend — Vercel

1. **Root Directory** = `client`
2. Set `VITE_API_URL` to your Railway URL
3. Redeploy after CORS changes on the API

---

## API overview

| Endpoint | Description |
|----------|-------------|
| `GET /api/watchlist/snapshot` | Batch quotes + BUY/HOLD/SELL signals |
| `POST /api/analyze` | Run signal analysis |
| `GET /api/peers/{ticker}` | Peer comparison |
| `GET /api/earnings/{ticker}` | Earnings calendar |
| `GET /api/signals/{ticker}/history` | Signal history |
| `GET /api/backtest/{ticker}` | Backtesting-lite |
| `WS /api/ws/quotes/{ticker}` | Live quote stream |

Interactive docs: `/docs` when running locally (disabled in production).

---

## Limitations

- Free API tiers rate-limit and may omit some fundamentals
- Backtesting needs accumulated signal history over time
- AI explanations describe pre-computed scores — they do not fetch new facts
- Research use only — not financial advice

---

## Security

See [SECURITY.md](SECURITY.md) for vulnerability reporting and deployment checklist.

---

## Contributing

Issues and PRs welcome. Please do not commit secrets or `.env` files.

1. Fork the repo
2. Create a feature branch
3. Run `pytest` and `npx tsc -p tsconfig.app.json --noEmit`
4. Open a PR with a clear description

---

## License

MIT — see [LICENSE](LICENSE).

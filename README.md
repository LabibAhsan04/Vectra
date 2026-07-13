# Vectra

Stock intelligence dashboard — live prices, news aggregation, sentiment scoring, and model-generated buy/hold/sell analysis for tech stocks.

> **Disclaimer:** Research and learning tool only. Does not execute trades. Always do your own research before investing.

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Tailwind CSS, Zustand, Recharts |
| Backend | FastAPI, SQLAlchemy, SQLite |
| Data | Polygon.io, Finnhub, Alpha Vantage, NewsAPI |
| Analysis | OpenRouter (LLM gateway) |

## Project structure

```
Vectra/
├── client/          # React frontend (port 3000) → Vercel
├── server/          # FastAPI backend (port 8000) → Railway
├── .env.example     # API keys template (copy to .env)
└── docker-compose.yml
```

## Phase 1 — Setup

- [x] Monorepo folder structure
- [x] React + TypeScript frontend with Tailwind CSS
- [x] FastAPI backend skeleton with routers, models, schemas
- [x] Environment variable templates
- [x] API verification script

## Phase 2 — Backend quotes

- [x] `GET /health`
- [x] `GET /api/stock/{ticker}` via Polygon (free-tier aggregates)

## Phase 3 — Frontend quotes

- [x] Ticker bar + stock card UI
- [x] Live quote fetch from backend API

## Phase 4 — News

- [x] Finnhub news endpoint
- [x] NewsPanel with headlines per ticker

## Phase 5 — AI analysis

- [x] OpenRouter analysis endpoint (`POST /api/analyze`)
- [x] AIAnalysis panel with signal, score, and factor bars

## Phase 6 — Score gauge

- [x] Weighted composite 0–100 score from factor scores
- [x] Animated circular `ScoreGauge` in the AI Analysis panel

## Phase 7 — Price charts

- [x] `GET /api/stock/{ticker}/history` (Polygon + Finnhub + Alpha Vantage fallbacks)
- [x] Recharts `PriceChart` with range toggles (1M–5Y)
- [x] 15-minute history cache to reduce rate limits

## Phase 8 — Watchlist

- [x] SQLite-backed watchlist API (`GET/POST/DELETE /api/watchlist`)
- [x] WatchList panel with add/remove and ticker selection

## Phase 9 — Polish

- [x] Shared API error helper + friendlier provider messages
- [x] Loading skeletons, empty states, and retry actions
- [x] Focus rings, `aria-pressed` / `aria-live` / labels
- [x] Mobile padding and watchlist-first column order
- [x] Ticker bar scroll cue + per-chip loading states

## Phase 10 — Deploy

- [x] Railway-ready FastAPI (`PORT`, healthcheck, `railway.toml`)
- [x] Vercel-ready Vite app (`vercel.json`)
- [x] Production CORS (`ALLOWED_ORIGINS` + Vercel preview regex)

### Backend — Railway

1. Push this repo to GitHub (already on `main`).
2. In [Railway](https://railway.app): **New Project → Deploy from GitHub** → select `Vectra`.
3. Set **Root Directory** to `server`.
4. Add variables (from your local `.env`):

| Variable | Notes |
|----------|--------|
| `POLYGON_API_KEY` | required |
| `FINNHUB_API_KEY` | required |
| `ALPHA_VANTAGE_KEY` | recommended |
| `NEWS_API_KEY` | optional (news falls back to Finnhub) |
| `OPENROUTER_API_KEY` | required for AI analysis |
| `OPENROUTER_MODEL` | e.g. `openai/gpt-4o-mini` |
| `ALLOWED_ORIGINS` | include your Vercel URL (see below) |
| `DATABASE_URL` | default `sqlite:///./stocks.db` (ephemeral) |

5. Deploy, then open the public URL + `/health` — expect `{"status":"ok"}`.
6. Copy the public API base URL (no trailing slash), e.g. `https://vectra-api.up.railway.app`.

Optional: attach a Railway volume at `/data` and set `DATABASE_URL=sqlite:////data/stocks.db` so the watchlist survives redeploys.

### Frontend — Vercel

1. In [Vercel](https://vercel.com): **Add New Project** → import `Vectra`.
2. Set **Root Directory** to `client`.
3. Framework: Vite (auto). Build: `npm run build`. Output: `dist`.
4. Environment variable:

| Variable | Value |
|----------|--------|
| `VITE_API_URL` | Railway API URL from above |

5. Deploy. Copy the Vercel URL (e.g. `https://vectra.vercel.app`).
6. Back on Railway, update `ALLOWED_ORIGINS` to include that URL (comma-separated with local origins if you want), then redeploy the API.

```bash
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,https://vectra.vercel.app
```

Preview deployments on `*.vercel.app` are allowed by default via `ALLOWED_ORIGIN_REGEX`.

### Verify production

1. Open the Vercel site — quotes, news, chart, watchlist, and AI analysis should work.
2. Browser Network tab: API calls go to your Railway host, not `localhost`.
3. If CORS errors appear, double-check `ALLOWED_ORIGINS` matches the exact Vercel origin (https, no trailing slash).

## Quick start

### 1. Clone and configure environment

```bash
cp .env.example .env
cp client/.env.example client/.env
```

Add your API keys to `.env`:

| Variable | Sign up |
|----------|---------|
| `POLYGON_API_KEY` | [polygon.io/dashboard](https://polygon.io/dashboard) |
| `FINNHUB_API_KEY` | [finnhub.io/register](https://finnhub.io/register) |
| `OPENROUTER_API_KEY` | [openrouter.ai](https://openrouter.ai) |
| `ALPHA_VANTAGE_KEY` | [alphavantage.co/support](https://www.alphavantage.co/support/#api-key) |
| `NEWS_API_KEY` | [newsapi.org/register](https://newsapi.org/register) |

### 2. Backend

```bash
cd server
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Health check: [http://localhost:8000/health](http://localhost:8000/health)

### 3. Frontend

```bash
cd client
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 4. Verify API keys

```bash
cd server
python scripts/verify_apis.py
```

All five services should report ✓ before moving to Phase 2.

## Build phases

| Phase | Goal |
|-------|------|
| **1** | Project setup, deps, env, API verification |
| 2 | FastAPI + Polygon price endpoint |
| 3 | React dashboard skeleton + live price display |
| 4 | Finnhub news integration |
| 5 | LLM analysis layer |
| 6 | Composite score system |
| 7 | Historical price charts |
| 8 | Watchlist persistence |
| **9** | Polish (loading states, a11y, mobile) |
| **10** | Deploy to Vercel + Railway |

## Docker (optional)

```bash
docker compose up --build
```

## License

MIT

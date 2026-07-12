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
├── client/          # React frontend (port 3000)
├── server/          # FastAPI backend (port 8000)
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
| 9 | Polish (loading states, dark mode, mobile) |
| 10 | Deploy to Vercel + Railway |

## Docker (optional)

```bash
docker compose up --build
```

## License

MIT

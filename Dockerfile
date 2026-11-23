# Vectra — standard single-container Docker image (any host that runs Docker)
# Frontend (Vite/React) is built and served by the FastAPI backend on port 3000.
# Compatible with read-only root + writable /tmp (e.g. LaunchBase / Traefik).

# ---- Frontend build ----
FROM node:22-alpine AS frontend
WORKDIR /build/client

COPY client/package.json client/package-lock.json ./
RUN npm ci

COPY client/ ./
# Empty VITE_API_URL → same-origin /api calls in the browser
ENV VITE_API_URL=
RUN npm run build

# ---- Backend runtime ----
FROM python:3.12-slim AS runtime

WORKDIR /app

RUN useradd --create-home --uid 10001 appuser

COPY server/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server/ .
COPY --from=frontend /build/client/dist ./static

# Writable state lives under /tmp (tmpfs). Do not require /app or /data writes.
ENV PORT=3000 \
    PYTHONUNBUFFERED=1 \
    ENV=production \
    HOME=/tmp \
    TMPDIR=/tmp \
    XDG_CACHE_HOME=/tmp/cache \
    VECTRA_DATA_DIR=/tmp/vectra

USER appuser

EXPOSE 3000

# Health: GET / returns the SPA (HTTP 200). /health also works for API checks.
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-3000}"]

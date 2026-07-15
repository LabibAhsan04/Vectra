"""In-memory per-IP rate limiting for expensive public API routes."""

from __future__ import annotations

import time
from collections import defaultdict, deque
from typing import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

# (method, path_prefix, max_hits, window_seconds)
_RULES: tuple[tuple[str | None, str, int, int], ...] = (
    ("POST", "/api/analyze", 10, 60),
    (None, "/api/watchlist/snapshot", 40, 60),
    (None, "/api/ws/", 30, 60),
    (None, "/api/", 120, 60),
)


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, *, enabled: bool = True) -> None:
        super().__init__(app)
        self.enabled = enabled
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def _check(self, key: str, limit: int, window: int) -> bool:
        now = time.monotonic()
        bucket = self._hits[key]
        while bucket and now - bucket[0] > window:
            bucket.popleft()
        if len(bucket) >= limit:
            return False
        bucket.append(now)
        return True

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if not self.enabled:
            return await call_next(request)

        path = request.url.path
        if path in {"/health", "/"}:
            return await call_next(request)

        ip = _client_ip(request)
        method = request.method.upper()

        for rule_method, prefix, limit, window in _RULES:
            if not path.startswith(prefix):
                continue
            if rule_method is not None and method != rule_method:
                continue
            key = f"{ip}:{rule_method or '*'}:{prefix}"
            if not self._check(key, limit, window):
                return JSONResponse(
                    status_code=429,
                    content={
                        "detail": "Rate limit exceeded. Please wait a moment and try again."
                    },
                )
            break

        return await call_next(request)

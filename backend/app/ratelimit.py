"""In-memory, per-IP rate limiting for the cost-bearing endpoints.

The public API's `/cohort/build` and `/cohort/stream` call OpenAI, and `/eval/run`
is compute-heavy, so an unthrottled endpoint could drain the API budget or the dyno.
This guards them with two sliding windows (per-minute and per-hour) keyed by client
IP, returning HTTP 429 with a `Retry-After` header. State is per-process, which is the
whole picture on a single dyno; set a limit to 0 in config to disable that window.
"""
from __future__ import annotations

import logging
import threading
import time
from collections import deque

from fastapi import HTTPException, Request

from .config import settings

logger = logging.getLogger("cohortfit")

_lock = threading.Lock()
_hits: dict[str, deque[float]] = {}
_next_sweep = 0.0


def _client_ip(request: Request) -> str:
    # Behind Heroku's router the real client is the first hop in X-Forwarded-For.
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _deny(key: str, retry_after: int, window: str, limit: int) -> None:
    retry_after = max(1, retry_after)
    logger.warning("rate limit: %s exceeded %d per %s", key, limit, window)
    raise HTTPException(
        status_code=429,
        detail=f"Rate limit exceeded ({limit} requests per {window}). Please wait and retry.",
        headers={"Retry-After": str(retry_after)},
    )


def _sweep(now: float) -> None:
    """Occasionally drop fully-expired IP entries so memory stays bounded."""
    global _next_sweep
    if now < _next_sweep:
        return
    _next_sweep = now + 600
    for k in [k for k, dq in _hits.items() if not dq or dq[-1] <= now - 3600]:
        del _hits[k]


def rate_limit(request: Request) -> None:
    """FastAPI dependency: raise 429 if the caller exceeds the per-IP windows."""
    per_min = settings.rate_limit_per_minute
    per_hour = settings.rate_limit_per_hour
    if per_min <= 0 and per_hour <= 0:
        return
    key = _client_ip(request)
    now = time.monotonic()
    with _lock:
        _sweep(now)
        dq = _hits.setdefault(key, deque())
        while dq and dq[0] <= now - 3600:
            dq.popleft()
        if per_min > 0:
            recent = [t for t in dq if t > now - 60]
            if len(recent) >= per_min:
                _deny(key, int(recent[0] + 60 - now) + 1, "minute", per_min)
        if per_hour > 0 and len(dq) >= per_hour:
            _deny(key, int(dq[0] + 3600 - now) + 1, "hour", per_hour)
        dq.append(now)

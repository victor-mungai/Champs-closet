import threading
import time

from fastapi import Request
from fastapi.responses import JSONResponse

from app.config import RATE_LIMIT_ENABLED, RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW_SECONDS, REQUEST_ID_HEADER
from app.middleware.request_id import ensure_request_id


class _InMemoryRateLimiter:
    def __init__(self, *, limit: int, window_seconds: int):
        self.limit = max(1, limit)
        self.window_seconds = max(1, window_seconds)
        self._entries: dict[str, tuple[int, float]] = {}
        self._lock = threading.Lock()
        self._last_gc = time.monotonic()

    def _gc(self, now: float) -> None:
        if now - self._last_gc < self.window_seconds:
            return
        stale_before = now - (self.window_seconds * 2)
        self._entries = {
            key: value
            for key, value in self._entries.items()
            if value[1] > stale_before
        }
        self._last_gc = now

    def consume(self, key: str) -> tuple[bool, int, int]:
        now = time.monotonic()
        with self._lock:
            self._gc(now)

            count, reset_at = self._entries.get(key, (0, now + self.window_seconds))
            if now >= reset_at:
                count = 0
                reset_at = now + self.window_seconds

            if count >= self.limit:
                retry_after = max(1, int(reset_at - now))
                return False, 0, retry_after

            count += 1
            self._entries[key] = (count, reset_at)
            remaining = max(0, self.limit - count)
            retry_after = max(1, int(reset_at - now))
            return True, remaining, retry_after


_limiter = _InMemoryRateLimiter(
    limit=RATE_LIMIT_REQUESTS,
    window_seconds=RATE_LIMIT_WINDOW_SECONDS,
)


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get('x-forwarded-for')
    if forwarded:
        first = forwarded.split(',')[0].strip()
        if first:
            return first
    if request.client and request.client.host:
        return request.client.host
    return 'unknown'


async def enforce_rate_limit(request: Request, call_next):
    if not RATE_LIMIT_ENABLED:
        return await call_next(request)

    if request.method == 'OPTIONS' or request.url.path == '/health':
        return await call_next(request)

    request_id = ensure_request_id(request)
    key = f"{_client_ip(request)}:{request.method}:{request.url.path}"
    allowed, remaining, retry_after = _limiter.consume(key)

    if not allowed:
        response = JSONResponse(
            status_code=429,
            content={
                'error': 'Rate limit exceeded',
                'request_id': request_id,
                'retry_after_seconds': retry_after,
            },
        )
    else:
        response = await call_next(request)

    response.headers['X-RateLimit-Limit'] = str(RATE_LIMIT_REQUESTS)
    response.headers['X-RateLimit-Remaining'] = str(remaining)
    response.headers['X-RateLimit-Window'] = str(RATE_LIMIT_WINDOW_SECONDS)
    response.headers[REQUEST_ID_HEADER] = request_id
    if not allowed:
        response.headers['Retry-After'] = str(retry_after)
    return response

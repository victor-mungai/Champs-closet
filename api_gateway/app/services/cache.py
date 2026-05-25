import json
import logging

import redis

from app.config import CACHE_ENABLED, CACHE_TTL_SECONDS, REDIS_URL

logger = logging.getLogger('api_gateway.cache')

redis_client: redis.Redis | None = None

if CACHE_ENABLED:
    try:
        redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)
        redis_client.ping()
    except Exception as exc:
        redis_client = None
        logger.warning('Cache disabled: Redis unavailable (%s)', exc)


def is_cache_enabled() -> bool:
    return bool(CACHE_ENABLED and redis_client is not None)


def get_json(cache_key: str):
    if not is_cache_enabled():
        return None

    try:
        raw = redis_client.get(cache_key)
        if not raw:
            return None
        return json.loads(raw)
    except Exception as exc:
        logger.warning('Cache get failed for key=%s (%s)', cache_key, exc)
        return None


def set_json(cache_key: str, payload, ttl_seconds: int | None = None) -> None:
    if not is_cache_enabled():
        return

    ttl = int(ttl_seconds or CACHE_TTL_SECONDS)
    if ttl <= 0:
        return

    try:
        redis_client.setex(cache_key, ttl, json.dumps(payload))
    except Exception as exc:
        logger.warning('Cache set failed for key=%s (%s)', cache_key, exc)


def invalidate_prefix(prefix: str) -> int:
    if not is_cache_enabled():
        return 0

    removed = 0
    pattern = f'{prefix}*'

    try:
        keys = list(redis_client.scan_iter(match=pattern, count=200))
        if keys:
            removed = int(redis_client.delete(*keys) or 0)
    except Exception as exc:
        logger.warning('Cache invalidate failed for prefix=%s (%s)', prefix, exc)

    return removed

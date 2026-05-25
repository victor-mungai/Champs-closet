import hashlib
import json
import logging
import time

import httpx
import redis

from app.config import (
    CACHE_TTL_SECONDS,
    GEMINI_TIMEOUT,
    MAX_RETRIES,
    PRODUCT_SERVICE_URL,
    REDIS_URL,
    STREAM_NAME,
)
from app.events import publish_event
from app.gemini import generate_description_and_tags
from app.metrics import metrics

logger = logging.getLogger('ai_service')
redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)

DEFAULT_DESCRIPTION = "Premium men's wear item."
DEFAULT_TAGS = ["fashion"]


def _cache_key(image_url: str) -> str:
    digest = hashlib.sha256(image_url.encode('utf-8')).hexdigest()
    return f"ai:{digest}"


def _get_cached(image_url: str) -> dict | None:
    key = _cache_key(image_url)
    cached = redis_client.get(key)
    if not cached:
        return None
    try:
        return json.loads(cached)
    except Exception:
        return None


def _set_cached(image_url: str, value: dict) -> None:
    key = _cache_key(image_url)
    try:
        redis_client.set(key, json.dumps(value), ex=CACHE_TTL_SECONDS)
    except Exception:
        pass


def _normalize_ai_output(result: dict | None) -> tuple[str, list[str]]:
    description = None
    tags = None
    if isinstance(result, dict):
        description = result.get('description')
        tags = result.get('tags')

    if not isinstance(description, str) or not description.strip():
        description = DEFAULT_DESCRIPTION

    if not isinstance(tags, list):
        tags = DEFAULT_TAGS.copy()

    clean_tags = [
        t.strip().lower()
        for t in tags
        if isinstance(t, str) and t.strip()
    ]

    if not clean_tags:
        clean_tags = DEFAULT_TAGS.copy()

    return description.strip(), clean_tags


def update_product_ai(product_id: int, description: str, tags: list[str]):
    payload = {
        "description": description,
        "tags": tags,
        "status": "enriched",
    }
    with httpx.Client(timeout=GEMINI_TIMEOUT) as client:
        res = client.patch(f"{PRODUCT_SERVICE_URL}/products/{product_id}/ai", json=payload)
        res.raise_for_status()
        return res.json()


def _emit_enriched_event(product_id: int, description: str, tags: list[str]) -> None:
    publish_event(
        STREAM_NAME,
        {
            "event_type": "product_ai_enriched",
            "data": {
                "product_id": product_id,
                "description": description,
                "tags": tags,
            },
        },
    )


def process_product(data: dict) -> bool:
    start = time.time()

    product_id = data.get('product_id')
    image_url = data.get('image_url')
    status = data.get('status')

    if not product_id or not image_url:
        logger.warning('Missing product_id or image_url', extra={"data": data})
        metrics.record_failure()
        return False

    if status == 'enriched':
        logger.info('Skipping already enriched product', extra={"product_id": product_id})
        return True

    cached = _get_cached(image_url)
    if cached:
        logger.info('Cache hit', extra={"product_id": product_id})
        description, clean_tags = _normalize_ai_output(cached)
        update_product_ai(product_id, description, clean_tags)
        metrics.record_success(time.time() - start)
        _emit_enriched_event(product_id, description, clean_tags)
        return True

    for attempt in range(MAX_RETRIES):
        try:
            result = generate_description_and_tags(image_url)
            if not result:
                raise RuntimeError('Empty AI response')

            description, clean_tags = _normalize_ai_output(result)
            update_product_ai(product_id, description, clean_tags)

            _set_cached(image_url, {"description": description, "tags": clean_tags})

            _emit_enriched_event(product_id, description, clean_tags)

            latency = time.time() - start
            metrics.record_success(latency)
            logger.info('AI enrichment complete', extra={"product_id": product_id, "latency": latency})
            return True
        except Exception as exc:
            logger.error(
                'AI processing failed',
                extra={"product_id": product_id, "attempt": attempt + 1, "error": str(exc)},
            )
            if attempt == MAX_RETRIES - 1:
                metrics.record_failure()
                return False
            time.sleep(2 ** attempt)

    metrics.record_failure()
    return False

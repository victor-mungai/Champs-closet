import json
import logging
from datetime import datetime, timezone

import redis

from app.config import PRODUCT_STREAM_MAXLEN, REDIS_URL

logger = logging.getLogger('product_service')
redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)


def publish_event(stream_name: str, event: dict) -> str:
    payload = event
    if 'timestamp' not in payload:
        payload['timestamp'] = datetime.now(timezone.utc).isoformat()
    try:
        return redis_client.xadd(
            stream_name,
            {"data": json.dumps(payload)},
            maxlen=PRODUCT_STREAM_MAXLEN,
            approximate=True,
        )
    except redis.exceptions.RedisError as exc:
        logger.warning('Failed to publish event', extra={"error": str(exc)})
        return ''

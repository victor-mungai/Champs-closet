import json
from datetime import datetime, timezone

import redis

from app.config import AI_EVENTS_MAXLEN, REDIS_URL

redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)


def publish_event(stream_name: str, event: dict) -> str:
    payload = event
    if 'timestamp' not in payload:
        payload['timestamp'] = datetime.now(timezone.utc).isoformat()
    return redis_client.xadd(
        stream_name,
        {"data": json.dumps(payload)},
        maxlen=AI_EVENTS_MAXLEN,
        approximate=True,
    )

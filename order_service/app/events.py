import json
from datetime import datetime, timezone
import redis

from app.config import ORDER_EVENTS_MAXLEN, REDIS_URL

redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)


def emit_event(event_type: str, data: dict) -> str:
    payload = {
        "event_type": event_type,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data": data,
    }
    return redis_client.xadd(
        'order_events',
        {"event": json.dumps(payload)},
        maxlen=ORDER_EVENTS_MAXLEN,
        approximate=True,
    )

import redis

from app.config import REDIS_URL
from app.metrics import increment

redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)


def is_processed(order_id: int) -> bool:
    key = f'receipt_sent:{order_id}'
    if redis_client.get(key):
        increment('duplicate_events_total')
        return True

    redis_client.set(key, '1', ex=86400)
    return False

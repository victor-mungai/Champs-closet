import hashlib

import redis

from app.config import REDIS_URL, RECEIPT_LINK_BASE_URL, RECEIPT_LINK_TTL_SECONDS, SECRET_KEY

redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)


def _link_key(token: str) -> str:
    return f'receipt_link:{token}'


def generate_token(order_id: int) -> str:
    raw = f'{order_id}-{SECRET_KEY}'
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()


def store_link(token: str, destination_url: str) -> None:
    redis_client.set(_link_key(token), destination_url, ex=RECEIPT_LINK_TTL_SECONDS)


def resolve_link(token: str) -> str | None:
    return redis_client.get(_link_key(token))


def build_receipt_url(token: str) -> str:
    return f'{RECEIPT_LINK_BASE_URL}/r/{token}'

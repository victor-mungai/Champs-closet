import asyncio
import json
import logging

import redis

from app.config import (
    AI_DLQ_MAXLEN,
    CONSUMER_GROUP,
    CONSUMER_NAME,
    CONSUMER_SLEEP_MS,
    DLQ_STREAM,
    MAX_CONCURRENCY,
    REDIS_URL,
    STREAM_NAME,
)
from app.service import process_product

logger = logging.getLogger('ai_service')
redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)


def ensure_consumer_group():
    try:
        redis_client.xgroup_create(STREAM_NAME, CONSUMER_GROUP, id='0', mkstream=True)
        logger.info('Consumer group created', extra={"group": CONSUMER_GROUP})
    except redis.exceptions.ResponseError as exc:
        if 'BUSYGROUP' in str(exc):
            return
        raise


def _send_dlq(payload: dict, error: str):
    try:
        redis_client.xadd(
            DLQ_STREAM,
            {
                "data": json.dumps(payload),
                "error": error,
            },
            maxlen=AI_DLQ_MAXLEN,
            approximate=True,
        )
    except Exception as exc:
        logger.error('Failed to write DLQ', extra={"error": str(exc)})


async def _process_message(msg_id: str, data: dict):
    payload = {}
    try:
        payload = json.loads(data.get('data', '{}'))
    except Exception as exc:
        _send_dlq({"raw": data}, f"invalid_json:{exc}")
        redis_client.xack(STREAM_NAME, CONSUMER_GROUP, msg_id)
        return

    event_type = payload.get('event_type')
    if event_type != 'product_created':
        redis_client.xack(STREAM_NAME, CONSUMER_GROUP, msg_id)
        return

    event_data = payload.get('data', payload)
    ok = await asyncio.to_thread(process_product, event_data)
    if ok:
        redis_client.xack(STREAM_NAME, CONSUMER_GROUP, msg_id)
        return

    _send_dlq(payload, 'processing_failed')
    redis_client.xack(STREAM_NAME, CONSUMER_GROUP, msg_id)


async def _process_batch(messages):
    semaphore = asyncio.Semaphore(MAX_CONCURRENCY)

    async def run_one(msg_id, data):
        async with semaphore:
            await _process_message(msg_id, data)

    tasks = [run_one(msg_id, data) for msg_id, data in messages]
    await asyncio.gather(*tasks, return_exceptions=True)


def consume():
    ensure_consumer_group()
    while True:
        messages = redis_client.xreadgroup(
            groupname=CONSUMER_GROUP,
            consumername=CONSUMER_NAME,
            streams={STREAM_NAME: '>'},
            block=CONSUMER_SLEEP_MS,
        )
        for _, msgs in messages:
            if not msgs:
                continue
            asyncio.run(_process_batch(msgs))

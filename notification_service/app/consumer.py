import json
import logging

import redis

from app.config import CONSUMER_GROUP, CONSUMER_NAME, DLQ_MAXLEN, DLQ_STREAM, REDIS_URL, STREAM_NAME
from app.events import handle_event
from app.metrics import increment

logger = logging.getLogger('notification_service.consumer')
redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)


def ensure_group() -> None:
    try:
        redis_client.xgroup_create(STREAM_NAME, CONSUMER_GROUP, id='0', mkstream=True)
        logger.info('Notification consumer group created', extra={'group': CONSUMER_GROUP})
    except redis.exceptions.ResponseError as exc:
        if 'BUSYGROUP' not in str(exc):
            raise


def _send_dlq(payload: dict, error: str) -> None:
    redis_client.xadd(
        DLQ_STREAM,
        {
            'error': error,
            'payload': json.dumps(payload),
        },
        maxlen=DLQ_MAXLEN,
        approximate=True,
    )


def consume() -> None:
    ensure_group()
    while True:
        messages = redis_client.xreadgroup(
            CONSUMER_GROUP,
            CONSUMER_NAME,
            {STREAM_NAME: '>'},
            count=10,
            block=5000,
        )

        for _, msg_list in messages:
            for msg_id, msg_data in msg_list:
                raw_event = msg_data.get('event', '{}')
                try:
                    payload = json.loads(raw_event)
                    handle_event(payload)
                    redis_client.xack(STREAM_NAME, CONSUMER_GROUP, msg_id)
                except Exception as exc:
                    increment('events_failed_total')
                    logger.exception('Notification event failed', extra={'error': str(exc), 'message_id': msg_id})
                    _send_dlq({'message_id': msg_id, 'event': raw_event}, str(exc))
                    redis_client.xack(STREAM_NAME, CONSUMER_GROUP, msg_id)

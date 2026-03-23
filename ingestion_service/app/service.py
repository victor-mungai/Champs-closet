import hashlib
import logging
import time
import asyncio

from app.ai_parser import parse_product_text
from app.client import create_product
from app.config import ALLOWED_NUMBERS, SESSION_TTL, IMAGE_GRACE_SECONDS
from app.redis_client import redis_client
from app.uploader import upload_image
from app.whatsapp import parse_whatsapp_payload

logger = logging.getLogger('ingestion_service')


def _session_key(phone: str) -> str:
    return f"wa_session:{phone}"


def _text_key(phone: str) -> str:
    return f"wa_texts:{phone}"


def _lock_key(phone: str) -> str:
    return f"wa_lock:{phone}"


def _last_image_key(phone: str) -> str:
    return f"wa_last_image_at:{phone}"


def _dedupe_key(phone: str, text: str) -> str:
    digest = hashlib.sha256(text.encode('utf-8')).hexdigest()
    return f"wa_text_processed:{phone}:{digest}"


def _store_images(phone: str, image_urls: list[str]) -> None:
    key = _session_key(phone)
    if image_urls:
        redis_client.rpush(key, *image_urls)
        redis_client.expire(key, SESSION_TTL)
        redis_client.set(_last_image_key(phone), str(time.time()), ex=SESSION_TTL)
        logger.info('Stored images', extra={"phone": phone, "count": len(image_urls)})


def _store_text(phone: str, text: str) -> None:
    key = _text_key(phone)
    redis_client.rpush(key, text)
    redis_client.expire(key, SESSION_TTL)
    logger.info('Stored text', extra={"phone": phone})


def _peek_images(phone: str) -> list[str]:
    key = _session_key(phone)
    images = redis_client.lrange(key, 0, -1)
    return images or []


def _peek_text(phone: str) -> str | None:
    key = _text_key(phone)
    return redis_client.lindex(key, 0)


def _pop_text(phone: str) -> None:
    redis_client.lpop(_text_key(phone))


def _consume_images(phone: str, count: int) -> None:
    key = _session_key(phone)
    if count <= 0:
        return
    length = redis_client.llen(key)
    if length <= count:
        redis_client.delete(key)
        redis_client.delete(_last_image_key(phone))
        return
    redis_client.ltrim(key, count, -1)


def _clear_all_buffers(phone: str) -> None:
    redis_client.delete(_session_key(phone))
    redis_client.delete(_text_key(phone))
    redis_client.delete(_last_image_key(phone))


def _is_allowed(phone: str | None) -> bool:
    if not ALLOWED_NUMBERS:
        return True
    return bool(phone) and phone in ALLOWED_NUMBERS


def _is_duplicate(phone: str, text: str) -> bool:
    key = _dedupe_key(phone, text)
    if redis_client.get(key):
        return True
    redis_client.set(key, '1', ex=300)
    return False


def _acquire_lock(phone: str) -> bool:
    key = _lock_key(phone)
    return bool(redis_client.set(key, '1', nx=True, ex=8))


def _release_lock(phone: str) -> None:
    redis_client.delete(_lock_key(phone))


def _get_last_image_at(phone: str) -> float | None:
    value = redis_client.get(_last_image_key(phone))
    if not value:
        return None
    try:
        return float(value)
    except Exception:
        return None


async def _wait_for_images(phone: str) -> None:
    if IMAGE_GRACE_SECONDS <= 0:
        return
    last_image_at = _get_last_image_at(phone)
    if not last_image_at:
        return
    elapsed = time.time() - last_image_at
    if elapsed < IMAGE_GRACE_SECONDS:
        await asyncio.sleep(IMAGE_GRACE_SECONDS - elapsed)


async def _process_one(phone: str) -> bool:
    images = _peek_images(phone)
    text = _peek_text(phone)
    logger.info('Images fetched', extra={"phone": phone, "count": len(images)})

    if len(images) > 10:
        logger.warning('Too many images in buffer, clearing', extra={"phone": phone, "count": len(images)})
        _clear_all_buffers(phone)
        return False

    if not images or not text:
        return False

    await _wait_for_images(phone)
    images = _peek_images(phone)
    text = _peek_text(phone)
    if not images or not text:
        return False

    if _is_duplicate(phone, text):
        logger.info('Duplicate text ignored', extra={"phone": phone})
        _consume_images(phone, len(images))
        _pop_text(phone)
        return True

    parsed = parse_product_text(text)
    logger.info('AI parsed output', extra={"phone": phone, "parsed": parsed})

    price = parsed.get('price')
    if not price:
        logger.warning('Missing price for shoe_hub product', extra={"phone": phone})
        _consume_images(phone, len(images))
        _pop_text(phone)
        return True

    uploaded_images: list[str] = []
    for img in images:
        try:
            uploaded_images.append(upload_image(img))
        except Exception as exc:
            logger.warning(f'Image upload failed: {exc}')

    if not uploaded_images:
        logger.warning('No images uploaded for product creation', extra={"phone": phone})
        _consume_images(phone, len(images))
        _pop_text(phone)
        return True

    payload = {
        "name": parsed.get("name"),
        "price": price,
        "category": "Shoe Hub",
        "image_url": uploaded_images[0],
        "image_urls": ','.join(uploaded_images),
        "stock": 10,
    }

    if parsed.get('sizes'):
        payload['sizes'] = ','.join(parsed['sizes'])

    if parsed.get('colors'):
        payload['tags'] = ','.join(parsed['colors'])

    try:
        await create_product(payload)
        logger.info('Product created', extra={"phone": phone, "product_name": parsed.get("name")})
    except Exception as exc:
        logger.error(f'Product creation failed: {exc}')
    finally:
        _consume_images(phone, len(images))
        _pop_text(phone)

    return True


async def _try_create_from_buffers(phone: str) -> None:
    if not _acquire_lock(phone):
        logger.info('Lock active, skipping', extra={"phone": phone})
        return

    try:
        # Batch processing: handle multiple buffered texts if images are ready
        for _ in range(5):
            processed = await _process_one(phone)
            if not processed:
                break
    finally:
        _release_lock(phone)


async def process_whatsapp(data) -> None:
    phone, text, image_urls = parse_whatsapp_payload(data)
    session_phone = phone or 'unknown'

    if not _is_allowed(phone):
        logger.warning('Blocked sender', extra={"phone": phone})
        return

    if text:
        _store_text(session_phone, text)

    if image_urls:
        _store_images(session_phone, image_urls)

    if text or image_urls:
        await _try_create_from_buffers(session_phone)

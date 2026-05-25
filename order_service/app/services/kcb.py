import base64
import logging
import httpx
import redis

from app.config import (
    KCB_BASE_URL,
    KCB_CALLBACK_URL,
    KCB_CONSUMER_KEY,
    KCB_CONSUMER_SECRET,
    KCB_SHORTCODE,
    REDIS_URL,
    KCB_ACCOUNT_NUMBER,
)

redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)
logger = logging.getLogger("order_service.kcb")


def _build_invoice() -> str:
    return KCB_ACCOUNT_NUMBER


def _get_access_token() -> str:
    if not KCB_CONSUMER_KEY or not KCB_CONSUMER_SECRET:
        raise RuntimeError('KCB consumer credentials are not set')

    url = f"{KCB_BASE_URL}/token?grant_type=client_credentials"
    credentials = f"{KCB_CONSUMER_KEY}:{KCB_CONSUMER_SECRET}"
    encoded = base64.b64encode(credentials.encode()).decode()
    headers = {"Authorization": f"Basic {encoded}"}

    with httpx.Client(timeout=10) as client:
        res = client.post(url, headers=headers)
        if res.status_code >= 400:
            logger.error("KCB token error", extra={"status": res.status_code, "body": res.text})
        res.raise_for_status()
        data = res.json()

    token = data.get('access_token')
    if not token:
        raise RuntimeError('KCB access token missing')
    return token


def get_cached_token() -> str:
    token = redis_client.get('kcb_token')
    if token:
        return token

    token = _get_access_token()
    redis_client.set('kcb_token', token, ex=3500)
    return token


def build_invoice() -> str:
    return _build_invoice()


async def initiate_stk(phone: str, amount: float, order_id: int) -> tuple[dict, str]:
    token = get_cached_token()
    invoice = _build_invoice()

    payload = {
        "phoneNumber": phone,
        "amount": str(amount),
        "invoiceNumber": invoice,
        "sharedShortCode": True,
        "orgShortCode": KCB_SHORTCODE,
        "callbackUrl": KCB_CALLBACK_URL,
        "transactionDescription": "Champ's Closet Purchase",
    }

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
    }

    async with httpx.AsyncClient(timeout=15) as client:
        res = await client.post(
            f"{KCB_BASE_URL}/mm/api/request/1.0.0/stkpush",
            json=payload,
            headers=headers,
        )
        if res.status_code >= 400:
            logger.error("KCB STK error", extra={"status": res.status_code, "body": res.text})
        res.raise_for_status()
        return res.json(), invoice

import base64
import logging
from datetime import datetime, timezone

import httpx
import redis

from app.config import (
    MPESA_ACCOUNT_REFERENCE,
    MPESA_BASE_URL,
    MPESA_CALLBACK_URL,
    MPESA_CONSUMER_KEY,
    MPESA_CONSUMER_SECRET,
    MPESA_PARTY_B,
    MPESA_PASSKEY,
    MPESA_SHORTCODE,
    MPESA_TOKEN_CACHE_SECONDS,
    MPESA_TRANSACTION_TYPE,
    REDIS_URL,
)

redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)
logger = logging.getLogger('order_service.mpesa')


TOKEN_CACHE_KEY = 'mpesa_token'
ACCOUNT_REFERENCE_MAX_LENGTH = 12


def _normalize_phone(phone: str) -> str:
    digits = ''.join(char for char in str(phone or '').strip() if char.isdigit() or char == '+')
    if digits.startswith('+'):
        digits = digits[1:]

    if digits.startswith('254') and len(digits) >= 12:
        return digits
    if digits.startswith('0') and len(digits) >= 10:
        return f'254{digits[1:]}'
    if digits.startswith('7') and len(digits) == 9:
        return f'254{digits}'

    raise ValueError('Invalid phone number format. Use 07XXXXXXXX or 2547XXXXXXXX.')


def _get_access_token() -> str:
    if not MPESA_CONSUMER_KEY or not MPESA_CONSUMER_SECRET:
        raise RuntimeError('M-Pesa consumer credentials are not set')

    auth = base64.b64encode(f'{MPESA_CONSUMER_KEY}:{MPESA_CONSUMER_SECRET}'.encode()).decode()
    url = f'{MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials'

    with httpx.Client(timeout=10) as client:
        response = client.get(url, headers={'Authorization': f'Basic {auth}'})
        if response.status_code >= 400:
            logger.error('M-Pesa token error', extra={'status': response.status_code, 'body': response.text})
        response.raise_for_status()
        payload = response.json()

    token = payload.get('access_token')
    if not token:
        raise RuntimeError('M-Pesa access token missing from response')

    return token


def get_cached_token() -> str:
    token = redis_client.get(TOKEN_CACHE_KEY)
    if token:
        return token

    token = _get_access_token()
    redis_client.set(TOKEN_CACHE_KEY, token, ex=MPESA_TOKEN_CACHE_SECONDS)
    return token


def build_invoice(order_id: int) -> str:
    base = ''.join(char for char in (MPESA_ACCOUNT_REFERENCE or 'REF') if char.isalnum()).upper()
    suffix = str(order_id % 10000).zfill(4)
    prefix_len = max(3, ACCOUNT_REFERENCE_MAX_LENGTH - len(suffix) - 1)
    prefix = (base[:prefix_len] or 'REF').upper()
    return f'{prefix}-{suffix}'


def generate_password() -> tuple[str, str]:
    if not MPESA_SHORTCODE or not MPESA_PASSKEY:
        raise RuntimeError('M-Pesa shortcode and passkey are required')

    timestamp = datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')
    data = f'{MPESA_SHORTCODE}{MPESA_PASSKEY}{timestamp}'
    password = base64.b64encode(data.encode()).decode()
    return password, timestamp


async def initiate_stk(phone: str, amount: float, order_id: int) -> tuple[dict, str]:
    if not MPESA_CALLBACK_URL:
        raise RuntimeError('MPESA_CALLBACK_URL is not set')
    if not MPESA_SHORTCODE:
        raise RuntimeError('MPESA_SHORTCODE is not set')

    normalized_phone = _normalize_phone(phone)
    token = get_cached_token()
    password, timestamp = generate_password()
    account_reference = build_invoice(order_id)

    payload = {
        'BusinessShortCode': MPESA_SHORTCODE,
        'Password': password,
        'Timestamp': timestamp,
        'TransactionType': MPESA_TRANSACTION_TYPE,
        'Amount': max(1, int(round(float(amount)))),
        'PartyA': normalized_phone,
        'PartyB': MPESA_PARTY_B or MPESA_SHORTCODE,
        'PhoneNumber': normalized_phone,
        'CallBackURL': MPESA_CALLBACK_URL,
        'AccountReference': account_reference,
        'TransactionDesc': f'Payment for order {order_id}',
    }

    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json',
    }

    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(
            f'{MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest',
            json=payload,
            headers=headers,
        )

    if response.status_code >= 400:
        logger.error('M-Pesa STK error', extra={'status': response.status_code, 'body': response.text})
    response.raise_for_status()

    return response.json(), account_reference

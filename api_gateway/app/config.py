import os
from typing import List

from dotenv import load_dotenv

load_dotenv()


def _as_bool(value: str | None, *, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {'1', 'true', 'yes', 'on'}


def _split_csv(value: str | None, *, default: str = '*') -> List[str]:
    raw = value if value is not None else default
    return [item.strip() for item in raw.split(',') if item.strip()]


APP_NAME = os.getenv('APP_NAME', 'Champs Closet API Gateway')
LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO').upper()

PRODUCT_SERVICE_URL = os.getenv('PRODUCT_SERVICE_URL', 'http://localhost:8000').rstrip('/')
ORDER_SERVICE_URL = os.getenv('ORDER_SERVICE_URL', 'http://localhost:8003').rstrip('/')
INGESTION_SERVICE_URL = os.getenv('INGESTION_SERVICE_URL', 'http://localhost:8002').rstrip('/')
AI_SERVICE_URL = os.getenv('AI_SERVICE_URL', 'http://localhost:8001').rstrip('/')
NOTIFICATION_SERVICE_URL = os.getenv('NOTIFICATION_SERVICE_URL', 'http://localhost:8004').rstrip('/')

HTTP_TIMEOUT_SECONDS = float(os.getenv('HTTP_TIMEOUT_SECONDS', '30'))
HTTP_MAX_CONNECTIONS = int(os.getenv('HTTP_MAX_CONNECTIONS', '100'))
HTTP_MAX_KEEPALIVE_CONNECTIONS = int(os.getenv('HTTP_MAX_KEEPALIVE_CONNECTIONS', '20'))
MAX_REQUEST_BODY_BYTES = int(os.getenv('MAX_REQUEST_BODY_BYTES', '2097152'))
REQUEST_ID_HEADER = os.getenv('REQUEST_ID_HEADER', 'X-Request-ID')

REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379')
CACHE_ENABLED = _as_bool(os.getenv('CACHE_ENABLED'), default=True)
CACHE_TTL_SECONDS = int(os.getenv('CACHE_TTL_SECONDS', '60'))

RATE_LIMIT_ENABLED = _as_bool(os.getenv('RATE_LIMIT_ENABLED'), default=True)
RATE_LIMIT_REQUESTS = int(os.getenv('RATE_LIMIT_REQUESTS', '120'))
RATE_LIMIT_WINDOW_SECONDS = int(os.getenv('RATE_LIMIT_WINDOW_SECONDS', '60'))

CORS_ALLOW_ORIGINS = _split_csv(os.getenv('CORS_ALLOW_ORIGINS'), default='*')

FIREBASE_AUTH_DISABLED = _as_bool(os.getenv('FIREBASE_AUTH_DISABLED'), default=False)
FIREBASE_CREDENTIALS_PATH = os.getenv('FIREBASE_CREDENTIALS_PATH')
FIREBASE_REQUIRE_ADMIN_CLAIM = _as_bool(os.getenv('FIREBASE_REQUIRE_ADMIN_CLAIM'), default=True)
FIREBASE_ADMIN_EMAILS = [email.lower() for email in _split_csv(os.getenv('FIREBASE_ADMIN_EMAILS'), default='')]

PRODUCT_SERVICE_INTERNAL_TOKEN = os.getenv('PRODUCT_SERVICE_INTERNAL_TOKEN')
ORDER_SERVICE_INTERNAL_TOKEN = os.getenv('ORDER_SERVICE_INTERNAL_TOKEN')

SITE_BASE_URL = os.getenv('SITE_BASE_URL', 'http://localhost:3000').rstrip('/')

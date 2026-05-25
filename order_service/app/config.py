import os

from dotenv import load_dotenv

load_dotenv()


def _as_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {'1', 'true', 'yes', 'on'}

DATABASE_URL = os.getenv('DATABASE_URL')
DB_POOL_SIZE = int(os.getenv('DB_POOL_SIZE', '5'))
DB_MAX_OVERFLOW = int(os.getenv('DB_MAX_OVERFLOW', '10'))
REDIS_URL = os.getenv('REDIS_URL', 'redis://redis:6379')
ORDER_EVENTS_MAXLEN = int(os.getenv('ORDER_EVENTS_MAXLEN', '1000'))

MPESA_BASE_URL = os.getenv('MPESA_BASE_URL', 'https://sandbox.safaricom.co.ke')
MPESA_CONSUMER_KEY = os.getenv('MPESA_CONSUMER_KEY')
MPESA_CONSUMER_SECRET = os.getenv('MPESA_CONSUMER_SECRET')
MPESA_SHORTCODE = os.getenv('MPESA_SHORTCODE')
MPESA_PASSKEY = os.getenv('MPESA_PASSKEY')
MPESA_CALLBACK_URL = os.getenv('MPESA_CALLBACK_URL')
MPESA_ACCOUNT_REFERENCE = os.getenv('MPESA_ACCOUNT_REFERENCE', 'CHAMPS001')
MPESA_TRANSACTION_TYPE = os.getenv('MPESA_TRANSACTION_TYPE', 'CustomerPayBillOnline')
MPESA_PARTY_B = os.getenv('MPESA_PARTY_B')
MPESA_TOKEN_CACHE_SECONDS = int(os.getenv('MPESA_TOKEN_CACHE_SECONDS', '3400'))
PRODUCT_SERVICE_URL = os.getenv('PRODUCT_SERVICE_URL', 'http://localhost:8000')
PRODUCT_SERVICE_INTERNAL_TOKEN = os.getenv('PRODUCT_SERVICE_INTERNAL_TOKEN')
ORDER_INVENTORY_LOCK_TTL_SECONDS = int(os.getenv('ORDER_INVENTORY_LOCK_TTL_SECONDS', '300'))
GOOGLE_MAPS_API_KEY = os.getenv('GOOGLE_MAPS_API_KEY')
SHOP_LAT = float(os.getenv('SHOP_LAT', '-1.49315'))
SHOP_LNG = float(os.getenv('SHOP_LNG', '36.955124'))
ORDER_TEST_MODE = _as_bool(os.getenv('ORDER_TEST_MODE'), default=False)
ORDER_SERVICE_INTERNAL_TOKEN = os.getenv('ORDER_SERVICE_INTERNAL_TOKEN')
LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO').upper()

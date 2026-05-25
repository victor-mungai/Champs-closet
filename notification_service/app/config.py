import os

from dotenv import load_dotenv

load_dotenv()


def _as_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {'1', 'true', 'yes', 'on'}

REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379')
STREAM_NAME = os.getenv('STREAM_NAME', 'order_events')
CONSUMER_GROUP = os.getenv('CONSUMER_GROUP', 'notification_group')
CONSUMER_NAME = os.getenv('CONSUMER_NAME', 'notifier-1')
DLQ_STREAM = os.getenv('DLQ_STREAM', 'notification_dlq')
DLQ_MAXLEN = int(os.getenv('DLQ_MAXLEN', '5000'))

AT_API_KEY = os.getenv('AT_API_KEY')
AT_USERNAME = os.getenv('AT_USERNAME', 'sandbox')
AT_SENDER_ID = os.getenv('AT_SENDER_ID')

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
SUPABASE_KEY = SUPABASE_SERVICE_ROLE_KEY or os.getenv('SUPABASE_KEY')
SUPABASE_BUCKET = os.getenv('SUPABASE_BUCKET', 'receipts')

APP_ENV = os.getenv('APP_ENV', 'sandbox').lower()
ADMIN_PHONE = os.getenv('ADMIN_PHONE')
LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO').upper()
SECRET_KEY = os.getenv('SECRET_KEY', 'change-me-in-env')
RECEIPT_LINK_BASE_URL = os.getenv('RECEIPT_LINK_BASE_URL', 'http://localhost:8004').rstrip('/')
RECEIPT_LINK_TTL_SECONDS = int(os.getenv('RECEIPT_LINK_TTL_SECONDS', '2592000'))
ORDER_SERVICE_URL = os.getenv('ORDER_SERVICE_URL', 'http://localhost:8003').rstrip('/')
ORDER_SERVICE_INTERNAL_TOKEN = os.getenv('ORDER_SERVICE_INTERNAL_TOKEN')
NOTIFICATION_SMS_DRY_RUN = _as_bool(os.getenv('NOTIFICATION_SMS_DRY_RUN'), default=False)
NOTIFICATION_SMS_FAIL_OPEN = _as_bool(os.getenv('NOTIFICATION_SMS_FAIL_OPEN'), default=True)
SMS_MAX_RETRIES = int(os.getenv('SMS_MAX_RETRIES', '3'))
SMS_RETRY_BASE_SECONDS = float(os.getenv('SMS_RETRY_BASE_SECONDS', '1.0'))
AT_DISABLE_PROXY = _as_bool(os.getenv('AT_DISABLE_PROXY'), default=True)
AT_CURL_FALLBACK = _as_bool(os.getenv('AT_CURL_FALLBACK'), default=True)

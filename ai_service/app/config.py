import os

from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.getenv('REDIS_URL', 'redis://redis:6379')
AI_EVENTS_MAXLEN = int(os.getenv('AI_EVENTS_MAXLEN', '1000'))
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
GEMINI_MODEL = os.getenv('GEMINI_MODEL', 'gemini-2.5-flash')
PRODUCT_SERVICE_URL = os.getenv('PRODUCT_SERVICE_URL', 'http://product-service:8000')
STREAM_NAME = os.getenv('PRODUCT_STREAM', 'product_stream')
DLQ_STREAM = os.getenv('DLQ_STREAM', 'product_dlq')
AI_DLQ_MAXLEN = int(os.getenv('AI_DLQ_MAXLEN', '5000'))
CONSUMER_GROUP = os.getenv('CONSUMER_GROUP', 'ai_group')
CONSUMER_NAME = os.getenv('CONSUMER_NAME', f"consumer-{os.getpid()}")
CONSUMER_SLEEP_MS = int(os.getenv('CONSUMER_SLEEP_MS', '5000'))
MAX_RETRIES = int(os.getenv('GEMINI_MAX_RETRIES', '3'))
GEMINI_TIMEOUT = int(os.getenv('GEMINI_TIMEOUT', '10'))
CACHE_TTL_SECONDS = int(os.getenv('AI_CACHE_TTL_SECONDS', '86400'))
MAX_CONCURRENCY = int(os.getenv('AI_MAX_CONCURRENCY', '3'))

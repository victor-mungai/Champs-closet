import os

from dotenv import load_dotenv

load_dotenv()

PRODUCT_SERVICE_URL = os.getenv('PRODUCT_SERVICE_URL', 'http://product-service:8000')
REDIS_URL = os.getenv('REDIS_URL', 'redis://redis:6379')
SESSION_TTL = int(os.getenv('SESSION_TTL', '600'))
IMAGE_GRACE_SECONDS = int(os.getenv('IMAGE_GRACE_SECONDS', '5'))
AI_PARSE_TTL_SECONDS = int(os.getenv('AI_PARSE_TTL_SECONDS', '86400'))

CLOUDINARY_CLOUD_NAME = os.getenv('CLOUDINARY_CLOUD_NAME')
CLOUDINARY_API_KEY = os.getenv('CLOUDINARY_API_KEY')
CLOUDINARY_API_SECRET = os.getenv('CLOUDINARY_API_SECRET')

TWILIO_ACCOUNT_SID = os.getenv('TWILIO_ACCOUNT_SID')
TWILIO_AUTH_TOKEN = os.getenv('TWILIO_AUTH_TOKEN')

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
GEMINI_MODEL = os.getenv('GEMINI_MODEL', 'gemini-2.5-flash')

ALLOWED_NUMBERS = [
    num.strip()
    for num in os.getenv('ALLOWED_NUMBERS', '').split(',')
    if num.strip()
]

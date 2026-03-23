import requests
import cloudinary
import cloudinary.uploader

from app.config import (
    CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET,
    CLOUDINARY_CLOUD_NAME,
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
)

cloudinary.config(
    cloud_name=CLOUDINARY_CLOUD_NAME,
    api_key=CLOUDINARY_API_KEY,
    api_secret=CLOUDINARY_API_SECRET,
)


def _download_image(image_url: str) -> bytes:
    auth = None
    if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
        auth = (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

    resp = requests.get(image_url, auth=auth, timeout=15)
    resp.raise_for_status()

    content_type = (resp.headers.get('content-type') or '').lower()
    if content_type and not (content_type.startswith('image/') or content_type == 'application/octet-stream'):
        raise RuntimeError(f"Unsupported content type: {content_type}")

    return resp.content


def upload_image(image_url: str) -> str:
    if not (CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET):
        raise RuntimeError('Cloudinary credentials are not set')

    image_bytes = _download_image(image_url)
    result = cloudinary.uploader.upload(image_bytes, resource_type='image')
    return result['secure_url']

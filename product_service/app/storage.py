from typing import IO

import cloudinary
import cloudinary.uploader

from app.config import CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET


cloudinary.config(
    cloud_name=CLOUDINARY_CLOUD_NAME,
    api_key=CLOUDINARY_API_KEY,
    api_secret=CLOUDINARY_API_SECRET,
)


def upload_image(file_obj: IO[bytes]) -> str:
    if not (CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET):
        raise RuntimeError('Cloudinary credentials are not set')
    result = cloudinary.uploader.upload(file_obj, resource_type='image')
    return result['secure_url']

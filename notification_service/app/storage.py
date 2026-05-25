import os
import uuid
import logging

from supabase import create_client

from app.config import APP_ENV, RECEIPT_LINK_TTL_SECONDS, SUPABASE_BUCKET, SUPABASE_KEY, SUPABASE_URL

supabase = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None
logger = logging.getLogger('notification_service.storage')


def upload_pdf(file_path: str, order_id: int) -> str:
    if supabase is None:
        raise RuntimeError('Supabase storage configuration is incomplete')

    if SUPABASE_KEY and SUPABASE_KEY.startswith('sb_publishable_'):
        raise RuntimeError('SUPABASE_SERVICE_ROLE_KEY is required for server-side receipt uploads')

    token = uuid.uuid4().hex[:12]
    file_name = f'invoice_{order_id}_{token}.pdf'

    with open(file_path, 'rb') as file_obj:
        result = supabase.storage.from_(SUPABASE_BUCKET).upload(
            file_name,
            file_obj,
            file_options={'content-type': 'application/pdf', 'upsert': 'true'},
        )

    if isinstance(result, dict) and result.get('error'):
        logger.error('Supabase upload error', extra={'order_id': order_id, 'error': str(result['error'])})
        raise RuntimeError(f"Supabase upload failed: {result['error']}")

    signed = supabase.storage.from_(SUPABASE_BUCKET).create_signed_url(file_name, RECEIPT_LINK_TTL_SECONDS)
    signed_url = None
    if isinstance(signed, dict):
        signed_url = signed.get('signedURL') or signed.get('signedUrl')
    if signed_url:
        destination = signed_url
    else:
        destination = supabase.storage.from_(SUPABASE_BUCKET).get_public_url(file_name)
    if not destination:
        raise RuntimeError('Supabase did not return a receipt URL')

    logger.info('Supabase receipt stored', extra={'order_id': order_id, 'file_name': file_name, 'app_env': APP_ENV})
    return destination


def cleanup_file(file_path: str) -> None:
    try:
        os.remove(file_path)
    except FileNotFoundError:
        return

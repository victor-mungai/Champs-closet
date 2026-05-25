import logging
from pathlib import Path
from functools import lru_cache

import firebase_admin
from fastapi import HTTPException, Request, status
from firebase_admin import auth, credentials

from app.config import (
    FIREBASE_ADMIN_EMAILS,
    FIREBASE_AUTH_DISABLED,
    FIREBASE_CREDENTIALS_PATH,
    FIREBASE_REQUIRE_ADMIN_CLAIM,
)

logger = logging.getLogger('api_gateway.auth')


def _resolve_credentials_path(raw_path: str) -> Path:
    candidate = Path(raw_path).expanduser()
    if candidate.is_file():
        return candidate

    if not candidate.is_absolute():
        local_candidate = (Path.cwd() / candidate).resolve()
        if local_candidate.is_file():
            return local_candidate

        project_candidate = (Path(__file__).resolve().parents[2] / candidate).resolve()
        if project_candidate.is_file():
            return project_candidate

    raise RuntimeError(
        f'Firebase credentials file not found at "{raw_path}". '
        'Set FIREBASE_CREDENTIALS_PATH to a valid JSON file path, '
        'or set FIREBASE_AUTH_DISABLED=true for local development.'
    )


@lru_cache(maxsize=1)
def _ensure_firebase_initialized() -> bool:
    if FIREBASE_AUTH_DISABLED:
        logger.warning('Firebase auth is disabled by configuration')
        return False

    if firebase_admin._apps:
        return True

    if not FIREBASE_CREDENTIALS_PATH:
        raise RuntimeError('FIREBASE_CREDENTIALS_PATH is required when Firebase auth is enabled')

    credentials_path = _resolve_credentials_path(FIREBASE_CREDENTIALS_PATH)
    cred = credentials.Certificate(str(credentials_path))
    firebase_admin.initialize_app(cred)
    logger.info('Firebase Admin SDK initialized with credentials file %s', credentials_path)
    return True


def _extract_bearer_token(request: Request) -> str:
    header = request.headers.get('Authorization') or request.headers.get('authorization')
    if not header:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Missing Authorization token')

    parts = header.split(' ', 1)
    if len(parts) != 2 or parts[0].lower() != 'bearer' or not parts[1].strip():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Authorization header must be Bearer token')

    return parts[1].strip()


async def verify_admin(request: Request):
    if FIREBASE_AUTH_DISABLED:
        request.state.user = {'uid': 'dev-admin', 'admin': True}
        return

    try:
        _ensure_firebase_initialized()
    except (RuntimeError, OSError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc

    token = _extract_bearer_token(request)

    try:
        decoded = auth.verify_id_token(token)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid token') from exc

    is_claim_admin = bool(decoded.get('admin'))
    email = str(decoded.get('email') or '').strip().lower()
    is_email_admin = bool(email) and email in FIREBASE_ADMIN_EMAILS

    if FIREBASE_REQUIRE_ADMIN_CLAIM and not (is_claim_admin or is_email_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail='Admin access required (missing admin claim and email is not whitelisted)',
        )

    request.state.user = decoded

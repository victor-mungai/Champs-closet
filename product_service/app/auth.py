from fastapi import Header, HTTPException, status
import firebase_admin
from firebase_admin import auth, credentials

from app.config import FIREBASE_AUTH_DISABLED, FIREBASE_CREDENTIALS, FIREBASE_PROJECT_ID

_firebase_initialized = False


def _init_firebase() -> None:
    global _firebase_initialized
    if _firebase_initialized or FIREBASE_AUTH_DISABLED:
        return

    if FIREBASE_CREDENTIALS:
        cred = credentials.Certificate(FIREBASE_CREDENTIALS)
        firebase_admin.initialize_app(cred, {"projectId": FIREBASE_PROJECT_ID} if FIREBASE_PROJECT_ID else None)
    else:
        firebase_admin.initialize_app(options={"projectId": FIREBASE_PROJECT_ID} if FIREBASE_PROJECT_ID else None)

    _firebase_initialized = True


def verify_firebase_token(authorization: str | None = Header(default=None)):
    if FIREBASE_AUTH_DISABLED:
        return {"uid": "dev"}

    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Missing or invalid Authorization header')

    token = authorization.split(' ', 1)[1]
    _init_firebase()
    try:
        decoded = auth.verify_id_token(token)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid Firebase token') from exc
    return decoded

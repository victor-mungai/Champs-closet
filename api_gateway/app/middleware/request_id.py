import re
import uuid

from fastapi import Request

from app.config import REQUEST_ID_HEADER

REQUEST_ID_PATTERN = re.compile(r'^[A-Za-z0-9\-_]{8,128}$')


def _sanitize_request_id(value: str | None) -> str | None:
    if not value:
        return None
    candidate = value.strip()
    if REQUEST_ID_PATTERN.fullmatch(candidate):
        return candidate
    return None


def ensure_request_id(request: Request) -> str:
    existing = getattr(request.state, 'request_id', None)
    if isinstance(existing, str) and existing:
        return existing

    incoming = request.headers.get(REQUEST_ID_HEADER)
    request_id = _sanitize_request_id(incoming) or uuid.uuid4().hex
    request.state.request_id = request_id
    return request_id


async def attach_request_id(request: Request, call_next):
    request_id = ensure_request_id(request)
    response = await call_next(request)
    response.headers[REQUEST_ID_HEADER] = request_id
    return response

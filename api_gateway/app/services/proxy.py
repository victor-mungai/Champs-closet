import json
import logging
from typing import Any, Mapping

import httpx
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse, Response

from app.config import (
    HTTP_MAX_CONNECTIONS,
    HTTP_MAX_KEEPALIVE_CONNECTIONS,
    HTTP_TIMEOUT_SECONDS,
    REQUEST_ID_HEADER,
)

logger = logging.getLogger('api_gateway.proxy')

HOP_BY_HOP_HEADERS = {
    'connection',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailers',
    'transfer-encoding',
    'upgrade',
    'host',
    'content-length',
}

_http_client: httpx.AsyncClient | None = None


def get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None:
        timeout = httpx.Timeout(HTTP_TIMEOUT_SECONDS)
        limits = httpx.Limits(
            max_connections=HTTP_MAX_CONNECTIONS,
            max_keepalive_connections=HTTP_MAX_KEEPALIVE_CONNECTIONS,
        )
        _http_client = httpx.AsyncClient(timeout=timeout, limits=limits)
    return _http_client


async def close_http_client() -> None:
    global _http_client
    if _http_client is None:
        return
    await _http_client.aclose()
    _http_client = None


def build_forward_headers(
    request: Request,
    *,
    forward_authorization: bool = False,
    forward_content_type: bool = False,
    service_token: str | None = None,
    extra: Mapping[str, str] | None = None,
) -> dict[str, str]:
    headers: dict[str, str] = {}

    if forward_content_type:
        content_type = request.headers.get('content-type')
        if content_type:
            headers['Content-Type'] = content_type

    if forward_authorization:
        auth = request.headers.get('authorization')
        if auth:
            headers['Authorization'] = auth

    if service_token:
        headers['X-Service-Token'] = service_token

    request_id = getattr(request.state, 'request_id', None)
    if isinstance(request_id, str) and request_id:
        headers[REQUEST_ID_HEADER] = request_id

    if extra:
        headers.update(extra)

    return headers


async def proxy_request(
    method: str,
    url: str,
    *,
    params: Mapping[str, Any] | None = None,
    headers: Mapping[str, str] | None = None,
    json_body: Any = None,
    content: bytes | None = None,
) -> Response:
    client = get_http_client()
    try:
        upstream = await client.request(
            method,
            url,
            params=params,
            headers=headers,
            json=json_body,
            content=content,
        )
    except httpx.RequestError as exc:
        logger.error(
            'Upstream request failed',
            extra={'method': method, 'url': url, 'error': str(exc)},
        )
        raise HTTPException(
            status_code=503,
            detail={'error': 'Service unavailable', 'upstream': url, 'reason': str(exc)},
        ) from exc

    content_type = (upstream.headers.get('content-type') or '').lower()

    if 'application/json' in content_type:
        try:
            payload = upstream.json()
        except json.JSONDecodeError:
            payload = {'error': 'Invalid upstream response'}
        return JSONResponse(status_code=upstream.status_code, content=payload)

    filtered_headers = {
        key: value
        for key, value in upstream.headers.items()
        if key.lower() not in HOP_BY_HOP_HEADERS
    }

    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        media_type=upstream.headers.get('content-type'),
        headers=filtered_headers,
    )

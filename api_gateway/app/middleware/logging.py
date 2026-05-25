import logging
import time

from fastapi import Request

from app.middleware.request_id import ensure_request_id

logger = logging.getLogger('api_gateway.http')


async def log_requests(request: Request, call_next):
    request_id = ensure_request_id(request)
    started = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - started) * 1000
    client_ip = request.client.host if request.client else 'unknown'

    logger.info(
        'request completed request_id=%s method=%s path=%s status_code=%s duration_ms=%.2f client_ip=%s',
        request_id,
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
        client_ip,
    )
    return response

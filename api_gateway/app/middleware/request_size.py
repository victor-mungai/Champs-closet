from fastapi import Request
from fastapi.responses import JSONResponse

from app.config import MAX_REQUEST_BODY_BYTES, REQUEST_ID_HEADER
from app.middleware.request_id import ensure_request_id


async def enforce_request_size(request: Request, call_next):
    if request.method in {'GET', 'HEAD', 'OPTIONS'}:
        return await call_next(request)

    content_length = request.headers.get('content-length')
    if content_length is not None:
        try:
            if int(content_length) > MAX_REQUEST_BODY_BYTES:
                request_id = ensure_request_id(request)
                response = JSONResponse(
                    status_code=413,
                    content={
                        'error': 'Request body too large',
                        'max_bytes': MAX_REQUEST_BODY_BYTES,
                        'request_id': request_id,
                    },
                )
                response.headers[REQUEST_ID_HEADER] = request_id
                return response
        except ValueError:
            pass

    return await call_next(request)

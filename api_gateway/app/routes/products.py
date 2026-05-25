import json
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, Response

from app.config import PRODUCT_SERVICE_URL
from app.middleware.auth import verify_admin
from app.services.cache import get_json, invalidate_prefix, set_json
from app.services.proxy import build_forward_headers, proxy_request

router = APIRouter(tags=['products'])

PRODUCT_LIST_CACHE_PREFIX = 'gateway:products:list:'
PRODUCT_DETAIL_CACHE_PREFIX = 'gateway:products:item:'


def _list_cache_key(request: Request) -> str:
    items = sorted(request.query_params.multi_items())
    query = urlencode(items, doseq=True)
    return f'{PRODUCT_LIST_CACHE_PREFIX}{query or "all"}'


def _detail_cache_key(product_id: int) -> str:
    return f'{PRODUCT_DETAIL_CACHE_PREFIX}{product_id}'


def _extract_json_payload(response: Response):
    if not isinstance(response, JSONResponse):
        return None
    try:
        return json.loads(response.body.decode('utf-8'))
    except Exception:
        return None


def _invalidate_product_cache(product_id: int | None = None) -> None:
    invalidate_prefix(PRODUCT_LIST_CACHE_PREFIX)
    if product_id is None:
        invalidate_prefix(PRODUCT_DETAIL_CACHE_PREFIX)
        return

    invalidate_prefix(_detail_cache_key(product_id))


@router.get('/products')
@router.get('/catalog')
async def get_products(request: Request):
    cache_key = _list_cache_key(request)
    cached = get_json(cache_key)
    if cached is not None:
        response = JSONResponse(status_code=200, content=cached)
        response.headers['X-Cache'] = 'HIT'
        return response

    response = await proxy_request(
        'GET',
        f'{PRODUCT_SERVICE_URL}/products/',
        params=request.query_params,
    )
    payload = _extract_json_payload(response)
    if response.status_code == 200 and payload is not None:
        set_json(cache_key, payload)
    response.headers['X-Cache'] = 'MISS'
    return response


@router.get('/products/{product_id}')
async def get_product(product_id: int):
    cache_key = _detail_cache_key(product_id)
    cached = get_json(cache_key)
    if cached is not None:
        response = JSONResponse(status_code=200, content=cached)
        response.headers['X-Cache'] = 'HIT'
        return response

    response = await proxy_request('GET', f'{PRODUCT_SERVICE_URL}/products/{product_id}')
    payload = _extract_json_payload(response)
    if response.status_code == 200 and payload is not None:
        set_json(cache_key, payload)
    response.headers['X-Cache'] = 'MISS'
    return response


@router.post('/products', dependencies=[Depends(verify_admin)])
async def create_product(request: Request):
    response = await proxy_request(
        'POST',
        f'{PRODUCT_SERVICE_URL}/products/',
        headers=build_forward_headers(
            request,
            forward_authorization=True,
            forward_content_type=True,
        ),
        content=await request.body(),
    )
    if 200 <= response.status_code < 300:
        created = _extract_json_payload(response)
        product_id = None
        if isinstance(created, dict):
            raw_id = created.get('id')
            if isinstance(raw_id, int):
                product_id = raw_id
        _invalidate_product_cache(product_id)
    return response


@router.patch('/products/{product_id}', dependencies=[Depends(verify_admin)])
async def update_product(product_id: int, request: Request):
    response = await proxy_request(
        'PATCH',
        f'{PRODUCT_SERVICE_URL}/products/{product_id}',
        headers=build_forward_headers(
            request,
            forward_authorization=True,
            forward_content_type=True,
        ),
        content=await request.body(),
    )
    if 200 <= response.status_code < 300:
        _invalidate_product_cache(product_id)
    return response


@router.delete('/products/{product_id}', dependencies=[Depends(verify_admin)])
async def delete_product(product_id: int, request: Request):
    response = await proxy_request(
        'DELETE',
        f'{PRODUCT_SERVICE_URL}/products/{product_id}',
        headers=build_forward_headers(request, forward_authorization=True),
    )
    if 200 <= response.status_code < 300:
        _invalidate_product_cache(product_id)
    return response

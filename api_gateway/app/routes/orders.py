from fastapi import APIRouter, Depends, Request

from app.config import ORDER_SERVICE_URL
from app.middleware.auth import verify_admin
from app.services.proxy import proxy_request

router = APIRouter(tags=['orders'])


@router.post('/orders')
async def create_order(request: Request):
    body = await request.json()
    return await proxy_request('POST', f'{ORDER_SERVICE_URL}/orders', json_body=body)


@router.post('/orders/delivery-quote')
async def delivery_quote(request: Request):
    body = await request.json()
    return await proxy_request('POST', f'{ORDER_SERVICE_URL}/orders/delivery-quote', json_body=body)


@router.get('/orders/{order_id}/status')
async def get_order_status(order_id: int, request: Request):
    return await proxy_request(
        'GET',
        f'{ORDER_SERVICE_URL}/orders/{order_id}/status',
        params=request.query_params,
    )


@router.get('/orders', dependencies=[Depends(verify_admin)])
async def list_orders(request: Request):
    return await proxy_request('GET', f'{ORDER_SERVICE_URL}/orders', params=request.query_params)


@router.get('/orders/metrics', dependencies=[Depends(verify_admin)])
async def metrics(request: Request):
    return await proxy_request('GET', f'{ORDER_SERVICE_URL}/orders/metrics', params=request.query_params)


@router.get('/orders/{order_id}', dependencies=[Depends(verify_admin)])
async def get_order(order_id: int):
    return await proxy_request('GET', f'{ORDER_SERVICE_URL}/orders/{order_id}')

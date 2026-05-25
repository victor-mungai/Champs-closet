from fastapi import APIRouter, Depends, Request

from app.config import ORDER_SERVICE_URL
from app.middleware.auth import verify_admin
from app.services.proxy import proxy_request

router = APIRouter(prefix='/admin', tags=['admin'], dependencies=[Depends(verify_admin)])


@router.post('/orders')
async def create_admin_order(request: Request):
    body = await request.json()
    return await proxy_request('POST', f'{ORDER_SERVICE_URL}/admin/orders', json_body=body)

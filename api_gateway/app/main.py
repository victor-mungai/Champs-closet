import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import APP_NAME, CORS_ALLOW_ORIGINS, LOG_LEVEL
from app.middleware.logging import log_requests
from app.middleware.rate_limit import enforce_rate_limit
from app.middleware.request_id import attach_request_id
from app.middleware.request_size import enforce_request_size
from app.routes import admin, orders, products, public
from app.services.proxy import close_http_client

logging.basicConfig(
    level=LOG_LEVEL,
    format='%(asctime)s %(levelname)s %(name)s %(message)s',
)

app = FastAPI(title=APP_NAME)

app.middleware('http')(attach_request_id)
app.middleware('http')(enforce_rate_limit)
app.middleware('http')(enforce_request_size)
app.middleware('http')(log_requests)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOW_ORIGINS,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(products.router)
app.include_router(orders.router)
app.include_router(admin.router)
app.include_router(public.router)


@app.on_event('shutdown')
async def _shutdown_http_client() -> None:
    await close_http_client()


@app.get('/health')
def health() -> dict[str, str]:
    return {'status': 'ok'}

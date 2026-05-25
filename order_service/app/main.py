import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from app.db import Base, engine
from app.config import LOG_LEVEL
from app.routes import orders, kcb

logging.basicConfig(
    level=LOG_LEVEL,
    format='%(asctime)s %(levelname)s %(name)s %(message)s',
)

app = FastAPI(title='Champs Closet Order Service')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(orders.router)
app.include_router(kcb.router)


def _ensure_column(conn, table: str, column: str, ddl: str) -> None:
    conn.execute(text(f'ALTER TABLE {table} ADD COLUMN {column} {ddl}'))


@app.on_event('startup')
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
    inspector = inspect(engine)
    if 'orders' in inspector.get_table_names():
        columns = {col['name'] for col in inspector.get_columns('orders')}
        with engine.begin() as conn:
            if 'created_at' not in columns:
                _ensure_column(conn, 'orders', 'created_at', 'TIMESTAMPTZ DEFAULT NOW()')
                conn.execute(text('UPDATE orders SET created_at = NOW() WHERE created_at IS NULL'))
            if 'delivery_type' not in columns:
                _ensure_column(conn, 'orders', 'delivery_type', "VARCHAR DEFAULT 'pickup'")
            if 'delivery_fee' not in columns:
                _ensure_column(conn, 'orders', 'delivery_fee', 'FLOAT DEFAULT 0')
            if 'delivery_lat' not in columns:
                _ensure_column(conn, 'orders', 'delivery_lat', 'FLOAT')
            if 'delivery_lng' not in columns:
                _ensure_column(conn, 'orders', 'delivery_lng', 'FLOAT')
            if 'delivery_address' not in columns:
                _ensure_column(conn, 'orders', 'delivery_address', 'VARCHAR')
            if 'receipt_url' not in columns:
                _ensure_column(conn, 'orders', 'receipt_url', 'VARCHAR')
            if 'channel' not in columns:
                _ensure_column(conn, 'orders', 'channel', "VARCHAR DEFAULT 'online'")
            if 'payment_method' not in columns:
                _ensure_column(conn, 'orders', 'payment_method', "VARCHAR DEFAULT 'stk'")
            if 'created_by' not in columns:
                _ensure_column(conn, 'orders', 'created_by', 'VARCHAR')
            if 'inventory_lock_id' not in columns:
                _ensure_column(conn, 'orders', 'inventory_lock_id', 'VARCHAR')
            if 'inventory_lock_expires_at' not in columns:
                _ensure_column(conn, 'orders', 'inventory_lock_expires_at', 'TIMESTAMPTZ')
            if 'inventory_synced' not in columns:
                _ensure_column(conn, 'orders', 'inventory_synced', 'BOOLEAN DEFAULT FALSE')
    if 'order_items' in inspector.get_table_names():
        columns = {col['name'] for col in inspector.get_columns('order_items')}
        with engine.begin() as conn:
            if 'item_name' not in columns:
                _ensure_column(conn, 'order_items', 'item_name', 'VARCHAR')
            if 'size' not in columns:
                _ensure_column(conn, 'order_items', 'size', 'VARCHAR')


@app.get('/health')
def health():
    return {'status': 'ok'}

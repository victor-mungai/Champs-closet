from threading import Event, Thread

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from app import crud
from app.database import Base, SessionLocal, engine
from app.routes import products, admin, health

app = FastAPI(title='Champs Closet Product Service')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(health.router)
app.include_router(products.router)
app.include_router(admin.router)

_reaper_stop_event = Event()
_reaper_thread: Thread | None = None


def _ensure_column(conn, table: str, column: str, ddl: str) -> None:
    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}"))


def _ensure_unique_index(conn, index_name: str, table: str, column: str) -> None:
    conn.execute(text(f"CREATE UNIQUE INDEX IF NOT EXISTS {index_name} ON {table} ({column})"))


def _inventory_lock_reaper() -> None:
    while not _reaper_stop_event.is_set():
        db = SessionLocal()
        try:
            if crud._cleanup_expired_locks(db):
                db.commit()
        except Exception:
            db.rollback()
        finally:
            db.close()

        _reaper_stop_event.wait(30)


@app.on_event('startup')
def on_startup() -> None:
    global _reaper_thread

    Base.metadata.create_all(bind=engine)
    inspector = inspect(engine)
    if 'products' in inspector.get_table_names():
        columns = {col['name'] for col in inspector.get_columns('products')}
        with engine.begin() as conn:
            if 'status' not in columns:
                _ensure_column(conn, 'products', 'status', "VARCHAR DEFAULT 'pending_ai'")
            if 'sku' not in columns:
                _ensure_column(conn, 'products', 'sku', 'VARCHAR')
            if 'sizes' not in columns:
                _ensure_column(conn, 'products', 'sizes', 'JSON')
            if 'colors' not in columns:
                _ensure_column(conn, 'products', 'colors', 'JSON')
            if 'image_urls' not in columns:
                _ensure_column(conn, 'products', 'image_urls', 'JSON')
            if 'is_unique' not in columns:
                _ensure_column(conn, 'products', 'is_unique', 'BOOLEAN DEFAULT FALSE')
            if 'reserved_stock' not in columns:
                _ensure_column(conn, 'products', 'reserved_stock', 'INTEGER DEFAULT 0')
            _ensure_unique_index(conn, 'ix_products_sku', 'products', 'sku')

    _reaper_stop_event.clear()
    _reaper_thread = Thread(target=_inventory_lock_reaper, name='inventory-lock-reaper', daemon=True)
    _reaper_thread.start()


@app.on_event('shutdown')
def on_shutdown() -> None:
    _reaper_stop_event.set()


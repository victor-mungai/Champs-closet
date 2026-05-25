from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import DATABASE_URL, DB_MAX_OVERFLOW, DB_POOL_SIZE

if not DATABASE_URL:
    raise RuntimeError('DATABASE_URL is not set')

engine_kwargs = {'pool_pre_ping': True}
connect_args = {}

if DATABASE_URL.startswith('sqlite'):
    connect_args = {'check_same_thread': False}
else:
    engine_kwargs['pool_size'] = DB_POOL_SIZE
    engine_kwargs['max_overflow'] = DB_MAX_OVERFLOW

engine = create_engine(DATABASE_URL, connect_args=connect_args, **engine_kwargs)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()

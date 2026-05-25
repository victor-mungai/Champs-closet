from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import DB_MAX_OVERFLOW, DB_POOL_SIZE, SUPABASE_DB_URL

connect_args = {}
engine_kwargs = {'pool_pre_ping': True}

if SUPABASE_DB_URL.startswith('sqlite'):
    connect_args = {'check_same_thread': False}
else:
    engine_kwargs['pool_size'] = DB_POOL_SIZE
    engine_kwargs['max_overflow'] = DB_MAX_OVERFLOW

engine = create_engine(SUPABASE_DB_URL, connect_args=connect_args, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

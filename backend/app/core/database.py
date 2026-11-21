import re
from urllib.parse import quote_plus, unquote
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from sqlalchemy.pool import NullPool
from typing import Generator
import logging
from app.core.config import settings

logger = logging.getLogger("formgate.database")

def sanitize_db_url(url: str) -> str:
    """
    Normalizes database URLs and safely URL-encodes special characters (such as '@')
    in database passwords to prevent SQLAlchemy connection string parsing errors.
    """
    cleaned = url.strip()
    if cleaned.startswith("sqlite"):
        return cleaned

    # Normalize dialect prefix
    if cleaned.startswith("postgres://"):
        cleaned = cleaned.replace("postgres://", "postgresql+psycopg2://", 1)
    elif cleaned.startswith("postgresql://") and not cleaned.startswith("postgresql+"):
        cleaned = cleaned.replace("postgresql://", "postgresql+psycopg2://", 1)

    # Handle passwords containing '@' or other unencoded special characters
    pattern = r"^(?P<scheme>[a-zA-Z0-9+_]+://)(?P<user>[^:]+):(?P<password>.+)@(?P<host_and_rest>[^@]+)$"
    match = re.match(pattern, cleaned)
    if match:
        scheme = match.group("scheme")
        user = match.group("user")
        pwd = match.group("password")
        host_and_rest = match.group("host_and_rest")
        clean_pwd = quote_plus(unquote(pwd))
        return f"{scheme}{user}:{clean_pwd}@{host_and_rest}"
    return cleaned

db_url = sanitize_db_url(settings.DATABASE_URL)

connect_args = {}
engine_kwargs = {
    "echo": False,
    "future": True
}

if db_url.startswith("sqlite"):
    connect_args["check_same_thread"] = False
    engine_kwargs["connect_args"] = connect_args
else:
    # Ensure SSL for remote PostgreSQL / Supabase
    if "sslmode" not in db_url and "localhost" not in db_url and "127.0.0.1" not in db_url:
        connect_args["sslmode"] = "require"
    engine_kwargs["connect_args"] = connect_args

    # Check if connecting to Supabase PgBouncer Transaction Pooler (port 6543, pooler host, or pgbouncer flag)
    is_transaction_pooler = (
        ":6543" in db_url or
        "pooler.supabase.com" in db_url or
        "pgbouncer=true" in db_url.lower()
    )

    if is_transaction_pooler:
        # Supabase PostgreSQL Transaction Pooler operates in transaction mode.
        # NullPool delegates connection management directly to PgBouncer, preventing
        # connection leaks and prepared statement issues across serverless/container workers.
        engine_kwargs["poolclass"] = NullPool
        engine_kwargs["pool_pre_ping"] = True
        logger.info("Configured Supabase PostgreSQL Transaction Pooler with NullPool and pre-ping enabled.")
    else:
        # Standard PostgreSQL cloud connection pool resiliency
        engine_kwargs.update({
            "pool_pre_ping": True,
            "pool_recycle": 300,
            "pool_size": 10,
            "max_overflow": 20
        })
        logger.info("Configured PostgreSQL connection pool with pre-ping and recycling enabled.")

engine = create_engine(
    db_url,
    **engine_kwargs
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    future=True
)

Base = declarative_base()

def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

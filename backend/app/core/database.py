from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator, Dict
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import declarative_base
from app.core.config import settings

# Determine engine parameters dynamically based on dialect
engine_kwargs: Dict[str, Any] = {
    "echo": settings.DEBUG and settings.ENVIRONMENT == "development",
    "future": True,
}

if "sqlite" in settings.DATABASE_URL:
    # SQLite async configuration
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    # Production PostgreSQL connection pool configuration
    engine_kwargs.update(
        {
            "pool_pre_ping": True,
            "pool_size": settings.DB_POOL_SIZE,
            "max_overflow": settings.DB_MAX_OVERFLOW,
            "pool_timeout": settings.DB_POOL_TIMEOUT,
        }
    )

# Async SQLAlchemy 2.0 Engine
engine = create_async_engine(settings.DATABASE_URL, **engine_kwargs)

# Thread-safe async session factory
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)

# Shared declarative base for all ORM models
Base = declarative_base()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency yielding an asynchronous database session per request.

    Transaction boundaries & lifecycle:
    - Yields an active AsyncSession to the route handler.
    - Automatically commits all operations on successful completion.
    - Rolls back the transaction if any unhandled exception occurs.
    - Closes and returns the connection to the pool in the finally block.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


@asynccontextmanager
async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Standalone async context manager for background workers, CLI scripts,
    and automated database fixtures outside of FastAPI route handlers.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

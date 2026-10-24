import asyncio
import os
import sys
from logging.config import fileConfig
from pathlib import Path

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# Ensure workspace and backend paths are discoverable
current_dir = Path(__file__).resolve().parent
backend_dir = current_dir.parent
workspace_dir = backend_dir.parent

for p in (str(workspace_dir), str(backend_dir)):
    if p not in sys.path:
        sys.path.insert(0, p)

# Load Brand Bridge application settings and ORM models
from app.core.config import settings
from app.core.database import Base
import app.models  # Ensures all models and tables are registered in Base.metadata

# Alembic Config object
config = context.config

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Set model metadata for autogenerate support
target_metadata = Base.metadata


def get_url() -> str:
    """
    Retrieves database URL with dynamic fallback:
    1. Environment variable DATABASE_URL
    2. Settings DATABASE_URL
    3. Alembic config ini option
    Normalizes standard postgresql:// to postgresql+asyncpg:// for async engine compatibility.
    """
    raw_url = os.getenv("DATABASE_URL") or settings.DATABASE_URL or config.get_main_option("sqlalchemy.url")
    if not raw_url:
        raw_url = "sqlite+aiosqlite:///./brand_bridge.db"

    # Normalize PostgreSQL URL for asyncpg if standard driver is specified
    if raw_url.startswith("postgresql://"):
        raw_url = raw_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif raw_url.startswith("postgres://"):
        raw_url = raw_url.replace("postgres://", "postgresql+asyncpg://", 1)

    return raw_url


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode without an active DB connection."""
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=url.startswith("sqlite"),
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    """Executes migrations within synchronous connection wrapper."""
    is_sqlite = connection.dialect.name == "sqlite"
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        render_as_batch=is_sqlite,
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Creates async engine and runs migrations asynchronously."""
    section = config.get_section(config.config_ini_section, {})
    section["sqlalchemy.url"] = get_url()

    connectable = async_engine_from_config(
        section,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode using asyncio event loop."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

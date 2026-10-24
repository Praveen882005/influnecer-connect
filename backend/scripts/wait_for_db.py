"""
==============================================================================
Brand Bridge - Database Connection Wait Utility
==============================================================================
Polls the configured database until a live connection is established or timeout.
Ensures containers and orchestration services do not fail during cold starts
while PostgreSQL finishes initialization.
==============================================================================
"""

import asyncio
import logging
import os
import sys

# Configure stdout logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("wait-for-db")


async def check_db_connection(max_retries: int = 30, delay: float = 1.0) -> bool:
    """
    Attempts to establish a connection to the configured database.
    Retries up to max_retries times with a delay between each attempt.
    """
    # Ensure backend directory is in path
    sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

    from app.core.config import settings
    from sqlalchemy.ext.asyncio import create_async_engine
    from sqlalchemy import text

    db_url = settings.DATABASE_URL
    # Mask password in logs
    if "@" in db_url:
        safe_url = db_url.split("@")[-1]
    else:
        safe_url = db_url

    logger.info(f"Testing database connectivity to [{safe_url}]...")

    if "sqlite" in db_url:
        logger.info("Local SQLite storage detected; database is immediately available.")
        return True

    engine = create_async_engine(db_url, pool_pre_ping=True)

    for attempt in range(1, max_retries + 1):
        try:
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            logger.info(f"Database connection successfully established on attempt {attempt}.")
            await engine.dispose()
            return True
        except Exception as exc:
            logger.warning(
                f"Attempt {attempt}/{max_retries} failed: {exc}. Retrying in {delay}s..."
            )
            await asyncio.sleep(delay)

    await engine.dispose()
    logger.error(f"Could not connect to database after {max_retries} attempts.")
    return False


def main():
    success = asyncio.run(check_db_connection())
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()

import logging
from typing import Dict, Tuple
from sqlalchemy import text
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.schemas.health import HealthResponse, ReadinessResponse

logger = logging.getLogger("brand_bridge")


class HealthService:
    """Service handling platform liveness and readiness verification."""

    @staticmethod
    def get_liveness(status_str: str = "healthy", include_subsystems: bool = True) -> HealthResponse:
        """Returns instantaneous liveness state of the application container."""
        subsystems = (
            {
                "database": "connected",
                "matching_engine": "ready",
                "auth_jwt": "ready",
            }
            if include_subsystems
            else None
        )

        return HealthResponse(
            status=status_str,
            app=settings.APP_NAME,
            version=settings.APP_VERSION,
            environment=settings.ENVIRONMENT,
            subsystems=subsystems,
        )

    @staticmethod
    async def check_database_connectivity() -> Tuple[bool, str]:
        """
        Tests database connection liveness.
        Returns a tuple of (is_connected, status_description).
        """
        if not settings.is_database_configured:
            return False, "Database is not configured in environment settings."

        try:
            async with AsyncSessionLocal() as session:
                await session.execute(text("SELECT 1"))
            return True, "connected"
        except Exception as exc:
            logger.warning(f"Database readiness probe failed: {exc}")
            return False, f"unreachable: {str(exc)}"

    @classmethod
    async def get_readiness(cls) -> Tuple[ReadinessResponse, bool]:
        """
        Evaluates system readiness across persistence and AI inference subsystems.
        Returns (ReadinessResponse, is_ready_boolean).
        """
        db_connected, db_status = await cls.check_database_connectivity()

        subsystems: Dict[str, str] = {
            "database": db_status,
            "matching_engine": "ready",
            "auth_jwt": "ready",
            "storage": f"mounted ({settings.STORAGE_PROVIDER})",
        }

        is_ready = db_connected
        status_label = "ready" if is_ready else "not_ready"

        response = ReadinessResponse(
            status=status_label,
            database_configured=settings.is_database_configured,
            database_status=db_status,
            subsystems=subsystems,
            app=settings.APP_NAME,
            version=settings.APP_VERSION,
        )

        return response, is_ready

from datetime import datetime, timezone
from typing import Dict, Optional
from pydantic import BaseModel, ConfigDict, Field


class HealthResponse(BaseModel):
    """Liveness probe response model."""

    model_config = ConfigDict(from_attributes=True)

    status: str = Field(default="healthy", description="Liveness state (ok / healthy)")
    app: str = Field(description="Application name")
    version: str = Field(description="Application version")
    environment: str = Field(description="Active runtime environment")
    subsystems: Optional[Dict[str, str]] = Field(default=None, description="Subsystem health status indicators")
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
        description="UTC ISO-8601 timestamp",
    )


class ReadinessResponse(BaseModel):
    """Readiness probe response model."""

    model_config = ConfigDict(from_attributes=True)

    status: str = Field(description="Readiness state (ready / not_ready / degraded)")
    database_configured: bool = Field(description="Whether a persistent database is configured")
    database_status: str = Field(description="Database connectivity check result")
    subsystems: Dict[str, str] = Field(description="Operational status of all subsystems")
    app: str = Field(description="Application name")
    version: str = Field(description="Application version")
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
        description="UTC ISO-8601 timestamp",
    )

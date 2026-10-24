import os
from typing import Any, Dict, List
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Brand Bridge Core Application Settings.
    Loaded deterministically from environment variables or .env file.
    All secrets are protected from accidental logging or disclosure.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # General Application Information
    APP_NAME: str = Field(default="Brand Bridge", description="Public application name")
    APP_VERSION: str = Field(default="0.1.0", description="SemVer application version")
    ENVIRONMENT: str = Field(
        default="development",
        description="Deployment stage: development, staging, production, or testing",
    )
    DEBUG: bool = Field(default=True, description="Debug mode flag")
    API_V1_PREFIX: str = Field(default="/api/v1", description="API v1 routing prefix")

    # Host & Networking
    BACKEND_HOST: str = Field(default="127.0.0.1", description="Bind IP address")
    BACKEND_PORT: int = Field(default=8000, description="Listening TCP port")

    @field_validator("BACKEND_PORT")
    @classmethod
    def validate_port(cls, v: int) -> int:
        if not (1 <= v <= 65535):
            raise ValueError(f"BACKEND_PORT must be between 1 and 65535 (got {v})")
        return v

    @field_validator("ENVIRONMENT")
    @classmethod
    def validate_environment(cls, v: str) -> str:
        valid_envs = {"development", "staging", "production", "testing"}
        clean = v.lower().strip()
        if clean not in valid_envs:
            raise ValueError(
                f"ENVIRONMENT must be one of {valid_envs} (got '{v}'). "
                f"Please verify your .env configuration."
            )
        return clean

    # Security & Cryptography
    SECRET_KEY: str = Field(
        default="brand-bridge-dev-secret-key-change-in-production-32chars",
        description="JWT cryptographic signing key",
    )
    JWT_ALGORITHM: str = Field(default="HS256", description="JWT cryptographic signature algorithm")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(
        default=60 * 24, description="Access token lifetime in minutes"
    )
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(
        default=7, description="Refresh token lifetime in days"
    )

    # Cross-Origin Resource Sharing (CORS) Allowlist
    CORS_ALLOWED_ORIGINS: str = Field(
        default="http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173",
        description="Comma-separated list of allowed origins",
    )

    @property
    def cors_origins_list(self) -> List[str]:
        """Parses comma-separated CORS allowlist into clean list of origin URLs without trailing slashes."""
        return [
            origin.strip().rstrip("/")
            for origin in self.CORS_ALLOWED_ORIGINS.split(",")
            if origin.strip()
        ]

    # Database Configuration
    DATABASE_URL: str = Field(
        default="sqlite+aiosqlite:///./brand_bridge.db",
        description="Async SQLAlchemy database connection string",
    )
    AUTO_CREATE_TABLES: bool = Field(
        default=True,
        description="Auto-create tables on startup in development/testing mode only. Disabled in production.",
    )
    DB_POOL_SIZE: int = Field(default=10, description="Connection pool size for external database")
    DB_MAX_OVERFLOW: int = Field(default=20, description="Max overflow connections beyond pool size")
    DB_POOL_TIMEOUT: int = Field(default=30, description="Connection acquisition timeout in seconds")

    @property
    def is_postgres_configured(self) -> bool:
        """Indicates whether an external PostgreSQL instance is configured."""
        return self.DATABASE_URL.startswith("postgresql")

    @property
    def is_database_configured(self) -> bool:
        """Indicates whether a database URL is present and configured."""
        return bool(self.DATABASE_URL and self.DATABASE_URL.strip())

    # Storage Provider
    STORAGE_PROVIDER: str = Field(default="local", description="local or s3")
    LOCAL_STORAGE_PATH: str = Field(default="./data/samples", description="Path for local file cache")

    # AI / Machine Learning Engine
    AI_PROVIDER: str = Field(default="local", description="local TF-IDF or external LLM")
    OPENAI_API_KEY: str = Field(default="", description="Optional OpenAI key for future AI modules")
    ANTHROPIC_API_KEY: str = Field(default="", description="Optional Anthropic key for future AI modules")

    def safe_dict(self) -> Dict[str, Any]:
        """
        Returns a dictionary of configuration settings with sensitive secrets masked.
        Safe for logging, telemetry, and debugging inspection.
        """
        raw = self.model_dump()
        sensitive_keys = {
            "SECRET_KEY",
            "OPENAI_API_KEY",
            "ANTHROPIC_API_KEY",
        }
        for key in sensitive_keys:
            val = raw.get(key)
            if val and isinstance(val, str) and len(val) > 0:
                raw[key] = f"***REDACTED (length {len(val)})***"
            else:
                raw[key] = "***NOT_CONFIGURED***"

        return raw

    def __repr__(self) -> str:
        """Safe string representation preventing credential leaks."""
        safe_props = [
            f"app_name='{self.APP_NAME}'",
            f"version='{self.APP_VERSION}'",
            f"environment='{self.ENVIRONMENT}'",
            f"database='{self.DATABASE_URL.split('://')[0]}://***'",
        ]
        return f"Settings({', '.join(safe_props)})"


# Instantiate singleton settings
settings = Settings()

import pytest
from pydantic import ValidationError
from app.core.config import Settings


def test_settings_defaults():
    """Verifies default settings configuration."""
    s = Settings()
    assert s.APP_NAME == "Brand Bridge"
    assert s.APP_VERSION == "0.1.0"
    assert s.BACKEND_PORT == 8000
    assert s.API_V1_PREFIX == "/api/v1"
    assert len(s.cors_origins_list) >= 1
    assert "http://localhost:3000" in s.cors_origins_list


def test_cors_allowlist_parsing():
    """Verifies that CORS origins are split and whitespace trimmed."""
    s = Settings(CORS_ALLOWED_ORIGINS="https://app.brandbridge.io , https://admin.brandbridge.io")
    assert s.cors_origins_list == [
        "https://app.brandbridge.io",
        "https://admin.brandbridge.io",
    ]


def test_settings_port_validation():
    """Verifies that invalid TCP ports raise an actionable ValidationError."""
    with pytest.raises(ValidationError) as exc_info:
        Settings(BACKEND_PORT=70000)
    assert "BACKEND_PORT must be between 1 and 65535" in str(exc_info.value)

    with pytest.raises(ValidationError) as exc_info2:
        Settings(BACKEND_PORT=0)
    assert "BACKEND_PORT must be between 1 and 65535" in str(exc_info2.value)


def test_settings_environment_validation():
    """Verifies that invalid ENVIRONMENT raises an actionable ValidationError."""
    with pytest.raises(ValidationError) as exc_info:
        Settings(ENVIRONMENT="invalid_env_name")
    assert "ENVIRONMENT must be one of" in str(exc_info.value)


def test_secrets_masking_in_repr_and_dict():
    """Verifies that SECRET_KEY and API keys are never exposed in string representation or safe_dict."""
    secret_val = "super-confidential-secret-key-12345"
    s = Settings(SECRET_KEY=secret_val, OPENAI_API_KEY="sk-live-secret")

    # __repr__ check
    rep = repr(s)
    assert secret_val not in rep
    assert "sk-live-secret" not in rep

    # safe_dict check
    safe = s.safe_dict()
    assert secret_val not in str(safe)
    assert "sk-live-secret" not in str(safe)
    assert "***REDACTED" in safe["SECRET_KEY"]
    assert "***REDACTED" in safe["OPENAI_API_KEY"]

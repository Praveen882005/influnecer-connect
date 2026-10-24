import pytest
from httpx import AsyncClient
from app.core.logging import SensitiveDataFilter


@pytest.mark.asyncio
async def test_liveness_endpoints(client: AsyncClient):
    """Verifies that both /health and /api/v1/health return valid liveness payloads."""
    # Root /health
    res = await client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["app"] == "Brand Bridge"
    assert data["version"] == "0.1.0"
    assert "timestamp" in data

    # Detailed /api/v1/health
    res_v1 = await client.get("/api/v1/health")
    assert res_v1.status_code == 200
    data_v1 = res_v1.json()
    assert data_v1["status"] in ["ok", "healthy"]
    assert data_v1["app"] == "Brand Bridge"
    assert data_v1["subsystems"]["matching_engine"] == "ready"
    assert "timestamp" in data_v1


@pytest.mark.asyncio
async def test_readiness_endpoints(client: AsyncClient):
    """Verifies that both /ready and /api/v1/ready verify database readiness."""
    for path in ["/ready", "/api/v1/ready"]:
        res = await client.get(path)
        assert res.status_code == 200, f"Expected 200 on {path}, got {res.status_code}"
        data = res.json()
        assert data["status"] == "ready"
        assert data["database_configured"] is True
        assert data["database_status"] == "connected"
        assert "database" in data["subsystems"]
        assert "matching_engine" in data["subsystems"]
        assert "auth_jwt" in data["subsystems"]


@pytest.mark.asyncio
async def test_standardized_not_found_error_response(client: AsyncClient):
    """Verifies that 404 responses conform to the standardized error envelope."""
    res = await client.get("/api/v1/nonexistent-endpoint-route")
    assert res.status_code == 404
    data = res.json()
    assert "error" in data
    assert data["error"]["code"] == 404
    assert data["error"]["error_type"] == "http_exception"
    assert "detail" in data


@pytest.mark.asyncio
async def test_standardized_validation_error_response(client: AsyncClient):
    """Verifies that 422 validation errors conform to the standardized error envelope."""
    # Invalid registration payload (missing password, invalid email)
    res = await client.post("/api/v1/auth/register", json={"email": "not-an-email"})
    assert res.status_code == 422
    data = res.json()
    assert "error" in data
    assert data["error"]["code"] == 422
    assert data["error"]["error_type"] == "validation_error"
    assert "details" in data["error"]
    assert len(data["error"]["details"]) > 0


def test_sensitive_data_logging_filter():
    """Verifies that SensitiveDataFilter masks passwords and bearer tokens."""
    filter_instance = SensitiveDataFilter()

    # Test password redaction in string
    log_text = "User login attempt with password='SuperSecretPassword123' and username='tester'"
    sanitized = filter_instance.sanitize_string(log_text)
    assert "SuperSecretPassword123" not in sanitized
    assert "***REDACTED***" in sanitized

    # Test Bearer token redaction
    bearer_text = "Incoming HTTP Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature"
    sanitized_bearer = filter_instance.sanitize_string(bearer_text)
    assert "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" not in sanitized_bearer
    assert "***REDACTED***" in sanitized_bearer

    # Test dictionary key redaction
    sensitive_dict = {"api_key": "sk-1234567890abcdef", "action": "health_check"}
    assert filter_instance.sanitize_val("api_key", sensitive_dict["api_key"]) == "***REDACTED***"
    assert filter_instance.sanitize_val("action", sensitive_dict["action"]) == "health_check"

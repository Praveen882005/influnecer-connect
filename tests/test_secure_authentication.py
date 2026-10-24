from datetime import timedelta
import pytest
from httpx import AsyncClient
from app.core.config import settings
from app.core.rate_limiter import auth_rate_limiter
from app.core.security import create_access_token, token_blacklist


@pytest.fixture(autouse=True)
def reset_security_stores():
    """Reset rate limiter and token blacklist before each test."""
    auth_rate_limiter.reset()
    token_blacklist.clear()
    yield
    auth_rate_limiter.reset()
    token_blacklist.clear()


@pytest.mark.asyncio
async def test_public_admin_registration_forbidden(client: AsyncClient):
    """
    Verifies that public registration endpoint strictly rejects attempts
    to provision administrator accounts.
    """
    payload = {
        "email": "infiltrator@test.com",
        "password": "Password123!",
        "full_name": "Fake Admin",
        "role": "admin",
    }
    res = await client.post("/api/v1/auth/register", json=payload)
    assert res.status_code == 403
    assert "Administrator accounts cannot be registered publicly" in res.json()["detail"]


@pytest.mark.asyncio
async def test_admin_bootstrap_endpoint_security(client: AsyncClient):
    """
    Verifies development admin bootstrap authorization and secret key validation.
    """
    bootstrap_payload = {
        "email": "dev.admin@brandbridge.io",
        "password": "SuperSecurePassword123",
        "full_name": "Dev Admin Lead",
        "secret_key": settings.SECRET_KEY,
    }

    # 1. Successful bootstrap with matching secret key in development
    res = await client.post("/api/v1/auth/bootstrap-admin", json=bootstrap_payload)
    assert res.status_code == 201
    admin_data = res.json()
    assert admin_data["role"] == "admin"
    assert admin_data["email"] == "dev.admin@brandbridge.io"

    # 2. Rejection when secret key is incorrect
    bad_payload = bootstrap_payload.copy()
    bad_payload["secret_key"] = "incorrect_secret_key"
    bad_res = await client.post("/api/v1/auth/bootstrap-admin", json=bad_payload)
    assert bad_res.status_code == 403
    assert "Invalid master secret key" in bad_res.json()["detail"]


@pytest.mark.asyncio
async def test_token_refresh_and_rotation(client: AsyncClient):
    """
    Verifies refresh token exchange, new access token issuance,
    and refresh token rotation.
    """
    # Register user
    reg_payload = {
        "email": "refresh.user@brandbridge.io",
        "password": "Password123!",
        "full_name": "Token Tester",
        "role": "creator",
    }
    reg_res = await client.post("/api/v1/auth/register", json=reg_payload)
    assert reg_res.status_code == 201
    tokens = reg_res.json()
    refresh_token = tokens["refresh_token"]
    assert refresh_token is not None

    # Exchange refresh token
    refresh_res = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": refresh_token}
    )
    assert refresh_res.status_code == 200
    new_tokens = refresh_res.json()
    new_access_token = new_tokens["access_token"]
    new_refresh_token = new_tokens["refresh_token"]

    assert new_access_token != tokens["access_token"]
    assert new_refresh_token != refresh_token

    # Verify old refresh token was consumed (rotated) and cannot be reused
    reuse_res = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": refresh_token}
    )
    assert reuse_res.status_code == 401


@pytest.mark.asyncio
async def test_logout_token_revocation(client: AsyncClient):
    """
    Verifies that calling /logout invalidates the access token,
    causing subsequent protected requests to be rejected.
    """
    # Register and sign in
    login_payload = {
        "email": "logout.tester@brandbridge.io",
        "password": "Password123!",
        "full_name": "Logout Tester",
        "role": "creator",
    }
    reg_res = await client.post("/api/v1/auth/register", json=login_payload)
    tokens = reg_res.json()
    access_token = tokens["access_token"]
    refresh_token = tokens["refresh_token"]

    # Access /auth/me before logout - should succeed
    headers = {"Authorization": f"Bearer {access_token}"}
    me_before = await client.get("/api/v1/auth/me", headers=headers)
    assert me_before.status_code == 200

    # Logout and revoke tokens
    logout_res = await client.post(
        "/api/v1/auth/logout",
        headers=headers,
        json={"refresh_token": refresh_token},
    )
    assert logout_res.status_code == 200
    assert logout_res.json()["logged_out"] is True

    # Access /auth/me after logout - should fail with 401
    me_after = await client.get("/api/v1/auth/me", headers=headers)
    assert me_after.status_code == 401


@pytest.mark.asyncio
async def test_expired_token_rejection(client: AsyncClient):
    """
    Verifies that an expired JWT token is immediately rejected with 401 Unauthorized.
    """
    # Generate an intentionally expired token (-10 minutes)
    expired_token = create_access_token(
        data={"sub": "9999", "role": "creator"},
        expires_delta=timedelta(minutes=-10),
    )

    headers = {"Authorization": f"Bearer {expired_token}"}
    res = await client.get("/api/v1/auth/me", headers=headers)
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_server_side_role_enforcement(client: AsyncClient):
    """
    Verifies that server-side RBAC dependencies prevent role misuse
    (e.g., creator attempting to create a campaign).
    """
    # 1. Register a Creator
    creator_payload = {
        "email": "creator.role.test@brandbridge.io",
        "password": "Password123!",
        "full_name": "Role Test Creator",
        "role": "creator",
    }
    c_res = await client.post("/api/v1/auth/register", json=creator_payload)
    creator_token = c_res.json()["access_token"]

    # 2. Creator attempts to POST /campaigns/ (Brand-only action)
    c_headers = {"Authorization": f"Bearer {creator_token}"}
    campaign_payload = {
        "title": "Unauthorized Creator Campaign",
        "description": "This should be blocked by RBAC.",
        "budget": 5000.0,
        "niche": "Tech",
    }
    blocked_res = await client.post("/api/v1/campaigns/", json=campaign_payload, headers=c_headers)
    assert blocked_res.status_code == 403
    assert "Operation not permitted" in blocked_res.json()["detail"]


@pytest.mark.asyncio
async def test_cross_user_resource_ownership_protection(client: AsyncClient):
    """
    Verifies that User A cannot modify or view private resources belonging to User B.
    """
    # 1. Create Brand A
    brand_a_payload = {
        "email": "brand_a@company.com",
        "password": "Password123!",
        "full_name": "Brand Alpha",
        "role": "brand",
        "company_name": "Alpha Corp",
        "industry": "Software",
    }
    res_a = await client.post("/api/v1/auth/register", json=brand_a_payload)
    token_a = res_a.json()["access_token"]

    # 2. Create Brand B
    brand_b_payload = {
        "email": "brand_b@company.com",
        "password": "Password123!",
        "full_name": "Brand Beta",
        "role": "brand",
        "company_name": "Beta Corp",
        "industry": "Retail",
    }
    res_b = await client.post("/api/v1/auth/register", json=brand_b_payload)
    token_b = res_b.json()["access_token"]

    # 3. Brand A creates a campaign
    headers_a = {"Authorization": f"Bearer {token_a}"}
    create_res = await client.post(
        "/api/v1/campaigns/",
        json={"title": "Alpha Campaign", "description": "Confidential", "budget": 10000.0, "niche": "Tech"},
        headers=headers_a,
    )
    campaign_id = create_res.json()["id"]

    # 4. Brand B attempts to modify Brand A's campaign -> must be rejected with 403 Forbidden
    headers_b = {"Authorization": f"Bearer {token_b}"}
    update_res = await client.put(
        f"/api/v1/campaigns/{campaign_id}",
        json={"title": "Hacked Title"},
        headers=headers_b,
    )
    assert update_res.status_code == 403
    assert "Ownership check failed" in update_res.json()["detail"]


@pytest.mark.asyncio
async def test_authentication_rate_limiting(client: AsyncClient):
    """
    Verifies that exceeding the threshold of login attempts triggers
    HTTP 429 Too Many Requests with a Retry-After header.
    """
    login_payload = {
        "email": "brute_force_target@test.com",
        "password": "WrongPassword!",
    }

    # Trigger multiple requests up to limit
    responses = []
    for _ in range(12):
        res = await client.post("/api/v1/auth/login", json=login_payload)
        responses.append(res)

    status_codes = [r.status_code for r in responses]
    # Earliest requests should fail credentials (401), later ones rate limited (429)
    assert 429 in status_codes
    rate_limited_response = next(r for r in responses if r.status_code == 429)
    assert "Retry-After" in rate_limited_response.headers
    assert "Too many requests" in rate_limited_response.json()["detail"]

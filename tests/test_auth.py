import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_endpoints(client: AsyncClient):
    res = await client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["app"] == "Brand Bridge"

    det_res = await client.get("/api/v1/health")
    assert det_res.status_code == 200
    det_data = det_res.json()
    assert det_data["status"] == "healthy"
    assert det_data["subsystems"]["matching_engine"] == "ready"


@pytest.mark.asyncio
async def test_brand_registration_and_login(client: AsyncClient):
    reg_payload = {
        "email": "brand.tester@company.com",
        "password": "Password123!",
        "full_name": "Apex Footwear Co",
        "role": "brand",
        "company_name": "Apex Footwear Co",
        "industry": "Fashion & Athletic",
    }
    reg_res = await client.post("/api/v1/auth/register", json=reg_payload)
    assert reg_res.status_code == 201
    reg_data = reg_res.json()
    assert "access_token" in reg_data
    assert reg_data["user"]["role"] == "brand"
    assert reg_data["user"]["brand_profile_id"] is not None

    # Login
    login_payload = {
        "email": "brand.tester@company.com",
        "password": "Password123!",
    }
    login_res = await client.post("/api/v1/auth/login", json=login_payload)
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]

    # Verify /auth/me with bearer token
    headers = {"Authorization": f"Bearer {token}"}
    me_res = await client.get("/api/v1/auth/me", headers=headers)
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["email"] == "brand.tester@company.com"
    assert me_data["role"] == "brand"


@pytest.mark.asyncio
async def test_creator_registration_and_login(client: AsyncClient):
    reg_payload = {
        "email": "creator.tester@influencer.net",
        "password": "SecretPassword123",
        "full_name": "Jordan Rivers",
        "role": "creator",
        "handle": "@jordan_reviews",
        "primary_niche": "Tech & Gadgets",
    }
    reg_res = await client.post("/api/v1/auth/register", json=reg_payload)
    assert reg_res.status_code == 201
    reg_data = reg_res.json()
    assert reg_data["user"]["role"] == "creator"
    assert reg_data["user"]["creator_profile_id"] is not None

    # Check creator profile in list
    c_list_res = await client.get("/api/v1/creators/")
    assert c_list_res.status_code == 200
    creators = c_list_res.json()
    handles = [c["handle"] for c in creators]
    assert "@jordan_reviews" in handles


@pytest.mark.asyncio
async def test_duplicate_email_fails(client: AsyncClient):
    payload = {
        "email": "unique.user@test.com",
        "password": "Password123!",
        "full_name": "Unique User",
        "role": "creator",
    }
    res1 = await client.post("/api/v1/auth/register", json=payload)
    assert res1.status_code == 201

    res2 = await client.post("/api/v1/auth/register", json=payload)
    assert res2.status_code == 400
    assert "already exists" in res2.json()["detail"]


@pytest.mark.asyncio
async def test_invalid_login_credentials(client: AsyncClient):
    login_payload = {
        "email": "nonexistent@user.com",
        "password": "WrongPassword",
    }
    res = await client.post("/api/v1/auth/login", json=login_payload)
    assert res.status_code == 401

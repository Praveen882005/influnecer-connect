import pytest
from httpx import AsyncClient
from app.models.entities import INITIAL_NICHES


@pytest.mark.asyncio
async def test_initial_niches_endpoint(client: AsyncClient):
    """
    Verifies that GET /api/v1/creators/niches returns all 8 required initial niches:
    beauty, food, fitness, fashion, home, technology, parenting, wellness.
    """
    res = await client.get("/api/v1/creators/niches")
    assert res.status_code == 200
    niches = res.json()
    assert isinstance(niches, list)

    expected = {"beauty", "food", "fitness", "fashion", "home", "technology", "parenting", "wellness"}
    assert expected.issubset(set(niches))
    assert len(niches) == 8


@pytest.mark.asyncio
async def test_brand_profile_lifecycle_and_completeness(client: AsyncClient):
    """
    Tests brand profile creation, retrieval, updates, owner metadata,
    and completeness scoring calculations.
    """
    # 1. Register Brand User
    reg_res = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "brand.owner@acme-corp.com",
            "password": "SecurePassword123!",
            "full_name": "Eleanor Vance",
            "role": "brand",
            "company_name": "Acme Global Dynamics",
            "industry": "technology",
        },
    )
    assert reg_res.status_code == 201
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Get Profile
    get_res = await client.get("/api/v1/brands/profile", headers=headers)
    assert get_res.status_code == 200
    brand_data = get_res.json()
    assert brand_data["company_name"] == "Acme Global Dynamics"
    assert brand_data["owner_name"] == "Eleanor Vance"
    assert brand_data["owner_email"] == "brand.owner@acme-corp.com"
    initial_score = brand_data["completeness_score"]
    assert initial_score > 0

    # 3. Update Brand Profile with logo, website, location, demographics
    update_payload = {
        "companyName": "Acme Global Dynamics Inc.",
        "website": "https://acmeglobal.io",
        "logoUrl": "https://acmeglobal.io/assets/emblem.png",
        "industry": "technology",
        "targetRegion": "us_eu",
        "description": "Leading manufacturer of intelligent edge devices and developer productivity environments.",
        "minEngagement": 4.5,
        "minAuthenticity": 93.0,
    }
    put_res = await client.put("/api/v1/brands/profile", json=update_payload, headers=headers)
    assert put_res.status_code == 200
    updated_data = put_res.json()

    assert updated_data["company_name"] == "Acme Global Dynamics Inc."
    assert updated_data["website"] == "https://acmeglobal.io"
    assert updated_data["logo_url"] == "https://acmeglobal.io/assets/emblem.png"
    assert updated_data["location"] == "us_eu"
    assert "intelligent edge devices" in updated_data["description"]
    assert updated_data["completeness_score"] >= initial_score
    assert updated_data["target_demographics"]["min_engagement"] == 4.5
    assert updated_data["target_demographics"]["min_authenticity"] == 93.0

    # 4. Verify persistence on subsequent GET
    verify_res = await client.get("/api/v1/brands/profile", headers=headers)
    assert verify_res.status_code == 200
    persisted = verify_res.json()
    assert persisted["company_name"] == "Acme Global Dynamics Inc."
    assert persisted["logo_url"] == "https://acmeglobal.io/assets/emblem.png"
    assert persisted["website"] == "https://acmeglobal.io"


@pytest.mark.asyncio
async def test_creator_profile_lifecycle_and_updates(client: AsyncClient):
    """
    Tests creator profile retrieval, update of media kit and niches,
    and profile completeness tracking.
    """
    # 1. Register Creator User
    reg_res = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "creator.sophia@creativelab.com",
            "password": "SecurePassword123!",
            "full_name": "Sophia Martinez",
            "role": "creator",
            "handle": "@sophia_builds",
            "primary_niche": "technology",
        },
    )
    assert reg_res.status_code == 201
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Get Profile
    get_res = await client.get("/api/v1/creators/profile", headers=headers)
    assert get_res.status_code == 200
    data = get_res.json()
    assert data["handle"] == "@sophia_builds"
    assert data["display_name"] == "Sophia Martinez"
    assert data["owner_name"] == "Sophia Martinez"
    assert data["data_source"] == "user_manual"
    assert data["is_platform_verified"] is False
    assert data["freshness_status"] == "manual"

    # 3. Update Creator Profile
    update_payload = {
        "displayName": "Sophia Martinez - Senior Dev",
        "handle": "@sophia_codes",
        "profileImageUrl": "https://creativelab.com/avatar.jpg",
        "primaryNiche": "technology",
        "bio": "Deep architectural reviews, cloud native system engineering, and developer workstation setups.",
        "location": "Austin, TX",
        "language": "English",
        "rateYoutubeDedicated": "$4,200",
        "rateYoutubeIntegration": "$2,100",
        "rateInstagramReel": "$1,500",
    }
    put_res = await client.put("/api/v1/creators/profile", json=update_payload, headers=headers)
    assert put_res.status_code == 200
    updated = put_res.json()

    assert updated["display_name"] == "Sophia Martinez - Senior Dev"
    assert updated["handle"] == "@sophia_codes"
    assert updated["profile_image_url"] == "https://creativelab.com/avatar.jpg"
    assert updated["language"] == "English"
    assert updated["collaboration_preferences"]["location"] == "Austin, TX"
    assert updated["collaboration_preferences"]["rate_youtube_dedicated"] == "$4,200"

    # 4. Verify persistence after fresh fetch
    refetch_res = await client.get("/api/v1/creators/profile", headers=headers)
    assert refetch_res.status_code == 200
    refetched = refetch_res.json()
    assert refetched["handle"] == "@sophia_codes"
    assert refetched["collaboration_preferences"]["rate_instagram_reel"] == "$1,500"


@pytest.mark.asyncio
async def test_platform_verification_and_provenance(client: AsyncClient):
    """
    Verifies data provenance rules:
    - Do not claim a profile is connected to Instagram until connection is verified.
    - User manual changes retain data_source = 'user_manual'.
    - Platform verification updates data_source and freshness_status.
    """
    reg_res = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "dan.creator@studio.io",
            "password": "SecurePassword123!",
            "full_name": "Dan Miller",
            "role": "creator",
            "handle": "@dan_miller",
            "primary_niche": "fitness",
        },
    )
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Check initial unverified state
    initial_res = await client.get("/api/v1/creators/profile", headers=headers)
    assert initial_res.status_code == 200
    initial_data = initial_res.json()
    assert initial_data["is_platform_verified"] is False
    assert initial_data["data_source"] == "user_manual"
    assert "instagram" not in initial_data.get("connected_platforms", {})

    # Trigger Instagram verification
    verify_res = await client.post(
        "/api/v1/creators/verify-platform",
        json={"platform": "instagram", "external_account_handle": "@dan_miller_fitness"},
        headers=headers,
    )
    assert verify_res.status_code == 200
    verified_data = verify_res.json()

    assert verified_data["is_platform_verified"] is True
    assert verified_data["data_source"] == "instagram_verified_api"
    assert verified_data["freshness_status"] == "fresh"
    assert verified_data["last_fetched_at"] is not None
    assert verified_data["connected_platforms"]["instagram"]["verified"] is True
    assert verified_data["connected_platforms"]["instagram"]["handle"] == "@dan_miller_fitness"

    # Verify that persistence holds on subsequent GET
    get_res = await client.get("/api/v1/creators/profile", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["is_platform_verified"] is True


@pytest.mark.asyncio
async def test_handle_uniqueness_conflict_rejected(client: AsyncClient):
    """
    Ensures that a creator cannot claim a handle already in use by another creator.
    """
    # Register creator 1
    res1 = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "c1@test.com",
            "password": "Password123!",
            "full_name": "Creator One",
            "role": "creator",
            "handle": "@unique_handle",
        },
    )
    assert res1.status_code == 201

    # Register creator 2
    res2 = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "c2@test.com",
            "password": "Password123!",
            "full_name": "Creator Two",
            "role": "creator",
            "handle": "@other_handle",
        },
    )
    token2 = res2.json()["access_token"]
    headers2 = {"Authorization": f"Bearer {token2}"}

    # Attempt to change creator 2's handle to @unique_handle
    conflict_res = await client.put(
        "/api/v1/creators/profile",
        json={"handle": "@unique_handle"},
        headers=headers2,
    )
    assert conflict_res.status_code == 400
    assert "already registered" in conflict_res.json()["detail"]


@pytest.mark.asyncio
async def test_cross_role_and_ownership_protection(client: AsyncClient):
    """
    Verifies role restrictions and ownership protection:
    - Creator cannot access or update Brand profile (/brands/profile -> 404/403).
    - Unauthenticated requests are rejected with 401.
    """
    # 1. Unauthenticated request rejected
    anon_res = await client.get("/api/v1/brands/profile")
    assert anon_res.status_code == 401

    # 2. Creator attempting to access brand profile
    reg_creator = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "solo.creator@domain.com",
            "password": "Password123!",
            "full_name": "Solo Creator",
            "role": "creator",
            "handle": "@solo_creator",
        },
    )
    creator_token = reg_creator.json()["access_token"]
    creator_headers = {"Authorization": f"Bearer {creator_token}"}

    # Creator has no brand profile
    brand_req = await client.get("/api/v1/brands/profile", headers=creator_headers)
    assert brand_req.status_code == 404

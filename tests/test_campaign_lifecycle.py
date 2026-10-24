from datetime import datetime, timedelta, timezone
import pytest
from httpx import AsyncClient
from app.models.entities import CampaignStatus


@pytest.mark.asyncio
async def test_campaign_create_and_read_lifecycle(client: AsyncClient):
    """
    Tests creating a complete campaign with budget range, currency,
    creator criteria, dates, deliverables, and reading it back.
    """
    # 1. Register Brand User
    reg_res = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "brand.growth@aurora.io",
            "password": "Password123!",
            "full_name": "Aurora Marketing",
            "role": "brand",
            "company_name": "Aurora Audio & Tech",
            "industry": "technology",
        },
    )
    assert reg_res.status_code == 201
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Create Campaign in Draft status
    start = datetime.now(timezone.utc) + timedelta(days=7)
    end = start + timedelta(days=30)
    deadline = start - timedelta(days=2)

    payload = {
        "title": "Next-Gen Spatial Audio Headphones Launch",
        "description": "High-fidelity wireless studio monitoring headphones featuring active noise cancellation.",
        "product_description": "Our flagship spatial audio headphone series engineered for audio producers.",
        "niche": "technology",
        "objective": "Product Launch",
        "target_location": "United States & Canada",
        "budget": 8500.0,
        "budget_min": 7000.0,
        "budget_max": 10000.0,
        "currency": "USD",
        "required_criteria": {
            "min_followers": 25000,
            "platforms": ["youtube"],
        },
        "preferred_criteria": {
            "content_format": "dedicated review",
            "primary_niche": "audio_production",
        },
        "deliverables": ["1x 10min Dedicated YouTube Review", "2x Instagram Stories"],
        "min_followers": 25000,
        "min_engagement_rate": 3.0,
        "status": "draft",
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "deadline": deadline.isoformat(),
    }

    create_res = await client.post("/api/v1/campaigns/", json=payload, headers=headers)
    assert create_res.status_code == 201
    campaign = create_res.json()
    assert campaign["id"] > 0
    assert campaign["title"] == payload["title"]
    assert campaign["status"] == "draft"
    assert campaign["budget_min"] == 7000.0
    assert campaign["budget_max"] == 10000.0
    assert campaign["currency"] == "USD"
    assert campaign["objective"] == "Product Launch"
    assert campaign["brand_name"] == "Aurora Audio & Tech"

    # 3. Read campaign via GET /{id}
    c_id = campaign["id"]
    get_res = await client.get(f"/api/v1/campaigns/{c_id}")
    assert get_res.status_code == 200
    assert get_res.json()["title"] == payload["title"]

    # 4. Read via GET /my
    my_res = await client.get("/api/v1/campaigns/my", headers=headers)
    assert my_res.status_code == 200
    my_campaigns = my_res.json()
    assert len(my_campaigns) == 1
    assert my_campaigns[0]["id"] == c_id


@pytest.mark.asyncio
async def test_budget_boundaries_validation(client: AsyncClient):
    """
    Validates budget rules:
    - budget must be > 0.
    - budget_min cannot exceed budget_max.
    """
    reg_res = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "finance@brand.com",
            "password": "Password123!",
            "full_name": "Finance Brand",
            "role": "brand",
        },
    )
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    base_payload = {
        "title": "Budget Validation Test Campaign",
        "description": "Comprehensive review of developer tools and workflow systems.",
        "niche": "technology",
        "budget": 5000.0,
    }

    # Case 1: budget <= 0
    bad_payload1 = base_payload.copy()
    bad_payload1["budget"] = -100.0
    res1 = await client.post("/api/v1/campaigns/", json=bad_payload1, headers=headers)
    assert res1.status_code == 422

    # Case 2: budget_min > budget_max
    bad_payload2 = base_payload.copy()
    bad_payload2["budget_min"] = 8000.0
    bad_payload2["budget_max"] = 4000.0
    res2 = await client.post("/api/v1/campaigns/", json=bad_payload2, headers=headers)
    assert res2.status_code == 422
    assert "budget_min" in str(res2.json())


@pytest.mark.asyncio
async def test_date_boundaries_validation(client: AsyncClient):
    """
    Validates date rules:
    - end_date cannot be earlier than start_date.
    - deadline cannot be set to a date in the past.
    - deadline cannot be after end_date.
    """
    reg_res = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "dates@brand.com",
            "password": "Password123!",
            "full_name": "Dates Brand",
            "role": "brand",
        },
    )
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    now = datetime.now(timezone.utc)

    # Case 1: end_date < start_date
    bad_dates_payload = {
        "title": "Invalid Date Sequence Campaign",
        "description": "Reviewing system tools with reverse start and end dates.",
        "niche": "technology",
        "budget": 4000.0,
        "start_date": (now + timedelta(days=20)).isoformat(),
        "end_date": (now + timedelta(days=10)).isoformat(),
    }
    res1 = await client.post("/api/v1/campaigns/", json=bad_dates_payload, headers=headers)
    assert res1.status_code == 422
    assert "start date" in str(res1.json()).lower()

    # Case 2: deadline in the past
    past_deadline_payload = {
        "title": "Expired Application Deadline Campaign",
        "description": "Reviewing system tools with an expired deadline in the past.",
        "niche": "technology",
        "budget": 4000.0,
        "deadline": (now - timedelta(days=5)).isoformat(),
    }
    res2 = await client.post("/api/v1/campaigns/", json=past_deadline_payload, headers=headers)
    assert res2.status_code == 422
    assert "past" in str(res2.json()).lower()


@pytest.mark.asyncio
async def test_duplicate_campaign_submission_prevention(client: AsyncClient):
    """
    Ensures that submitting duplicate campaigns with the same title under
    the same brand is rejected with an actionable 400 Bad Request error.
    """
    reg_res = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "dup@brand.com",
            "password": "Password123!",
            "full_name": "Dup Brand",
            "role": "brand",
        },
    )
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "title": "Unique Product Showcase Launch",
        "description": "Original promotional campaign for smart IoT hardware suite.",
        "niche": "technology",
        "budget": 6000.0,
    }

    # 1. Initial creation succeeds
    res1 = await client.post("/api/v1/campaigns/", json=payload, headers=headers)
    assert res1.status_code == 201

    # 2. Duplicate submission fails
    res2 = await client.post("/api/v1/campaigns/", json=payload, headers=headers)
    assert res2.status_code == 400
    assert "already exists" in res2.json()["detail"].lower()


@pytest.mark.asyncio
async def test_campaign_ownership_and_unauthorized_edits(client: AsyncClient):
    """
    Verifies that:
    - Brand A cannot update or delete Brand B's campaign.
    - Creators cannot create or update campaigns.
    """
    # Register Brand A
    res_a = await client.post(
        "/api/v1/auth/register",
        json={"email": "brand_a@test.com", "password": "Password123!", "full_name": "Brand A", "role": "brand"},
    )
    token_a = res_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # Register Brand B
    res_b = await client.post(
        "/api/v1/auth/register",
        json={"email": "brand_b@test.com", "password": "Password123!", "full_name": "Brand B", "role": "brand"},
    )
    token_b = res_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Register Creator C
    res_c = await client.post(
        "/api/v1/auth/register",
        json={"email": "creator_c@test.com", "password": "Password123!", "full_name": "Creator C", "role": "creator"},
    )
    token_c = res_c.json()["access_token"]
    headers_c = {"Authorization": f"Bearer {token_c}"}

    # 1. Brand A creates a campaign
    camp_res = await client.post(
        "/api/v1/campaigns/",
        json={"title": "Brand A Private Initiative", "description": "Exclusive campaign brief for Brand A.", "niche": "technology", "budget": 5000.0},
        headers=headers_a,
    )
    assert camp_res.status_code == 201
    c_id = camp_res.json()["id"]

    # 2. Brand B attempts to edit Brand A's campaign -> 403 Forbidden
    edit_res = await client.put(
        f"/api/v1/campaigns/{c_id}",
        json={"title": "Hijacked Title by Brand B"},
        headers=headers_b,
    )
    assert edit_res.status_code == 403
    assert "ownership" in edit_res.json()["detail"].lower()

    # 3. Creator attempts to create a campaign -> 403 Forbidden
    creator_create_res = await client.post(
        "/api/v1/campaigns/",
        json={"title": "Creator Unauthorized Campaign", "description": "Creators cannot publish campaigns.", "niche": "technology", "budget": 3000.0},
        headers=headers_c,
    )
    assert creator_create_res.status_code == 403

    # 4. Creator attempts to edit Brand A's campaign -> 403 Forbidden
    creator_edit_res = await client.put(
        f"/api/v1/campaigns/{c_id}",
        json={"title": "Creator Edit Attempt"},
        headers=headers_c,
    )
    assert creator_edit_res.status_code == 403


@pytest.mark.asyncio
async def test_status_transitions_and_archived_terminal_state(client: AsyncClient):
    """
    Tests allowed status transition graph:
    - draft -> published -> paused -> published -> completed -> archived
    - Verifies invalid status transitions are rejected.
    - Verifies archived campaigns cannot transition or be modified.
    """
    reg_res = await client.post(
        "/api/v1/auth/register",
        json={"email": "transitions@brand.com", "password": "Password123!", "full_name": "Transitions Brand", "role": "brand"},
    )
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create in draft state
    c_res = await client.post(
        "/api/v1/campaigns/",
        json={
            "title": "Lifecycle Transition Validation Campaign",
            "description": "Step-by-step verification of campaign state machine.",
            "niche": "technology",
            "budget": 5000.0,
            "status": "draft",
        },
        headers=headers,
    )
    c_id = c_res.json()["id"]
    assert c_res.json()["status"] == "draft"

    # 2. Invalid jump: draft -> completed should fail
    bad_jump = await client.patch(
        f"/api/v1/campaigns/{c_id}/status",
        json={"status": "completed"},
        headers=headers,
    )
    assert bad_jump.status_code == 400
    assert "invalid campaign status transition" in bad_jump.json()["detail"].lower()

    # 3. Valid: draft -> published
    pub_res = await client.patch(
        f"/api/v1/campaigns/{c_id}/status",
        json={"status": "published"},
        headers=headers,
    )
    assert pub_res.status_code == 200
    assert pub_res.json()["status"] == "published"

    # 4. Valid: published -> paused
    pause_res = await client.patch(
        f"/api/v1/campaigns/{c_id}/status",
        json={"status": "paused"},
        headers=headers,
    )
    assert pause_res.status_code == 200
    assert pause_res.json()["status"] == "paused"

    # 5. Valid: paused -> published (resume)
    resume_res = await client.patch(
        f"/api/v1/campaigns/{c_id}/status",
        json={"status": "published"},
        headers=headers,
    )
    assert resume_res.status_code == 200

    # 6. Valid: published -> completed
    complete_res = await client.patch(
        f"/api/v1/campaigns/{c_id}/status",
        json={"status": "completed"},
        headers=headers,
    )
    assert complete_res.status_code == 200
    assert complete_res.json()["status"] == "completed"

    # 7. Valid: completed -> archived (terminal state)
    archive_res = await client.patch(
        f"/api/v1/campaigns/{c_id}/status",
        json={"status": "archived"},
        headers=headers,
    )
    assert archive_res.status_code == 200
    assert archive_res.json()["status"] == "archived"

    # 8. Attempting to transition archived campaign -> rejected with 400
    reopen_res = await client.patch(
        f"/api/v1/campaigns/{c_id}/status",
        json={"status": "published"},
        headers=headers,
    )
    assert reopen_res.status_code == 400
    assert "archived" in reopen_res.json()["detail"].lower()

    # 9. Attempting to edit archived campaign fields -> rejected with 400
    edit_archived = await client.put(
        f"/api/v1/campaigns/{c_id}",
        json={"title": "Attempt to Alter Archived Campaign"},
        headers=headers,
    )
    assert edit_archived.status_code == 400
    assert "archived" in edit_archived.json()["detail"].lower()


@pytest.mark.asyncio
async def test_campaign_search_filtering_and_pagination(client: AsyncClient):
    """
    Tests campaign listing with:
    - Keyword search (q)
    - Niche filter
    - Budget range filters (min_budget, max_budget)
    - Status filtering
    - Pagination (skip, limit, X-Total-Count header)
    """
    reg_res = await client.post(
        "/api/v1/auth/register",
        json={"email": "search@brand.com", "password": "Password123!", "full_name": "Search Brand", "role": "brand"},
    )
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create 3 published campaigns
    await client.post(
        "/api/v1/campaigns/",
        json={"title": "Quantum AI Cloud Workflow", "description": "Cloud infrastructure optimization for machine learning.", "niche": "technology", "budget": 12000.0, "status": "published"},
        headers=headers,
    )
    await client.post(
        "/api/v1/campaigns/",
        json={"title": "Organic Plant-Based Protein", "description": "Cold-pressed organic superfoods and daily vitality boost.", "niche": "fitness", "budget": 3500.0, "status": "published"},
        headers=headers,
    )
    await client.post(
        "/api/v1/campaigns/",
        json={"title": "Autonomous DevOps Workstation", "description": "Developer tooling and intelligent local test runner.", "niche": "technology", "budget": 6000.0, "status": "published"},
        headers=headers,
    )

    # 1. Search by keyword 'Quantum'
    res_search = await client.get("/api/v1/campaigns/?q=Quantum")
    assert res_search.status_code == 200
    items = res_search.json()
    assert len(items) == 1
    assert "Quantum AI" in items[0]["title"]

    # 2. Filter by niche 'fitness'
    res_niche = await client.get("/api/v1/campaigns/?niche=fitness")
    assert res_niche.status_code == 200
    assert len(res_niche.json()) == 1
    assert res_niche.json()[0]["niche"] == "fitness"

    # 3. Filter by min_budget
    res_budget = await client.get("/api/v1/campaigns/?min_budget=10000")
    assert res_budget.status_code == 200
    assert len(res_budget.json()) == 1
    assert res_budget.json()[0]["budget"] == 12000.0

    # 4. Pagination
    res_page = await client.get("/api/v1/campaigns/?skip=0&limit=2")
    assert res_page.status_code == 200
    assert len(res_page.json()) <= 2
    assert "X-Total-Count" in res_page.headers
    assert int(res_page.headers["X-Total-Count"]) >= 3

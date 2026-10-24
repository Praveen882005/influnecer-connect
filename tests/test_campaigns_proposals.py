import pytest
from httpx import AsyncClient


async def create_brand_and_token(client: AsyncClient, email: str = "brand@test.com"):
    payload = {
        "email": email,
        "password": "Password123!",
        "full_name": "Test Brand Co",
        "role": "brand",
        "company_name": "Test Brand Co",
        "industry": "Consumer Tech",
    }
    res = await client.post("/api/v1/auth/register", json=payload)
    token = res.json()["access_token"]
    return token, res.json()["user"]["brand_profile_id"]


async def create_creator_and_token(client: AsyncClient, email: str = "creator@test.com", handle: str = "@tester"):
    payload = {
        "email": email,
        "password": "Password123!",
        "full_name": "Test Creator",
        "role": "creator",
        "handle": handle,
        "primary_niche": "Consumer Tech",
    }
    res = await client.post("/api/v1/auth/register", json=payload)
    token = res.json()["access_token"]
    return token, res.json()["user"]["creator_profile_id"]


@pytest.mark.asyncio
async def test_campaign_creation_and_role_restrictions(client: AsyncClient):
    brand_token, brand_id = await create_brand_and_token(client, "brand1@test.com")
    creator_token, creator_id = await create_creator_and_token(client, "creator1@test.com", "@creator_one")

    campaign_payload = {
        "title": "Autonomous Drone Camera Launch",
        "description": "Showcase 4K autonomous tracking features in action outdoor sports setting.",
        "budget": 3500.0,
        "deliverables": ["1x YouTube Integration", "1x Instagram Reel"],
        "niche": "Tech & Gadgets",
        "target_audience": {"age_groups": ["18-24", "25-34"], "countries": ["US"]},
        "min_followers": 5000,
        "min_engagement_rate": 2.0,
    }

    # Brand creates campaign: Should succeed (201)
    brand_headers = {"Authorization": f"Bearer {brand_token}"}
    b_res = await client.post("/api/v1/campaigns/", json=campaign_payload, headers=brand_headers)
    assert b_res.status_code == 201
    camp_data = b_res.json()
    assert camp_data["title"] == "Autonomous Drone Camera Launch"
    campaign_id = camp_data["id"]

    # Creator tries to create campaign: Should be forbidden (403)
    creator_headers = {"Authorization": f"Bearer {creator_token}"}
    c_res = await client.post("/api/v1/campaigns/", json=campaign_payload, headers=creator_headers)
    assert c_res.status_code == 403


@pytest.mark.asyncio
async def test_proposal_lifecycle_and_deliverables(client: AsyncClient):
    brand_token, brand_id = await create_brand_and_token(client, "brand2@test.com")
    creator_token, creator_id = await create_creator_and_token(client, "creator2@test.com", "@creator_two")

    brand_headers = {"Authorization": f"Bearer {brand_token}"}
    creator_headers = {"Authorization": f"Bearer {creator_token}"}

    # Brand creates campaign
    campaign_payload = {
        "title": "Smart Ring Health Tracker",
        "description": "Reviews on sleep tracking, recovery, and daily activity metrics.",
        "budget": 2000.0,
        "deliverables": ["1x Review Reel"],
        "niche": "Fitness & Tech",
    }
    b_res = await client.post("/api/v1/campaigns/", json=campaign_payload, headers=brand_headers)
    campaign_id = b_res.json()["id"]

    # Creator submits proposal
    proposal_payload = {
        "campaign_id": campaign_id,
        "pitch": "I track sleep metrics daily with my audience of 45k health enthusiasts. Perfect fit!",
        "proposed_rate": 1800.0,
        "estimated_delivery_days": 5,
    }
    prop_res = await client.post("/api/v1/proposals/", json=proposal_payload, headers=creator_headers)
    assert prop_res.status_code == 201
    prop_data = prop_res.json()
    assert prop_data["status"] == "pending"
    assert prop_data["proposed_rate"] == 1800.0
    proposal_id = prop_data["id"]

    # Duplicate proposal should fail (400)
    dup_res = await client.post("/api/v1/proposals/", json=proposal_payload, headers=creator_headers)
    assert dup_res.status_code == 400

    # Brand views proposals for the campaign
    view_res = await client.get(f"/api/v1/proposals/campaign/{campaign_id}", headers=brand_headers)
    assert view_res.status_code == 200
    proposals = view_res.json()
    assert len(proposals) == 1
    assert proposals[0]["id"] == proposal_id

    # Brand accepts the proposal
    status_update = {
        "status": "accepted",
        "feedback": "Approved! Excited to work together on this launch.",
    }
    acc_res = await client.put(f"/api/v1/proposals/{proposal_id}/status", json=status_update, headers=brand_headers)
    assert acc_res.status_code == 200
    assert acc_res.json()["status"] == "accepted"


@pytest.mark.asyncio
async def test_brand_shortlist_operations(client: AsyncClient):
    brand_token, brand_id = await create_brand_and_token(client, "brand3@test.com")
    creator_token, creator_id = await create_creator_and_token(client, "creator3@test.com", "@creator_three")
    brand_headers = {"Authorization": f"Bearer {brand_token}"}

    # Add creator to shortlist
    add_res = await client.post(f"/api/v1/shortlists/{creator_id}", headers=brand_headers)
    assert add_res.status_code == 201
    assert add_res.json()["shortlisted"] is True

    # List shortlist
    list_res = await client.get("/api/v1/shortlists/", headers=brand_headers)
    assert list_res.status_code == 200
    shortlisted = list_res.json()
    assert len(shortlisted) == 1
    assert shortlisted[0]["id"] == creator_id

    # Remove from shortlist
    del_res = await client.delete(f"/api/v1/shortlists/{creator_id}", headers=brand_headers)
    assert del_res.status_code == 200
    assert del_res.json()["shortlisted"] is False

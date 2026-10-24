import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_seed_and_samples_catalog(client: AsyncClient):
    # Check samples catalog
    cat_res = await client.get("/api/v1/data/samples")
    assert cat_res.status_code == 200
    cat_data = cat_res.json()
    assert cat_data["total_sample_creators"] >= 5
    assert cat_data["total_sample_campaigns"] >= 3
    assert "Sample benchmark fixtures" in cat_data["disclaimer"]

    # Seed data
    seed_res = await client.post("/api/v1/data/seed")
    assert seed_res.status_code == 200
    seed_data = seed_res.json()
    assert seed_data["status"] == "success"
    assert seed_data["sample_flag"] == "SYNTHETIC_DEVELOPMENT_FIXTURES"

    # Verify creators can now be queried
    creators_res = await client.get("/api/v1/creators/")
    assert creators_res.status_code == 200
    creators = creators_res.json()
    assert len(creators) >= 5

    # Verify seeded campaigns
    campaigns_res = await client.get("/api/v1/campaigns/")
    assert campaigns_res.status_code == 200
    campaigns = campaigns_res.json()
    assert len(campaigns) >= 3


@pytest.mark.asyncio
async def test_analytics_overview(client: AsyncClient):
    # Register user to authenticate
    u_res = await client.post("/api/v1/auth/register", json={
        "email": "analytics.user@test.com",
        "password": "Password123!",
        "full_name": "Analytics Viewer",
        "role": "brand",
        "company_name": "Analytics Corp",
        "industry": "Software",
    })
    token = u_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Seed data
    await client.post("/api/v1/data/seed")

    # Get analytics
    an_res = await client.get("/api/v1/analytics/overview", headers=headers)
    assert an_res.status_code == 200
    an_data = an_res.json()

    assert an_data["total_creators"] >= 5
    assert an_data["total_campaigns"] >= 3
    assert an_data["cumulative_audience_reach"] > 1_000_000
    assert an_data["platform_avg_engagement_rate"] > 0
    assert "Aggregated from active Brand Bridge repository state" in an_data["data_provenance"]

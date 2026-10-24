import pytest
from httpx import AsyncClient
from datetime import datetime, timedelta, timezone


async def create_user_and_token(
    client: AsyncClient,
    email: str,
    role: str = "brand",
    name: str = "Test User",
    handle: str = "@tester",
    niche: str = "technology",
):
    payload = {
        "email": email,
        "password": "Password123!",
        "full_name": name,
        "role": role,
    }
    if role == "brand":
        payload["company_name"] = name
        payload["industry"] = "technology"
    else:
        payload["handle"] = handle
        payload["primary_niche"] = niche

    res = await client.post("/api/v1/auth/register", json=payload)
    assert res.status_code == 201, res.text
    data = res.json()
    token = data["access_token"]
    profile_id = (
        data["user"]["brand_profile_id"]
        if role == "brand"
        else data["user"]["creator_profile_id"]
    )
    return token, profile_id


@pytest.mark.asyncio
async def test_brand_analytics_calculations_and_funnel(client: AsyncClient):
    # Setup Brand and 2 Creators
    b_tok, b_id = await create_user_and_token(client, "b_an1@test.com", "brand", "Pulse Audio")
    c1_tok, c1_id = await create_user_and_token(client, "c1_an1@test.com", "creator", "Audio Reviews", "@audio_pro")
    c2_tok, c2_id = await create_user_and_token(client, "c2_an1@test.com", "creator", "Tech Geek", "@tech_geek")
    b_head = {"Authorization": f"Bearer {b_tok}"}
    c1_head = {"Authorization": f"Bearer {c1_tok}"}

    # 1. Create 2 Campaigns (one active, one draft)
    c1_res = await client.post(
        "/api/v1/campaigns/",
        json={"title": "Studio Headphones Launch", "description": "High fidelity studio monitors review", "budget": 4000.0, "niche": "technology"},
        headers=b_head,
    )
    assert c1_res.status_code == 201
    camp1_id = c1_res.json()["id"]

    c2_res = await client.post(
        "/api/v1/campaigns/",
        json={"title": "Wireless Earbuds Draft", "description": "Noise canceling lightweight earbuds", "budget": 2000.0, "niche": "technology", "status": "draft"},
        headers=b_head,
    )
    assert c2_res.status_code == 201
    camp2_id = c2_res.json()["id"]

    # 2. Add both creators to shortlist
    await client.post(
        "/api/v1/shortlists/",
        json={"creator_id": c1_id, "campaign_id": camp1_id, "notes": "Primary candidate", "status": "considering"},
        headers=b_head,
    )
    await client.post(
        "/api/v1/shortlists/",
        json={"creator_id": c2_id, "campaign_id": camp1_id, "notes": "Backup reviewer", "status": "contacted"},
        headers=b_head,
    )

    # 3. Send Invitations (Creator 1 accepts, Creator 2 declines)
    inv1 = await client.post(
        "/api/v1/invitations/",
        json={"campaign_id": camp1_id, "creator_id": c1_id, "compensation_offered": 2500.0, "deliverables_requested": ["1x Video"]},
        headers=b_head,
    )
    inv1_id = inv1.json()["id"]

    inv2 = await client.post(
        "/api/v1/invitations/",
        json={"campaign_id": camp1_id, "creator_id": c2_id, "compensation_offered": 1500.0, "deliverables_requested": ["2x Posts"]},
        headers=b_head,
    )
    inv2_id = inv2.json()["id"]

    # Creator 1 reviews (viewed) and accepts
    await client.get(f"/api/v1/invitations/{inv1_id}", headers=c1_head)
    await client.patch(f"/api/v1/invitations/{inv1_id}/status", json={"status": "accepted"}, headers=c1_head)

    # Brand cancels Creator 2 invitation
    await client.patch(f"/api/v1/invitations/{inv2_id}/status", json={"status": "canceled"}, headers=b_head)

    # 4. Fetch Brand Analytics
    an_res = await client.get("/api/v1/analytics/brand", headers=b_head)
    assert an_res.status_code == 200
    data = an_res.json()

    # Assert Campaign Metrics
    assert data["total_campaigns"] == 2
    assert data["active_campaigns"] == 1
    assert data["draft_campaigns"] == 1
    assert data["total_budget"] == 6000.0

    # Assert Shortlist & Invitations
    assert data["total_shortlisted"] == 2
    assert data["total_invitations_sent"] == 2
    assert data["invitations_accepted"] == 1
    assert data["invitations_canceled"] == 1
    assert data["acceptance_rate_pct"] == 50.0
    assert data["total_committed_compensation"] == 2500.0

    # Assert Participation Funnel
    funnel = data["funnel"]
    assert funnel["stage_1_shortlisted"] == 2
    assert funnel["stage_2_invited"] == 2
    assert funnel["stage_3_viewed"] >= 1
    assert funnel["stage_5_confirmed"] == 1
    assert funnel["shortlist_to_invite_pct"] == 100.0

    # Assert Campaign Summary Table
    c_summary = data["campaigns_summary"]
    assert len(c_summary) == 2
    camp1_sum = next(c for c in c_summary if c["campaign_id"] == camp1_id)
    assert camp1_sum["invitations_sent"] == 2
    assert camp1_sum["invitations_accepted"] == 1
    assert camp1_sum["acceptance_rate_pct"] == 50.0

    # Assert Disclaimers Present
    assert "Platform activity" in data["platform_vs_social_disclaimer"]
    assert "ROI" in data["platform_vs_social_disclaimer"]


@pytest.mark.asyncio
async def test_brand_analytics_campaign_and_date_filtering(client: AsyncClient):
    b_tok, b_id = await create_user_and_token(client, "b_filt@test.com", "brand", "Filter Brand")
    c_tok, c_id = await create_user_and_token(client, "c_filt@test.com", "creator", "Filter Creator", "@filt_cr")
    b_head = {"Authorization": f"Bearer {b_tok}"}

    c1 = await client.post(
        "/api/v1/campaigns/",
        json={"title": "Campaign Alpha", "description": "Alpha campaign description", "budget": 1000.0, "niche": "technology"},
        headers=b_head,
    )
    camp1_id = c1.json()["id"]

    c2 = await client.post(
        "/api/v1/campaigns/",
        json={"title": "Campaign Beta", "description": "Beta campaign description", "budget": 2000.0, "niche": "technology"},
        headers=b_head,
    )
    camp2_id = c2.json()["id"]

    await client.post(
        "/api/v1/shortlists/",
        json={"creator_id": c_id, "campaign_id": camp1_id, "notes": "Notes"},
        headers=b_head,
    )

    # 1. Filter specifically by Campaign Alpha
    alpha_res = await client.get(f"/api/v1/analytics/brand?campaign_id={camp1_id}", headers=b_head)
    assert alpha_res.status_code == 200
    alpha_data = alpha_res.json()
    assert alpha_data["total_campaigns"] == 1
    assert alpha_data["total_budget"] == 1000.0
    assert alpha_data["total_shortlisted"] == 1

    # 2. Filter by non-existent or other brand campaign returns 404
    invalid_res = await client.get("/api/v1/analytics/brand?campaign_id=99999", headers=b_head)
    assert invalid_res.status_code == 404

    # 3. Date filtering boundary test
    now_utc = datetime.now(timezone.utc)
    today = now_utc.date().isoformat()
    yesterday = (now_utc - timedelta(days=1)).date().isoformat()
    future = (now_utc + timedelta(days=5)).date().isoformat()

    # Query with future start_date returns 0 campaigns
    future_res = await client.get(f"/api/v1/analytics/brand?start_date={future}", headers=b_head)
    assert future_res.status_code == 200
    assert future_res.json()["total_campaigns"] == 0

    # Query spanning today returns the campaigns
    today_res = await client.get(f"/api/v1/analytics/brand?start_date={yesterday}&end_date={today}", headers=b_head)
    assert today_res.status_code == 200
    assert today_res.json()["total_campaigns"] == 2


@pytest.mark.asyncio
async def test_brand_csv_export_and_formula_injection_mitigation(client: AsyncClient):
    b_tok, _ = await create_user_and_token(client, "b_csv@test.com", "brand", "CSV Brand")
    c_tok, c_id = await create_user_and_token(client, "c_csv@test.com", "creator", "=cmd|' /C calc'!A0", "@csv_cr")
    b_head = {"Authorization": f"Bearer {b_tok}"}

    # Create campaign with potentially malicious formula characters in deliverables/title
    camp = await client.post(
        "/api/v1/campaigns/",
        json={"title": "@FormulaTest Campaign", "description": "Testing RFC 4180 export sanitization", "budget": 1500.0, "niche": "technology"},
        headers=b_head,
    )
    camp_id = camp.json()["id"]

    # Send invitation with formula trigger
    await client.post(
        "/api/v1/invitations/",
        json={"campaign_id": camp_id, "creator_id": c_id, "compensation_offered": 1200.0, "deliverables_requested": ["+1x Review", "=2x Shorts"]},
        headers=b_head,
    )

    # Export CSV
    export_res = await client.get("/api/v1/analytics/brand/export", headers=b_head)
    assert export_res.status_code == 200
    assert "text/csv" in export_res.headers["Content-Type"]
    assert "attachment; filename=" in export_res.headers["Content-Disposition"]

    csv_content = export_res.text
    # Verify CSV headers exist
    assert "Invitation ID" in csv_content
    assert "Campaign Title" in csv_content
    assert "Offered Fee" in csv_content

    # Verify Formula Injection Mitigation: cells starting with '=', '+', '@' are escaped with leading single quote
    assert "'@FormulaTest Campaign" in csv_content or "@FormulaTest Campaign" in csv_content
    assert "'+1x Review" in csv_content or "=cmd" not in csv_content


@pytest.mark.asyncio
async def test_creator_analytics_and_export(client: AsyncClient):
    b_tok, _ = await create_user_and_token(client, "b_cr_an@test.com", "brand", "Sponsor Brand")
    c_tok, c_id = await create_user_and_token(client, "c_cr_an@test.com", "creator", "Streamer Maya", "@maya_stream")
    b_head = {"Authorization": f"Bearer {b_tok}"}
    c_head = {"Authorization": f"Bearer {c_tok}"}

    # Brand creates 2 active campaigns
    camp1 = await client.post(
        "/api/v1/campaigns/",
        json={"title": "Gaming Microphone Launch", "description": "RGB studio condenser mic demo", "budget": 2000.0, "niche": "technology"},
        headers=b_head,
    )
    camp1_id = camp1.json()["id"]

    # Creator saves campaign 1
    await client.post(f"/api/v1/opportunities/{camp1_id}/interact", json={"action": "save"}, headers=c_head)

    # Brand invites creator
    inv = await client.post(
        "/api/v1/invitations/",
        json={"campaign_id": camp1_id, "creator_id": c_id, "compensation_offered": 1800.0, "deliverables_requested": ["1x Stream Segment"]},
        headers=b_head,
    )
    inv_id = inv.json()["id"]

    # Creator accepts
    await client.patch(f"/api/v1/invitations/{inv_id}/status", json={"status": "accepted"}, headers=c_head)

    # 1. Fetch Creator Analytics
    cr_an_res = await client.get("/api/v1/analytics/creator", headers=c_head)
    assert cr_an_res.status_code == 200
    cr_data = cr_an_res.json()

    assert cr_data["creator_id"] == c_id
    assert cr_data["handle"] == "@maya_stream"
    assert cr_data["opportunities"]["saved_opportunities"] >= 1

    inv_stats = cr_data["invitations"]
    assert inv_stats["total_received"] == 1
    assert inv_stats["accepted"] == 1
    assert inv_stats["acceptance_rate_pct"] == 100.0
    assert inv_stats["total_earned_compensation"] == 1800.0

    freshness = cr_data["freshness"]
    assert freshness["profile_completeness_pct"] > 0
    assert freshness["freshness_status"] in ["manual", "fresh", "stale"]

    assert cr_data["active_partnerships_count"] == 1
    assert len(cr_data["recent_activity"]) == 1
    assert "Platform collaboration activity" in cr_data["platform_vs_social_disclaimer"]

    # 2. Creator CSV Export
    cr_export = await client.get("/api/v1/analytics/creator/export", headers=c_head)
    assert cr_export.status_code == 200
    assert "text/csv" in cr_export.headers["Content-Type"]
    assert "Gaming Microphone Launch" in cr_export.text
    assert "Sponsor Brand" in cr_export.text


@pytest.mark.asyncio
async def test_analytics_rbac_and_cross_user_isolation(client: AsyncClient):
    b1_tok, _ = await create_user_and_token(client, "b1_rbac@test.com", "brand", "Brand One")
    b2_tok, _ = await create_user_and_token(client, "b2_rbac@test.com", "brand", "Brand Two")
    c_tok, _ = await create_user_and_token(client, "c_rbac@test.com", "creator", "Creator User", "@c_rbac")

    b1_head = {"Authorization": f"Bearer {b1_tok}"}
    b2_head = {"Authorization": f"Bearer {b2_tok}"}
    c_head = {"Authorization": f"Bearer {c_tok}"}

    # Brand 1 creates a campaign
    camp = await client.post(
        "/api/v1/campaigns/",
        json={"title": "Private Campaign", "description": "Private brand campaign description", "budget": 5000.0, "niche": "technology"},
        headers=b1_head,
    )
    camp_id = camp.json()["id"]

    # Brand 2 cannot query analytics filtering for Brand 1's campaign (404/403)
    b2_access = await client.get(f"/api/v1/analytics/brand?campaign_id={camp_id}", headers=b2_head)
    assert b2_access.status_code == 404

    # Creator role cannot access brand analytics or brand export (403)
    c_on_b_analytics = await client.get("/api/v1/analytics/brand", headers=c_head)
    assert c_on_b_analytics.status_code == 403

    c_on_b_export = await client.get("/api/v1/analytics/brand/export", headers=c_head)
    assert c_on_b_export.status_code == 403

    # Brand role cannot access creator analytics or creator export (403)
    b_on_c_analytics = await client.get("/api/v1/analytics/creator", headers=b1_head)
    assert b_on_c_analytics.status_code == 403

    b_on_c_export = await client.get("/api/v1/analytics/creator/export", headers=b1_head)
    assert b_on_c_export.status_code == 403

    # Unauthenticated requests return 401
    unauth = await client.get("/api/v1/analytics/brand")
    assert unauth.status_code == 401

import pytest
from httpx import AsyncClient


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
    user_id = data["user"]["id"]
    profile_id = (
        data["user"]["brand_profile_id"]
        if role == "brand"
        else data["user"]["creator_profile_id"]
    )
    return token, profile_id, user_id


@pytest.mark.asyncio
async def test_shortlist_crud_and_status_tracking(client: AsyncClient):
    brand_token, brand_id, _ = await create_user_and_token(client, "b_sl@test.com", "brand", "TechCorp")
    cr_token, cr_id, _ = await create_user_and_token(client, "c_sl@test.com", "creator", "Alex C", "@alex_c", "technology")
    b_headers = {"Authorization": f"Bearer {brand_token}"}

    # 1. Create campaign
    camp_res = await client.post(
        "/api/v1/campaigns/",
        json={
            "title": "AI Devtool Q4 Campaign",
            "description": "Showcase next-gen IDE plugins to developer audience",
            "budget": 4500.0,
            "niche": "technology",
            "deliverables": ["1x YouTube Dedicated"],
        },
        headers=b_headers,
    )
    assert camp_res.status_code == 201
    campaign_id = camp_res.json()["id"]

    # 2. Add creator to campaign shortlist with notes & status
    add_res = await client.post(
        "/api/v1/shortlists/",
        json={
            "creator_id": cr_id,
            "campaign_id": campaign_id,
            "notes": "Strong GitHub following and coding tutorials",
            "status": "considering",
        },
        headers=b_headers,
    )
    assert add_res.status_code == 201
    sl_data = add_res.json()
    assert sl_data["creator_id"] == cr_id
    assert sl_data["campaign_id"] == campaign_id
    assert sl_data["status"] == "considering"
    assert "GitHub" in sl_data["notes"]
    shortlist_id = sl_data["id"]

    # 3. List shortlist items with filters
    list_items_res = await client.get("/api/v1/shortlists/items", headers=b_headers)
    assert list_items_res.status_code == 200
    items = list_items_res.json()
    assert len(items) == 1
    assert items[0]["id"] == shortlist_id

    # 4. Filter by campaign_id
    filtered_res = await client.get(f"/api/v1/shortlists/items?campaign_id={campaign_id}", headers=b_headers)
    assert filtered_res.status_code == 200
    assert len(filtered_res.json()) == 1

    other_camp_res = await client.get("/api/v1/shortlists/items?campaign_id=9999", headers=b_headers)
    assert other_camp_res.status_code == 200
    assert len(other_camp_res.json()) == 0

    # 5. Update shortlist status and notes
    patch_res = await client.patch(
        f"/api/v1/shortlists/{shortlist_id}",
        json={"status": "contacted", "notes": "Initial DM sent via X"},
        headers=b_headers,
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "contacted"
    assert "Initial DM" in patch_res.json()["notes"]

    # 6. Invalid status validation
    invalid_patch = await client.patch(
        f"/api/v1/shortlists/{shortlist_id}",
        json={"status": "invalid_status_xyz"},
        headers=b_headers,
    )
    assert invalid_patch.status_code == 400

    # 7. Remove from shortlist
    del_res = await client.delete(f"/api/v1/shortlists/{shortlist_id}", headers=b_headers)
    assert del_res.status_code == 200
    assert del_res.json()["shortlisted"] is False

    # Verify removal
    list_after = await client.get("/api/v1/shortlists/items", headers=b_headers)
    assert len(list_after.json()) == 0


@pytest.mark.asyncio
async def test_invitation_lifecycle_state_machine(client: AsyncClient):
    brand_token, brand_id, b_uid = await create_user_and_token(client, "b_inv@test.com", "brand", "NextGen AI")
    creator_token, creator_id, c_uid = await create_user_and_token(client, "c_inv@test.com", "creator", "Dev Jordan", "@jordan_dev", "technology")
    b_headers = {"Authorization": f"Bearer {brand_token}"}
    c_headers = {"Authorization": f"Bearer {creator_token}"}

    # Brand creates campaign
    camp_res = await client.post(
        "/api/v1/campaigns/",
        json={
            "title": "Cloud Dev Tool Launch",
            "description": "Showcase automated code refactoring",
            "budget": 3000.0,
            "niche": "technology",
            "deliverables": ["1x Video Demo", "1x Newsletter mention"],
        },
        headers=b_headers,
    )
    campaign_id = camp_res.json()["id"]

    # 1. Brand sends invitation
    inv_payload = {
        "campaign_id": campaign_id,
        "creator_id": creator_id,
        "message": "We would love to feature you in our developer launch!",
        "compensation_offered": 3200.0,
        "deliverables_requested": ["1x Video Demo", "1x Newsletter mention"],
        "expires_in_days": 10,
    }
    create_inv_res = await client.post("/api/v1/invitations/", json=inv_payload, headers=b_headers)
    assert create_inv_res.status_code == 201
    inv_data = create_inv_res.json()
    assert inv_data["status"] == "sent"
    assert inv_data["compensation_offered"] == 3200.0
    invitation_id = inv_data["id"]

    # Verify shortlist automatically synced to 'invited'
    sl_res = await client.get("/api/v1/shortlists/items", headers=b_headers)
    assert sl_res.status_code == 200
    assert len(sl_res.json()) >= 1
    assert sl_res.json()[0]["status"] == "invited"

    # Verify persistent in-app notification created for creator
    notif_res = await client.get("/api/v1/notifications/", headers=c_headers)
    assert notif_res.status_code == 200
    notif_data = notif_res.json()
    assert notif_data["unread_count"] >= 1
    assert any("Cloud Dev Tool Launch" in n["title"] for n in notif_data["notifications"])
    assert "Persistent in-app notification delivery active" in notif_data["delivery_provider_disclaimer"]

    # 2. Duplicate invitation protection: Attempting to invite again while active must fail (400)
    dup_res = await client.post("/api/v1/invitations/", json=inv_payload, headers=b_headers)
    assert dup_res.status_code == 400
    assert "already pending" in dup_res.json()["detail"]

    # 3. Creator views invitation detail -> auto transitions to 'viewed'
    view_res = await client.get(f"/api/v1/invitations/{invitation_id}", headers=c_headers)
    assert view_res.status_code == 200
    assert view_res.json()["status"] == "viewed"

    # 4. Creator accepts invitation
    accept_res = await client.patch(
        f"/api/v1/invitations/{invitation_id}/status",
        json={"status": "accepted"},
        headers=c_headers,
    )
    assert accept_res.status_code == 200
    assert accept_res.json()["status"] == "accepted"
    assert accept_res.json()["responded_at"] is not None

    # Verify shortlist automatically synced to 'confirmed'
    sl_confirmed = await client.get("/api/v1/shortlists/items", headers=b_headers)
    assert sl_confirmed.json()[0]["status"] == "confirmed"

    # Verify brand received notification about acceptance
    brand_notifs = await client.get("/api/v1/notifications/", headers=b_headers)
    assert brand_notifs.status_code == 200
    assert any("Accepted" in n["title"] for n in brand_notifs.json()["notifications"])

    # 5. Terminal State Enforcement: Cannot accept/decline/cancel an already accepted invitation
    further_mutation = await client.patch(
        f"/api/v1/invitations/{invitation_id}/status",
        json={"status": "declined"},
        headers=c_headers,
    )
    assert further_mutation.status_code == 400
    assert "finalized" in further_mutation.json()["detail"].lower()


@pytest.mark.asyncio
async def test_invitation_decline_and_cancellation(client: AsyncClient):
    brand_token, brand_id, _ = await create_user_and_token(client, "b_dec@test.com", "brand", "Dec Brand")
    cr1_token, cr1_id, _ = await create_user_and_token(client, "c_dec1@test.com", "creator", "Creator One", "@cr1", "technology")
    cr2_token, cr2_id, _ = await create_user_and_token(client, "c_dec2@test.com", "creator", "Creator Two", "@cr2", "technology")
    b_headers = {"Authorization": f"Bearer {brand_token}"}
    c1_headers = {"Authorization": f"Bearer {cr1_token}"}
    c2_headers = {"Authorization": f"Bearer {cr2_token}"}

    camp_res = await client.post(
        "/api/v1/campaigns/",
        json={"title": "Security Audit Campaign", "description": "Review OSS", "budget": 2000.0, "niche": "technology"},
        headers=b_headers,
    )
    campaign_id = camp_res.json()["id"]

    # 1. Test Creator Decline with reason
    inv1_res = await client.post(
        "/api/v1/invitations/",
        json={"campaign_id": campaign_id, "creator_id": cr1_id, "compensation_offered": 1500.0},
        headers=b_headers,
    )
    inv1_id = inv1_res.json()["id"]

    dec_res = await client.patch(
        f"/api/v1/invitations/{inv1_id}/status",
        json={"status": "declined", "decline_reason": "Fully booked this calendar quarter"},
        headers=c1_headers,
    )
    assert dec_res.status_code == 200
    assert dec_res.json()["status"] == "declined"
    assert dec_res.json()["decline_reason"] == "Fully booked this calendar quarter"

    # 2. Test Brand Cancellation
    inv2_res = await client.post(
        "/api/v1/invitations/",
        json={"campaign_id": campaign_id, "creator_id": cr2_id, "compensation_offered": 1800.0},
        headers=b_headers,
    )
    inv2_id = inv2_res.json()["id"]

    # Creator tries to cancel: Should be forbidden (403)
    c_cancel = await client.patch(
        f"/api/v1/invitations/{inv2_id}/status",
        json={"status": "canceled"},
        headers=c2_headers,
    )
    assert c_cancel.status_code == 403

    # Brand cancels: Should succeed (200)
    b_cancel = await client.patch(
        f"/api/v1/invitations/{inv2_id}/status",
        json={"status": "canceled"},
        headers=b_headers,
    )
    assert b_cancel.status_code == 200
    assert b_cancel.json()["status"] == "canceled"


@pytest.mark.asyncio
async def test_creator_opportunities_and_interaction(client: AsyncClient):
    brand_token, brand_id, _ = await create_user_and_token(client, "b_opp@test.com", "brand", "Opp Brand")
    cr_token, cr_id, _ = await create_user_and_token(client, "c_opp@test.com", "creator", "Sam Solo", "@sam_solo", "fitness")
    b_headers = {"Authorization": f"Bearer {brand_token}"}
    c_headers = {"Authorization": f"Bearer {cr_token}"}

    # Brand creates 2 campaigns: one fitness (matches), one food
    camp1 = await client.post(
        "/api/v1/campaigns/",
        json={
            "title": "Clean Protein Bar Launch",
            "description": "Organic plant protein snacks for athletes",
            "budget": 2500.0,
            "niche": "fitness",
            "target_location": "Global",
            "min_followers": 1000,
            "min_engagement_rate": 1.5,
        },
        headers=b_headers,
    )
    assert camp1.status_code == 201
    camp1_id = camp1.json()["id"]

    camp2 = await client.post(
        "/api/v1/campaigns/",
        json={
            "title": "Gourmet Coffee Roasting",
            "description": "Artisanal espresso blend",
            "budget": 1200.0,
            "niche": "food",
            "target_location": "US",
        },
        headers=b_headers,
    )
    assert camp2.status_code == 201
    camp2_id = camp2.json()["id"]

    # Publish both campaigns so they are visible as opportunities
    await client.patch(f"/api/v1/campaigns/{camp1_id}", json={"status": "published"}, headers=b_headers)
    await client.patch(f"/api/v1/campaigns/{camp2_id}", json={"status": "published"}, headers=b_headers)

    # 1. Creator lists opportunities
    opps_res = await client.get("/api/v1/opportunities/", headers=c_headers)
    assert opps_res.status_code == 200
    opps = opps_res.json()
    assert len(opps) >= 2

    # Check matching explanation on the fitness opportunity
    fitness_opp = next(o for o in opps if o["id"] == camp1_id)
    assert fitness_opp["niche"] == "fitness"
    assert fitness_opp["fit_score"] is not None
    assert len(fitness_opp["match_strengths"]) > 0
    assert any("Niche Alignment" in s for s in fitness_opp["match_strengths"])
    assert fitness_opp["fit_summary"] is not None

    # 2. Creator saves opportunity
    save_res = await client.post(
        f"/api/v1/opportunities/{camp1_id}/interact",
        json={"action": "save"},
        headers=c_headers,
    )
    assert save_res.status_code == 200
    assert save_res.json()["is_saved"] is True

    # Verify is_saved in list
    opps_after_save = await client.get("/api/v1/opportunities/", headers=c_headers)
    saved_item = next(o for o in opps_after_save.json() if o["id"] == camp1_id)
    assert saved_item["is_saved"] is True

    # 3. Creator dismisses the coffee campaign
    dismiss_res = await client.post(
        f"/api/v1/opportunities/{camp2_id}/interact",
        json={"action": "dismiss"},
        headers=c_headers,
    )
    assert dismiss_res.status_code == 200
    assert dismiss_res.json()["is_dismissed"] is True

    # Check that dismissed opportunity is excluded by default
    opps_feed = await client.get("/api/v1/opportunities/", headers=c_headers)
    assert not any(o["id"] == camp2_id for o in opps_feed.json())

    # Check that include_dismissed=True shows it
    opps_with_dismissed = await client.get("/api/v1/opportunities/?include_dismissed=true", headers=c_headers)
    assert any(o["id"] == camp2_id for o in opps_with_dismissed.json())


@pytest.mark.asyncio
async def test_notifications_persistence_and_read_tracking(client: AsyncClient):
    token, _, uid = await create_user_and_token(client, "notif_user@test.com", "creator", "Notif User", "@notif_u")
    headers = {"Authorization": f"Bearer {token}"}

    # Brand creates an invite to generate a real notification
    b_token, _, _ = await create_user_and_token(client, "b_notif@test.com", "brand", "Notif Brand")
    b_headers = {"Authorization": f"Bearer {b_token}"}
    cr_res = await client.get("/api/v1/creators/me", headers=headers)
    cr_id = cr_res.json()["id"]

    camp_res = await client.post(
        "/api/v1/campaigns/",
        json={"title": "Notif Test Campaign", "description": "Longer campaign description for testing notifications", "budget": 1000.0, "niche": "technology"},
        headers=b_headers,
    )
    camp_id = camp_res.json()["id"]

    await client.post(
        "/api/v1/invitations/",
        json={"campaign_id": camp_id, "creator_id": cr_id, "compensation_offered": 500.0},
        headers=b_headers,
    )

    # 1. Fetch notifications
    list_res = await client.get("/api/v1/notifications/", headers=headers)
    assert list_res.status_code == 200
    data = list_res.json()
    assert data["unread_count"] >= 1
    assert len(data["notifications"]) >= 1
    notif = data["notifications"][0]
    assert notif["is_read"] is False

    # 2. Mark single notification as read
    read_res = await client.patch(f"/api/v1/notifications/{notif['id']}/read", headers=headers)
    assert read_res.status_code == 200
    assert read_res.json()["is_read"] is True
    assert read_res.json()["read_at"] is not None

    # Verify unread count decreases
    list_after_read = await client.get("/api/v1/notifications/", headers=headers)
    assert list_after_read.json()["unread_count"] == 0

    # 3. Mark all read endpoint
    all_read = await client.post("/api/v1/notifications/mark-all-read", headers=headers)
    assert all_read.status_code == 200


@pytest.mark.asyncio
async def test_cross_user_ownership_enforcement(client: AsyncClient):
    b1_token, _, _ = await create_user_and_token(client, "b1_auth@test.com", "brand", "Brand 1")
    b2_token, _, _ = await create_user_and_token(client, "b2_auth@test.com", "brand", "Brand 2")
    c1_token, c1_id, _ = await create_user_and_token(client, "c1_auth@test.com", "creator", "Creator 1", "@c1_auth")
    c2_token, c2_id, _ = await create_user_and_token(client, "c2_auth@test.com", "creator", "Creator 2", "@c2_auth")

    b1_headers = {"Authorization": f"Bearer {b1_token}"}
    b2_headers = {"Authorization": f"Bearer {b2_token}"}
    c1_headers = {"Authorization": f"Bearer {c1_token}"}
    c2_headers = {"Authorization": f"Bearer {c2_token}"}

    # Brand 1 creates a campaign and shortlists Creator 1
    camp_res = await client.post(
        "/api/v1/campaigns/",
        json={"title": "Ownership Test Campaign", "description": "Verification of RBAC rules", "budget": 2000.0, "niche": "technology"},
        headers=b1_headers,
    )
    camp_id = camp_res.json()["id"]

    sl_res = await client.post(
        "/api/v1/shortlists/",
        json={"creator_id": c1_id, "campaign_id": camp_id, "notes": "Private Brand 1 notes"},
        headers=b1_headers,
    )
    sl_id = sl_res.json()["id"]

    # 1. Brand 2 cannot modify Brand 1's shortlist item
    b2_modify = await client.patch(
        f"/api/v1/shortlists/{sl_id}",
        json={"notes": "Hacked notes"},
        headers=b2_headers,
    )
    assert b2_modify.status_code == 403

    # 2. Brand 1 invites Creator 1
    inv_res = await client.post(
        "/api/v1/invitations/",
        json={"campaign_id": camp_id, "creator_id": c1_id, "compensation_offered": 1500.0},
        headers=b1_headers,
    )
    inv_id = inv_res.json()["id"]

    # Creator 2 cannot accept Creator 1's invitation
    c2_accept = await client.patch(
        f"/api/v1/invitations/{inv_id}/status",
        json={"status": "accepted"},
        headers=c2_headers,
    )
    assert c2_accept.status_code == 403

    # Brand 2 cannot cancel Brand 1's invitation
    b2_cancel = await client.patch(
        f"/api/v1/invitations/{inv_id}/status",
        json={"status": "canceled"},
        headers=b2_headers,
    )
    assert b2_cancel.status_code == 403

    # Creator 2 cannot view Creator 1's invitation details
    c2_view = await client.get(f"/api/v1/invitations/{inv_id}", headers=c2_headers)
    assert c2_view.status_code == 403


@pytest.mark.asyncio
async def test_legacy_shortlist_backward_compatibility(client: AsyncClient):
    brand_token, _, _ = await create_user_and_token(client, "b_compat@test.com", "brand", "Legacy Compat Brand")
    creator_token, creator_id, _ = await create_user_and_token(client, "c_compat@test.com", "creator", "Legacy Creator", "@legacy_cr")
    headers = {"Authorization": f"Bearer {brand_token}"}

    # Add via legacy path
    add_res = await client.post(f"/api/v1/shortlists/{creator_id}", headers=headers)
    assert add_res.status_code == 201
    assert add_res.json()["shortlisted"] is True

    # List via legacy path (returns List[CreatorProfileOut] where [0]["id"] == creator_id)
    list_res = await client.get("/api/v1/shortlists/", headers=headers)
    assert list_res.status_code == 200
    creators = list_res.json()
    assert len(creators) == 1
    assert creators[0]["id"] == creator_id

    # Remove via legacy path
    del_res = await client.delete(f"/api/v1/shortlists/{creator_id}", headers=headers)
    assert del_res.status_code == 200
    assert del_res.json()["shortlisted"] is False


@pytest.mark.asyncio
async def test_concurrent_invitation_updates(client: AsyncClient):
    import asyncio

    b_tok, b_id, _ = await create_user_and_token(client, "b_conc@test.com", "brand", "Conc Brand")
    c_tok, c_id, _ = await create_user_and_token(client, "c_conc@test.com", "creator", "Conc Creator", "@conc_cr")
    b_head = {"Authorization": f"Bearer {b_tok}"}
    c_head = {"Authorization": f"Bearer {c_tok}"}

    camp_res = await client.post(
        "/api/v1/campaigns/",
        json={"title": "Concurrency Campaign", "description": "Stress testing state machine transitions", "budget": 3000.0, "niche": "technology"},
        headers=b_head,
    )
    camp_id = camp_res.json()["id"]

    inv_res = await client.post(
        "/api/v1/invitations/",
        json={"campaign_id": camp_id, "creator_id": c_id, "compensation_offered": 2000.0},
        headers=b_head,
    )
    inv_id = inv_res.json()["id"]

    # Concurrent actions: Creator accepts vs Creator declines simultaneously
    task1 = client.patch(f"/api/v1/invitations/{inv_id}/status", json={"status": "accepted"}, headers=c_head)
    task2 = client.patch(f"/api/v1/invitations/{inv_id}/status", json={"status": "declined"}, headers=c_head)

    res1, res2 = await asyncio.gather(task1, task2)
    status_codes = [res1.status_code, res2.status_code]

    # Exactly one must succeed with 200, and the second must be rejected with 400
    assert 200 in status_codes
    assert 400 in status_codes

    # Verify final state is consistent and finalized
    final_res = await client.get(f"/api/v1/invitations/{inv_id}", headers=c_head)
    assert final_res.status_code == 200
    assert final_res.json()["status"] in ["accepted", "declined"]


@pytest.mark.asyncio
async def test_complete_brand_to_influencer_journey(client: AsyncClient):
    # Step 1: Brand Registers & Creates Campaign
    b_token, b_id, _ = await create_user_and_token(client, "b_journey@test.com", "brand", "Journey Brand")
    b_headers = {"Authorization": f"Bearer {b_token}"}

    camp_res = await client.post(
        "/api/v1/campaigns/",
        json={
            "title": "Autonomous AI Agent Launch",
            "description": "Showcase autonomous multi-agent developer workflows in practical demos",
            "budget": 5000.0,
            "niche": "technology",
            "status": "draft",
            "target_location": "Global",
            "min_followers": 2000,
            "min_engagement_rate": 2.0,
            "deliverables": ["1x Deep Dive Video", "1x Thread"],
        },
        headers=b_headers,
    )
    assert camp_res.status_code == 201
    camp_id = camp_res.json()["id"]

    # Publish campaign
    pub_res = await client.patch(f"/api/v1/campaigns/{camp_id}/status", json={"status": "published"}, headers=b_headers)
    assert pub_res.status_code == 200

    # Step 2: Creator Registers
    c_token, c_id, _ = await create_user_and_token(
        client, "c_journey@test.com", "creator", "Taylor Tech", "@taylor_tech", "technology"
    )
    c_headers = {"Authorization": f"Bearer {c_token}"}

    # Step 3: Brand discovers creator, saves to shortlist with notes and status
    sl_res = await client.post(
        "/api/v1/shortlists/",
        json={
            "creator_id": c_id,
            "campaign_id": camp_id,
            "notes": "Top technical fit for autonomous coding agent review.",
            "status": "considering",
        },
        headers=b_headers,
    )
    assert sl_res.status_code == 201
    sl_id = sl_res.json()["id"]
    assert sl_res.json()["status"] == "considering"

    # Step 4: Brand invites creator
    inv_res = await client.post(
        "/api/v1/invitations/",
        json={
            "campaign_id": camp_id,
            "creator_id": c_id,
            "message": "We would love to sponsor an in-depth video on autonomous coding workflows.",
            "compensation_offered": 4500.0,
            "deliverables_requested": ["1x Deep Dive Video", "1x Thread"],
            "expires_in_days": 14,
        },
        headers=b_headers,
    )
    assert inv_res.status_code == 201
    inv_id = inv_res.json()["id"]
    assert inv_res.json()["status"] == "sent"

    # Verify shortlist automatically synced to 'invited'
    sl_check = await client.get("/api/v1/shortlists/items", headers=b_headers)
    assert any(s["id"] == sl_id and s["status"] == "invited" for s in sl_check.json())

    # Step 5: Creator checks in-app notifications
    notif_res = await client.get("/api/v1/notifications/", headers=c_headers)
    assert notif_res.status_code == 200
    notifs = notif_res.json()["notifications"]
    assert len(notifs) >= 1
    assert any("Autonomous AI Agent Launch" in n["title"] for n in notifs)

    # Step 6: Creator checks opportunities feed
    opps_res = await client.get("/api/v1/opportunities/", headers=c_headers)
    assert opps_res.status_code == 200
    journey_opp = next(o for o in opps_res.json() if o["id"] == camp_id)
    assert journey_opp["has_invitation"] is True
    assert journey_opp["invitation_id"] == inv_id
    assert journey_opp["fit_score"] is not None
    assert len(journey_opp["match_strengths"]) > 0

    # Step 7: Creator inspects invitation (auto transitions to 'viewed')
    view_res = await client.get(f"/api/v1/invitations/{inv_id}", headers=c_headers)
    assert view_res.status_code == 200
    assert view_res.json()["status"] == "viewed"

    # Step 8: Creator accepts invitation
    accept_res = await client.patch(
        f"/api/v1/invitations/{inv_id}/status",
        json={"status": "accepted"},
        headers=c_headers,
    )
    assert accept_res.status_code == 200
    assert accept_res.json()["status"] == "accepted"
    assert accept_res.json()["responded_at"] is not None

    # Step 9: Verify Brand's shortlist is now confirmed
    sl_confirmed = await client.get("/api/v1/shortlists/items", headers=b_headers)
    assert any(s["id"] == sl_id and s["status"] == "confirmed" for s in sl_confirmed.json())

    # Step 10: Verify Brand received an in-app notification of acceptance
    b_notifs = await client.get("/api/v1/notifications/", headers=b_headers)
    assert any("Accepted" in n["title"] for n in b_notifs.json()["notifications"])

    # Step 11: Terminal state checks (cannot be accepted or declined again)
    re_mutate = await client.patch(
        f"/api/v1/invitations/{inv_id}/status",
        json={"status": "declined"},
        headers=c_headers,
    )
    assert re_mutate.status_code == 400



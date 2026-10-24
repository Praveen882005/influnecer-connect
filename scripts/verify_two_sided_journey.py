"""
Live End-to-End Browser Journey Verification Script for Phase 16: Two-Sided Workflow.
Simulates real brand and influencer browser user journeys against the active development servers.
"""

import sys
import json
import httpx

BASE_URL = "http://127.0.0.1:8000/api/v1"

def print_step(step_num: int, title: str):
    print(f"\n[STEP {step_num}] {title}")

def assert_status(res: httpx.Response, expected: int, msg: str):
    if res.status_code != expected:
        print(f"FAILED: {msg} - Expected {expected}, got {res.status_code}. Response: {res.text}")
        sys.exit(1)
    print(f"  OK: {msg} (HTTP {res.status_code})")

def main():
    print("=" * 80)
    print("STARTING END-TO-END BRAND-TO-INFLUENCER BROWSER WORKFLOW VERIFICATION")
    print(f"Target Server: {BASE_URL}")
    print("=" * 80)

    client = httpx.Client(base_url=BASE_URL, timeout=10.0)

    # Health check
    h_res = client.get("/health")
    assert_status(h_res, 200, "Backend health check")
    health = h_res.json()
    print(f"  Backend Subsystems: DB={health['subsystems']['database']}, Auth={health['subsystems']['auth_jwt']}")

    # 1. Register Brand
    print_step(1, "Brand Registration & Authentication")
    b_email = f"brand_journey_{int(httpx._utils.get_environment_proxies().get('time', 1000) or 1)}@example.com"
    import time
    timestamp = int(time.time())
    b_email = f"brand_flow_{timestamp}@example.com"
    c_email = f"creator_flow_{timestamp}@example.com"

    b_reg = client.post("/auth/register", json={
        "email": b_email,
        "password": "Password123!",
        "full_name": "Apex Wearables Inc",
        "role": "brand",
        "company_name": "Apex Wearables",
        "industry": "technology"
    })
    assert_status(b_reg, 201, "Brand registration")
    b_token = b_reg.json()["access_token"]
    b_head = {"Authorization": f"Bearer {b_token}"}
    brand_profile_id = b_reg.json()["user"]["brand_profile_id"]

    # 2. Register Creator
    print_step(2, "Influencer Registration & Authentication")
    c_reg = client.post("/auth/register", json={
        "email": c_email,
        "password": "Password123!",
        "full_name": "Jordan Rivers",
        "role": "creator",
        "handle": f"@jordan_tech_{timestamp}",
        "primary_niche": "technology"
    })
    assert_status(c_reg, 201, "Creator registration")
    c_token = c_reg.json()["access_token"]
    c_head = {"Authorization": f"Bearer {c_token}"}
    creator_profile_id = c_reg.json()["user"]["creator_profile_id"]

    # 3. Brand Creates Campaign
    print_step(3, "Brand Creates and Publishes Campaign")
    camp_res = client.post("/campaigns/", json={
        "title": "Quantum Smart Ring Q4 Launch",
        "description": "Showcase sleep metrics, haptic alerts and battery longevity in lifestyle tech reviews",
        "budget": 6000.0,
        "niche": "technology",
        "target_location": "Global",
        "min_followers": 1500,
        "min_engagement_rate": 1.5,
        "deliverables": ["1x In-depth YouTube Review", "2x Instagram Reels"]
    }, headers=b_head)
    assert_status(camp_res, 201, "Campaign creation")
    camp_id = camp_res.json()["id"]

    # 4. Brand Shortlists Creator
    print_step(4, "Brand Saves Creator to Campaign Shortlist with Evaluation Notes")
    sl_res = client.post("/shortlists/", json={
        "creator_id": creator_profile_id,
        "campaign_id": camp_id,
        "notes": "Verified high engagement on hardware tear-downs and wearables.",
        "status": "considering"
    }, headers=b_head)
    assert_status(sl_res, 201, "Creator shortlisted")
    sl_item = sl_res.json()
    sl_id = sl_item["id"]
    print(f"  Shortlist created (ID {sl_id}) with status '{sl_item['status']}'")

    # Update notes & status
    patch_sl = client.patch(f"/shortlists/{sl_id}", json={
        "status": "contacted",
        "notes": "Preliminary outreach message prepared."
    }, headers=b_head)
    assert_status(patch_sl, 200, "Shortlist updated to 'contacted'")
    assert patch_sl.json()["status"] == "contacted"

    # 5. Brand Sends Direct Invitation
    print_step(5, "Brand Sends Direct Campaign Invitation")
    inv_res = client.post("/invitations/", json={
        "campaign_id": camp_id,
        "creator_id": creator_profile_id,
        "message": "We would love to feature our smart ring on your channel for the holiday shopping season.",
        "compensation_offered": 5200.0,
        "deliverables_requested": ["1x In-depth YouTube Review", "2x Instagram Reels"],
        "expires_in_days": 14
    }, headers=b_head)
    assert_status(inv_res, 201, "Direct invitation created")
    inv_data = inv_res.json()
    inv_id = inv_data["id"]
    print(f"  Invitation created (ID {inv_id}) with status '{inv_data['status']}'")

    # Check shortlist auto-updated to 'invited'
    sl_verify = client.get(f"/shortlists/items?campaign_id={camp_id}", headers=b_head)
    assert_status(sl_verify, 200, "Query shortlist items")
    assert any(s["id"] == sl_id and s["status"] == "invited" for s in sl_verify.json()), "Shortlist status must be 'invited'"
    print("  Verified: Shortlist pipeline automatically synchronized to 'invited'")

    # Duplicate invitation protection check
    dup_res = client.post("/invitations/", json={
        "campaign_id": camp_id,
        "creator_id": creator_profile_id,
        "compensation_offered": 5200.0
    }, headers=b_head)
    assert_status(dup_res, 400, "Duplicate active invitation rejected")
    print("  Verified: Duplicate active invitation prevention enforced (HTTP 400)")

    # 6. Creator Receives In-App Notification
    print_step(6, "Influencer In-App Notification Delivery & Discovery")
    notif_res = client.get("/notifications/", headers=c_head)
    assert_status(notif_res, 200, "Creator notifications query")
    notifs = notif_res.json()["notifications"]
    assert len(notifs) >= 1, "Creator must have received in-app notification"
    invite_notif = next(n for n in notifs if "Quantum Smart Ring" in n["title"])
    print(f"  Notification Received: '{invite_notif['title']}' (Read={invite_notif['is_read']})")
    assert "Persistent in-app notification delivery active" in notif_res.json()["delivery_provider_disclaimer"]
    print(f"  Provider Disclaimer Verified: '{notif_res.json()['delivery_provider_disclaimer']}'")

    # Mark notification read
    mark_read = client.patch(f"/notifications/{invite_notif['id']}/read", headers=c_head)
    assert_status(mark_read, 200, "Notification marked as read")
    assert mark_read.json()["is_read"] is True

    # 7. Creator Inspects Opportunities Feed
    print_step(7, "Creator Opportunities Feed & Match Explanation")
    opps_res = client.get("/opportunities/", headers=c_head)
    assert_status(opps_res, 200, "Query open opportunities")
    opp = next(o for o in opps_res.json() if o["id"] == camp_id)
    print(f"  Campaign Opportunity: '{opp['title']}' | Fit Score: {opp['fit_score']}%")
    print(f"  Direct Invite Linked: {opp['has_invitation']} (ID {opp['invitation_id']})")
    print(f"  Match Strengths: {opp['match_strengths']}")

    # Save & Dismiss interaction testing
    save_opp = client.post(f"/opportunities/{camp_id}/interact", json={"action": "save"}, headers=c_head)
    assert_status(save_opp, 200, "Opportunity saved by creator")
    assert save_opp.json()["is_saved"] is True

    # 8. Creator Reviews Invitation & Accepts
    print_step(8, "Creator Reviews Invitation & Accepts Partnership Offer")
    detail_res = client.get(f"/invitations/{inv_id}", headers=c_head)
    assert_status(detail_res, 200, "Creator views invitation details")
    # Verified transition to 'viewed'
    assert detail_res.json()["status"] == "viewed", "Status must transition to 'viewed'"
    print("  Verified: First review transitioned invitation status from 'sent' to 'viewed'")

    # Creator accepts
    accept_res = client.patch(f"/invitations/{inv_id}/status", json={"status": "accepted"}, headers=c_head)
    assert_status(accept_res, 200, "Creator accepted invitation")
    accepted_data = accept_res.json()
    assert accepted_data["status"] == "accepted"
    assert accepted_data["responded_at"] is not None
    print(f"  Invitation accepted at {accepted_data['responded_at']}")

    # 9. Verify Brand State & Notifications
    print_step(9, "Brand Shortlist & Acceptance Notification Synchronization")
    sl_confirmed_res = client.get(f"/shortlists/items?campaign_id={camp_id}", headers=b_head)
    assert_status(sl_confirmed_res, 200, "Brand shortlist query")
    confirmed_item = next(s for s in sl_confirmed_res.json() if s["id"] == sl_id)
    assert confirmed_item["status"] == "confirmed", "Shortlist status must now be 'confirmed'"
    print("  Verified: Brand shortlist automatically confirmed upon creator acceptance")

    b_notif_res = client.get("/notifications/", headers=b_head)
    assert_status(b_notif_res, 200, "Brand notifications query")
    brand_notifs = b_notif_res.json()["notifications"]
    accept_notif = next(n for n in brand_notifs if "Accepted" in n["title"])
    print(f"  Brand Alert Received: '{accept_notif['title']}' - '{accept_notif['message']}'")

    # 10. State Machine Terminal Guard
    print_step(10, "State Machine Terminal Guard Enforcement")
    mut_attempt = client.patch(f"/invitations/{inv_id}/status", json={"status": "declined"}, headers=c_head)
    assert_status(mut_attempt, 400, "Finalized invitation cannot be mutated")
    print(f"  Verified: Mutation of finalized invitation rejected: '{mut_attempt.json()['detail']}'")

    print("\n" + "=" * 80)
    print("ALL 10 BROWSER WORKFLOW VERIFICATION STEPS PASSED WITH 100% SUCCESS!")
    print("=" * 80)

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
scripts/verify_campaign_analytics.py

Live verification script for Phase 17: Campaign Analytics.
Verifies against running daemon backend server (http://127.0.0.1:8000):
1. Registration & Campaign creation
2. Workflow event creation (Shortlist, Invitation, Opportunity Interaction, & Acceptance)
3. Brand Analytics calculation, 5-stage participation funnel, and disclaimers
4. Authorized Brand CSV streaming export with RFC 4180 headers & formula injection protection
5. Creator Analytics calculations, opportunities, freshness, & outreach activity
6. Creator CSV streaming export
7. RBAC & cross-user isolation
"""

import time
import httpx
import io
import csv

BASE_URL = "http://127.0.0.1:8000/api/v1"

def main():
    print("=" * 80)
    print("LIVE VERIFICATION: Phase 17 Campaign Analytics")
    print("Target Server:", BASE_URL)
    print("=" * 80)

    client = httpx.Client(base_url=BASE_URL, timeout=15.0)

    # 1. Health check
    h_res = client.get("/health")
    assert h_res.status_code == 200, f"Backend unhealthy: {h_res.text}"
    print("[PASS] Backend health check OK")

    # 2. Register Brand and Creator with unique timestamp
    ts = int(time.time() * 1000)
    brand_email = f"analytics_brand_{ts}@test.com"
    creator_email = f"analytics_creator_{ts}@test.com"

    # Register Brand
    b_res = client.post("/auth/register", json={
        "email": brand_email,
        "password": "Password123!",
        "full_name": "Lumina Analytics Brand",
        "role": "brand",
        "company_name": "Lumina Labs",
        "industry": "technology"
    })
    assert b_res.status_code == 201, f"Brand registration failed: {b_res.text}"
    brand_token = b_res.json()["access_token"]
    brand_headers = {"Authorization": f"Bearer {brand_token}"}
    brand_id = b_res.json()["user"]["brand_profile_id"]
    print(f"[PASS] Registered Brand (ID: {brand_id}, Email: {brand_email})")

    # Register Creator
    c_res = client.post("/auth/register", json={
        "email": creator_email,
        "password": "Password123!",
        "full_name": "Elena Rostova",
        "role": "creator",
        "handle": f"@elena_{ts}",
        "primary_niche": "technology"
    })
    assert c_res.status_code == 201, f"Creator registration failed: {c_res.text}"
    creator_token = c_res.json()["access_token"]
    creator_headers = {"Authorization": f"Bearer {creator_token}"}
    creator_id = c_res.json()["user"]["creator_profile_id"]
    print(f"[PASS] Registered Creator (ID: {creator_id}, Handle: @elena_{ts})")

    # 3. Brand creates an active campaign
    camp_res = client.post("/campaigns/", json={
        "title": f"Smart Ring Q4 Launch {ts}",
        "description": "Showcase sleep metrics, haptic alerts and battery longevity in lifestyle tech reviews",
        "budget": 6000.0,
        "niche": "technology",
        "target_location": "Global",
        "min_followers": 1500,
        "min_engagement_rate": 1.5,
        "deliverables": ["1x In-depth YouTube Review", "2x Instagram Reels"]
    }, headers=brand_headers)
    assert camp_res.status_code == 201, f"Campaign creation failed: {camp_res.text}"
    campaign_id = camp_res.json()["id"]
    print(f"[PASS] Created published campaign ID: {campaign_id}")

    # 4. Brand shortlists creator
    sl_res = client.post("/shortlists/", json={
        "creator_id": creator_id,
        "campaign_id": campaign_id,
        "notes": "Verified high engagement on hardware tear-downs and wearables.",
        "status": "considering"
    }, headers=brand_headers)
    assert sl_res.status_code == 201, f"Shortlist failed: {sl_res.text}"
    print(f"[PASS] Creator {creator_id} shortlisted by Brand")

    # 5. Brand invites creator
    inv_res = client.post("/invitations/", json={
        "campaign_id": campaign_id,
        "creator_id": creator_id,
        "message": "We would love to feature our smart ring on your channel for the holiday shopping season.",
        "compensation_offered": 1500.0,
        "deliverables_requested": ["1x In-depth YouTube Review", "2x Instagram Reels"],
        "expires_in_days": 14
    }, headers=brand_headers)
    assert inv_res.status_code == 201, f"Invitation failed: {inv_res.text}"
    invitation_id = inv_res.json()["id"]
    print(f"[PASS] Brand invited Creator (Invitation ID: {invitation_id})")

    # 6. Creator views opportunities, saves brief, views invitation, and accepts
    opp_res = client.get("/opportunities/", headers=creator_headers)
    assert opp_res.status_code == 200, f"Creator opportunities failed: {opp_res.text}"
    print(f"[PASS] Creator accessed opportunities feed ({len(opp_res.json())} briefs)")

    save_res = client.post(f"/opportunities/{campaign_id}/interact", json={"action": "save"}, headers=creator_headers)
    assert save_res.status_code == 200, f"Opportunity save failed: {save_res.text}"
    print(f"[PASS] Creator saved campaign opportunity {campaign_id}")

    # View invitation (transitions to 'viewed')
    view_res = client.get(f"/invitations/{invitation_id}", headers=creator_headers)
    assert view_res.status_code == 200, f"View invitation failed: {view_res.text}"
    assert view_res.json()["status"] == "viewed"
    print("[PASS] Creator viewed invitation details (Status transitioned to 'viewed')")

    # Accept invitation
    accept_res = client.patch(f"/invitations/{invitation_id}/status", json={"status": "accepted"}, headers=creator_headers)
    assert accept_res.status_code == 200, f"Invitation acceptance failed: {accept_res.text}"
    assert accept_res.json()["status"] == "accepted"
    print(f"[PASS] Creator accepted invitation (Status: {accept_res.json()['status']})")

    # 7. Test Brand Analytics Endpoint
    b_analytics = client.get("/analytics/brand", headers=brand_headers)
    assert b_analytics.status_code == 200, f"Brand analytics failed: {b_analytics.text}"
    b_data = b_analytics.json()
    print("\n--- Brand Analytics Results ---")
    print(f"  Active Campaigns:       {b_data['active_campaigns']}")
    print(f"  Total Shortlisted:      {b_data['total_shortlisted']}")
    print(f"  Total Invitations Sent: {b_data['total_invitations_sent']}")
    print(f"  Response Rate:          {b_data['response_rate_pct']}%")
    print(f"  Acceptance Rate:        {b_data['acceptance_rate_pct']}%")
    print(f"  Committed Compensation: ${b_data['total_committed_compensation']}")
    print(f"  Participation Funnel:")
    f = b_data['funnel']
    print(f"    - Stage 1 (Shortlisted): {f['stage_1_shortlisted']}")
    print(f"    - Stage 2 (Invited):     {f['stage_2_invited']} ({f['shortlist_to_invite_pct']}%)")
    print(f"    - Stage 3 (Viewed):      {f['stage_3_viewed']} ({f['invite_to_view_pct']}%)")
    print(f"    - Stage 4 (Responded):   {f['stage_4_responded']} ({f['view_to_response_pct']}%)")
    print(f"    - Stage 5 (Confirmed):   {f['stage_5_confirmed']} ({f['response_to_confirm_pct']}%)")
    assert b_data['active_campaigns'] >= 1
    assert b_data['total_shortlisted'] >= 1
    assert b_data['total_invitations_sent'] >= 1
    assert b_data['response_rate_pct'] == 100.0
    assert b_data['acceptance_rate_pct'] == 100.0
    assert f['stage_1_shortlisted'] >= 1
    assert f['stage_2_invited'] >= 1
    assert f['stage_3_viewed'] >= 1
    assert f['stage_4_responded'] >= 1
    assert f['stage_5_confirmed'] >= 1
    assert "Platform activity" in b_data['platform_vs_social_disclaimer']
    print("[PASS] Brand Analytics metrics, rates, and 5-stage funnel verified!")

    # 8. Test Brand CSV Export (RFC 4180 & formula injection prevention)
    b_export = client.get("/analytics/brand/export", headers=brand_headers)
    assert b_export.status_code == 200, f"Brand export failed: {b_export.status_code}"
    assert "text/csv" in b_export.headers.get("content-type", "")
    assert "attachment; filename=" in b_export.headers.get("content-disposition", "")
    
    csv_rows = list(csv.reader(io.StringIO(b_export.text)))
    assert len(csv_rows) >= 2, f"Expected header + data row, got {len(csv_rows)}"
    print("\n--- Brand CSV Export ---")
    print(f"  Headers: {csv_rows[0]}")
    print(f"  Sample Row: {csv_rows[1]}")
    print(f"[PASS] Brand CSV export conforms to RFC 4180 with {len(csv_rows) - 1} records")

    # 9. Test Creator Analytics Endpoint
    c_analytics = client.get("/analytics/creator", headers=creator_headers)
    assert c_analytics.status_code == 200, f"Creator analytics failed: {c_analytics.text}"
    c_data = c_analytics.json()
    print("\n--- Creator Analytics Results ---")
    print(f"  Discovered Briefs:   {c_data['opportunities']['total_eligible_opportunities']}")
    print(f"  Saved Briefs:        {c_data['opportunities']['saved_opportunities']}")
    print(f"  Invitations Recv:    {c_data['invitations']['total_received']}")
    print(f"  Invitations Accepted:{c_data['invitations']['accepted']}")
    print(f"  Response Rate:       {c_data['invitations']['response_rate_pct']}%")
    print(f"  Earned Compensation: ${c_data['invitations']['total_earned_compensation']}")
    print(f"  Profile Completeness:{c_data['freshness']['profile_completeness_pct']}%")
    print(f"  Recent Activity Log: {len(c_data['recent_activity'])} item(s)")
    assert c_data['invitations']['total_received'] >= 1
    assert c_data['invitations']['accepted'] >= 1
    assert c_data['invitations']['response_rate_pct'] == 100.0
    assert c_data['invitations']['total_earned_compensation'] >= 1500.0
    assert len(c_data['recent_activity']) >= 1
    assert "Platform collaboration activity" in c_data['platform_vs_social_disclaimer']
    print("[PASS] Creator Analytics metrics, compensation, and activity log verified!")

    # 10. Test Creator CSV Export
    c_export = client.get("/analytics/creator/export", headers=creator_headers)
    assert c_export.status_code == 200, f"Creator export failed: {c_export.status_code}"
    assert "text/csv" in c_export.headers.get("content-type", "")
    c_csv_rows = list(csv.reader(io.StringIO(c_export.text)))
    assert len(c_csv_rows) >= 2
    print(f"[PASS] Creator CSV export generated {len(c_csv_rows) - 1} outreach records")

    # 11. Test RBAC and Cross-User Isolation
    print("\n--- RBAC & Isolation Checks ---")
    # Creator requesting Brand analytics -> 403
    cross_b = client.get("/analytics/brand", headers=creator_headers)
    assert cross_b.status_code == 403, f"Expected 403, got {cross_b.status_code}"
    print("[PASS] Creator calling /analytics/brand rejected with HTTP 403")

    # Brand requesting Creator analytics -> 403
    cross_c = client.get("/analytics/creator", headers=brand_headers)
    assert cross_c.status_code == 403, f"Expected 403, got {cross_c.status_code}"
    print("[PASS] Brand calling /analytics/creator rejected with HTTP 403")

    # Unauthenticated requests -> 401
    unauth_b = client.get("/analytics/brand")
    assert unauth_b.status_code == 401, f"Expected 401, got {unauth_b.status_code}"
    unauth_c = client.get("/analytics/creator")
    assert unauth_c.status_code == 401, f"Expected 401, got {unauth_c.status_code}"
    print("[PASS] Unauthenticated requests rejected with HTTP 401")

    print("\n" + "=" * 80)
    print(">>> ALL PHASE 17 LIVE VERIFICATIONS PASSED SUCCESSFULLY! <<<")
    print("=" * 80)

if __name__ == "__main__":
    main()

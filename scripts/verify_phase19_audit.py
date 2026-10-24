"""
Phase 19 - Full Frontend and Backend Integration Audit Script.
Validates end-to-end API client contract compliance, error envelope consistency,
user journeys, database persistence, state transitions, and admin oversight.
"""

import os
import sys
import uuid
import httpx

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))
from app.core.config import settings

BASE_URL = "http://127.0.0.1:8000/api/v1"
ALT_BASE_URL = "http://127.0.0.1:8000/api"

def run_audit():
    print("=" * 70)
    print("PHASE 19: FRONTEND & BACKEND INTEGRATION AUDIT VERIFICATION")
    print("=" * 70)
    
    passed_tests = 0
    total_tests = 0

    def assert_test(condition, label, details=""):
        nonlocal passed_tests, total_tests
        total_tests += 1
        if condition:
            passed_tests += 1
            print(f"  [PASS] {label}")
        else:
            print(f"  [FAIL] {label} -> {details}")
            sys.exit(1)

    client = httpx.Client(timeout=10.0, headers={"X-Forwarded-For": f"198.51.100.{uuid.uuid4().int % 250 + 1}"})

    # 1. Base URL & Routing Parity Check
    print("\n--- 1. Base URL & Route Aliasing Check ---")
    res1 = client.get(f"{BASE_URL}/health")
    res2 = client.get(f"{ALT_BASE_URL}/health")
    assert_test(res1.status_code == 200, "Base URL /api/v1/health accessible", f"status={res1.status_code}")
    assert_test(res2.status_code == 200, "Base URL alias /api/health accessible", f"status={res2.status_code}")
    assert_test(res1.json().get("status") in ["healthy", "ok"], "Health status schema verified")

    # 2. Consistent Error Envelopes & Form Validation Feedback
    print("\n--- 2. Error Envelope & Validation Feedback Check ---")
    # 422 Validation error
    bad_reg = client.post(f"{BASE_URL}/auth/register", json={"email": "not-an-email"})
    assert_test(bad_reg.status_code == 422, "Invalid payload triggers HTTP 422")
    bad_reg_json = bad_reg.json()
    assert_test("error" in bad_reg_json, "Error envelope contains top-level 'error' key")
    assert_test(bad_reg_json["error"].get("error_type") == "validation_error", "Error type is 'validation_error'")
    assert_test(isinstance(bad_reg_json["error"].get("details"), list), "Validation details array present in error object")
    assert_test("detail" in bad_reg_json, "Compatibility 'detail' array preserved for FastAPI standard clients")

    # 403 Forbidden on direct admin registration (with valid name and schema)
    forbidden_reg = client.post(f"{BASE_URL}/auth/register", json={
        "email": f"hacker_{uuid.uuid4().hex[:6]}@example.com",
        "password": "Password123!",
        "full_name": "Admin Attacker",
        "role": "admin"
    })
    assert_test(forbidden_reg.status_code == 403, "Public admin registration blocked with HTTP 403", f"status={forbidden_reg.status_code}")
    assert_test("error" in forbidden_reg.json(), "403 envelope conforms to error response schema")

    # 401 Unauthorized check
    unauth = client.get(f"{BASE_URL}/auth/me")
    assert_test(unauth.status_code == 401, "Protected endpoint returns HTTP 401 without token")
    assert_test("error" in unauth.json(), "401 envelope conforms to error response schema")

    # 3. Brand User Journey: Registration -> Campaign -> Discovery -> Shortlist -> Invitation
    print("\n--- 3. Brand User Journey & Data Persistence ---")
    brand_uid = uuid.uuid4().hex[:6]
    brand_email = f"audit_brand_{brand_uid}@example.com"
    reg_brand = client.post(f"{BASE_URL}/auth/register", json={
        "email": brand_email,
        "password": "SecurePassword123!",
        "full_name": f"Brand Manager {brand_uid}",
        "role": "brand",
        "company_name": f"Initial Brand {brand_uid}"
    })
    assert_test(reg_brand.status_code == 201, "Brand user registered successfully", f"status={reg_brand.status_code}")
    brand_token = reg_brand.json()["access_token"]
    brand_headers = {"Authorization": f"Bearer {brand_token}"}

    # Brand Profile Update
    patch_brand = client.patch(f"{BASE_URL}/brands/me", headers=brand_headers, json={
        "company_name": f"Integration Test Brand {brand_uid}",
        "website": "https://auditbrand.test",
        "industry": "Technology",
        "description": "Integration testing brand entity for Phase 19 audit."
    })
    assert_test(patch_brand.status_code == 200, "Brand profile updated and persisted")
    assert_test(patch_brand.json()["company_name"] == f"Integration Test Brand {brand_uid}", "Brand company name verified")

    # Campaign Creation
    campaign_res = client.post(f"{BASE_URL}/campaigns/", headers=brand_headers, json={
        "title": f"Phase 19 Audit Campaign {brand_uid}",
        "description": "A comprehensive end-to-end integration test brief for Phase 19 audit.",
        "niche": "technology",
        "budget": 7500.0,
        "min_followers": 1000,
        "deliverables": ["1x 60s Reel", "1x Dedicated Review"],
        "status": "active"
    })
    assert_test(campaign_res.status_code == 201, "Campaign brief created and persisted", f"status={campaign_res.status_code}")
    campaign_id = campaign_res.json()["id"]

    # 4. Creator User Journey: Registration -> Profile Setup -> Discovery Visibility
    print("\n--- 4. Creator User Journey & Discovery Visibility ---")
    creator_uid = uuid.uuid4().hex[:6]
    creator_email = f"audit_creator_{creator_uid}@example.com"
    reg_creator = client.post(f"{BASE_URL}/auth/register", json={
        "email": creator_email,
        "password": "SecurePassword123!",
        "full_name": f"Audit Creator {creator_uid}",
        "role": "creator",
        "handle": f"audit_tech_{creator_uid}"
    })
    assert_test(reg_creator.status_code == 201, "Creator user registered successfully", f"status={reg_creator.status_code}")
    creator_token = reg_creator.json()["access_token"]
    creator_headers = {"Authorization": f"Bearer {creator_token}"}
    creator_user_id = reg_creator.json()["user"]["id"]

    # Creator Profile Setup
    patch_creator = client.patch(f"{BASE_URL}/creators/me", headers=creator_headers, json={
        "handle": f"audit_tech_{creator_uid}",
        "display_name": f"Audit Creator {creator_uid}",
        "bio": "Full-stack developer and AI hardware enthusiast.",
        "primary_niche": "technology",
        "follower_count": 45000,
        "engagement_rate": 3.8
    })
    assert_test(patch_creator.status_code == 200, "Creator profile updated and persisted")
    creator_profile_id = patch_creator.json()["id"]

    # Discovery by Brand
    search_creators = client.get(
        f"{BASE_URL}/creators/?niche=technology&min_followers=1000",
        headers=brand_headers
    )
    assert_test(search_creators.status_code == 200, "Brand creator discovery query succeeds")
    creators_list = search_creators.json()
    assert_test(any(c["id"] == creator_profile_id for c in creators_list), "Newly created creator appears in live search results")

    # 5. Shortlist & Invitation Two-Sided Workflow
    print("\n--- 5. Shortlist & Direct Invitation Two-Sided Workflow ---")
    # Brand shortlists the creator
    shortlist_res = client.post(f"{BASE_URL}/shortlists/", headers=brand_headers, json={
        "creator_id": creator_profile_id,
        "campaign_id": campaign_id,
        "notes": "Top tier candidate for tech review campaign",
        "status": "considering"
    })
    assert_test(shortlist_res.status_code == 201, "Candidate added to shortlist", f"status={shortlist_res.status_code}")
    shortlist_id = shortlist_res.json()["id"]

    # Brand updates shortlist notes
    patch_shortlist = client.patch(
        f"{BASE_URL}/shortlists/{shortlist_id}",
        headers=brand_headers,
        json={"notes": "Confirmed portfolio matches requirements, sending invite.", "status": "confirmed"}
    )
    assert_test(patch_shortlist.status_code == 200, "Shortlist notes and status updated", f"status={patch_shortlist.status_code}")
    assert_test(patch_shortlist.json()["status"] == "confirmed", "Shortlist status persisted as 'confirmed'")

    # Brand sends invitation
    invite_res = client.post(f"{BASE_URL}/invitations/", headers=brand_headers, json={
        "campaign_id": campaign_id,
        "creator_id": creator_profile_id,
        "message": "We would love to sponsor a dedicated YouTube overview video.",
        "compensation_offered": 2500.0,
        "deliverables_requested": ["1x 60s Reel", "1x YouTube Dedicated"],
        "expires_in_days": 14
    })
    assert_test(invite_res.status_code == 201, "Collaboration invitation sent to creator", f"status={invite_res.status_code}")
    invitation_id = invite_res.json()["id"]

    # Creator views invitation
    creator_invites = client.get(f"{BASE_URL}/invitations/creator", headers=creator_headers)
    assert_test(creator_invites.status_code == 200, "Creator fetches invitations list")
    my_invites = creator_invites.json()
    assert_test(any(inv["id"] == invitation_id for inv in my_invites), "Sent invitation visible in creator queue")

    # Creator accepts invitation via status patch
    accept_res = client.patch(
        f"{BASE_URL}/invitations/{invitation_id}/status",
        headers=creator_headers,
        json={"status": "accepted"}
    )
    assert_test(accept_res.status_code == 200, "Creator accepted invitation successfully")
    assert_test(accept_res.json()["status"] == "accepted", "Invitation status transitioned to 'accepted'")

    # 6. Notifications Lifecycle & Read State
    print("\n--- 6. In-App Notifications Lifecycle ---")
    brand_notifs = client.get(f"{BASE_URL}/notifications/", headers=brand_headers)
    assert_test(brand_notifs.status_code == 200, "Brand fetches notifications")
    notif_data = brand_notifs.json()
    assert_test(len(notif_data["notifications"]) >= 1, "Brand received notification for creator invitation acceptance")
    unread_id = notif_data["notifications"][0]["id"]

    # Mark single notification as read
    read_single = client.patch(f"{BASE_URL}/notifications/{unread_id}/read", headers=brand_headers)
    assert_test(read_single.status_code == 200, "Single notification marked as read")

    # Mark all notifications as read
    read_all = client.post(f"{BASE_URL}/notifications/mark-all-read", headers=brand_headers)
    assert_test(read_all.status_code == 200, "Batch mark-all notifications read succeeds")

    # 7. Brand and Creator Analytics Refresh Telemetry
    print("\n--- 7. Analytics Dashboards Live Telemetry ---")
    brand_analytics = client.get(f"{BASE_URL}/analytics/brand", headers=brand_headers)
    assert_test(brand_analytics.status_code == 200, "Brand analytics telemetry returns HTTP 200")
    b_data = brand_analytics.json()
    assert_test(b_data["active_campaigns"] >= 1, "Brand analytics reflects active campaigns count")
    assert_test(b_data["total_shortlisted"] >= 1, "Brand analytics reflects total shortlisted count")
    assert_test(b_data["invitations_accepted"] >= 1, "Brand analytics reflects accepted invitations count")

    creator_analytics = client.get(f"{BASE_URL}/analytics/creator", headers=creator_headers)
    assert_test(creator_analytics.status_code == 200, "Creator analytics telemetry returns HTTP 200")
    c_data = creator_analytics.json()
    assert_test(c_data["invitations"]["total_received"] >= 1, "Creator analytics reflects total invitations received")
    assert_test(c_data["invitations"]["accepted"] >= 1, "Creator analytics reflects accepted invitations count")

    # 8. Admin Operations & Audit Verification
    print("\n--- 8. Admin Oversight, RBAC & Audit Events ---")
    admin_ts = uuid.uuid4().hex[:6]
    admin_email = f"ops_admin_{admin_ts}@brandbridge.io"
    admin_pass = "AdminPassword123!"
    admin_boot = client.post(f"{BASE_URL}/auth/bootstrap-admin", json={
        "email": admin_email,
        "password": admin_pass,
        "full_name": "Operations Executive",
        "secret_key": settings.SECRET_KEY
    })
    assert_test(admin_boot.status_code == 201, "Admin bootstrapped successfully", f"status={admin_boot.status_code}")
    admin_login = client.post(f"{BASE_URL}/auth/login", json={"email": admin_email, "password": admin_pass})
    assert_test(admin_login.status_code == 200, "Admin login successful")
    admin_token = admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Admin overview telemetry
    admin_ov = client.get(f"{BASE_URL}/admin/overview", headers=admin_headers)
    assert_test(admin_ov.status_code == 200, "Admin overview telemetry endpoint accessible")
    assert_test(admin_ov.json()["total_users"] >= 2, "Admin overview reflects real total users count")

    # Admin user search with pagination & role filtering
    admin_users = client.get(f"{BASE_URL}/admin/users?role=brand&limit=10", headers=admin_headers)
    assert_test(admin_users.status_code == 200, "Admin users list with filtering succeeds")
    assert_test(any(u["email"] == brand_email for u in admin_users.json()["items"]), "Newly created brand appears in admin search")

    # Verify sensitive fields are redacted (no hashed_password or secrets)
    for u in admin_users.json()["items"]:
        assert_test("hashed_password" not in u, "User password hash redacted from admin API response")

    # Audit events search
    admin_audits = client.get(f"{BASE_URL}/admin/audit-events?limit=20", headers=admin_headers)
    assert_test(admin_audits.status_code == 200, "Admin audit events endpoint accessible")
    audit_items = admin_audits.json()["items"]
    assert_test(len(audit_items) >= 1, "Audit events recorded and queryable in admin console")

    # Provider adapters status
    admin_provs = client.get(f"{BASE_URL}/admin/providers", headers=admin_headers)
    assert_test(admin_provs.status_code == 200, "Admin provider adapters status accessible")

    # Model registry status
    admin_models = client.get(f"{BASE_URL}/admin/models", headers=admin_headers)
    assert_test(admin_models.status_code == 200, "Admin model registry status accessible")

    # System diagnostics (liveness vs readiness)
    admin_diag = client.post(f"{BASE_URL}/admin/system/diagnostics", headers=admin_headers)
    assert_test(admin_diag.status_code == 200, "Admin system diagnostics accessible")
    diag_data = admin_diag.json()
    assert_test(diag_data["status"] in ["healthy", "ok"], "System diagnostics status verified", f"status={diag_data['status']}")
    assert_test(diag_data["tests_failed"] == 0, "All diagnostic subsystem probes passed with zero failures")

    print("\n" + "=" * 70)
    print(f"AUDIT SUMMARY: {passed_tests} / {total_tests} ASSERTIONS PASSED (100%)")
    print("ALL INTEGRATION CONTRACTS, ERROR ENVELOPES & USER JOURNEYS VERIFIED!")
    print("=" * 70)

if __name__ == "__main__":
    run_audit()

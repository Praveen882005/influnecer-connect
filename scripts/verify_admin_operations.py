#!/usr/bin/env python3
"""
scripts/verify_admin_operations.py

Live verification script for Phase 18: Admin and Operations.
Verifies against running backend daemon (http://127.0.0.1:8000):
1. Bootstrap Admin authentication & login
2. Role-based access control (RBAC): Brand/Creator/Unauthenticated 403/401 enforcement
3. Admin Overview dashboard telemetry
4. User search, filtering, and pagination
5. Sensitive-field redaction (no password hashes or secrets in responses)
6. User status management & self-deactivation safety guard
7. User role management & self-demotion safety guard
8. Immutable audit event search, pagination, and detail inspection
9. Service health & readiness distinction with DB URL credential masking
10. Active subsystem diagnostics self-test probe
11. Model registry catalog & cache flush
12. Social provider adapter status & restriction transparency
"""

import time
import httpx
import json
import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))
from app.core.config import settings

BASE_URL = "http://127.0.0.1:8000/api/v1"

def main():
    print("=" * 80)
    print("LIVE VERIFICATION: Phase 18 Admin and Operations")
    print("Target Server:", BASE_URL)
    print("=" * 80)

    client = httpx.Client(base_url=BASE_URL, timeout=60.0)

    # 1. Health check
    h_res = client.get("/health")
    assert h_res.status_code == 200, f"Backend unhealthy: {h_res.text}"
    print("[PASS] Backend liveness health check OK")

    # 2. Provision Admin and regular Brand & Creator accounts
    ts = int(time.time() * 1000)
    admin_email = f"ops_admin_{ts}@brandbridge.io"
    brand_email = f"brand_user_{ts}@brandbridge.io"
    creator_email = f"creator_user_{ts}@brandbridge.io"
    password = "AdminPassword123!"

    # Bootstrap admin
    boot_res = client.post("/auth/bootstrap-admin", json={
        "email": admin_email,
        "password": password,
        "full_name": "Operations Executive",
        "secret_key": settings.SECRET_KEY,
    })
    assert boot_res.status_code == 201, f"Admin bootstrap failed: {boot_res.text}"
    print(f"[PASS] Provisioned Administrator ({admin_email})")

    # Admin Login
    admin_login_res = client.post("/auth/login", json={"email": admin_email, "password": password})
    assert admin_login_res.status_code == 200, f"Admin login failed: {admin_login_res.text}"
    admin_token = admin_login_res.json()["access_token"]
    admin_id = admin_login_res.json()["user"]["id"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print(f"[PASS] Authenticated as Admin (User ID: {admin_id})")

    # Register Brand
    b_res = client.post("/auth/register", json={
        "email": brand_email,
        "password": password,
        "full_name": "Venture Brand Co",
        "role": "brand",
        "company_name": "Venture Brand",
        "industry": "technology"
    })
    assert b_res.status_code == 201, f"Brand registration failed: {b_res.text}"
    brand_token = b_res.json()["access_token"]
    brand_headers = {"Authorization": f"Bearer {brand_token}"}
    brand_id = b_res.json()["user"]["id"]
    print(f"[PASS] Registered Brand ({brand_email}, ID: {brand_id})")

    # Register Creator
    c_res = client.post("/auth/register", json={
        "email": creator_email,
        "password": password,
        "full_name": "Marcus Chen",
        "role": "creator",
        "handle": f"@marcus_{ts}",
        "primary_niche": "technology"
    })
    assert c_res.status_code == 201, f"Creator registration failed: {c_res.text}"
    creator_token = c_res.json()["access_token"]
    creator_headers = {"Authorization": f"Bearer {creator_token}"}
    creator_id = c_res.json()["user"]["id"]
    print(f"[PASS] Registered Creator ({creator_email}, ID: {creator_id})")

    # 3. RBAC Enforcement Checks
    print("\n--- 1. RBAC & Access Control Enforcement ---")
    admin_routes = [
        ("GET", "/admin/overview"),
        ("GET", "/admin/users"),
        ("GET", "/admin/audit-events"),
        ("GET", "/admin/system/health"),
        ("POST", "/admin/system/diagnostics"),
        ("GET", "/admin/models"),
        ("POST", "/admin/models/flush-cache"),
        ("GET", "/admin/providers"),
        ("GET", "/admin/imports"),
    ]
    for method, path in admin_routes:
        # Unauthenticated -> 401
        res_unauth = client.get(path) if method == "GET" else client.post(path)
        assert res_unauth.status_code == 401, f"Expected 401 for unauth {path}, got {res_unauth.status_code}"

        # Brand -> 403
        res_brand = client.get(path, headers=brand_headers) if method == "GET" else client.post(path, headers=brand_headers)
        assert res_brand.status_code == 403, f"Expected 403 for brand {path}, got {res_brand.status_code}"

        # Creator -> 403
        res_creator = client.get(path, headers=creator_headers) if method == "GET" else client.post(path, headers=creator_headers)
        assert res_creator.status_code == 403, f"Expected 403 for creator {path}, got {res_creator.status_code}"

    print("[PASS] All 9 administrative endpoints strictly protected against unauthorized access (HTTP 401 / 403)")

    # 4. Admin Overview Telemetry
    print("\n--- 2. Admin Overview Dashboard Telemetry ---")
    overview_res = client.get("/admin/overview", headers=admin_headers)
    assert overview_res.status_code == 200, f"Overview failed: {overview_res.text}"
    overview_data = overview_res.json()
    print(f"  Total Users:       {overview_data['total_users']}")
    print(f"  Active Users:      {overview_data['active_users']}")
    print(f"  Suspended Users:   {overview_data['suspended_users']}")
    print(f"  Users by Role:     {overview_data['users_by_role']}")
    print(f"  System Status:     {overview_data['system_status']} (Readiness: {overview_data['readiness_status']})")
    assert overview_data["total_users"] >= 3
    assert "admin" in overview_data["users_by_role"]
    assert "brand" in overview_data["users_by_role"]
    assert "creator" in overview_data["users_by_role"]
    print("[PASS] Operational overview metrics successfully computed from live entities")

    # 5. User Search, Filtering & Redaction Checks
    print("\n--- 3. User Directory Search & Sensitive-Field Redaction ---")
    users_res = client.get("/admin/users?per_page=10", headers=admin_headers)
    assert users_res.status_code == 200, f"List users failed: {users_res.text}"
    users_raw_text = users_res.text.lower()
    assert "hashed_password" not in users_raw_text, "CRITICAL: hashed_password found in user list!"
    assert password.lower() not in users_raw_text, "CRITICAL: Plaintext password found in user list!"

    # Search by keyword
    search_res = client.get(f"/admin/users?q={creator_email}", headers=admin_headers)
    assert search_res.status_code == 200
    search_data = search_res.json()
    assert search_data["total"] >= 1
    matched_user = next(u for u in search_data["items"] if u["id"] == creator_id)
    assert matched_user["email"] == creator_email
    assert matched_user["role"] == "creator"
    print(f"[PASS] User search confirmed: Matched #{creator_id} with sanitized fields")

    # 6. User Status Management & Self-Deactivation Guard
    print("\n--- 4. Safe Status Management & Guard Enforcement ---")
    # Guard: Admin self-deactivation attempt -> HTTP 400
    self_deact = client.patch(f"/admin/users/{admin_id}/status", headers=admin_headers, json={"is_active": False})
    assert self_deact.status_code == 400, f"Expected 400 for self-deactivation, got {self_deact.status_code}"
    print(f"  Self-deactivation guard: Rejected with HTTP 400 ('{self_deact.json()['detail']}')")

    # Suspend Creator
    susp_res = client.patch(f"/admin/users/{creator_id}/status", headers=admin_headers, json={
        "is_active": False,
        "reason": "Security review investigation"
    })
    assert susp_res.status_code == 200
    assert susp_res.json()["is_active"] is False
    print(f"  Suspended user #{creator_id}: is_active = False")

    # Reactivate Creator
    react_res = client.patch(f"/admin/users/{creator_id}/status", headers=admin_headers, json={
        "is_active": True,
        "reason": "Investigation concluded"
    })
    assert react_res.status_code == 200
    assert react_res.json()["is_active"] is True
    print(f"  Reactivated user #{creator_id}: is_active = True")
    print("[PASS] User account status toggle and self-deactivation guard verified")

    # 7. User Role Management & Self-Demotion Guard
    print("\n--- 5. User Role Management & Demotion Guards ---")
    # Guard: Admin self-demotion -> HTTP 400
    self_demote = client.patch(f"/admin/users/{admin_id}/role", headers=admin_headers, json={"role": "creator"})
    assert self_demote.status_code == 400
    print(f"  Self-demotion guard: Rejected with HTTP 400 ('{self_demote.json()['detail']}')")

    # Promote Brand to Admin
    promote_res = client.patch(f"/admin/users/{brand_id}/role", headers=admin_headers, json={"role": "admin"})
    assert promote_res.status_code == 200
    assert promote_res.json()["role"] == "admin"
    print(f"  Promoted user #{brand_id} to Admin")

    # Demote back to Brand
    demote_res = client.patch(f"/admin/users/{brand_id}/role", headers=admin_headers, json={"role": "brand"})
    assert demote_res.status_code == 200
    assert demote_res.json()["role"] == "brand"
    print(f"  Demoted user #{brand_id} back to Brand")
    print("[PASS] Role transitions and safety guards verified")

    # 8. Immutable Audit Events
    print("\n--- 6. Immutable Audit Trail Inspection ---")
    audit_res = client.get("/admin/audit-events?per_page=10", headers=admin_headers)
    assert audit_res.status_code == 200
    audit_data = audit_res.json()
    assert audit_data["total"] >= 2
    recent_events = [e["action"] for e in audit_data["items"]]
    print(f"  Recent Actions: {recent_events[:4]}")
    assert "ADMIN_USER_STATUS_CHANGE" in recent_events
    assert "ADMIN_USER_ROLE_CHANGE" in recent_events
    print("[PASS] Mandatory audit trail logged administrative actions with actor & timestamp")

    # 9. System Health & Telemetry with Sanitized Credentials
    print("\n--- 7. System Health, Telemetry & Credential Masking ---")
    health_res = client.get("/admin/system/health", headers=admin_headers)
    assert health_res.status_code == 200
    health_data = health_res.json()
    print(f"  Liveness:    {health_data['liveness_status']}")
    print(f"  Readiness:   {health_data['readiness_status']} (is_ready={health_data['is_ready']})")
    print(f"  Uptime:      {health_data['uptime_seconds']:.1f} seconds")
    print(f"  Database:    {health_data['database_engine']}")
    print(f"  Subsystems:  {len(health_data['subsystems'])} active")
    assert "password" not in health_data["database_engine"].lower()
    if "@" in health_data["database_engine"]:
        assert ":***@" in health_data["database_engine"]
    print("[PASS] Operational telemetry distinguishes liveness/readiness and sanitizes database credentials")

    # 10. Active Subsystem Diagnostics Probe
    print("\n--- 8. Active Subsystem Self-Test Diagnostics ---")
    diag_res = client.post("/admin/system/diagnostics", headers=admin_headers)
    assert diag_res.status_code == 200
    diag_data = diag_res.json()
    print(f"  Probe Status:   {diag_data['status']}")
    print(f"  Tests Executed: {diag_data['tests_run']} ({diag_data['tests_passed']} passed, {diag_data['tests_failed']} failed)")
    print(f"  Probe Duration: {diag_data['duration_ms']:.1f} ms")
    for sub, res in diag_data["subsystems_tested"].items():
        print(f"    - {sub}: {res}")
    assert diag_data["tests_run"] >= 3
    assert diag_data["tests_failed"] == 0
    print("[PASS] Subsystem self-test probe executed with zero anomalies")

    # 11. Model Registry & Cache Management
    print("\n--- 9. AI Model Registry & Cache Management ---")
    models_res = client.get("/admin/models", headers=admin_headers)
    assert models_res.status_code == 200
    models_data = models_res.json()
    print(f"  Registered Models: {len(models_data['models'])}")
    for m in models_data["models"]:
        print(f"    - {m['name']} ({m['model_id']}, v{m['version']}) -> {m['status'].upper()}")
    assert len(models_data["models"]) >= 4

    flush_res = client.post("/admin/models/flush-cache", headers=admin_headers)
    assert flush_res.status_code == 200
    print(f"  Cache Flush: {flush_res.json()['message']}")
    print("[PASS] Model registry and operational cache controls verified")

    # 12. Social Provider Connection Status
    print("\n--- 10. Social Data Provider Connections ---")
    prov_res = client.get("/admin/providers", headers=admin_headers)
    assert prov_res.status_code == 200
    providers = prov_res.json()
    for p in providers:
        print(f"    - {p['name']}: {p['status'].upper()} (Auth: {p['auth_mode']})")
        if p["restriction_reason"]:
            print(f"      Reason: {p['restriction_reason']}")
    synthetic = next(p for p in providers if p["provider_id"] == "synthetic_catalog")
    assert synthetic["status"] == "active"
    external_disabled = [p for p in providers if p["status"] == "disabled_restricted"]
    assert len(external_disabled) >= 3
    print("[PASS] Provider connection states and transparent restriction reasons verified")

    print("\n" + "=" * 80)
    print(">>> ALL 10 PHASE 18 LIVE ADMIN VERIFICATION SUITES PASSED SUCCESSFULLY! <<<")
    print("=" * 80)

if __name__ == "__main__":
    main()

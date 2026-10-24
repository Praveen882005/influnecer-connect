import pytest
from httpx import AsyncClient
from datetime import datetime, timezone

from app.core.config import settings
from app.models.entities import AuditEvent, User, UserRole


async def create_user_and_token(
    client: AsyncClient,
    email: str,
    role: str = "brand",
    name: str = "Test User",
    handle: str = "@tester",
    niche: str = "technology",
) -> tuple[str, int]:
    if role == "admin":
        bootstrap_payload = {
            "email": email,
            "password": "Password123!",
            "full_name": name,
            "secret_key": settings.SECRET_KEY,
        }
        b_res = await client.post("/api/v1/auth/bootstrap-admin", json=bootstrap_payload)
        assert b_res.status_code == 201, b_res.text
        user_id = b_res.json()["id"]

        login_res = await client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
        assert login_res.status_code == 200, login_res.text
        token = login_res.json()["access_token"]
        return token, user_id

    payload = {
        "email": email,
        "password": "Password123!",
        "full_name": name,
        "role": role,
    }
    if role == "brand":
        payload["company_name"] = name
        payload["industry"] = "technology"
    elif role == "creator":
        payload["handle"] = handle
        payload["primary_niche"] = niche

    res = await client.post("/api/v1/auth/register", json=payload)
    assert res.status_code == 201, res.text
    data = res.json()
    token = data["access_token"]
    user_id = data["user"]["id"]
    return token, user_id


# ==============================================================================
# 1. RBAC & ROLE PROTECTION TESTS
# ==============================================================================

@pytest.mark.asyncio
async def test_admin_endpoints_rbac_and_cross_role_isolation(client: AsyncClient):
    """Verifies that non-admin users (Brand, Creator) and unauthenticated requests are strictly rejected."""
    brand_tok, _ = await create_user_and_token(client, "brand_forbidden@test.com", "brand", "Brand Guard")
    creator_tok, _ = await create_user_and_token(client, "creator_forbidden@test.com", "creator", "Creator Guard", "@creator_guard")
    admin_tok, _ = await create_user_and_token(client, "admin_user_rbac@test.com", "admin", "Admin RBAC")

    brand_head = {"Authorization": f"Bearer {brand_tok}"}
    creator_head = {"Authorization": f"Bearer {creator_tok}"}
    admin_head = {"Authorization": f"Bearer {admin_tok}"}

    endpoints = [
        ("GET", "/api/v1/admin/overview"),
        ("GET", "/api/v1/admin/users"),
        ("GET", "/api/v1/admin/audit-events"),
        ("GET", "/api/v1/admin/system/health"),
        ("POST", "/api/v1/admin/system/diagnostics"),
        ("GET", "/api/v1/admin/models"),
        ("POST", "/api/v1/admin/models/flush-cache"),
        ("GET", "/api/v1/admin/providers"),
        ("GET", "/api/v1/admin/imports"),
    ]

    for method, path in endpoints:
        # 1. Unauthenticated request -> HTTP 401
        if method == "GET":
            unauth_res = await client.get(path)
        else:
            unauth_res = await client.post(path)
        assert unauth_res.status_code == 401, f"Expected 401 for unauth {method} {path}, got {unauth_res.status_code}"

        # 2. Brand user request -> HTTP 403
        if method == "GET":
            brand_res = await client.get(path, headers=brand_head)
        else:
            brand_res = await client.post(path, headers=brand_head)
        assert brand_res.status_code == 403, f"Expected 403 for brand {method} {path}, got {brand_res.status_code}"

        # 3. Creator user request -> HTTP 403
        if method == "GET":
            creator_res = await client.get(path, headers=creator_head)
        else:
            creator_res = await client.post(path, headers=creator_head)
        assert creator_res.status_code == 403, f"Expected 403 for creator {method} {path}, got {creator_res.status_code}"

        # 4. Admin user request -> HTTP 200
        if method == "GET":
            admin_res = await client.get(path, headers=admin_head)
        else:
            admin_res = await client.post(path, headers=admin_head)
        assert admin_res.status_code == 200, f"Expected 200 for admin {method} {path}, got {admin_res.status_code}"


# ==============================================================================
# 2. SENSITIVE FIELD REDACTION CHECKS
# ==============================================================================

@pytest.mark.asyncio
async def test_admin_sensitive_field_redaction(client: AsyncClient):
    """Verifies password hashes, security tokens, and DB passwords are never leaked in admin payloads."""
    admin_tok, admin_id = await create_user_and_token(client, "admin_redact@test.com", "admin", "Admin Redact")
    admin_head = {"Authorization": f"Bearer {admin_tok}"}

    # 1. Inspect /admin/users response
    users_res = await client.get("/api/v1/admin/users", headers=admin_head)
    assert users_res.status_code == 200
    users_text = users_res.text.lower()
    assert "hashed_password" not in users_text, "hashed_password must never be returned in /admin/users"
    assert "password123!" not in users_text, "Raw passwords must never appear in /admin/users"

    users_data = users_res.json()
    for item in users_data["items"]:
        assert "hashed_password" not in item
        assert "password" not in item

    # 2. Inspect /admin/system/health database URL sanitization
    health_res = await client.get("/api/v1/admin/system/health", headers=admin_head)
    assert health_res.status_code == 200
    health_data = health_res.json()
    db_engine = health_data["database_engine"]
    assert "password" not in db_engine.lower()
    if "@" in db_engine:
        assert ":***@" in db_engine, "Database URL password credentials must be replaced with '***'"
    assert "security_redaction_notice" in health_data

    # 3. Create an audit event with sensitive payload and verify redaction
    # Trigger audit event by updating user with sensitive-looking keyword
    user_tok, target_uid = await create_user_and_token(client, "target_redact@test.com", "creator", "Target", "@target_redact")
    patch_res = await client.patch(
        f"/api/v1/admin/users/{target_uid}/status",
        headers=admin_head,
        json={"is_active": False, "reason": "Administrative suspension test with auth token audit"},
    )
    assert patch_res.status_code == 200

    audit_res = await client.get("/api/v1/admin/audit-events", headers=admin_head)
    assert audit_res.status_code == 200
    audit_data = audit_res.json()
    for event in audit_data["items"]:
        details_str = str(event["details"]).lower()
        assert "password123!" not in details_str


# ==============================================================================
# 3. USER SEARCH, FILTERING & PAGINATION TESTS
# ==============================================================================

@pytest.mark.asyncio
async def test_admin_user_search_filters_and_pagination(client: AsyncClient):
    """Tests keyword search, role filters, status filters, and pagination parameters."""
    admin_tok, _ = await create_user_and_token(client, "admin_search_ops@test.com", "admin", "Search Admin")
    admin_head = {"Authorization": f"Bearer {admin_tok}"}

    # Register unique test users
    _, b_id = await create_user_and_token(client, "searchable_brand_unique@test.com", "brand", "Unique Brand Name")
    _, c_id = await create_user_and_token(client, "searchable_creator_unique@test.com", "creator", "Unique Creator Name", "@unique_cr")

    # 1. Search by name keyword
    res_name = await client.get("/api/v1/admin/users?q=Unique Brand", headers=admin_head)
    assert res_name.status_code == 200
    data_name = res_name.json()
    assert any(u["id"] == b_id for u in data_name["items"])
    assert all("unique brand" in (u["full_name"] + u["email"]).lower() for u in data_name["items"])

    # 2. Filter by role
    res_role = await client.get("/api/v1/admin/users?role=creator", headers=admin_head)
    assert res_role.status_code == 200
    data_role = res_role.json()
    assert all(u["role"] == "creator" for u in data_role["items"])

    # 3. Filter by status
    # Suspend searchable creator
    await client.patch(f"/api/v1/admin/users/{c_id}/status", headers=admin_head, json={"is_active": False})
    
    res_susp = await client.get("/api/v1/admin/users?status=suspended", headers=admin_head)
    assert res_susp.status_code == 200
    data_susp = res_susp.json()
    assert any(u["id"] == c_id for u in data_susp["items"])
    assert all(u["is_active"] is False for u in data_susp["items"])

    res_act = await client.get("/api/v1/admin/users?status=active", headers=admin_head)
    assert res_act.status_code == 200
    data_act = res_act.json()
    assert not any(u["id"] == c_id for u in data_act["items"])

    # 4. Pagination
    res_pag = await client.get("/api/v1/admin/users?per_page=2&page=1", headers=admin_head)
    assert res_pag.status_code == 200
    data_pag = res_pag.json()
    assert len(data_pag["items"]) <= 2
    assert data_pag["per_page"] == 2
    assert data_pag["page"] == 1
    assert data_pag["pages"] >= 1


# ==============================================================================
# 4. USER STATUS MANAGEMENT & SAFETY GUARDS
# ==============================================================================

@pytest.mark.asyncio
async def test_admin_user_status_management_and_guards(client: AsyncClient):
    """Tests activating, suspending, audit logging, and the self-deactivation guard."""
    admin_tok, admin_id = await create_user_and_token(client, "admin_status_tester@test.com", "admin", "Admin Status")
    admin_head = {"Authorization": f"Bearer {admin_tok}"}

    _, target_id = await create_user_and_token(client, "user_to_suspend@test.com", "brand", "Suspend Target")

    # 1. Self-deactivation guard: Admin cannot deactivate themselves -> HTTP 400
    self_res = await client.patch(
        f"/api/v1/admin/users/{admin_id}/status",
        headers=admin_head,
        json={"is_active": False, "reason": "Self deactivation attempt"},
    )
    assert self_res.status_code == 400
    assert "Administrators cannot deactivate their own active account" in self_res.json()["detail"]

    # 2. Suspend target user
    suspend_res = await client.patch(
        f"/api/v1/admin/users/{target_id}/status",
        headers=admin_head,
        json={"is_active": False, "reason": "Policy violation investigation"},
    )
    assert suspend_res.status_code == 200
    assert suspend_res.json()["is_active"] is False

    # 3. Reactivate target user
    activate_res = await client.patch(
        f"/api/v1/admin/users/{target_id}/status",
        headers=admin_head,
        json={"is_active": True, "reason": "Investigation concluded satisfactorily"},
    )
    assert activate_res.status_code == 200
    assert activate_res.json()["is_active"] is True

    # 4. Verify Audit Event logged
    audit_res = await client.get(f"/api/v1/admin/audit-events?action=ADMIN_USER_STATUS_CHANGE", headers=admin_head)
    assert audit_res.status_code == 200
    audit_data = audit_res.json()
    assert audit_data["total"] >= 2
    recent_event = audit_data["items"][0]
    assert recent_event["action"] == "ADMIN_USER_STATUS_CHANGE"
    assert recent_event["resource_id"] == str(target_id)
    assert recent_event["details"]["new_is_active"] is True


# ==============================================================================
# 5. USER ROLE MANAGEMENT & GUARDS
# ==============================================================================

@pytest.mark.asyncio
async def test_admin_user_role_management_and_guards(client: AsyncClient):
    """Tests role elevation, self-demotion guard, and audit trail."""
    admin_tok, admin_id = await create_user_and_token(client, "admin_role_tester@test.com", "admin", "Admin Role")
    admin_head = {"Authorization": f"Bearer {admin_tok}"}

    _, target_id = await create_user_and_token(client, "user_to_promote@test.com", "creator", "Promote Target", "@promote_cr")

    # 1. Self-demotion guard -> HTTP 400
    self_role = await client.patch(
        f"/api/v1/admin/users/{admin_id}/role",
        headers=admin_head,
        json={"role": "creator", "reason": "Accidental self demotion"},
    )
    assert self_role.status_code == 400
    assert "Administrators cannot demote their own account role" in self_role.json()["detail"]

    # 2. Promote target creator to admin
    promote_res = await client.patch(
        f"/api/v1/admin/users/{target_id}/role",
        headers=admin_head,
        json={"role": "admin", "reason": "Operations team onboarding"},
    )
    assert promote_res.status_code == 200
    assert promote_res.json()["role"] == "admin"

    # 3. Demote target back to brand
    demote_res = await client.patch(
        f"/api/v1/admin/users/{target_id}/role",
        headers=admin_head,
        json={"role": "brand", "reason": "Role re-assignment"},
    )
    assert demote_res.status_code == 200
    assert demote_res.json()["role"] == "brand"

    # 4. Verify audit event
    audit_res = await client.get("/api/v1/admin/audit-events?action=ADMIN_USER_ROLE_CHANGE", headers=admin_head)
    assert audit_res.status_code == 200
    assert audit_res.json()["total"] >= 2


# ==============================================================================
# 6. SYSTEM HEALTH & DIAGNOSTICS
# ==============================================================================

@pytest.mark.asyncio
async def test_admin_system_health_and_diagnostics(client: AsyncClient):
    """Tests operational health telemetry and active subsystem self-test probe."""
    admin_tok, _ = await create_user_and_token(client, "admin_diag_tester@test.com", "admin", "Admin Diag")
    admin_head = {"Authorization": f"Bearer {admin_tok}"}

    # 1. Operational health
    health_res = await client.get("/api/v1/admin/system/health", headers=admin_head)
    assert health_res.status_code == 200
    health_data = health_res.json()
    assert health_data["liveness_status"] == "healthy"
    assert health_data["readiness_status"] in ("ready", "not_ready")
    assert health_data["database_connected"] is True
    assert len(health_data["subsystems"]) >= 4

    # 2. Active diagnostics self-test probe
    diag_res = await client.post("/api/v1/admin/system/diagnostics", headers=admin_head)
    assert diag_res.status_code == 200
    diag_data = diag_res.json()
    assert diag_data["tests_run"] >= 3
    assert diag_data["tests_passed"] >= 3
    assert diag_data["status"] == "healthy"
    assert "database" in diag_data["subsystems_tested"]
    assert "auth_jwt" in diag_data["subsystems_tested"]

    # 3. Verify audit event emitted for diagnostics
    audit_res = await client.get("/api/v1/admin/audit-events?action=ADMIN_DIAGNOSTICS_RUN", headers=admin_head)
    assert audit_res.status_code == 200
    assert audit_res.json()["total"] >= 1


# ==============================================================================
# 7. MODEL REGISTRY & PROVIDER CONNECTIONS
# ==============================================================================

@pytest.mark.asyncio
async def test_admin_model_registry_and_provider_connections(client: AsyncClient):
    """Tests model catalog inspection, cache flushing, and provider connection status."""
    admin_tok, _ = await create_user_and_token(client, "admin_models_tester@test.com", "admin", "Admin Models")
    admin_head = {"Authorization": f"Bearer {admin_tok}"}

    # 1. Model Registry
    models_res = await client.get("/api/v1/admin/models", headers=admin_head)
    assert models_res.status_code == 200
    models_data = models_res.json()
    assert len(models_data["models"]) >= 4
    model_ids = [m["model_id"] for m in models_data["models"]]
    assert "sentence-transformers/all-MiniLM-L6-v2" in model_ids
    assert "brand-bridge/hybrid-recommender-v1" in model_ids

    # 2. Flush Model Cache
    flush_res = await client.post("/api/v1/admin/models/flush-cache", headers=admin_head)
    assert flush_res.status_code == 200
    flush_data = flush_res.json()
    assert flush_data["status"] == "success"
    assert "flushed_entries" in flush_data

    # 3. Provider Connections
    providers_res = await client.get("/api/v1/admin/providers", headers=admin_head)
    assert providers_res.status_code == 200
    providers = providers_res.json()
    assert len(providers) >= 4
    
    # Verify synthetic catalog is active
    synthetic_p = next(p for p in providers if p["provider_id"] == "synthetic_catalog")
    assert synthetic_p["status"] == "active"

    # Verify external social APIs are disabled and have clear restriction reasons
    ig_p = next(p for p in providers if p["provider_id"] == "meta_instagram_graph")
    assert ig_p["status"] == "disabled_restricted"
    assert ig_p["restriction_reason"] is not None
    assert "Meta App Review" in ig_p["restriction_reason"]

    yt_p = next(p for p in providers if p["provider_id"] == "google_youtube_v3")
    assert yt_p["status"] == "disabled_restricted"
    assert yt_p["restriction_reason"] is not None


# ==============================================================================
# 8. OVERVIEW & IMPORT JOBS
# ==============================================================================

@pytest.mark.asyncio
async def test_admin_overview_and_imports(client: AsyncClient):
    """Tests overview counter aggregation and paginated import history."""
    admin_tok, _ = await create_user_and_token(client, "admin_overview_tester@test.com", "admin", "Admin Overview")
    admin_head = {"Authorization": f"Bearer {admin_tok}"}

    # 1. Overview metrics
    overview_res = await client.get("/api/v1/admin/overview", headers=admin_head)
    assert overview_res.status_code == 200
    overview_data = overview_res.json()
    assert overview_data["total_users"] >= 1
    assert overview_data["system_status"] == "healthy"
    assert "brand" in overview_data["users_by_role"]
    assert "creator" in overview_data["users_by_role"]
    assert "admin" in overview_data["users_by_role"]

    # 2. Imports endpoint
    imports_res = await client.get("/api/v1/admin/imports", headers=admin_head)
    assert imports_res.status_code == 200
    imports_data = imports_res.json()
    assert "items" in imports_data
    assert "total" in imports_data
    assert "pages" in imports_data

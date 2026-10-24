# Phase 18 — Admin Console & Operations Specification

## 1. Overview & Architectural Principles

Brand Bridge Phase 18 establishes a restricted, production-grade operations console designed for platform administrators, security auditors, and system operators. The administration layer adheres to the following principles:

1. **Zero Secret Leakage & Strict Field Redaction**: Sensitive attributes such as password hashes, security tokens, secret keys, and database connection credentials are never serialized or returned across any administrative API responses.
2. **Server-Side Role-Based Access Control (RBAC)**: All administrative endpoints are guarded server-side by `require_roles([UserRole.ADMIN])`. Any unauthorized attempt by unauthenticated callers (HTTP 401) or non-administrative roles (HTTP 403) is immediately rejected and logged.
3. **Mandatory Audit Logging**: Every administrative mutation—including user account suspension, activation, role change, diagnostic probe execution, and model cache flushing—automatically persists an immutable `AuditEvent` with actor provenance, target identifiers, and client IP addresses.
4. **Safety Guards Against Administrative Lockout**: Self-deactivation and self-demotion guards prevent administrators from inadvertently locking themselves out or demoting the last active administrator.
5. **Clear Operational Telemetry**: Distinguishes process liveness (container/process up) from platform readiness (relational persistence, embedding worker, and storage accessible).

---

## 2. Admin API Endpoint Reference (`/api/v1/admin/*`)

| Method | Endpoint | Description | Guard / Audit Action |
|---|---|---|---|
| `GET` | `/admin/overview` | Platform-wide throughput, entity counts, active campaigns, and readiness summary. | Admin Role Guard |
| `GET` | `/admin/users` | Search, filter (by role, active/suspended status), and paginate platform users. | Admin Role Guard; Redacted Credentials |
| `GET` | `/admin/users/{id}` | Single user account details with profile linkage. | Admin Role Guard |
| `PATCH` | `/admin/users/{id}/status` | Activate or suspend a user account. | Self-Deactivation Guard; `ADMIN_USER_STATUS_CHANGE` |
| `PATCH` | `/admin/users/{id}/role` | Promote or demote user role (`brand`, `creator`, `admin`). | Self-Demotion Guard; Last-Admin Guard; `ADMIN_USER_ROLE_CHANGE` |
| `GET` | `/admin/audit-events` | Search, filter, and paginate immutable compliance audit trails. | Admin Role Guard; Recursive Sensitive Redaction |
| `GET` | `/admin/audit-events/{id}` | Full detail view of a single sanitized audit event. | Admin Role Guard |
| `GET` | `/admin/system/health` | Comprehensive operational telemetry with DB URL credential masking. | Admin Role Guard; Distinguishes Liveness vs Readiness |
| `POST` | `/admin/system/diagnostics` | Runs active subsystem self-tests (DB, JWT, Embeddings, Storage). | `ADMIN_DIAGNOSTICS_RUN` |
| `GET` | `/admin/models` | AI model registry catalog, architectures, hardware target, and limits. | Admin Role Guard |
| `POST` | `/admin/models/flush-cache` | Clears in-memory sentence embedding LRU cache. | `ADMIN_MODEL_CACHE_FLUSH` |
| `GET` | `/admin/providers` | Social provider adapter statuses, auth modes, and restriction reasons. | Admin Role Guard |
| `GET` | `/admin/imports` | Paginated catalog import jobs with record counters and error summaries. | Admin Role Guard |

---

## 3. Security, Redaction & Safety Guards

### 3.1 Sensitive Field Redaction
- In `AdminUserItem`, the `hashed_password` column is omitted from the Pydantic schema, guaranteeing that password hashes are never exposed over the wire.
- In `_sanitize_database_url()`, any URI containing `@` masks authentication credentials (e.g. `postgresql+asyncpg://user:***@host:port/dbname`).
- In `_mask_sensitive_data()`, any audit event details containing keys matching `password`, `token`, `secret`, `authorization`, `cookie`, or `api_key` are recursively replaced with `"***REDACTED***"`.

### 3.2 Lockout Prevention Guards
1. **Self-Deactivation Guard**:
   ```python
   if user_id == current_user.id and not payload.is_active:
       raise HTTPException(
           status_code=status.HTTP_400_BAD_REQUEST,
           detail="Administrators cannot deactivate their own active account. Request another administrator to perform this action.",
       )
   ```
2. **Self-Demotion Guard**:
   ```python
   if user_id == current_user.id and payload.role != UserRole.ADMIN:
       raise HTTPException(
           status_code=status.HTTP_400_BAD_REQUEST,
           detail="Administrators cannot demote their own account role.",
       )
   ```
3. **Last-Admin Preservation Guard**:
   Prevents demoting an administrator if they are the only remaining active administrator on the platform.

---

## 4. Telemetry: Service Liveness vs. Readiness

- **Liveness (`/health`)**: Indicates the Python asyncio process is alive, the event loop is responsive, and HTTP traffic is accepted.
- **Readiness (`/ready` & `/admin/system/health`)**: Actively tests downstream dependencies:
  1. Executes `SELECT 1` against the relational database via `HealthService.check_database_connectivity()`.
  2. Verifies the dense Sentence-Transformers model worker (`all-MiniLM-L6-v2`) is loaded in memory.
  3. Verifies filesystem write permissions for local/cloud storage.
  4. Returns `503 Service Unavailable` if critical subsystems are degraded.

---

## 5. Model Registry & Social Provider Adapters

### Registered Models
1. **`sentence-transformers/all-MiniLM-L6-v2`**: 384-dimensional dense semantic sentence encoder (PyTorch/CPU).
2. **`brand-bridge/hybrid-recommender-v1`**: 9-stage deterministic recommendation engine with normalized weights.
3. **`brand-bridge/authenticity-anomaly-detector-v1`**: Rule-based review signal heuristic engine (non-exclusion policy).
4. **`brand-bridge/niche-prototype-alignment-v1`**: Geometric cosine similarity classifier across 8 canonical verticals.

### Provider Connection Transparency
- **Synthetic Benchmark Catalog Provider**: `ACTIVE` (Local JSON/CSV datasets).
- **Instagram Graph API**: `DISABLED_RESTRICTED` (Kept disabled until official Meta App Review permissions and account eligibility are granted).
- **YouTube Data API v3**: `DISABLED_RESTRICTED` (Kept disabled until authorized production Google Cloud project credentials are configured).
- **TikTok Commercial Content API**: `DISABLED_RESTRICTED` (Commercial developer review approval required).

---

## 6. Documented Manual Operations

The following manual operations remain intentionally outside automated public workflows:
1. **Initial Administrator Bootstrapping**:
   - Initial administrator accounts must be provisioned via the secure endpoint `/api/v1/auth/bootstrap-admin` using the server's master `SECRET_KEY`.
   - Public registration of administrator accounts via `/auth/register` is blocked by design (HTTP 403).
2. **Database Migrations**:
   - Schema alterations must be executed using version-controlled Alembic async migrations (`alembic upgrade head`).
3. **External Provider App Review Submissions**:
   - Production social provider enablement requires manual compliance submissions to Meta Developer Portal, Google Cloud Console, and TikTok Developer Center.

---

## 7. Verification Summary

- **Backend Pytest Suite (`tests/test_admin_operations.py`)**: **8 / 8 tests PASS (100%)**
- **Frontend Vitest Suite**: **30 / 30 tests PASS (100%)**
- **Frontend Production Build (`tsc -b && vite build`)**: **0 errors**
- **Live Server Verification (`scripts/verify_admin_operations.py`)**: **10 / 10 verification suites PASS (100%)**

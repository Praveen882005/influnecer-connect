# Brand Bridge

**Brand Bridge** is an intelligent collaboration and campaign management platform that connects brands with digital creators and influencers. The platform streamlines creator discovery, campaign workflows, brand-creator fit evaluation, proposal negotiation, and deliverable tracking.

---

## Architecture & Technology Stack

| Layer | Technology | Description |
| :--- | :--- | :--- |
| **Frontend** | React 19 / TypeScript / Vite 6 / Tailwind CSS v4 | Single-page application with responsive role-based workspaces (Brand, Influencer, Admin), React Hook Form, and Zod validation. |
| **Backend** | Python 3.12 / FastAPI / Pydantic v2 | High-performance asynchronous REST API with modular routers, sanitized logging, and OpenAPI documentation. |
| **Database** | PostgreSQL 16+ / SQLite Async | Relational persistence with SQLAlchemy 2.0 (`asyncpg` for PostgreSQL production; `aiosqlite` for zero-dependency local dev). |
| **Migrations** | Alembic (Async) | Version-controlled schema migrations with programmatic rollback and upgrade verification. |
| **AI / ML Engine** | Sentence-Transformers (`all-MiniLM-L6-v2`) / Scikit-Learn / TF-IDF | Dense 384-dimensional semantic embeddings, zero-shot 8-niche prototype alignment, brand-creator cosine similarity, and multi-signal engagement heuristics. |
| **Testing** | Pytest, Vitest, Testing Library | Automated test suites: 197 Pytest backend tests and 76 Vitest frontend tests (273 tests total, 100% passing). |

---

## AI & Intelligence Roadmap Implementation

All 10 phases of the **BRAND BRIDGE — AI Enhancement Roadmap** are fully implemented, verified, and operational:

1. **Phase 1 — Repository Audit & AI Baseline**: Audited working services vs UI placeholders; established 178 backend / 45 frontend test baseline.
2. **Phase 2 — Rich Influencer Profiles**: Comprehensive profile fields (biography, profile URLs, tier-relative benchmarks, delivery track records, and data freshness indicators).
3. **Phase 3 — AI-Based Brand-to-Influencer Matching**: Dense 384-dimensional semantic embeddings comparing natural language campaign briefs with creator profiles, applying hard eligibility filters before ranking with 4-signal explainability.
4. **Phase 4 — AI-Based Influencer-to-Brand Matching**: Reverse opportunity feed matching creators with compatible brand campaigns, displaying explainable fit scores, signal breakdowns, and direct proposal pitching.
5. **Phase 5 — Sales Potential & Campaign Forecasting**: Pure deterministic scenario calculations (Conservative, Baseline, Optimistic) for Clicks, Conversions, Gross Revenue, Net Profit, ROI %, CPC, and CPA; post-campaign actual outcome logging & variance analysis.
6. **Phase 6 — Influencer Trustworthiness Analysis**: 5-indicator evidence-based audit (Engagement Consistency with CV, Peer-Relative Engagement, Thematic Content Focus, Delivery History, Data Freshness); strict domain separation and non-penalization for unestablished creators.
7. **Phase 7 — Influencer Fraud-Risk & Anomaly Auditor**: Multi-modal search resolver (`@handle`, URL, catalog ID); tri-partite separation of empirical Observed Facts, mathematical Calculated Indicators, and Heuristic Anomaly Signals; manual human marketer verification checklist.
8. **Phase 8 — UI, API & Database Integration**: Natural workflow integration across Brand Overview, Creator Discovery, Candidate Shortlists, Campaign Management, and Profile Intelligence modals.
9. **Phase 9 — Verification, Quality Assurance & Edge Cases**: 8 new backend edge case tests and 5 frontend QA tests covering missing/empty fields, extreme values, zero division guards, and network timeout handling.
10. **Phase 10 — Final Audit Report, Documentation & Checkpoint**: Full documentation in `docs/AI_ARCHITECTURE_AND_SERVICES.md`, Git release checkpoint `v1.0.0-ai-enhancements`, and complete verification logs.

*For complete architectural details, formulas, and API reference, see [docs/AI_ARCHITECTURE_AND_SERVICES.md](docs/AI_ARCHITECTURE_AND_SERVICES.md).*

---

## Directory Structure

```text
brand-bridge/
├── frontend/             # Frontend client application (React 19 + TypeScript + Vite)
│   ├── src/              # Application source code, layouts, and components
│   │   ├── api/          # Reusable API client module with typed response handling
│   │   ├── components/   # Shared forms, feedback, and landing page sections
│   │   ├── design-system/# Reusable component primitives (tokens, Button, Card, etc.)
│   │   ├── layouts/      # AppShell, Sidebar, and TopHeader workspace layouts
│   │   ├── pages/        # Role pages (Brand, Influencer, Admin, Auth, 404)
│   │   ├── routes/       # React Router route hierarchy (AppRoutes)
│   │   ├── schemas/      # Zod validation schemas
│   │   └── __tests__/    # Vitest unit and component tests
│   └── public/           # Static public assets
├── backend/              # Backend API service (FastAPI)
│   ├── alembic/          # Alembic async migration environment
│   │   ├── versions/     # Version-controlled migration scripts
│   │   └── env.py        # Async migration engine runner and model metadata
│   ├── app/              # Application package
│   │   ├── api/          # Route handlers & endpoints (v1 API + health/ready)
│   │   ├── core/         # Settings (config.py), database (database.py), logging (logging.py)
│   │   ├── ml/           # TF-IDF brand matching engine and authenticity heuristics
│   │   ├── models/       # SQLAlchemy 2.0 entity models
│   │   ├── schemas/      # Pydantic v2 request & response schemas
│   │   ├── services/     # Domain services (health_service.py)
│   │   └── main.py       # FastAPI application entry point
│   ├── alembic.ini       # Backend-scoped Alembic configuration
│   └── requirements.txt  # Pinned backend dependencies
├── data/                 # Data assets and datasets
│   └── samples/          # Benchmark creator and campaign JSON fixtures
├── docs/                 # Project documentation and architectural guides
├── scripts/              # Development, deployment, and automation scripts
├── tests/                # Pytest integration and API test suites
├── alembic.ini           # Root-level Alembic configuration
├── .editorconfig         # Code formatting and indentation rules across editors
├── .env.example          # Environment variable template with documented placeholders
├── .gitignore            # Git ignore definitions for Node, Python, caches, and secrets
├── PHASE_STATUS.md       # Implementation phase roadmap, status tracking, and verification
└── README.md             # Project overview, stack architecture, and setup instructions
```

---

## Database Architecture & Alembic Migrations

Brand Bridge utilizes SQLAlchemy 2.0 with asynchronous drivers (`asyncpg` for PostgreSQL and `aiosqlite` for SQLite).

### Entity Models

* **`User`**: Account identity, credentials, role-based authorization (`brand`, `creator`, `admin`), active status, and audit linkage.
* **`BrandProfile`**: Enterprise profile, company name, logo URL, industry, website, description, location, owner metadata, and dynamic completeness scoring.
* **`CreatorProfile`** (aliased as **`InfluencerProfile`**): Creator handle, display name, biography, profile image URL, 8 standard niches (`beauty`, `food`, `fitness`, `fashion`, `home`, `technology`, `parenting`, `wellness`), language, collaboration preferences, follower/following/post counts, data source provenance, Instagram verification state, and dynamic completeness scoring.
* **`InfluencerPost`**: Individual social media post recording data source provenance (`data_source`, e.g., `youtube_api_v3`), `last_synced_at`, and validated semantic embedding vector.
* **`Campaign`**: Brand marketing collaboration specification, objective, product description, budget range, currency, required/preferred criteria, deliverables, campaign dates, application deadline, and lifecycle state machine (`draft`, `published`, `paused`, `completed`, `archived`).
* **`Proposal`**: Creator pitch, rates, estimated delivery days, and status.
* **`Shortlist`**: Curated candidate shortlist with unique brand-creator constraint.
* **`Invitation`**: Direct campaign invitations extended to creators.
* **`Notification`**: User alert delivery with read/unread tracking.
* **`ImportJob`**: Provenance tracking for batch data imports with record counters and error summaries.
* **`AuditEvent`** (aliased as **`AuditLog`**): Structured security and administrative audit trail with action, resource, IP address, and status.

### Metric Provenance & Explicit Unavailable Metric Modeling

Social media metrics from disparate platforms often vary in availability (e.g., YouTube provides view counts, while some platforms hide impressions or shares):
* **Data Provenance**: Every imported metric record tracks `data_source` and `last_synced_at`.
* **Explicit NULL Representation**: Unavailable metrics are recorded as `NULL` (`None`), **never as silent or misleading 0s**.
* **Metrics Availability Map**: The `metrics_availability` JSON column records explicit booleans (e.g., `{"likes": True, "views": True, "shares": False}`). Genuine zero interactions (`likes_count=0`) are cleanly distinguished from unsupported metrics (`shares_count=None`).

### Validated Embedding Vectors

To protect semantic search and AI matching from corrupted data, embedding vectors use `ValidatedEmbeddingVector`:
* Must be passed as structured arrays of numeric floats/integers.
* Rejects arbitrary unvalidated strings (raises `ValueError`).
* Rejects empty arrays and non-finite values (`NaN`, `Inf`).
* Serialized to portable JSON for cross-dialect database support.

### Safe Production Startup

To prevent schema conflicts and data corruption:
* Automatic table generation (`Base.metadata.create_all`) is strictly guarded by `AUTO_CREATE_TABLES` and only active in `development` and `testing` modes.
* In `production` environments, schema evolution is executed exclusively via versioned Alembic migrations.

---

## Authentication & Security Architecture

Brand Bridge implements enterprise-grade, role-based authentication and defense-in-depth resource protection.

### 1. Authentication Endpoints

| Endpoint | Method | Rate Limit | Description |
| :--- | :---: | :---: | :--- |
| `/api/v1/auth/register` | `POST` | 10 req / 60s | Provision brand or creator account; auto-provisions profile. **Admin role strictly rejected.** |
| `/api/v1/auth/login` | `POST` | 10 req / 60s | Authenticates credentials, returns signed access token + refresh token. |
| `/api/v1/auth/token` | `POST` | 10 req / 60s | OAuth2-compatible alias for `/login`. |
| `/api/v1/auth/refresh` | `POST` | 20 req / 60s | Exchanges valid refresh token for a new access token; invalidates old refresh token (rotation). |
| `/api/v1/auth/logout` | `POST` | None | Revokes active access and refresh tokens, blacklisting their unique JTI identifiers. |
| `/api/v1/auth/me` | `GET` | None | Retrieves authenticated user profile, active role, and associated brand/creator profile ID. |
| `/api/v1/auth/bootstrap-admin` | `POST` | None | Development/staging only admin provisioning endpoint guarded by `SECRET_KEY`. |

### 2. Token Security & Revocation
* **Password Hashing**: Bcrypt with 12 salt rounds and constant-time password verification.
* **Token Design**: Cryptographically signed HMAC-SHA256 JWTs with unique `jti` (JWT ID), token type claims (`access` vs `refresh`), and strict expiration timestamps.
* **Token Invalidation on Logout**: The server maintains a token blacklist (`TokenBlacklist`) that revokes token JTIs upon logout. Revoked tokens are immediately rejected by `get_current_user`.
* **Refresh Token Rotation**: Refresh tokens are single-use; exchanging a refresh token automatically revokes the previous token and issues a new pair.

### 3. Server-Side RBAC & Resource Ownership
* **Role-Based Access Control**: Route dependencies (`require_roles([UserRole.BRAND])`, `require_roles([UserRole.CREATOR])`) enforce permissions server-side.
* **Ownership Checks**:
  * Brands can only modify, view proposals for, or update campaigns that they own (`campaign.brand_id == current_user.brand_id`).
  * Creators can only withdraw, complete, or update deliverables on their own proposals (`proposal.creator_id == current_user.creator_id`).
  * Creators cannot unilaterally accept or reject their own proposals.
  * Cross-user modification attempts fail with HTTP 403 Forbidden.
* **Frontend Usability Guards**: `ProtectedRoute` redirects unauthorized or unauthenticated users to `/auth/sign-in` or their primary workspace for clean UX, but all authorization is enforced on the server.

### 4. Development Admin Bootstrap CLI

Public registration forbids administrator accounts. To bootstrap an initial administrator in development or staging environments:

```bash
# Windows PowerShell
$env:PYTHONPATH="backend"
.\.venv\Scripts\python -m app.cli.admin create-admin --email admin@brandbridge.io --password "SecureAdminKey123" --name "System Administrator"

# POSIX
PYTHONPATH=backend python -m app.cli.admin create-admin --email admin@brandbridge.io --password "SecureAdminKey123" --name "System Administrator"
```

> **Production Guard**: The admin bootstrap CLI and `/auth/bootstrap-admin` API endpoint are programmatically disabled when `ENVIRONMENT=production`.

### 5. Documented Security Limitations

* **In-Memory Rate Limiting**: The sliding-window rate limiter is currently node-local. In horizontally scaled multi-instance deployments behind a load balancer, a distributed cache (e.g., Redis) or API Gateway rate limiter should be employed.
* **In-Memory Token Blacklist**: The JWT revocation blacklist is maintained in memory with automatic TTL cleanup. In multi-instance deployments, the blacklist should be backed by Redis or a dedicated database table (`revoked_tokens`).
* **Client Token Storage**: Tokens are transported via the `Authorization: Bearer <token>` header and stored in client `localStorage`. For high-threat enterprise deployments, partitioned `httpOnly` secure `SameSite=Strict` cookies are recommended to eliminate potential XSS token exfiltration risks.
* **IP-Based Limiting**: Rate limits are enforced on client IP, which may aggregate requests from users sharing enterprise NAT proxies.

---

## Local Development Workflow

### 1. Environment Configuration

Copy the example environment template to create your local `.env`:

```bash
# Windows PowerShell
Copy-Item .env.example .env

# Bash / POSIX
cp .env.example .env
```

Key environment settings configured in `.env`:
* `ENVIRONMENT`: `development` (or `staging`, `production`, `testing`)
* `BACKEND_PORT`: `8000`
* `CORS_ALLOWED_ORIGINS`: `http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173`
* `DATABASE_URL`: `sqlite+aiosqlite:///./brand_bridge.db` (zero-dependency local development)
* `AUTO_CREATE_TABLES`: `True` in development/testing; `False` in production

---

### 2. PostgreSQL Setup (Production & Staging)

For external PostgreSQL deployment, configure `DATABASE_URL` with the `postgresql+asyncpg://` dialect:

#### A. Run PostgreSQL with Docker

```bash
docker run -d \
  --name brandbridge-postgres \
  -e POSTGRES_USER=brandbridge \
  -e POSTGRES_PASSWORD=brandbridge_secret \
  -e POSTGRES_DB=brand_bridge \
  -p 5432:5432 \
  postgres:16-alpine
```

#### B. Configure `.env`

```env
DATABASE_URL=postgresql+asyncpg://brandbridge:brandbridge_secret@localhost:5432/brand_bridge
AUTO_CREATE_TABLES=False
ENVIRONMENT=production
```

#### C. Run Alembic Migrations

```bash
# Check current migration revision
alembic current

# Run all pending migrations to head
alembic upgrade head

# Rollback one migration
alembic downgrade -1

# Rollback all migrations to empty base
alembic downgrade base

# Autogenerate a new migration script after model changes
alembic revision --autogenerate -m "describe_changes"
```

---

### 3. Backend Setup & Startup (FastAPI)

#### A. Activate the Python Virtual Environment

```bash
# Windows PowerShell
.\.venv\Scripts\Activate.ps1

# Windows Command Prompt
.\.venv\Scripts\activate.bat

# Linux / macOS
source .venv/bin/activate
```

#### B. Install Python Dependencies

```bash
pip install -r backend/requirements.txt
```

#### C. Start the Backend API Server

Run the development server with live reload:

```bash
# From workspace root
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --app-dir backend --reload
```

The API server will initialize on `http://127.0.0.1:8000`.

#### D. Verify Health & Readiness Probes

```bash
# Liveness probe (HTTP 200 OK)
curl -s http://127.0.0.1:8000/api/v1/health

# Readiness probe (HTTP 200 OK - verifies database connection)
curl -s http://127.0.0.1:8000/api/v1/ready

# Interactive Swagger OpenAPI documentation: http://127.0.0.1:8000/api/v1/docs
```

---

### 4. Frontend Setup & Startup (React + Vite)

#### A. Install Frontend Dependencies

```bash
npm --prefix frontend install
```

#### B. Start the Frontend Development Server

```bash
npm --prefix frontend run dev
```

The frontend application will be accessible at `http://localhost:3000`.

---

### 5. Running the Test Suites

#### Backend Test Suite (Pytest)

Executes all 138 backend integration, database foundation, migration lifecycle, health, auth, campaign lifecycle, data ingestion, engagement analytics, semantic content understanding, and hybrid brand-influencer matching tests:

```bash
# Windows PowerShell
.\.venv\Scripts\pytest tests/ -v

# POSIX
pytest tests/ -v
```

> **Note on PostgreSQL Test Isolation**: When local PostgreSQL is not running, the test suite executes automatically against isolated async SQLite databases (`:memory:` or isolated temporary files). Tests never claim external PostgreSQL integration passed unless PostgreSQL is actually connected and tested.

#### Frontend Test Suite (Vitest)

Executes all 30 frontend unit, validation schema, API client, and component tests:

```bash
npm --prefix frontend test
```

#### Frontend TypeScript & Production Build

```bash
# Type check without emitting
npm --prefix frontend run type-check

# Full production bundle build
npm --prefix frontend run build
```

---

## Data Ingestion Pipeline & Provider Adapters

Brand Bridge features a provider-neutral ingestion system supporting both bulk file datasets (CSV, JSON) and future authorized platform APIs:

### 1. Ingestion Schemas & Strict NULL Handling
* **Profile Schemas**: Handles username/handle normalization (`@handle`), follower shorthand (`450k`, `1.2m`), primary niches across 8 supported categories, and audience demographics.
* **Strict Metric Nullability**: Missing or unmonitored metrics are preserved as `None` (SQL NULL). **The system never substitutes zero for missing metrics.**
* **Genuine Interaction Counts**: Interaction counts reported as `0` are preserved as genuine zeros, and boolean flags in `metrics_availability` distinguish reported zeros from unmonitored metrics.

### 2. Idempotent Ingestion & Row-Level Error Tracking
* **Profiles**: Idempotently upserts on `CreatorProfile.handle`. Re-importing updates metrics and bio without duplicate key exceptions.
* **Posts**: Idempotently upserts on `(platform, external_post_id)`.
* **Row-Level Error Isolation**: Ingestion captures errors per row into `ImportJob.error_summary` without aborting the valid records in the batch.

### 3. Provider Adapters & Platform Safeguards
* **`SyntheticSampleAdapter`**: Operational in development and testing environments for reproducible benchmarking (`data/samples/synthetic_creators.csv`, `synthetic_posts.csv`).
* **`InstagramGraphApiAdapter` & `YouTubeDataApiAdapter`**: Stubbed and strictly disabled (`is_enabled() == False`) pending official platform App Review, business verification, and granted scopes. Web scraping is strictly prohibited.

### 4. Admin Ingestion Endpoints (RBAC Guarded)
* `GET /api/v1/import/jobs`: Paginated audit log of ingestion jobs (Admin only).
* `GET /api/v1/import/jobs/{id}`: Detailed error summary and metrics breakdown (Admin only).
* `POST /api/v1/import/upload`: Multipart CSV/JSON upload with entity type selection (Admin only).
* `POST /api/v1/import/seed-synthetic`: One-click seeding of synthetic development benchmark datasets (Admin only).
* `GET /api/v1/import/provider-adapters`: Status and compliance disclosures for all registered adapters.

---

## Engagement Metrics & Authenticity Signals (Analytics Service)

Brand Bridge implements an evidence-based analytics service providing transparent creator engagement calculations and review signals:

### 1. Canonical Engagement Rate Calculation
* **Formula**: `((average likes + average comments) / follower count) * 100`.
* **Zero Followers**: Handled safely without division by zero (`calculation_status = "zero_followers_uncomputable"`).
* **Missing Metrics**: Unmonitored metrics are never replaced with zero. Supports partial calculations with explicit documentation.
* **Empty Post History**: Returns explicit `empty_post_history` status.
* **Sample Identification**: Every calculation reports sample size (`sample_size_posts`), date range, metrics availability, data freshness, and calculation timestamp.

### 2. Transparent Suspicious-Account Signals (Evidence, Not Proof of Fraud)
* **`follower_following_ratio`**: Compares followers to following; flags extreme follow-unfollow skew (<0.15 on small accounts) while marking missing following counts as `insufficient_data`.
* **`posting_frequency`**: Analyzes intervals between posts; detects dormancy (>90 days) or rapid burst posting (<5 minutes); requires >= 2 dated posts.
* **`engagement_anomalies`**: Evaluates engagement against follower-tier benchmarks (nano, micro, mid, macro, mega) and identifies severe like-to-comment asymmetry.
* **`generic_interaction_patterns`**: Tokenizes captions to detect repetitive boilerplate copy (>=50% duplicate captions).
* **`growth_anomalies`**: Evaluated **strictly and only when multiple timestamped observations exist**. Single-observation profiles return `insufficient_data`.
* **Non-Exclusion Policy**: All signals set `is_exclusion_warranted = False`. Signals assist human marketers and never automatically exclude creators.

### 3. Model Interface & Architectural Catalogs
* **`DeterministicHeuristicAuthenticityModel`**: Active baseline model combining review signals into an explainable 0-100 score.
* **`SupervisedAuthenticityClassifierStub`**: Interface contract for future supervised ML classifiers. Strictly designated as untrained (`is_trained = False`); raises `NotImplementedError` on evaluation.
* **Endpoints**:
  * `GET /api/v1/analytics/creator/{id}/engagement`: Detailed engagement computation.
  * `GET /api/v1/analytics/creator/{id}/authenticity`: Review signals and evidence summary.
  * `GET /api/v1/analytics/creator/{id}/full-report`: Unified analytics report.
  * `GET /api/v1/analytics/model-metadata`: Active baseline vs unimplemented feature catalogs.

---

## Semantic Content Understanding (Sentence-Transformers)

Brand Bridge implements a pretrained Sentence-Transformers service for dense semantic understanding of creator content and marketing briefs:

### 1. Model Architecture & Embeddings
* **Pretrained Model**: `sentence-transformers/all-MiniLM-L6-v2` (MiniLM-L6-H384-uncased, 6 layers, 384 dimensions).
* **Unit Normalization**: $L_2$ normalized vectors ($\|\mathbf{v}\|_2 = 1.0$), making dot product identical to cosine similarity.
* **Context Window**: 256 WordPiece tokens.
* **Performance**: Lightweight (~80–90MB weights, ~120MB RAM) achieving sub-25ms CPU inference.

### 2. Text Normalization Pipeline
* **Unicode Standardization**: NFKC normalization cleans accents and decomposed characters.
* **Noise Stripping**: Control characters (`\x00-\x1f`) and raw URLs are removed.
* **Hashtag Splitting**: Alphanumeric and camelCase hashtags are normalized (`#CleanSkincare2026` $\to$ `clean skincare 2026`).
* **Caption Deduplication**: Filters repeated boilerplate text and identical captions across post histories.

### 3. Canonical 8-Niche Benchmark Alignment
* **Niches Supported**: `beauty`, `food`, `fitness`, `fashion`, `home`, `technology`, `parenting`, `wellness`.
* Evaluates semantic cosine similarity against benchmark prototype embeddings.
* Results are zero-shot geometric proximity ranks.

### 4. Strict Calibration Disclaimers & Blocker Reporting
* **Cosine Similarity Disclaimer**: Reflects directional proximity in the 384-dimensional latent embedding space, NOT a calibrated probability of campaign conversion or creator performance.
* **Niche Alignment Disclaimer**: Represents geometric proximity to prototype reference vectors, NOT ground-truth supervised classification.
* **Refusal to Fake**: If model weights cannot be loaded, the service raises `ModelUnavailableError` and returns HTTP 503 with the exact blocker. It never returns random or fake embeddings.

### 5. Semantic API Endpoints
* `POST /api/v1/semantic/embed`: Single text embedding generation with versioned SHA-256 caching.
* `POST /api/v1/semantic/embed-batch`: High-throughput batch embedding generation.
* `POST /api/v1/semantic/similarity`: Campaign brief vs creator content cosine similarity.
* `POST /api/v1/semantic/niches/alignment`: 8-niche benchmark alignment evaluation.
* `GET /api/v1/semantic/model-status`: Model operational metadata, cache stats, and hardware/runtime limits.

---

## Architectural Guides & Integration Documentation

Detailed architecture specifications, workflow state diagrams, and integration audits:
* **[Deployment & Production Verification Report](docs/DEPLOYMENT_REPORT.md)**: Production containerization, hosting provider analysis, CI/CD pipeline, and 9/9 live smoke test verification.
* **[Final Product Design Review](docs/PRODUCT_DESIGN_REVIEW.md)**: Senior SaaS product design evaluation, 5 prioritized UX/a11y fixes, and WCAG compliance audit.
* **[Full-System Quality Gate Report](docs/QUALITY_GATE_REPORT.md)**: Independent QA review, test execution logs, defect fixes, and security audit report.
* **[Integration Audit & Route-to-Screen Checklist](docs/INTEGRATION_AUDIT.md)**: Full frontend-to-backend integration audit, endpoint typing, error envelopes, and mock decommissioning report.
* **[Admin & Operations Specification](docs/ADMIN_OPERATIONS.md)**: RBAC governance, audit logging, model registry, and provider adapter specifications.
* **[Campaign Analytics & Funnel Specification](docs/CAMPAIGN_ANALYTICS.md)**: Real event telemetry, 5-stage funnel math, and RFC 4180 export safety.
* **[Two-Sided Workflow State Machine](docs/TWO_SIDED_WORKFLOW.md)**: Shortlist and invitation state machine diagrams and ownership checks.
* **[Hybrid Recommender Architecture](docs/HYBRID_BRAND_INFLUENCER_MATCHING.md)**: Explainable 9-step ranking pipeline and score breakdown math.
* **[Semantic Content Understanding](docs/SEMANTIC_CONTENT_UNDERSTANDING.md)**: Dense embedding vector design, caching, and 8-niche prototype alignment.

---

## Phase Status

Track ongoing progress, phase milestones, and audit results in [PHASE_STATUS.md](file:///c:/Users/cgmpr/Downloads/brand_bridge/PHASE_STATUS.md).

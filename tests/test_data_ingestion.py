import io
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.entities import CreatorProfile, ImportJob, InfluencerPost, User, UserRole
from app.schemas.ingestion import (
    RawPostInput,
    RawProfileInput,
    parse_explicit_metric,
    parse_numeric_followers,
)
from app.services.ingestion.importer import IngestionEngine
from app.services.ingestion.provider_adapter import (
    InstagramGraphApiAdapter,
    SyntheticSampleAdapter,
    YouTubeDataApiAdapter,
)


# Helper to obtain an authenticated admin JWT token
async def get_admin_token(client: AsyncClient) -> str:
    # Try existing admin first
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": "admin@brandbridge.io", "password": "admin12345"},
    )
    if login_res.status_code == 200 and "access_token" in login_res.json():
        return login_res.json()["access_token"]

    # Otherwise bootstrap admin
    bootstrap_res = await client.post(
        "/api/v1/auth/bootstrap-admin",
        json={
            "email": "ingestion.admin@brandbridge.io",
            "password": "AdminSecurePassword123!",
            "full_name": "Ingestion Super Admin",
            "secret_key": settings.SECRET_KEY,
        },
    )
    if bootstrap_res.status_code == 201:
        login_res2 = await client.post(
            "/api/v1/auth/login",
            json={"email": "ingestion.admin@brandbridge.io", "password": "AdminSecurePassword123!"},
        )
        if login_res2.status_code == 200 and "access_token" in login_res2.json():
            return login_res2.json()["access_token"]

    raise RuntimeError("Failed to obtain admin test token")


# Helper to obtain a regular creator JWT token
async def get_creator_token(client: AsyncClient, email: str = "regular.creator@example.com") -> str:
    reg_res = await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "CreatorPassword123!",
            "full_name": "Test Creator",
            "role": "creator",
            "handle": f"@creator_{abs(hash(email)) % 100000}",
            "primary_niche": "technology",
        },
    )
    if reg_res.status_code == 201 and "access_token" in reg_res.json():
        return reg_res.json()["access_token"]

    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "CreatorPassword123!"},
    )
    return login_res.json()["access_token"]


# ==============================================================================
# 1. Schema Validation & Metric Normalization Tests
# ==============================================================================

def test_parse_explicit_metric_distinguishes_zero_from_null():
    """
    CRITICAL: Never silently substitute zero for missing engagement metrics.
    Genuine 0 interaction counts must be preserved as 0.
    Missing, empty, or unmonitored metrics must parse to None (SQL NULL).
    """
    # Genuine zero interaction counts
    assert parse_explicit_metric(0) == 0
    assert parse_explicit_metric("0") == 0
    assert parse_explicit_metric("0.0") == 0

    # Explicit missing / unavailable markers -> None (SQL NULL)
    assert parse_explicit_metric(None) is None
    assert parse_explicit_metric("") is None
    assert parse_explicit_metric("   ") is None
    assert parse_explicit_metric("none") is None
    assert parse_explicit_metric("null") is None
    assert parse_explicit_metric("n/a") is None
    assert parse_explicit_metric("N/A") is None
    assert parse_explicit_metric("unavailable") is None
    assert parse_explicit_metric("-") is None

    # Positive counts
    assert parse_explicit_metric(1420) == 1420
    assert parse_explicit_metric("14,200") == 14200


def test_parse_numeric_followers_shorthand():
    """Parses standard integer strings as well as shorthand notations like 450k and 1.2m."""
    assert parse_numeric_followers(5000) == 5000
    assert parse_numeric_followers("25000") == 25000
    assert parse_numeric_followers("450k") == 450000
    assert parse_numeric_followers("1.2m") == 1200000
    assert parse_numeric_followers(None) == 0
    assert parse_numeric_followers("") == 0


def test_raw_profile_input_normalization():
    """Verifies handle @ prefix normalization and validation rules."""
    # Omitted @ prefix is auto-prepended
    p1 = RawProfileInput(
        handle="tech_reviewer",
        display_name="Tech Reviewer",
        primary_niche="technology",
        total_followers="150k",
    )
    assert p1.handle == "@tech_reviewer"
    assert p1.total_followers == 150000
    assert p1.authenticity_score == 90.0  # default

    # Invalid handle characters raise ValueError
    with pytest.raises(ValueError, match="Invalid handle format"):
        RawProfileInput(
            handle="@bad*handle!#",
            display_name="Bad Handle User",
            primary_niche="technology",
        )

    # Empty handle raises ValueError
    with pytest.raises(ValueError, match="Handle or username is required"):
        RawProfileInput(
            handle="",
            display_name="No Handle",
        )


# ==============================================================================
# 2. Ingestion Engine: CSV, JSON, Idempotency & Null Metric Preservation
# ==============================================================================

@pytest.mark.asyncio
async def test_csv_profile_import_and_idempotent_reimport(db_session: AsyncSession):
    """
    Verifies that importing profiles is idempotent:
    re-importing the same handle updates fields without throwing duplicate key errors.
    """
    csv_data = """# Synthetic Test Fixture
handle,display_name,primary_niche,bio,total_followers,avg_engagement_rate
@alex_idempotent,Alex First Import,fitness,Initial bio test,10000,3.5
"""
    records = IngestionEngine.parse_csv(csv_data)
    assert len(records) == 1

    # First import
    job1 = await IngestionEngine.import_profiles(
        records=records,
        source_provenance="test_csv_v1",
        db=db_session,
    )
    assert job1.processed_records == 1
    assert job1.failed_records == 0

    # Verify stored creator
    res1 = await db_session.execute(
        select(CreatorProfile).where(CreatorProfile.handle == "@alex_idempotent")
    )
    creator1 = res1.scalar_one_or_none()
    assert creator1 is not None
    assert creator1.display_name == "Alex First Import"
    assert creator1.total_followers == 10000

    # Second import (Updated metrics for same handle)
    csv_data_v2 = """# Synthetic Test Fixture v2
handle,display_name,primary_niche,bio,total_followers,avg_engagement_rate
@alex_idempotent,Alex Updated Import,fitness,Updated bio test,25000,4.2
"""
    records_v2 = IngestionEngine.parse_csv(csv_data_v2)
    job2 = await IngestionEngine.import_profiles(
        records=records_v2,
        source_provenance="test_csv_v2",
        db=db_session,
    )
    assert job2.processed_records == 1
    assert job2.failed_records == 0

    # Verify updated record (not duplicated)
    res2 = await db_session.execute(
        select(CreatorProfile).where(CreatorProfile.handle == "@alex_idempotent")
    )
    creators = res2.scalars().all()
    assert len(creators) == 1  # Only one record exists!
    assert creators[0].display_name == "Alex Updated Import"
    assert creators[0].total_followers == 25000
    assert creators[0].bio == "Updated bio test"


@pytest.mark.asyncio
async def test_posts_import_strict_null_metric_preservation(db_session: AsyncSession):
    """
    Verifies that missing engagement metrics are stored as SQL NULL (None),
    while explicit 0 metrics are preserved as 0.
    """
    # First provision a creator
    creator_records = [{
        "handle": "@metric_tester",
        "display_name": "Metric Tester",
        "primary_niche": "technology",
        "total_followers": 50000,
    }]
    await IngestionEngine.import_profiles(
        records=creator_records,
        source_provenance="metric_test",
        db=db_session,
    )

    # Now import posts:
    # Post 1: shares is omitted/empty -> NULL; views is reported.
    # Post 2: comments is explicitly 0 -> 0; views is omitted -> NULL.
    posts_records = [
        {
            "influencer_handle": "@metric_tester",
            "platform": "youtube",
            "external_post_id": "yt_metric_test_01",
            "url": "https://youtube.com/watch?v=yt_metric_test_01",
            "caption": "Video with unavailable shares metric",
            "likes_count": "5400",
            "views_count": "120000",
            "comments_count": "320",
            "shares_count": "",  # Unavailable / omitted
        },
        {
            "influencer_handle": "@metric_tester",
            "platform": "youtube",
            "external_post_id": "yt_metric_test_02",
            "url": "https://youtube.com/watch?v=yt_metric_test_02",
            "caption": "Video with genuine zero comments",
            "likes_count": "120",
            "views_count": "null",  # Unavailable
            "comments_count": "0",  # Genuine 0 comments!
            "shares_count": "unavailable",
        },
    ]

    job = await IngestionEngine.import_posts(
        records=posts_records,
        source_provenance="post_metric_test",
        db=db_session,
    )
    assert job.processed_records == 2
    assert job.failed_records == 0

    # Verify Post 1
    p1_res = await db_session.execute(
        select(InfluencerPost).where(InfluencerPost.external_post_id == "yt_metric_test_01")
    )
    post1 = p1_res.scalar_one_or_none()
    assert post1 is not None
    assert post1.likes_count == 5400
    assert post1.views_count == 120000
    assert post1.comments_count == 320
    assert post1.shares_count is None  # STRICTLY NULL, NOT 0!
    assert post1.metrics_availability["shares"] is False
    assert post1.metrics_availability["likes"] is True

    # Verify Post 2
    p2_res = await db_session.execute(
        select(InfluencerPost).where(InfluencerPost.external_post_id == "yt_metric_test_02")
    )
    post2 = p2_res.scalar_one_or_none()
    assert post2 is not None
    assert post2.views_count is None  # STRICTLY NULL, NOT 0!
    assert post2.comments_count == 0  # GENUINE 0 PRESERVED!
    assert post2.metrics_availability["views"] is False
    assert post2.metrics_availability["comments"] is True


@pytest.mark.asyncio
async def test_malformed_rows_handled_without_batch_failure(db_session: AsyncSession):
    """
    Verifies that malformed rows in a CSV or batch are recorded in error_summary
    without failing valid rows in the same ingestion batch.
    """
    csv_malformed = """# Malformed test
handle,display_name,primary_niche,bio,total_followers
,Missing Handle,technology,Invalid row,10000
@@bad_handle!!!,Invalid Symbol User,fitness,Invalid row,20000
@valid_resilient_user,Resilient User,wellness,Should succeed despite bad siblings,45000
"""
    records = IngestionEngine.parse_csv(csv_malformed)
    assert len(records) == 3

    job = await IngestionEngine.import_profiles(
        records=records,
        source_provenance="malformed_test_batch",
        db=db_session,
    )
    assert job.total_records == 3
    assert job.processed_records == 1  # Valid row succeeded!
    assert job.failed_records == 2     # Two malformed rows caught!
    assert len(job.error_summary) == 2

    # Check error details
    first_err = job.error_summary[0]
    assert first_err["row"] == 1
    assert "Handle or username is required" in first_err["error"]

    second_err = job.error_summary[1]
    assert second_err["row"] == 2
    assert "Invalid handle format" in second_err["error"]

    # Verify the resilient user was persisted in DB
    res = await db_session.execute(
        select(CreatorProfile).where(CreatorProfile.handle == "@valid_resilient_user")
    )
    creator = res.scalar_one_or_none()
    assert creator is not None
    assert creator.display_name == "Resilient User"


@pytest.mark.asyncio
async def test_empty_file_ingestion(db_session: AsyncSession):
    """Verifies that an empty dataset completes cleanly with 0 processed/failed records."""
    job = await IngestionEngine.import_profiles(
        records=[],
        source_provenance="empty_test",
        db=db_session,
    )
    assert job.total_records == 0
    assert job.processed_records == 0
    assert job.failed_records == 0
    assert job.status.value == "completed"


# ==============================================================================
# 3. Provider Adapter Architecture & Platform Safeguards
# ==============================================================================

def test_provider_adapter_compliance_and_disabled_stubs():
    """
    Verifies provider-neutral adapter interface:
    - Synthetic adapter is enabled for dev/testing.
    - Live Instagram Graph API is disabled pending Meta App Review.
    - Live YouTube Data API is disabled pending Google Cloud quota audit.
    - Disabled adapters raise NotImplementedError on fetch attempts.
    """
    synth = SyntheticSampleAdapter()
    assert synth.is_enabled() is True
    synth_summary = synth.get_status_summary()
    assert synth_summary["status"] == "active"

    ig = InstagramGraphApiAdapter()
    assert ig.is_enabled() is False
    ig_summary = ig.get_status_summary()
    assert ig_summary["status"] == "disabled"
    assert "disabled pending platform App Review" in ig_summary["reason"]

    yt = YouTubeDataApiAdapter()
    assert yt.is_enabled() is False
    yt_summary = yt.get_status_summary()
    assert yt_summary["status"] == "disabled"
    assert "Google Cloud production quota" in yt_summary["reason"]


@pytest.mark.asyncio
async def test_disabled_adapters_reject_fetches():
    """Calling fetch on disabled live adapters must raise NotImplementedError."""
    ig = InstagramGraphApiAdapter()
    with pytest.raises(NotImplementedError, match="Live Instagram Graph API is currently disabled"):
        await ig.fetch_profile("@test_user")

    yt = YouTubeDataApiAdapter()
    with pytest.raises(NotImplementedError, match="Live YouTube Data API is currently disabled"):
        await yt.fetch_profile("@test_channel")


# ==============================================================================
# 4. Admin REST API Endpoints & RBAC Security
# ==============================================================================

@pytest.mark.asyncio
async def test_provider_adapters_api_endpoint(client: AsyncClient):
    """GET /api/v1/import/provider-adapters returns all registered adapters and disclaimers."""
    res = await client.get("/api/v1/import/provider-adapters")
    assert res.status_code == 200
    adapters = res.json()
    assert len(adapters) >= 3

    adapter_ids = [a["provider_id"] for a in adapters]
    assert "synthetic_sample" in adapter_ids
    assert "instagram_graph_api" in adapter_ids
    assert "youtube_data_api_v3" in adapter_ids

    # Verify Instagram and YouTube are explicitly disabled
    ig = next(a for a in adapters if a["provider_id"] == "instagram_graph_api")
    assert ig["is_enabled"] is False
    assert ig["status"] == "disabled"


@pytest.mark.asyncio
async def test_admin_rbac_protection_on_import_endpoints(client: AsyncClient):
    """
    Verifies server-side RBAC:
    - Creators and Brands are rejected with 403 Forbidden.
    - Unauthenticated requests receive 401 Unauthorized.
    - Only Admins can trigger ingestion or view import jobs.
    """
    # 1. Unauthenticated request -> 401
    unauth_res = await client.get("/api/v1/import/jobs")
    assert unauth_res.status_code == 401

    # 2. Creator role request -> 403 Forbidden
    creator_token = await get_creator_token(client, email="denied.creator@test.com")
    creator_headers = {"Authorization": f"Bearer {creator_token}"}

    forbidden_res1 = await client.get("/api/v1/import/jobs", headers=creator_headers)
    assert forbidden_res1.status_code == 403
    assert "Operation not permitted" in forbidden_res1.json()["detail"]

    forbidden_res2 = await client.post(
        "/api/v1/import/seed-synthetic",
        headers=creator_headers,
    )
    assert forbidden_res2.status_code == 403

    # 3. Admin request -> 200 Success
    admin_token = await get_admin_token(client)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    admin_jobs_res = await client.get("/api/v1/import/jobs", headers=admin_headers)
    assert admin_jobs_res.status_code == 200
    assert isinstance(admin_jobs_res.json(), list)


@pytest.mark.asyncio
async def test_admin_seed_synthetic_endpoint(client: AsyncClient):
    """
    POST /api/v1/import/seed-synthetic ingests the synthetic datasets cleanly.
    """
    admin_token = await get_admin_token(client)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    res = await client.post("/api/v1/import/seed-synthetic", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "creators_job" in data
    assert "posts_job" in data
    assert data["creators_job"]["processed_records"] >= 5
    assert data["posts_job"]["processed_records"] >= 5
    assert "synthetic development fixtures" in data["disclaimer"]


@pytest.mark.asyncio
async def test_admin_multipart_file_upload(client: AsyncClient):
    """
    POST /api/v1/import/upload accepts multipart CSV and JSON uploads.
    """
    admin_token = await get_admin_token(client)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    csv_content = """handle,display_name,primary_niche,bio,total_followers
@uploaded_creator_test,Uploaded Test User,beauty,Uploaded via multipart form,32000
"""
    files = {
        "file": ("creators_test.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv"),
    }
    data = {
        "entity_type": "profiles",
        "source_provenance": "test_multipart_upload.csv",
    }

    res = await client.post(
        "/api/v1/import/upload",
        headers=admin_headers,
        files=files,
        data=data,
    )
    assert res.status_code == 200
    res_data = res.json()
    assert res_data["status"] == "completed"
    assert res_data["processed_records"] == 1
    assert res_data["failed_records"] == 0
    assert res_data["job_id"] > 0

    # Query the job by ID
    job_res = await client.get(f"/api/v1/import/jobs/{res_data['job_id']}", headers=admin_headers)
    assert job_res.status_code == 200
    assert job_res.json()["source_provenance"] == "test_multipart_upload.csv"

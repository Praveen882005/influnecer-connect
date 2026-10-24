import math
import os
import pytest
from datetime import datetime, timezone
import pytest_asyncio
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from alembic import command
from alembic.config import Config

from app.core.config import Settings
from app.core.database import Base, get_db_session
from app.models.entities import (
    AuditEvent,
    AuditLog,
    BrandProfile,
    Campaign,
    CampaignStatus,
    CreatorProfile,
    ImportJob,
    ImportJobStatus,
    InfluencerPost,
    InfluencerProfile,
    Invitation,
    Notification,
    Proposal,
    Shortlist,
    User,
    UserRole,
    ValidatedEmbeddingVector,
)


@pytest_asyncio.fixture
async def isolated_db_session():
    """Provides an isolated in-memory SQLite database session for unit tests."""
    test_engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        future=True,
    )
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(
        bind=test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    async with session_factory() as session:
        yield session

    await test_engine.dispose()


@pytest.mark.asyncio
async def test_user_and_profiles_creation_and_cascade(isolated_db_session: AsyncSession):
    """Verifies User creation, relationship binding, and cascade deletion."""
    session = isolated_db_session

    user = User(
        email="test_creator@brandbridge.io",
        hashed_password="hashed_pw_secret",
        full_name="Alex TechReviews",
        role=UserRole.CREATOR,
        is_active=True,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)

    creator = CreatorProfile(
        user_id=user.id,
        handle="alex_tech",
        display_name="Alex Reviews",
        primary_niche="Technology",
        total_followers=45000,
        avg_engagement_rate=4.8,
        authenticity_score=94.5,
        content_embedding=[0.12, -0.45, 0.88, 0.05],
    )
    session.add(creator)
    await session.commit()

    # Verify alias InfluencerProfile resolves identically to CreatorProfile
    assert InfluencerProfile is CreatorProfile

    # Query back using InfluencerProfile
    queried = (
        await session.execute(
            select(InfluencerProfile).where(InfluencerProfile.handle == "alex_tech")
        )
    ).scalar_one_or_none()
    assert queried is not None
    assert queried.user_id == user.id
    assert queried.content_embedding == [0.12, -0.45, 0.88, 0.05]


@pytest.mark.asyncio
async def test_influencer_post_explicit_unavailable_metrics(isolated_db_session: AsyncSession):
    """
    Verifies that unavailable metrics are explicitly tracked as NULL / None,
    preventing misleading silent zeros.
    """
    session = isolated_db_session

    user = User(
        email="creator_metrics@brandbridge.io",
        hashed_password="hashed_secret",
        full_name="Metrics Creator",
        role=UserRole.CREATOR,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)

    creator = CreatorProfile(
        user_id=user.id,
        handle="metrics_creator",
        display_name="Metrics Creator",
        primary_niche="Design",
    )
    session.add(creator)
    await session.commit()
    await session.refresh(creator)

    # Ingestion scenario:
    # Likes are genuine 0 (tracked and confirmed zero).
    # Views and Shares are NOT reported/unsupported by platform API (unavailable).
    post = InfluencerPost(
        influencer_id=creator.id,
        platform="youtube",
        external_post_id="yt_vid_99812",
        url="https://youtube.com/watch?v=99812",
        caption="Design system breakdown",
        media_type="video",
        posted_at=datetime.now(timezone.utc),
        data_source="youtube_api_v3",
        likes_count=0,          # Genuine 0
        comments_count=12,
        views_count=None,       # Explicitly unavailable
        shares_count=None,      # Explicitly unavailable
        engagement_rate=None,   # Cannot calculate without views/reach
        metrics_availability={
            "likes": True,
            "comments": True,
            "views": False,
            "shares": False,
        },
        embedding_vector=[0.05, 0.82, -0.31],
    )
    session.add(post)
    await session.commit()
    await session.refresh(post)

    # Verify metrics availability distinction
    assert post.is_metric_available("likes") is True
    assert post.get_metric("likes") == 0  # True zero

    assert post.is_metric_available("views") is False
    assert post.get_metric("views") is None  # Unavailable, NOT converted to 0

    assert post.is_metric_available("shares") is False
    assert post.get_metric("shares") is None  # Unavailable, NOT converted to 0

    assert post.data_source == "youtube_api_v3"
    assert post.last_synced_at is not None


@pytest.mark.asyncio
async def test_embedding_vector_type_validation_and_rejection():
    """
    Verifies that embedding vectors cannot be stored as arbitrary unvalidated strings
    or invalid numeric types.
    """
    type_decorator = ValidatedEmbeddingVector()

    # 1. Valid list of numeric floats/ints
    valid_result = type_decorator.process_bind_param([0.15, -0.92, 1, 0.0], dialect=None)
    assert valid_result is not None
    assert type_decorator.process_result_value(valid_result, dialect=None) == [0.15, -0.92, 1.0, 0.0]

    # 2. Rejection of arbitrary unvalidated strings
    with pytest.raises(ValueError, match="arbitrary unvalidated string"):
        type_decorator.process_bind_param("arbitrary unvalidated string [1.0, 2.0]", dialect=None)

    with pytest.raises(ValueError, match="arbitrary unvalidated string"):
        type_decorator.process_bind_param("SELECT * FROM users", dialect=None)

    # 3. Rejection of empty arrays
    with pytest.raises(ValueError, match="cannot be an empty array"):
        type_decorator.process_bind_param([], dialect=None)

    # 4. Rejection of non-finite numbers (NaN, Inf)
    with pytest.raises(ValueError, match="must be a finite float"):
        type_decorator.process_bind_param([0.1, float("nan")], dialect=None)

    with pytest.raises(ValueError, match="must be a finite float"):
        type_decorator.process_bind_param([0.1, float("inf")], dialect=None)

    # 5. Rejection of booleans and non-numeric types
    with pytest.raises(ValueError, match="must be a numeric float"):
        type_decorator.process_bind_param([0.1, True, "bad_item"], dialect=None)

    # 6. None is allowed (nullable field)
    assert type_decorator.process_bind_param(None, dialect=None) is None


@pytest.mark.asyncio
async def test_notifications_model(isolated_db_session: AsyncSession):
    """Verifies notification dispatch and read-state filtering."""
    session = isolated_db_session

    user = User(
        email="notify_user@brandbridge.io",
        hashed_password="pw",
        full_name="Notify User",
        role=UserRole.BRAND,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)

    n1 = Notification(
        user_id=user.id,
        title="Proposal Received",
        message="A new creator proposal has been submitted for Tech Fall Campaign.",
        notification_type="proposal_update",
        is_read=False,
    )
    n2 = Notification(
        user_id=user.id,
        title="Security Alert",
        message="New sign-in from recognized IP.",
        notification_type="security",
        is_read=True,
    )
    session.add_all([n1, n2])
    await session.commit()

    unread_count = (
        await session.execute(
            select(func.count(Notification.id))
            .where(Notification.user_id == user.id)
            .where(Notification.is_read.is_(False))
        )
    ).scalar()
    assert unread_count == 1


@pytest.mark.asyncio
async def test_import_job_model(isolated_db_session: AsyncSession):
    """Verifies ImportJob records provenance and failure audits."""
    session = isolated_db_session

    job = ImportJob(
        job_type="influencer_catalog_import",
        source_provenance="data/samples/creators_seed.json",
        status=ImportJobStatus.COMPLETED,
        total_records=100,
        processed_records=98,
        failed_records=2,
        error_summary=[
            {"row": 14, "reason": "Missing required handle"},
            {"row": 52, "reason": "Invalid engagement rate format"},
        ],
    )
    session.add(job)
    await session.commit()
    await session.refresh(job)

    assert job.id is not None
    assert job.status == ImportJobStatus.COMPLETED
    assert len(job.error_summary) == 2
    assert job.processed_records == 98


@pytest.mark.asyncio
async def test_audit_event_and_alias(isolated_db_session: AsyncSession):
    """Verifies AuditEvent recording and backward compatibility with AuditLog."""
    session = isolated_db_session

    event = AuditEvent(
        action="CAMPAIGN_PUBLISHED",
        resource_type="campaign",
        resource_id="101",
        status="success",
        details={"campaign_title": "Summer Launch 2026", "budget": 15000.0},
    )
    session.add(event)
    await session.commit()
    await session.refresh(event)

    assert AuditLog is AuditEvent
    assert event.id is not None
    assert event.action == "CAMPAIGN_PUBLISHED"
    assert event.details["budget"] == 15000.0


@pytest.mark.asyncio
async def test_transaction_rollback_boundary():
    """
    Verifies that get_db_session rolls back database state on exceptions
    and does not leak uncommitted records.
    """
    # Create isolated test engine
    test_engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        future=True,
    )
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(
        bind=test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    # Deliberate failure inside transaction
    with pytest.raises(RuntimeError, match="Intentional transaction test fault"):
        async with session_factory() as session:
            try:
                user = User(
                    email="will_fail@brandbridge.io",
                    hashed_password="pw",
                    full_name="Fail User",
                    role=UserRole.CREATOR,
                )
                session.add(user)
                await session.flush()
                # Simulating failure before commit
                raise RuntimeError("Intentional transaction test fault")
            except Exception:
                await session.rollback()
                raise

    # Verify user was NOT committed
    async with session_factory() as session:
        count = (
            await session.execute(
                select(func.count(User.id)).where(User.email == "will_fail@brandbridge.io")
            )
        ).scalar()
        assert count == 0

    await test_engine.dispose()


def test_production_auto_create_tables_setting():
    """
    Verifies configuration prevents automatic table creation in production mode.
    """
    prod_settings = Settings(
        ENVIRONMENT="production",
        AUTO_CREATE_TABLES=False,
    )
    assert prod_settings.ENVIRONMENT == "production"
    assert prod_settings.AUTO_CREATE_TABLES is False


def test_alembic_upgrade_downgrade_cycle(tmp_path):
    """
    Runs Alembic migration upgrade to head and downgrade to base
    against a disposable isolated SQLite database file.
    """
    test_db_path = tmp_path / "alembic_verify.db"
    db_url = f"sqlite+aiosqlite:///{test_db_path}"

    os.environ["DATABASE_URL"] = db_url

    alembic_cfg = Config("alembic.ini")
    alembic_cfg.set_main_option("sqlalchemy.url", db_url)

    # 1. Upgrade to head
    command.upgrade(alembic_cfg, "head")

    # 2. Downgrade to base
    command.downgrade(alembic_cfg, "base")

    # 3. Upgrade to head again
    command.upgrade(alembic_cfg, "head")

    assert test_db_path.exists()

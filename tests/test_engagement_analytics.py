from datetime import datetime, timedelta, timezone
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entities import CreatorProfile, InfluencerPost, User, UserRole
from app.schemas.analytics import EngagementMetricsOut, ReviewSignalOut
from app.services.analytics.authenticity_service import AuthenticitySignalEvaluator
from app.services.analytics.engagement_service import EngagementCalculator
from app.services.analytics.model_interface import (
    DeterministicHeuristicAuthenticityModel,
    SupervisedAuthenticityClassifierStub,
    DETERMINISTIC_HEURISTICS_CATALOG,
    UNIMPLEMENTED_FEATURES_CATALOG,
)


# Helper to get authenticated test token
async def get_auth_token(client: AsyncClient, email: str = "analytics.tester@example.com") -> str:
    reg_res = await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "Password123!",
            "full_name": "Analytics Tester",
            "role": "brand",
            "company_name": "Metrics Corp",
            "industry": "Marketing",
        },
    )
    if reg_res.status_code == 201:
        return reg_res.json()["access_token"]

    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "Password123!"},
    )
    return login_res.json()["access_token"]


# ==============================================================================
# 1. Engagement Rate Calculation & Boundary Conditions
# ==============================================================================

def test_canonical_engagement_rate_calculation():
    """
    Verifies canonical formula:
    ((average likes + average comments) / follower count) * 100
    Followers: 20,000. Posts: 2 posts.
    Post 1: 500 likes, 100 comments.
    Post 2: 700 likes, 140 comments.
    Avg likes: 600. Avg comments: 120.
    Expected: ((600 + 120) / 20,000) * 100 = (720 / 20,000) * 100 = 3.60%
    """
    now = datetime(2026, 10, 1, 12, 0, tzinfo=timezone.utc)
    creator = CreatorProfile(
        id=1,
        handle="@test_creator",
        total_followers=20_000,
        last_fetched_at=datetime(2026, 9, 28, 12, 0, tzinfo=timezone.utc),
    )
    posts = [
        InfluencerPost(
            id=101,
            influencer_id=1,
            platform="youtube",
            external_post_id="p1",
            url="https://youtube.com/p1",
            likes_count=500,
            comments_count=100,
            posted_at=datetime(2026, 9, 20, tzinfo=timezone.utc),
        ),
        InfluencerPost(
            id=102,
            influencer_id=1,
            platform="youtube",
            external_post_id="p2",
            url="https://youtube.com/p2",
            likes_count=700,
            comments_count=140,
            posted_at=datetime(2026, 9, 25, tzinfo=timezone.utc),
        ),
    ]

    result = EngagementCalculator.calculate_from_posts(creator, posts, now=now)
    assert result.calculated_engagement_rate == 3.60
    assert result.avg_likes == 600.0
    assert result.avg_comments == 120.0
    assert result.calculation_status == "complete"
    assert result.data_freshness == "fresh"
    assert result.sample_size_posts == 2


def test_zero_and_negative_followers_boundary():
    """
    Follower count <= 0 must NOT raise ZeroDivisionError.
    Must return explicit status 'zero_followers_uncomputable'.
    """
    now = datetime(2026, 10, 1, tzinfo=timezone.utc)
    creator = CreatorProfile(id=2, handle="@zero_foll", total_followers=0)
    posts = [
        InfluencerPost(
            id=201,
            influencer_id=2,
            platform="instagram",
            external_post_id="p201",
            url="https://ig.com/p201",
            likes_count=50,
            comments_count=10,
        )
    ]

    result = EngagementCalculator.calculate_from_posts(creator, posts, now=now)
    assert result.calculated_engagement_rate is None
    assert result.calculation_status == "zero_followers_uncomputable"
    assert any("division by zero" in n for n in result.notes)


def test_empty_post_history_boundary():
    """Empty post history returns status 'empty_post_history' without crashing."""
    now = datetime(2026, 10, 1, tzinfo=timezone.utc)
    creator = CreatorProfile(id=3, handle="@no_posts", total_followers=50_000)

    result = EngagementCalculator.calculate_from_posts(creator, [], now=now)
    assert result.calculated_engagement_rate is None
    assert result.calculation_status == "empty_post_history"
    assert result.sample_size_posts == 0


def test_missing_metrics_handling():
    """
    When metrics are omitted/unmonitored (None):
    - Partial calculation on likes-only if comments missing.
    - Missing metrics status if neither likes nor comments are present.
    """
    now = datetime(2026, 10, 1, tzinfo=timezone.utc)
    creator = CreatorProfile(id=4, handle="@missing_comments", total_followers=10_000)
    posts = [
        InfluencerPost(
            id=401,
            influencer_id=4,
            platform="youtube",
            external_post_id="p401",
            url="https://yt.com/p401",
            likes_count=350,
            comments_count=None,  # Missing
            views_count=5000,
        ),
        InfluencerPost(
            id=402,
            influencer_id=4,
            platform="youtube",
            external_post_id="p402",
            url="https://yt.com/p402",
            likes_count=450,
            comments_count=None,  # Missing
            views_count=6000,
        ),
    ]

    res = EngagementCalculator.calculate_from_posts(creator, posts, now=now)
    assert res.avg_likes == 400.0
    assert res.avg_comments is None
    # 400 / 10000 * 100 = 4.0%
    assert res.calculated_engagement_rate == 4.0
    assert res.calculation_status == "partial_metrics_likes_only"
    assert res.metrics_availability["comments"] is False
    assert res.metrics_availability["likes"] is True


def test_stale_data_detection():
    """If data was fetched >30 days ago, marks data_freshness as 'stale'."""
    now = datetime(2026, 10, 15, tzinfo=timezone.utc)
    # 45 days old data
    stale_date = now - timedelta(days=45)
    creator = CreatorProfile(
        id=5,
        handle="@stale_creator",
        total_followers=15_000,
        last_fetched_at=stale_date,
    )
    posts = [
        InfluencerPost(
            id=501,
            influencer_id=5,
            platform="instagram",
            external_post_id="p501",
            url="https://ig.com/p501",
            likes_count=200,
            comments_count=20,
        )
    ]

    res = EngagementCalculator.calculate_from_posts(creator, posts, now=now)
    assert res.data_freshness == "stale"
    assert any("Data sample is stale" in n for n in res.notes)


# ==============================================================================
# 2. Transparent Suspicious-Account Signals
# ==============================================================================

def test_follower_following_ratio_signal():
    """
    Evaluates follower/following ratio:
    - Highly skewed (<0.15 on small account) -> review_recommended.
    - Missing following count (None) -> insufficient_data.
    - Standard ratio -> normal.
    - Never sets is_exclusion_warranted to True.
    """
    evaluator = AuthenticitySignalEvaluator()

    # Normal ratio
    sig_normal = evaluator.evaluate_follower_following_ratio(followers=50_000, following=400)
    assert sig_normal.status == "normal"
    assert sig_normal.is_exclusion_warranted is False

    # Skewed follow-unfollow pattern
    sig_skewed = evaluator.evaluate_follower_following_ratio(followers=200, following=4_000)
    assert sig_skewed.status == "review_recommended"
    assert "Low ratio" in sig_skewed.evidence_summary
    assert sig_skewed.is_exclusion_warranted is False

    # Missing following count
    sig_missing = evaluator.evaluate_follower_following_ratio(followers=25_000, following=None)
    assert sig_missing.status == "insufficient_data"
    assert sig_missing.is_exclusion_warranted is False


def test_posting_frequency_signal():
    """
    Posting frequency evaluates cadence and dormancy:
    - Dormant account (>90 days) -> review_recommended.
    - Rapid burst posting (<5 mins) -> review_recommended.
    - < 2 posts -> insufficient_data.
    - Regular rhythm -> normal.
    """
    evaluator = AuthenticitySignalEvaluator()
    now = datetime(2026, 10, 1, 12, 0, tzinfo=timezone.utc)

    # Insufficient data (<2 posts)
    sig_sparse = evaluator.evaluate_posting_frequency(
        posts=[InfluencerPost(id=1, influencer_id=1, platform="yt", external_post_id="1", url="u", posted_at=now)],
        now=now,
    )
    assert sig_sparse.status == "insufficient_data"

    # Dormant account (latest post 120 days ago)
    dormant_date = now - timedelta(days=120)
    sig_dormant = evaluator.evaluate_posting_frequency(
        posts=[
            InfluencerPost(id=1, influencer_id=1, platform="yt", external_post_id="1", url="u", posted_at=dormant_date - timedelta(days=7)),
            InfluencerPost(id=2, influencer_id=1, platform="yt", external_post_id="2", url="u", posted_at=dormant_date),
        ],
        now=now,
    )
    assert sig_dormant.status == "review_recommended"
    assert "inactive" in sig_dormant.evidence_summary.lower()

    # Regular cadence
    sig_regular = evaluator.evaluate_posting_frequency(
        posts=[
            InfluencerPost(id=1, influencer_id=1, platform="yt", external_post_id="1", url="u", posted_at=now - timedelta(days=6)),
            InfluencerPost(id=2, influencer_id=1, platform="yt", external_post_id="2", url="u", posted_at=now - timedelta(days=3)),
            InfluencerPost(id=3, influencer_id=1, platform="yt", external_post_id="3", url="u", posted_at=now - timedelta(days=1)),
        ],
        now=now,
    )
    assert sig_regular.status == "normal"


def test_engagement_anomalies_signal():
    """
    Evaluates tier-normalized anomalies and like/comment balance:
    - Ghost audience (<0.1% on >25k) -> review_recommended.
    - Asymmetry (>1000 likes with 0 comments) -> review_recommended.
    - Normal engagement -> normal.
    """
    evaluator = AuthenticitySignalEvaluator()

    # Normal engagement for micro-tier (2.5% on 40k)
    eng_normal = EngagementMetricsOut(
        creator_id=1,
        handle="@norm",
        follower_count=40_000,
        sample_size_posts=5,
        avg_likes=900.0,
        avg_comments=100.0,
        calculated_engagement_rate=2.5,
        calculation_status="complete",
        data_freshness="fresh",
        calculated_at=datetime.now(timezone.utc),
    )
    sig_normal = evaluator.evaluate_engagement_anomalies(eng_normal)
    assert sig_normal.status == "normal"

    # Ghost audience anomaly (0.04% on 60,000 followers)
    eng_ghost = EngagementMetricsOut(
        creator_id=2,
        handle="@ghost",
        follower_count=60_000,
        sample_size_posts=5,
        avg_likes=20.0,
        avg_comments=4.0,
        calculated_engagement_rate=0.04,
        calculation_status="complete",
        data_freshness="fresh",
        calculated_at=datetime.now(timezone.utc),
    )
    sig_ghost = evaluator.evaluate_engagement_anomalies(eng_ghost)
    assert sig_ghost.status == "review_recommended"
    assert "low engagement" in sig_ghost.evidence_summary.lower()

    # Severe like/comment asymmetry
    eng_asym = EngagementMetricsOut(
        creator_id=3,
        handle="@asym",
        follower_count=30_000,
        sample_size_posts=3,
        avg_likes=1500.0,
        avg_comments=0.0,
        calculated_engagement_rate=5.0,
        calculation_status="complete",
        data_freshness="fresh",
        calculated_at=datetime.now(timezone.utc),
    )
    sig_asym = evaluator.evaluate_engagement_anomalies(eng_asym)
    assert sig_asym.status == "review_recommended"
    assert "asymmetry" in sig_asym.evidence_summary.lower()


def test_generic_interaction_patterns_signal():
    """
    Checks repetitive templated captions:
    - >= 50% identical captions -> review_recommended.
    - Natural varied text -> normal.
    - Insufficient text sample -> insufficient_data.
    """
    evaluator = AuthenticitySignalEvaluator()

    # Repetitive template spam
    spam_posts = [
        InfluencerPost(id=1, influencer_id=1, platform="ig", external_post_id="1", url="u", caption="Click the bio link for 20% off with promo code SAVE20 now!"),
        InfluencerPost(id=2, influencer_id=1, platform="ig", external_post_id="2", url="u", caption="Click the bio link for 20% off with promo code SAVE20 now!"),
        InfluencerPost(id=3, influencer_id=1, platform="ig", external_post_id="3", url="u", caption="Click the bio link for 20% off with promo code SAVE20 now!"),
        InfluencerPost(id=4, influencer_id=1, platform="ig", external_post_id="4", url="u", caption="Morning coffee thoughts in the city."),
    ]
    sig_spam = evaluator.evaluate_generic_interaction_patterns(spam_posts)
    assert sig_spam.status == "review_recommended"
    assert "identical or templated copies" in sig_spam.evidence_summary

    # Varied captions
    natural_posts = [
        InfluencerPost(id=1, influencer_id=1, platform="ig", external_post_id="1", url="u", caption="Deep dive breakdown of local LLMs running on M-series chips."),
        InfluencerPost(id=2, influencer_id=1, platform="ig", external_post_id="2", url="u", caption="Key takeaways from this weekend's AI developer conference."),
        InfluencerPost(id=3, influencer_id=1, platform="ig", external_post_id="3", url="u", caption="Testing battery life with intensive video encoding workflows."),
    ]
    sig_natural = evaluator.evaluate_generic_interaction_patterns(natural_posts)
    assert sig_natural.status == "normal"


def test_growth_anomalies_requires_multiple_observations():
    """
    CRITICAL PROMPT MANDATE:
    Growth anomalies evaluated ONLY when multiple timestamped observations exist.
    Single point-in-time snapshot must return 'insufficient_data'.
    """
    evaluator = AuthenticitySignalEvaluator()

    # Single snapshot -> strictly insufficient_data
    single_obs = [{"timestamp": "2026-09-01T00:00:00Z", "followers": 25000}]
    sig_single = evaluator.evaluate_growth_anomalies(single_obs)
    assert sig_single.status == "insufficient_data"
    assert "Found 1 observation" in sig_single.evidence_summary
    assert sig_single.is_exclusion_warranted is False

    # Empty list -> insufficient_data
    sig_empty = evaluator.evaluate_growth_anomalies([])
    assert sig_empty.status == "insufficient_data"

    # Multiple observations with organic trajectory -> normal
    multi_organic = [
        {"timestamp": "2026-08-01T00:00:00Z", "followers": 24000},
        {"timestamp": "2026-08-15T00:00:00Z", "followers": 24600},
        {"timestamp": "2026-09-01T00:00:00Z", "followers": 25200},
    ]
    sig_organic = evaluator.evaluate_growth_anomalies(multi_organic)
    assert sig_organic.status == "normal"

    # Multiple observations with unnatural jump (+20k followers in 1 day on 20k account)
    multi_spike = [
        {"timestamp": "2026-09-01T00:00:00Z", "followers": 20000},
        {"timestamp": "2026-09-02T00:00:00Z", "followers": 45000},
    ]
    sig_spike = evaluator.evaluate_growth_anomalies(multi_spike)
    assert sig_spike.status == "review_recommended"
    assert "Unusual growth spike observed" in sig_spike.evidence_summary


# ==============================================================================
# 3. Model Interface & Supervised Stub Verification
# ==============================================================================

def test_deterministic_model_scoring_and_explanation():
    """
    Verifies that the deterministic model generates explainable scores,
    summarizes strengths/cautions, and respects clamping rules.
    """
    model = DeterministicHeuristicAuthenticityModel()
    info = model.get_model_info()
    assert info["model_type"] == "deterministic_heuristic"
    assert info["is_trained"] is False

    # Normal signals produce high score (100.0)
    normal_signals = [
        ReviewSignalOut(signal_key="ratio", display_name="Ratio", status="normal", evidence_summary="Good ratio", context_and_guidance="ok"),
        ReviewSignalOut(signal_key="cadence", display_name="Cadence", status="normal", evidence_summary="Steady", context_and_guidance="ok"),
    ]
    score_normal, strengths, cautions = model.evaluate(normal_signals, {})
    assert score_normal == 100.0
    assert len(strengths) >= 2
    assert len(cautions) == 0

    # Review-recommended signals deduct bounded penalty
    flagged_signals = [
        ReviewSignalOut(signal_key="follower_following_ratio", display_name="Ratio", status="review_recommended", evidence_summary="Skewed", context_and_guidance="Audit"),
        ReviewSignalOut(signal_key="posting_frequency", display_name="Cadence", status="review_recommended", evidence_summary="Dormant", context_and_guidance="Check"),
    ]
    score_flagged, _, cautions_flagged = model.evaluate(flagged_signals, {})
    assert 70.0 <= score_flagged <= 80.0
    assert len(cautions_flagged) == 2


def test_supervised_model_stub_raises_not_implemented():
    """
    Supervised model stub interface must raise NotImplementedError on evaluate,
    clearly identifying that no trained model exists in Phase 13.
    """
    stub = SupervisedAuthenticityClassifierStub()
    info = stub.get_model_info()
    assert info["status"] == "planned_not_implemented"
    assert info["is_trained"] is False
    assert "Phase 13 establishes the model interface contract" in info["status_summary"]

    with pytest.raises(NotImplementedError, match="Supervised authenticity model is not yet trained"):
        stub.evaluate([], {})


def test_catalogs_and_architectural_documentation():
    """Verifies that deterministic heuristics and unimplemented features are documented."""
    assert len(DETERMINISTIC_HEURISTICS_CATALOG) >= 5
    assert len(UNIMPLEMENTED_FEATURES_CATALOG) >= 3

    keys = [h["signal_key"] for h in DETERMINISTIC_HEURISTICS_CATALOG]
    assert "follower_following_ratio" in keys
    assert "posting_frequency" in keys
    assert "engagement_anomalies" in keys
    assert "generic_interaction_patterns" in keys
    assert "growth_anomalies" in keys


# ==============================================================================
# 4. REST API Endpoints & RBAC Integration
# ==============================================================================

@pytest.mark.asyncio
async def test_analytics_endpoints_with_seeded_creator(client: AsyncClient, db_session: AsyncSession):
    """
    Integration test verifying:
    - GET /api/v1/analytics/creator/{id}/engagement
    - GET /api/v1/analytics/creator/{id}/authenticity
    - GET /api/v1/analytics/creator/{id}/full-report
    - GET /api/v1/analytics/model-metadata
    """
    token = await get_auth_token(client, email="analytics.viewer@test.com")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Provision a test creator and posts in DB
    now = datetime.now(timezone.utc)
    creator = CreatorProfile(
        user_id=1,
        handle="@analytics_subject",
        display_name="Subject Creator",
        primary_niche="technology",
        total_followers=40_000,
        following_count=350,
        last_fetched_at=now - timedelta(days=2),
        collaboration_preferences={
            "historical_growth_snapshots": [
                {"timestamp": (now - timedelta(days=30)).isoformat(), "followers": 38000},
                {"timestamp": now.isoformat(), "followers": 40000},
            ]
        },
    )
    db_session.add(creator)
    await db_session.flush()

    posts = [
        InfluencerPost(
            influencer_id=creator.id,
            platform="youtube",
            external_post_id="sub_p1",
            url="https://youtube.com/sub_p1",
            caption="Testing modern AI acceleration workflows on edge hardware.",
            posted_at=now - timedelta(days=5),
            likes_count=1200,
            comments_count=80,
            data_source="synthetic_test",
        ),
        InfluencerPost(
            influencer_id=creator.id,
            platform="youtube",
            external_post_id="sub_p2",
            url="https://youtube.com/sub_p2",
            caption="Comparison of deep learning inference architectures in 2026.",
            posted_at=now - timedelta(days=2),
            likes_count=1600,
            comments_count=120,
            data_source="synthetic_test",
        ),
    ]
    for p in posts:
        db_session.add(p)
    await db_session.commit()

    # 2. Test Engagement Endpoint
    eng_res = await client.get(f"/api/v1/analytics/creator/{creator.id}/engagement", headers=headers)
    assert eng_res.status_code == 200
    eng_data = eng_res.json()
    assert eng_data["handle"] == "@analytics_subject"
    assert eng_data["sample_size_posts"] == 2
    assert eng_data["avg_likes"] == 1400.0
    assert eng_data["avg_comments"] == 100.0
    # ((1400 + 100) / 40000) * 100 = 3.75%
    assert eng_data["calculated_engagement_rate"] == 3.75
    assert eng_data["calculation_status"] == "complete"
    assert eng_data["data_freshness"] == "fresh"

    # 3. Test Authenticity Endpoint
    auth_res = await client.get(f"/api/v1/analytics/creator/{creator.id}/authenticity", headers=headers)
    assert auth_res.status_code == 200
    auth_data = auth_res.json()
    assert auth_data["handle"] == "@analytics_subject"
    assert 80.0 <= auth_data["authenticity_score"] <= 100.0
    assert len(auth_data["signals"]) == 5
    assert "supervised_model_status" in auth_data
    assert "not automatically exclude" in auth_data["disclaimer"]

    # 4. Test Full Report Endpoint
    full_res = await client.get(f"/api/v1/analytics/creator/{creator.id}/full-report", headers=headers)
    assert full_res.status_code == 200
    full_data = full_res.json()
    assert "engagement" in full_data
    assert "authenticity" in full_data
    assert full_data["engagement"]["calculated_engagement_rate"] == 3.75

    # 5. Test Model Metadata Endpoint
    meta_res = await client.get("/api/v1/analytics/model-metadata")
    assert meta_res.status_code == 200
    meta_data = meta_res.json()
    assert "active_baseline_model" in meta_data
    assert "supervised_future_model" in meta_data
    assert len(meta_data["deterministic_heuristics_catalog"]) >= 5
    assert len(meta_data["unimplemented_features_catalog"]) >= 3


@pytest.mark.asyncio
async def test_analytics_endpoints_error_conditions(client: AsyncClient):
    """Verifies 404 on missing creator and 401 on unauthenticated requests."""
    # 1. Unauthenticated -> 401
    unauth_res = await client.get("/api/v1/analytics/creator/999/engagement")
    assert unauth_res.status_code == 401

    # 2. Authenticated but Creator not found -> 404
    token = await get_auth_token(client, email="auth.error.test@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    not_found_res = await client.get("/api/v1/analytics/creator/99999/engagement", headers=headers)
    assert not_found_res.status_code == 404
    assert "not found" in not_found_res.json()["detail"].lower()

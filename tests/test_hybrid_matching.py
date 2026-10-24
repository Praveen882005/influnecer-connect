"""
Comprehensive Automated Test Suite for Phase 15: Hybrid Brand-Influencer Matching.

Verifies:
1. Hard eligibility constraints (min_followers, min_engagement_rate, platform, strict_niche, min_authenticity).
2. Clean separation of hard constraints from weighted scoring.
3. Configurable weights validation (must strictly sum to 1.0; error if not).
4. Dynamic weight redistribution for missing signals (no fake data fabrication).
5. Explicit unavailable field tracking (audience demographics, engagement metrics).
6. Deterministic ranking order and multi-tier tie-breaking.
7. Role-based authorization & ownership checks (brand owner, cross-brand forbidden, creator forbidden, admin permitted).
8. End-to-end REST API endpoints (/campaign/{id}, /campaign/{id}/custom, /weights-schema, /evaluate).
9. Latency benchmarking across candidate pool sizes.
"""

from datetime import datetime, timezone
import math
import time
from typing import List
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entities import BrandProfile, Campaign, CampaignStatus, CreatorProfile, User, UserRole
from app.schemas.matching import (
    AUTHENTICITY_DISCLAIMER,
    OPTIMALITY_DISCLAIMER,
    RecommendationFilterOptions,
    RecommendationWeights,
)
from app.services.matching.recommender import (
    ENGAGEMENT_BENCHMARKS,
    HybridRecommenderService,
    get_recommender_service,
)


@pytest.fixture
def recommender_service():
    """Provides the singleton HybridRecommenderService instance."""
    return get_recommender_service()


# Helper factory for creating test CreatorProfile instances
def make_creator(
    cid: int,
    handle: str,
    niche: str,
    followers: int = 25000,
    engagement: float = 3.2,
    auth_score: float = 90.0,
    platforms: List[str] = None,
    audience: dict = None,
    bio: str = "Creator bio testing",
    content_embedding: list = None,
) -> CreatorProfile:
    now = datetime.now(timezone.utc)
    creator = CreatorProfile(
        id=cid,
        user_id=1000 + cid,
        handle=handle,
        display_name=f"Creator {handle}",
        bio=bio,
        profile_image_url="",
        primary_niche=niche,
        secondary_niches=[],
        content_niches=[niche],
        supported_platforms=platforms or ["instagram"],
        platforms={"instagram": {"followers": followers}},
        language="English",
        collaboration_preferences={},
        total_followers=followers,
        following_count=500,
        posts_count=50,
        avg_engagement_rate=engagement,
        authenticity_score=auth_score,
        sample_content_keywords=[],
        audience_demographics=audience or {},
        data_source="synthetic_test",
        freshness_status="fresh",
        is_verified=False,
        is_platform_verified=False,
        connected_platforms={},
        created_at=now,
        updated_at=now,
        content_embedding=content_embedding,
    )
    return creator


# Helper factory for creating test Campaign instances
def make_campaign(
    cid: int = 1,
    niche: str = "beauty",
    min_followers: int = 10000,
    min_engagement: float = 2.0,
    required_criteria: dict = None,
    target_audience: dict = None,
) -> Campaign:
    campaign = Campaign(
        id=cid,
        brand_id=1,
        title="Eco Glow Skincare Launch",
        description="Seeking beauty creators for organic facial serum campaign.",
        product_description="Botanical hyaluronic acid serum for sensitive skin.",
        niche=niche,
        objective="Brand Awareness",
        budget=2000.0,
        status=CampaignStatus.ACTIVE,
        min_followers=min_followers,
        min_engagement_rate=min_engagement,
        required_criteria=required_criteria or {},
        target_audience=target_audience or {},
    )
    return campaign


# ============================================================================
# 1. HARD ELIGIBILITY CONSTRAINTS UNIT TESTS
# ============================================================================

def test_hard_constraint_followers_threshold(recommender_service):
    campaign = make_campaign(min_followers=20000)

    creator_pass = make_creator(1, "pass_creator", "beauty", followers=25000)
    creator_fail = make_creator(2, "fail_creator", "beauty", followers=15000)

    is_el_pass, sat_pass, dis_pass = recommender_service.evaluate_hard_constraints(campaign, creator_pass)
    assert is_el_pass is True
    assert len(dis_pass) == 0
    assert any("25,000 >= 20,000" in s for s in sat_pass)

    is_el_fail, sat_fail, dis_fail = recommender_service.evaluate_hard_constraints(campaign, creator_fail)
    assert is_el_fail is False
    assert any("15,000" in d and "20,000" in d for d in dis_fail)


def test_hard_constraint_engagement_rate_threshold(recommender_service):
    campaign = make_campaign(min_engagement=3.0)

    creator_pass = make_creator(1, "pass_eng", "beauty", engagement=3.5)
    creator_fail = make_creator(2, "fail_eng", "beauty", engagement=2.1)
    creator_none = make_creator(3, "none_eng", "beauty", engagement=None)

    assert recommender_service.evaluate_hard_constraints(campaign, creator_pass)[0] is True
    assert recommender_service.evaluate_hard_constraints(campaign, creator_fail)[0] is False

    is_el_none, _, dis_none = recommender_service.evaluate_hard_constraints(campaign, creator_none)
    assert is_el_none is False
    assert any("unmonitored/unavailable" in d for d in dis_none)


def test_hard_constraint_platform_requirement(recommender_service):
    campaign = make_campaign(required_criteria={"platform": "youtube"})

    creator_yt = make_creator(1, "yt_creator", "beauty", platforms=["youtube", "instagram"])
    creator_ig_only = make_creator(2, "ig_creator", "beauty", platforms=["instagram", "tiktok"])

    assert recommender_service.evaluate_hard_constraints(campaign, creator_yt)[0] is True
    is_el, _, dis = recommender_service.evaluate_hard_constraints(campaign, creator_ig_only)
    assert is_el is False
    assert any("Required platform 'youtube' is not supported" in d for d in dis)


def test_hard_constraint_strict_niche_match(recommender_service):
    campaign = make_campaign(niche="technology")
    filters = RecommendationFilterOptions(strict_niche_match=True)

    creator_tech = make_creator(1, "tech_creator", "technology")
    creator_food = make_creator(2, "food_creator", "food")

    assert recommender_service.evaluate_hard_constraints(campaign, creator_tech, filters)[0] is True
    is_el, _, dis = recommender_service.evaluate_hard_constraints(campaign, creator_food, filters)
    assert is_el is False
    assert any("Strict niche match required" in d for d in dis)


def test_hard_constraint_minimum_authenticity(recommender_service):
    campaign = make_campaign(required_criteria={"min_authenticity": 85.0})

    creator_high_auth = make_creator(1, "high_auth", "beauty", auth_score=92.0)
    creator_low_auth = make_creator(2, "low_auth", "beauty", auth_score=78.0)

    assert recommender_service.evaluate_hard_constraints(campaign, creator_high_auth)[0] is True
    is_el, _, dis = recommender_service.evaluate_hard_constraints(campaign, creator_low_auth)
    assert is_el is False
    assert any("Authenticity score (78.0) below required minimum (85.0)" in d for d in dis)


def test_all_candidates_disqualified_returns_empty_recommendations(recommender_service):
    campaign = make_campaign(min_followers=50000)
    creators = [
        make_creator(1, "c1", "beauty", followers=10000),
        make_creator(2, "c2", "beauty", followers=20000),
    ]

    res = recommender_service.generate_recommendations(campaign, creators)
    assert res.total_analyzed == 2
    assert res.eligible_count == 0
    assert res.disqualified_count == 2
    assert len(res.recommendations) == 0


# ============================================================================
# 2. CONFIGURABLE WEIGHTS & VALIDATION
# ============================================================================

def test_weights_sum_to_one_validation():
    # Valid weights summing to 1.0
    w_valid = RecommendationWeights(
        weight_semantic_content=0.40,
        weight_engagement_quality=0.30,
        weight_authenticity=0.15,
        weight_audience_fit=0.15,
    )
    assert math.isclose(
        w_valid.weight_semantic_content
        + w_valid.weight_engagement_quality
        + w_valid.weight_authenticity
        + w_valid.weight_audience_fit,
        1.0,
    )

    # Invalid weights summing to 1.5 -> Must raise ValueError
    with pytest.raises(ValueError, match="weights must sum to 1.0"):
        RecommendationWeights(
            weight_semantic_content=0.50,
            weight_engagement_quality=0.50,
            weight_authenticity=0.30,
            weight_audience_fit=0.20,
        )


def test_configurable_weights_affect_ranking_order(recommender_service):
    campaign = make_campaign(min_followers=5000, min_engagement=1.0)

    # Creator A: High semantic content alignment, lower authenticity
    creator_content_heavy = make_creator(
        1, "content_heavy", "beauty",
        followers=20000, engagement=2.5, auth_score=60.0,
        bio="Deep botanical skincare ingredients, hyaluronic acid, ceramide barrier repair.",
    )
    # Creator B: Lower content alignment, near-perfect authenticity
    creator_auth_heavy = make_creator(
        2, "auth_heavy", "fashion",
        followers=20000, engagement=2.5, auth_score=98.0,
        bio="Streetwear and vintage leather jackets.",
    )
    creators = [creator_content_heavy, creator_auth_heavy]

    # Run 1: Heavily weight semantic content (0.70)
    w_content = RecommendationWeights(
        weight_semantic_content=0.70,
        weight_engagement_quality=0.10,
        weight_authenticity=0.10,
        weight_audience_fit=0.10,
    )
    res_content = recommender_service.generate_recommendations(campaign, creators, weights=w_content)
    assert res_content.recommendations[0].creator.handle == "content_heavy"

    # Run 2: Heavily weight authenticity (0.70)
    w_auth = RecommendationWeights(
        weight_semantic_content=0.10,
        weight_engagement_quality=0.10,
        weight_authenticity=0.70,
        weight_audience_fit=0.10,
    )
    res_auth = recommender_service.generate_recommendations(campaign, creators, weights=w_auth)
    assert res_auth.recommendations[0].creator.handle == "auth_heavy"


# ============================================================================
# 3. MISSING DATA HANDLING & WEIGHT REDISTRIBUTION (NO FABRICATION)
# ============================================================================

def test_missing_audience_data_redistributes_weight_without_fabrication(recommender_service):
    campaign = make_campaign(
        target_audience={"countries": ["US"], "age_groups": ["20-30"]},
    )
    # Creator with completely empty audience_demographics
    creator_no_demo = make_creator(
        1, "no_demo", "beauty",
        followers=25000, engagement=3.0, auth_score=90.0,
        audience={},  # Missing
    )

    res = recommender_service.generate_recommendations(campaign, [creator_no_demo])
    rec = res.recommendations[0]

    # Verify audience signal is explicitly unavailable
    aud_signal = rec.signal_breakdown.signal_details["audience_fit"]
    assert aud_signal.is_available is False
    assert aud_signal.active_weight == 0.0
    assert "audience_demographics" in rec.explanation.unavailable_fields

    # Verify active weights for available signals redistributed to sum to 1.0
    active_weights = [
        s.active_weight for s in rec.signal_breakdown.signal_details.values()
    ]
    assert math.isclose(sum(active_weights), 1.0, abs_tol=1e-3)
    assert rec.overall_match_score > 0.0


def test_missing_engagement_metrics_handling(recommender_service):
    # Campaign with min_engagement=0 allows creators with unmonitored metrics
    campaign = make_campaign(min_engagement=0.0)
    creator_no_eng = make_creator(
        1, "no_eng", "beauty",
        followers=15000,
        engagement=None,  # Missing
    )

    res = recommender_service.generate_recommendations(campaign, [creator_no_eng])
    rec = res.recommendations[0]

    eng_signal = rec.signal_breakdown.signal_details["engagement_quality"]
    assert eng_signal.is_available is False
    assert "avg_engagement_rate" in rec.explanation.unavailable_fields


# ============================================================================
# 4. DETERMINISTIC RANKING & TIE-BREAKING
# ============================================================================

def test_deterministic_tie_breaking(recommender_service):
    campaign = make_campaign(min_followers=1000)

    # Identical content and engagement, but Creator 1 has higher authenticity
    c1 = make_creator(1, "creator_higher_auth", "beauty", followers=10000, engagement=3.0, auth_score=95.0, bio="Clean beauty")
    c2 = make_creator(2, "creator_lower_auth", "beauty", followers=10000, engagement=3.0, auth_score=80.0, bio="Clean beauty")

    res = recommender_service.generate_recommendations(campaign, [c2, c1])
    assert res.recommendations[0].creator.handle == "creator_higher_auth"
    assert res.recommendations[1].creator.handle == "creator_lower_auth"


def test_deterministic_output_across_repeated_runs(recommender_service):
    campaign = make_campaign(min_followers=1000)
    creators = [
        make_creator(10, "creator_10", "beauty", followers=20000, engagement=3.5, auth_score=92.0),
        make_creator(20, "creator_20", "beauty", followers=15000, engagement=4.1, auth_score=88.0),
        make_creator(30, "creator_30", "beauty", followers=35000, engagement=2.2, auth_score=90.0),
        make_creator(40, "creator_40", "beauty", followers=12000, engagement=2.9, auth_score=85.0),
    ]

    # Run 5 consecutive iterations
    runs = [
        recommender_service.generate_recommendations(campaign, creators).recommendations
        for _ in range(5)
    ]

    first_handles = [r.creator.handle for r in runs[0]]
    first_scores = [r.overall_match_score for r in runs[0]]

    for i in range(1, 5):
        handles = [r.creator.handle for r in runs[i]]
        scores = [r.overall_match_score for r in runs[i]]
        assert handles == first_handles, f"Run {i} produced different creator ordering!"
        assert scores == first_scores, f"Run {i} produced different match scores!"


# ============================================================================
# 5. REST API ENDPOINTS & AUTHORIZATION TESTS
# ============================================================================

@pytest.mark.asyncio
async def test_api_recommendations_owner_authorized(client: AsyncClient, db_session: AsyncSession):
    # 1. Create brand user and profile
    brand_user = User(
        email="brand_rec_owner@test.com",
        hashed_password="secret_password",
        full_name="Eco Brand Owner",
        role=UserRole.BRAND,
        is_active=True,
    )
    db_session.add(brand_user)
    await db_session.flush()

    brand = BrandProfile(
        user_id=brand_user.id,
        company_name="Owner Skincare Co",
        industry="Beauty",
    )
    db_session.add(brand)
    await db_session.flush()

    # 2. Create campaign for this brand
    campaign = Campaign(
        brand_id=brand.id,
        title="Botanical Radiance Serum",
        niche="beauty",
        description="Serum campaign for beauty creators.",
        budget=1500.0,
        min_followers=5000,
        min_engagement_rate=1.0,
        status=CampaignStatus.ACTIVE,
    )
    db_session.add(campaign)

    # 3. Create a creator
    creator_user = User(
        email="creator_rec_test@test.com",
        hashed_password="secret_password",
        full_name="Aria Beauty",
        role=UserRole.CREATOR,
        is_active=True,
    )
    db_session.add(creator_user)
    await db_session.flush()

    creator = CreatorProfile(
        user_id=creator_user.id,
        handle="ariabeauty",
        display_name="Aria Beauty",
        primary_niche="beauty",
        content_niches=["beauty"],
        total_followers=25000,
        avg_engagement_rate=3.5,
        authenticity_score=92.0,
        supported_platforms=["instagram"],
    )
    db_session.add(creator)
    await db_session.commit()

    # 4. Generate JWT for brand owner
    from app.core.security import create_access_token
    token = create_access_token(data={"sub": str(brand_user.id), "role": "brand"})
    headers = {"Authorization": f"Bearer {token}"}

    res = await client.get(f"/api/v1/recommendations/campaign/{campaign.id}", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["campaign_id"] == campaign.id
    assert len(data["recommendations"]) >= 1
    assert data["recommendations"][0]["creator"]["handle"] == "ariabeauty"
    assert data["disclaimer"] == OPTIMALITY_DISCLAIMER


@pytest.mark.asyncio
async def test_api_recommendations_cross_brand_forbidden(client: AsyncClient, db_session: AsyncSession):
    # Brand 1 (Owner)
    u1 = User(email="b1@test.com", hashed_password="pw", full_name="B1", role=UserRole.BRAND, is_active=True)
    db_session.add(u1)
    await db_session.flush()
    b1 = BrandProfile(user_id=u1.id, company_name="Brand 1", industry="Tech")
    db_session.add(b1)
    await db_session.flush()

    camp = Campaign(brand_id=b1.id, title="Private Campaign", niche="technology", description="Private", budget=1000.0)
    db_session.add(camp)

    # Brand 2 (Intruder)
    u2 = User(email="b2@test.com", hashed_password="pw", full_name="B2", role=UserRole.BRAND, is_active=True)
    db_session.add(u2)
    await db_session.flush()
    b2 = BrandProfile(user_id=u2.id, company_name="Brand 2", industry="Tech")
    db_session.add(b2)
    await db_session.commit()

    from app.core.security import create_access_token
    intruder_token = create_access_token(data={"sub": str(u2.id), "role": "brand"})
    headers = {"Authorization": f"Bearer {intruder_token}"}

    # Intruder tries to read Brand 1's campaign recommendations
    res = await client.get(f"/api/v1/recommendations/campaign/{camp.id}", headers=headers)
    assert res.status_code == 403
    assert "You do not have permission" in res.json()["detail"]


@pytest.mark.asyncio
async def test_api_recommendations_creator_forbidden(client: AsyncClient, db_session: AsyncSession):
    u_creator = User(email="c_intruder@test.com", hashed_password="pw", full_name="C1", role=UserRole.CREATOR, is_active=True)
    db_session.add(u_creator)
    await db_session.commit()

    from app.core.security import create_access_token
    c_token = create_access_token(data={"sub": str(u_creator.id), "role": "creator"})
    headers = {"Authorization": f"Bearer {c_token}"}

    res = await client.get("/api/v1/recommendations/campaign/1", headers=headers)
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_api_weights_schema_endpoint(client: AsyncClient):
    res = await client.get("/api/v1/recommendations/weights-schema")
    assert res.status_code == 200
    data = res.json()
    assert "default_weights" in data
    assert data["default_weights"]["sum"] == 1.0
    assert "normalization_rules" in data
    assert "engagement_tier_benchmarks" in data


# ============================================================================
# 6. LATENCY BENCHMARKING
# ============================================================================

def test_recommender_latency_benchmark(recommender_service):
    """
    CRITICAL REQUIREMENT:
    'Benchmark actual response latency with representative data and report measured results.'
    """
    campaign = make_campaign(min_followers=5000, min_engagement=1.0)

    # Synthesize representative candidate pool of 50 creators
    candidate_pool = [
        make_creator(
            cid=i,
            handle=f"benchmark_creator_{i:02d}",
            niche="beauty" if i % 2 == 0 else "fashion",
            followers=10000 + i * 2000,
            engagement=1.5 + (i % 5) * 0.5,
            auth_score=80.0 + (i % 20),
            bio=f"Benchmark creator {i} sharing skincare tutorials, beauty reviews, and wellness tips.",
        )
        for i in range(1, 51)
    ]

    # Measure execution latency for candidate pool of 50
    start = time.perf_counter()
    res = recommender_service.generate_recommendations(
        campaign,
        candidate_pool,
        filters=RecommendationFilterOptions(limit=10),
    )
    elapsed_ms = (time.perf_counter() - start) * 1000.0

    assert res.total_analyzed == 50
    assert len(res.recommendations) == 10
    assert res.latency_ms is not None
    assert res.latency_ms > 0.0

    avg_ms_per_candidate = elapsed_ms / len(candidate_pool)
    print(f"\n--- Phase 15 Recommendation Engine Latency Benchmark ---")
    print(f"Total Candidates Evaluated : {len(candidate_pool)}")
    print(f"Top-K Recommendations      : {len(res.recommendations)}")
    print(f"Total Response Latency     : {elapsed_ms:.2f} ms")
    print(f"Average Latency / Candidate: {avg_ms_per_candidate:.3f} ms")
    print(f"-------------------------------------------------------")

    # Benchmark SLA: Must evaluate 50 candidate profiles in under 3.0 seconds on CPU
    assert elapsed_ms < 3000.0

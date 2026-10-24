"""
Tests for Phase 6: Influencer Trustworthiness Analysis.

Validates:
1. Evaluation of 5 supported trust indicators:
   - Engagement consistency (with variance / CV calculation).
   - Peer-relative engagement rate comparison by follower tier.
   - Thematic content relevance and coherence.
   - Verified campaign completion history and deliverable punctuality.
   - Data freshness (<=30 days) and profile completeness checklist.
2. Insufficient-evidence handling (sparse posts, missing metrics, new accounts).
3. Non-penalization mandate: Creators with no prior campaigns or missing metrics are not penalized.
4. Separation of trustworthiness from campaign suitability and fraud risk.
5. REST API endpoint GET /api/v1/analytics/creator/{creator_id}/trust.
"""

from datetime import datetime, timedelta, timezone
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token
from app.models.entities import CreatorProfile, InfluencerPost, User, UserRole
from app.services.analytics.trust_service import TrustAnalysisService, trust_analysis_service


def test_engagement_consistency_evaluates_variance_and_sparse_posts():
    """
    Validates engagement consistency calculation:
      - Less than 3 posts yields 'insufficient_evidence' without penalty.
      - Low CV (<=0.45) yields 'consistent'.
      - High CV (>0.95) yields 'variable'.
    """
    # 1. Sparse posts (<3)
    sparse_posts = [
        InfluencerPost(
            id=1,
            influencer_id=1,
            platform="instagram",
            external_post_id="post_1",
            url="https://instagr.am/p/1",
            posted_at=datetime.now(timezone.utc),
            data_source="instagram",
            likes_count=100,
            comments_count=10,
            views_count=1000,
        ),
    ]
    res_sparse = TrustAnalysisService.evaluate_engagement_consistency(sparse_posts)
    assert res_sparse.status == "insufficient_evidence"
    assert res_sparse.is_sufficient_evidence is False
    assert "minimum of 3 posts is required" in res_sparse.explanation.lower()
    assert res_sparse.definition != ""

    # 2. Consistent posts (e.g. 500, 520, 480, 510 interactions)
    steady_posts = [
        InfluencerPost(
            id=i,
            influencer_id=1,
            platform="instagram",
            external_post_id=f"steady_{i}",
            url=f"https://instagr.am/p/{i}",
            posted_at=datetime.now(timezone.utc),
            data_source="instagram",
            likes_count=likes,
            comments_count=50,
            views_count=5000,
        )
        for i, likes in enumerate([450, 470, 430, 460], start=1)
    ]
    res_steady = TrustAnalysisService.evaluate_engagement_consistency(steady_posts)
    assert res_steady.status == "consistent"
    assert res_steady.is_sufficient_evidence is True
    assert "Highly Consistent Engagement" in res_steady.status_label
    assert res_steady.observed_evidence["coefficient_of_variation"] <= 0.45

    # 3. Volatile posts (e.g. 50, 2000, 40 interactions)
    volatile_posts = [
        InfluencerPost(
            id=1,
            influencer_id=1,
            platform="instagram",
            external_post_id="v_1",
            url="https://instagr.am/p/v1",
            posted_at=datetime.now(timezone.utc),
            data_source="instagram",
            likes_count=45,
            comments_count=5,
            views_count=500,
        ),
        InfluencerPost(
            id=2,
            influencer_id=1,
            platform="instagram",
            external_post_id="v_2",
            url="https://instagr.am/p/v2",
            posted_at=datetime.now(timezone.utc),
            data_source="instagram",
            likes_count=1900,
            comments_count=100,
            views_count=20000,
        ),
        InfluencerPost(
            id=3,
            influencer_id=1,
            platform="instagram",
            external_post_id="v_3",
            url="https://instagr.am/p/v3",
            posted_at=datetime.now(timezone.utc),
            data_source="instagram",
            likes_count=35,
            comments_count=5,
            views_count=400,
        ),
    ]
    res_volatile = TrustAnalysisService.evaluate_engagement_consistency(volatile_posts)
    assert res_volatile.status == "variable"
    assert res_volatile.is_sufficient_evidence is True
    assert res_volatile.observed_evidence["coefficient_of_variation"] > 0.95


def test_peer_relative_engagement_compares_follower_tiers():
    """
    Validates engagement rate benchmarking against follower tiers:
      - Micro creator (10k-100k, benchmark 2.5%): 2.8% is healthy alignment.
      - Mid creator (100k-500k, benchmark 1.8%): 0.5% is below peer average.
      - Missing engagement rate yields 'insufficient_evidence'.
    """
    micro = CreatorProfile(
        id=1,
        handle="@micro_creator",
        total_followers=45_000,
        avg_engagement_rate=2.8,  # Close to 2.5% benchmark
    )
    res_micro = TrustAnalysisService.evaluate_peer_relative_engagement(micro)
    assert res_micro.status == "healthy_alignment"
    assert res_micro.is_sufficient_evidence is True
    assert res_micro.observed_evidence["peer_tier"] == "Micro-Creator"
    assert res_micro.observed_evidence["peer_median_er"] == 2.5

    mid_low = CreatorProfile(
        id=2,
        handle="@low_er_mid",
        total_followers=250_000,
        avg_engagement_rate=0.4,  # Below 1.8% benchmark (ratio ~0.22 < 0.6)
    )
    res_low = TrustAnalysisService.evaluate_peer_relative_engagement(mid_low)
    assert res_low.status == "variable"
    assert "Below Peer Average" in res_low.status_label
    assert res_low.is_sufficient_evidence is True

    missing_er = CreatorProfile(
        id=3,
        handle="@no_metrics",
        total_followers=10_000,
        avg_engagement_rate=None,
    )
    res_missing = TrustAnalysisService.evaluate_peer_relative_engagement(missing_er)
    assert res_missing.status == "insufficient_evidence"
    assert res_missing.is_sufficient_evidence is False


def test_campaign_completion_history_non_penalization_mandate():
    """
    Validates Task 6: Zero completed campaigns is identified as 'no_prior_history'
    and marked with is_sufficient_evidence=False so it is NOT penalized as a demerit.
    """
    new_creator = CreatorProfile(
        id=1,
        handle="@newbie",
        past_campaigns_count=0,
        on_time_delivery_rate=None,
        delivery_history=[],
    )
    res_new = TrustAnalysisService.evaluate_campaign_completion_history(new_creator)
    assert res_new.status == "no_prior_history"
    assert res_new.is_sufficient_evidence is False
    assert "NOT treated as a negative penalty" in res_new.explanation

    veteran = CreatorProfile(
        id=2,
        handle="@veteran",
        past_campaigns_count=8,
        on_time_delivery_rate=95.0,
        delivery_history=[{"campaign_title": "Summer Camp", "on_time": True}],
    )
    res_vet = TrustAnalysisService.evaluate_campaign_completion_history(veteran)
    assert res_vet.status == "verified_track_record"
    assert res_vet.is_sufficient_evidence is True
    assert "95.0% on-time" in res_vet.explanation


def test_data_freshness_and_completeness():
    """
    Validates freshness window (30 days threshold) and profile attribute completeness.
    """
    now = datetime(2026, 10, 24, 12, 0, 0, tzinfo=timezone.utc)

    fresh_creator = CreatorProfile(
        id=1,
        handle="@fresh_creator",
        display_name="Fresh Creator",
        bio="Verified wellness content creator sharing honest morning hydration routines.",
        profile_url="https://instagram.com/fresh_creator",
        total_followers=50_000,
        supported_platforms=["instagram", "tiktok"],
        primary_niche="wellness",
        content_categories=["skincare", "fitness"],
        last_fetched_at=now - timedelta(days=5),
        data_source="Instagram Graph API",
        is_verified=True,
    )
    res_fresh = TrustAnalysisService.evaluate_data_freshness_and_completeness(fresh_creator, now=now)
    assert res_fresh.status == "healthy_alignment"
    assert "Verified & Fresh Data" in res_fresh.status_label
    assert res_fresh.is_sufficient_evidence is True

    stale_creator = CreatorProfile(
        id=2,
        handle="@stale_creator",
        display_name="Stale Creator",
        bio="Lifestyle and travel adventures across Europe and North America.",
        profile_url="https://youtube.com/@stale",
        total_followers=80_000,
        supported_platforms=["youtube"],
        primary_niche="travel",
        content_categories=["adventure"],
        last_fetched_at=now - timedelta(days=45),  # 45 days > 30 days
        is_verified=False,
    )
    res_stale = TrustAnalysisService.evaluate_data_freshness_and_completeness(stale_creator, now=now)
    assert res_stale.status == "variable"
    assert "Comprehensive But Stale Metrics" in res_stale.status_label
    assert res_stale.is_sufficient_evidence is True


def test_composite_trust_report_and_insufficient_evidence_state():
    """
    Validates:
      - Creator with < 2 indicators receives overall 'insufficient_evidence' with trust_score = None.
      - Creator with solid evidence receives 'high_confidence' with trust_score (0-100).
      - New creator with 0 completed campaigns is evaluated fairly without penalty.
    """
    now = datetime.now(timezone.utc)

    # 1. Sparse creator (< 2 indicators with evidence)
    empty_creator = CreatorProfile(
        id=1,
        handle="@sparse",
        display_name="Sparse",
        total_followers=0,
        avg_engagement_rate=None,
        bio="",
        past_campaigns_count=0,
        last_fetched_at=None,
    )
    report_sparse = trust_analysis_service.evaluate_creator_trust(empty_creator, posts=[], now=now)
    assert report_sparse.overall_trust_level == "insufficient_evidence"
    assert report_sparse.trust_score is None
    assert len(report_sparse.cautions) > 0

    # 2. Complete, reliable creator
    posts = [
        InfluencerPost(
            id=i,
            influencer_id=2,
            platform="youtube",
            external_post_id=f"yt_{i}",
            url=f"https://youtube.com/watch?v={i}",
            posted_at=now,
            data_source="youtube",
            likes_count=500 + i * 10,
            comments_count=50,
            views_count=5000,
        )
        for i in range(5)
    ]
    strong_creator = CreatorProfile(
        id=2,
        handle="@reliable_creator",
        display_name="Reliable Creator",
        bio="Deep-dive consumer tech hardware reviews, benchmarking, and developer workstation tutorials.",
        profile_url="https://youtube.com/@reliable",
        total_followers=120_000,
        avg_engagement_rate=2.1,
        supported_platforms=["youtube"],
        primary_niche="technology",
        content_categories=["hardware", "computing"],
        past_campaigns_count=5,
        on_time_delivery_rate=100.0,
        last_fetched_at=now - timedelta(days=4),
        data_source="YouTube Analytics API",
        is_verified=True,
    )
    report_strong = trust_analysis_service.evaluate_creator_trust(strong_creator, posts=posts, now=now)
    assert report_strong.overall_trust_level == "high_confidence"
    assert report_strong.trust_score is not None
    assert report_strong.trust_score >= 80.0
    assert report_strong.evidence_coverage_pct == 100.0
    assert len(report_strong.strengths) >= 3
    assert "Trustworthiness Analysis strictly evaluates" in report_strong.distinction_notice


@pytest.mark.asyncio
async def test_creator_trust_analysis_api_endpoint(client: AsyncClient, db_session: AsyncSession):
    """
    Tests GET /api/v1/analytics/creator/{creator_id}/trust endpoint.
    """
    user = User(
        email="brand_trust_test@example.com",
        full_name="Brand Trust Evaluator",
        hashed_password="hash",
        role=UserRole.BRAND,
        is_active=True,
    )
    db_session.add(user)
    await db_session.flush()

    creator = CreatorProfile(
        user_id=user.id,
        handle="@health_guru",
        display_name="Dr. Health Guru",
        bio="Holistic wellness tips, nutrition science, and clean living advice.",
        profile_url="https://instagram.com/health_guru",
        total_followers=65_000,
        avg_engagement_rate=3.1,
        primary_niche="wellness",
        content_categories=["nutrition", "supplements"],
        supported_platforms=["instagram"],
        past_campaigns_count=3,
        on_time_delivery_rate=92.0,
        last_fetched_at=datetime.now(timezone.utc) - timedelta(days=2),
        data_source="Instagram Ingestion Pipeline",
        is_verified=True,
    )
    db_session.add(creator)
    await db_session.commit()

    token = create_access_token({"sub": str(user.id), "role": user.role.value})
    headers = {"Authorization": f"Bearer {token}"}

    res = await client.get(f"/api/v1/analytics/creator/{creator.id}/trust", headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert data["creator_id"] == creator.id
    assert data["handle"] == "@health_guru"
    assert data["overall_trust_level"] in ("high_confidence", "moderate_confidence")
    assert data["trust_score"] is not None
    assert len(data["indicators"]) == 5

    # Check indicator definitions are present
    for ind in data["indicators"]:
        assert ind["definition"] != ""
        assert ind["display_name"] != ""
        assert "observed_evidence" in ind

    assert "Trustworthiness Analysis strictly evaluates" in data["distinction_notice"]
    assert "Brand Bridge does not present automated heuristics as validated predictions" in data["methodology_and_limitations"]

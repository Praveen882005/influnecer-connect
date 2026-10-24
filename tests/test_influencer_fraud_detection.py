"""
Tests for Phase 7: Influencer Fraud-Risk Detection.

Validates:
1. Search input resolution supporting:
   - Creator handle (with and without leading '@')
   - Full profile URL
   - Numeric catalog ID
2. Evidence-based checks:
   - Unusual engagement patterns (like-comment asymmetry, inflated rates, ghost followers).
   - Abnormal interaction patterns (duplicate templated captions, burst posting).
   - Suspicious longitudinal growth curve velocity (requiring >= 2 timestamped snapshots).
   - Inconsistencies in profile or performance data (follow-unfollow churn).
3. Separation of observed facts, calculated indicators, and heuristic warnings.
4. Non-penalization mandate: Sparse growth observations or sparse posts return 'insufficient_evidence'.
5. Transparent supervised ML classifier status disclosure.
6. REST API endpoints POST /api/v1/fraud/search and GET /api/v1/fraud/creator/{id}.
"""

from datetime import datetime, timedelta, timezone
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token
from app.models.entities import CreatorProfile, InfluencerPost, User, UserRole
from app.services.analytics.fraud_service import FraudRiskAnalysisService, fraud_risk_analysis_service


@pytest.mark.asyncio
async def test_search_resolution_supports_handle_url_and_id(db_session: AsyncSession):
    """
    Validates Task 1: Resolves creator using:
      - handle with '@'
      - handle without '@'
      - full profile URL
      - integer catalog ID
    """
    user = User(
        email="searchable_creator@example.com",
        full_name="Searchable Talent",
        hashed_password="hash",
        role=UserRole.CREATOR,
        is_active=True,
    )
    db_session.add(user)
    await db_session.flush()

    creator = CreatorProfile(
        id=105,
        user_id=user.id,
        handle="@searchable_creator",
        display_name="Searchable Talent",
        profile_url="https://instagram.com/searchable_creator",
        primary_niche="technology",
        total_followers=45_000,
        avg_engagement_rate=2.4,
    )
    db_session.add(creator)
    await db_session.commit()

    # 1. Lookup by ID
    c_id = await FraudRiskAnalysisService.resolve_creator("105", db_session)
    assert c_id is not None
    assert c_id.id == 105

    # 2. Lookup by handle with '@'
    c_handle = await FraudRiskAnalysisService.resolve_creator("@searchable_creator", db_session)
    assert c_handle is not None
    assert c_handle.id == 105

    # 3. Lookup by handle without '@'
    c_raw = await FraudRiskAnalysisService.resolve_creator("searchable_creator", db_session)
    assert c_raw is not None
    assert c_raw.id == 105

    # 4. Lookup by URL
    c_url = await FraudRiskAnalysisService.resolve_creator("https://instagram.com/searchable_creator/", db_session)
    assert c_url is not None
    assert c_url.id == 105


def test_fraud_service_distinguishes_facts_indicators_and_warnings():
    """
    Validates Task 4: Separates:
      - Observed Facts (empirical raw numbers)
      - Calculated Indicators (mathematical ratios)
      - Heuristic Warnings (review signals with manual check suggestions)
    """
    now = datetime(2026, 10, 24, 12, 0, 0, tzinfo=timezone.utc)
    creator = CreatorProfile(
        id=1,
        handle="@organic_creator",
        display_name="Organic Creator",
        total_followers=85_000,
        following_count=450,
        avg_engagement_rate=2.6,
        data_source="Instagram Ingestion Pipeline",
    )

    posts = [
        InfluencerPost(
            id=i,
            influencer_id=1,
            platform="instagram",
            external_post_id=f"p_{i}",
            url=f"https://instagram.com/p/{i}",
            posted_at=now - timedelta(days=i * 2),
            data_source="instagram",
            likes_count=2100,
            comments_count=85,
            caption=f"Unique bespoke discussion post number {i} regarding wellness habits and daily water intake.",
        )
        for i in range(1, 5)
    ]

    report = fraud_risk_analysis_service.analyze_creator_fraud_risk(creator, posts, now=now)

    # 1. Observed Facts
    assert len(report.observed_facts) >= 3
    fact_keys = [f.fact_key for f in report.observed_facts]
    assert "follower_count" in fact_keys
    assert "following_count" in fact_keys
    assert "sample_post_history" in fact_keys

    # 2. Calculated Indicators
    assert len(report.calculated_indicators) >= 2
    ind_keys = [ind.indicator_key for ind in report.calculated_indicators]
    assert "like_to_comment_ratio" in ind_keys
    assert "follower_following_ratio" in ind_keys

    # 3. Anomaly Warnings
    assert len(report.anomaly_warnings) >= 3
    for w in report.anomaly_warnings:
        assert w.status in ("normal", "review_recommended", "anomaly_flagged", "insufficient_evidence")
        assert len(w.observed_finding) > 0
        assert len(w.limitations) > 0

    # Organic creator receives low observed risk
    assert report.overall_risk_level == "low_observed_risk"
    assert report.risk_score is not None
    assert report.risk_score < 30.0


def test_fraud_service_flags_unusual_engagement_asymmetry():
    """
    Validates Task 3: Flags severe like-to-comment asymmetry (e.g. 2,500 likes with 0 comments).
    """
    now = datetime.now(timezone.utc)
    suspicious_creator = CreatorProfile(
        id=2,
        handle="@asymmetry_creator",
        display_name="Asymmetry Account",
        total_followers=120_000,
        following_count=300,
        avg_likes=2500,
        avg_comments=0,
    )

    posts = [
        InfluencerPost(
            id=i,
            influencer_id=2,
            platform="instagram",
            external_post_id=f"asym_{i}",
            url=f"https://instagram.com/p/{i}",
            posted_at=now,
            data_source="instagram",
            likes_count=2500,
            comments_count=0,
            caption=f"Caption {i}",
        )
        for i in range(3)
    ]

    report = fraud_risk_analysis_service.analyze_creator_fraud_risk(suspicious_creator, posts, now=now)

    # Must flag like_comment_asymmetry
    asym_warnings = [w for w in report.anomaly_warnings if w.anomaly_key == "like_comment_asymmetry"]
    assert len(asym_warnings) == 1
    assert asym_warnings[0].status == "review_recommended"
    assert "Severe Interaction Asymmetry" in asym_warnings[0].display_name
    assert "2,500 likes" in asym_warnings[0].observed_finding
    assert len(asym_warnings[0].recommended_manual_checks) >= 1

    # Overall risk level elevates to moderate or high
    assert report.overall_risk_level in ("moderate_observed_risk", "high_observed_risk")


def test_fraud_service_evaluates_growth_anomalies_only_with_snapshots():
    """
    Validates Task 3 & Acceptance Criteria:
      - Longitudinal growth curve requires >= 2 timestamped observations.
      - If < 2 observations exist: returns 'insufficient_evidence' without penalty.
      - If sudden single-day surge > 50% exists on established account: flags anomaly.
    """
    now = datetime(2026, 10, 24, 12, 0, 0, tzinfo=timezone.utc)

    # 1. Zero/Sparse snapshots -> Insufficient Evidence (No Penalty)
    sparse_creator = CreatorProfile(
        id=3,
        handle="@no_snapshots",
        total_followers=50_000,
        collaboration_preferences={"historical_growth_snapshots": []},
    )
    report_sparse = fraud_risk_analysis_service.analyze_creator_fraud_risk(sparse_creator, posts=[], now=now)
    growth_sparse = [w for w in report_sparse.anomaly_warnings if w.category == "growth_velocity"][0]
    assert growth_sparse.status == "insufficient_evidence"
    assert "requires multiple timestamped historical snapshots" in growth_sparse.observed_finding

    # 2. Suspicious vertical growth surge (+30,000 in 1 day on a 40k account)
    surge_snaps = [
        {"timestamp": (now - timedelta(days=2)).isoformat(), "followers": 40_000},
        {"timestamp": (now - timedelta(days=1)).isoformat(), "followers": 75_000},  # +35,000 in 1 day (>50% surge)
    ]
    surge_creator = CreatorProfile(
        id=4,
        handle="@surge_creator",
        total_followers=75_000,
        collaboration_preferences={"historical_growth_snapshots": surge_snaps},
    )
    report_surge = fraud_risk_analysis_service.analyze_creator_fraud_risk(surge_creator, posts=[], now=now)
    growth_surge = [w for w in report_surge.anomaly_warnings if w.category == "growth_velocity"][0]
    assert growth_surge.status == "anomaly_flagged"
    assert "Unusual Follower Surge Detected" in growth_surge.status_label


@pytest.mark.asyncio
async def test_fraud_search_api_workflow(client: AsyncClient, db_session: AsyncSession):
    """
    Tests POST /api/v1/fraud/search and GET /api/v1/fraud/creator/{id} endpoints.
    """
    user = User(
        email="brand_fraud_eval@example.com",
        full_name="Brand Risk Manager",
        hashed_password="hash",
        role=UserRole.BRAND,
        is_active=True,
    )
    db_session.add(user)
    await db_session.flush()

    creator = CreatorProfile(
        user_id=user.id,
        handle="@tech_gadget_reviews",
        display_name="Tech Reviews Official",
        profile_url="https://youtube.com/@tech_gadget_reviews",
        primary_niche="technology",
        total_followers=95_000,
        following_count=520,
        avg_engagement_rate=2.2,
        is_verified=True,
    )
    db_session.add(creator)
    await db_session.commit()

    token = create_access_token({"sub": str(user.id), "role": user.role.value})
    headers = {"Authorization": f"Bearer {token}"}

    # Search by handle
    payload = {"query": "@tech_gadget_reviews"}
    res = await client.post("/api/v1/fraud/search", json=payload, headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert data["creator_id"] == creator.id
    assert data["handle"] == "@tech_gadget_reviews"
    assert "overall_risk_level" in data
    assert "observed_facts" in data
    assert "calculated_indicators" in data
    assert "anomaly_warnings" in data
    assert len(data["manual_verification_checklist"]) >= 3
    assert "SUPERVISED_CLASSIFIER_STATUS: Withheld" in data["ml_classifier_status"]
    assert "Brand Bridge strictly prohibits automated account exclusion" in data["disclaimer"]

    # Direct ID endpoint
    get_res = await client.get(f"/api/v1/fraud/creator/{creator.id}", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["creator_id"] == creator.id

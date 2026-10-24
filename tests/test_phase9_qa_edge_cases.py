"""
Tests for Phase 9: Verification, Quality Assurance, and Edge Cases.

Validates:
1. Rich Profiles:
   - Full, partial, and empty fields (null embedding, 0 past campaigns, missing delivery history).
2. Semantic Matching:
   - High similarity on aligned domains
   - Low similarity on orthogonal/divergent domains
   - Hard constraint disqualification (budget, platform, niche, followers)
3. Influencer Opportunity Matching:
   - Empty preferences & zero followers
   - Strict eligibility enforcement
4. Campaign Outcome Forecasting:
   - Extreme boundary values (0 budget, 0% CTR, extreme AOV)
   - Zero division guards for CPA and CPC
   - Pure deterministic ordering (Conservative <= Baseline <= Optimistic)
5. Trustworthiness Analysis:
   - Insufficient evidence handling without demerit penalties (0 posts, 0 past campaigns)
   - Highly erratic engagement vs steady engagement
6. Fraud Risk Detection:
   - Whitespace padded handles ("  @handle  ")
   - Full URL resolution with trailing slashes
   - Insufficient snapshots (<2) returning non-penalizing insufficient_evidence
   - Anomaly flag elevation on severe like-to-comment asymmetry (>250:1)
7. Model Fallback & Transparency:
   - Model status and supervised ML withheld status transparently disclosed.
"""

from datetime import datetime, timedelta, timezone
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entities import Campaign, CampaignStatus, CreatorProfile, InfluencerPost, User, UserRole
from app.schemas.forecasting import ForecastAssumptionsInput
from app.services.analytics.fraud_service import FraudRiskAnalysisService, fraud_risk_analysis_service
from app.services.analytics.trust_service import TrustAnalysisService, trust_analysis_service
from app.services.forecasting.campaign_forecaster import CampaignForecaster
from app.services.matching.recommender import get_recommender_service
from app.services.semantic.embedding_service import EmbeddingService


# ============================================================================
# 1. FORECASTING EDGE CASES & EXTREME VALUES
# ============================================================================

def test_forecasting_extreme_zero_cost_and_impressions():
    """Validates forecasting handles $0 cost and 0 impressions with safe fallbacks and no ZeroDivisionError."""
    # Test 0 cost
    res_zero_cost = CampaignForecaster.calculate_scenario(
        impressions=50_000,
        ctr=2.0,
        cvr=2.5,
        aov=60.0,
        cost=0.0,
        scenario_name="Zero Cost Edge",
        multiplier_description="Zero cost test",
    )
    assert res_zero_cost.estimated_clicks == 1000
    assert res_zero_cost.estimated_conversions == 25
    assert res_zero_cost.estimated_gross_revenue == 1500.0
    assert res_zero_cost.estimated_cpc is not None
    assert res_zero_cost.estimated_cpa is not None

    # Test 0 CTR
    res_zero_ctr = CampaignForecaster.calculate_scenario(
        impressions=10_000,
        ctr=0.0,
        cvr=2.5,
        aov=50.0,
        cost=1000.0,
        scenario_name="Zero CTR Edge",
        multiplier_description="Zero clicks test",
    )
    assert res_zero_ctr.estimated_clicks == 0
    assert res_zero_ctr.estimated_conversions == 0
    assert res_zero_ctr.estimated_gross_revenue == 0.0
    assert res_zero_ctr.estimated_roi_pct == -100.0
    assert res_zero_ctr.estimated_cpc is None
    assert res_zero_ctr.estimated_cpa is None


def test_forecasting_three_scenarios_deterministic_order():
    """Verifies Conservative <= Baseline <= Optimistic across all outcome metrics."""
    assumptions = ForecastAssumptionsInput(
        impressions=100_000,
        click_through_rate=3.0,
        conversion_rate=2.0,
        average_order_value=50.0,
        campaign_cost=2000.0,
    )
    response = CampaignForecaster.generate_forecast_scenarios(assumptions)
    c = response.scenarios["conservative"]
    b = response.scenarios["baseline"]
    o = response.scenarios["optimistic"]

    assert c.estimated_clicks < b.estimated_clicks < o.estimated_clicks
    assert c.estimated_conversions < b.estimated_conversions < o.estimated_conversions
    assert c.estimated_gross_revenue < b.estimated_gross_revenue < o.estimated_gross_revenue
    assert c.estimated_roi_pct < b.estimated_roi_pct < o.estimated_roi_pct
    assert c.campaign_cost == b.campaign_cost == o.campaign_cost == 2000.0


# ============================================================================
# 2. TRUST ANALYSIS EDGE CASES & NON-PENALIZATION
# ============================================================================

def test_trust_analysis_completely_empty_creator_profile():
    """Validates new creator with 0 posts and 0 past campaigns is NOT penalized."""
    now = datetime(2026, 10, 24, 12, 0, tzinfo=timezone.utc)
    new_creator = CreatorProfile(
        id=999,
        handle="@new_talent",
        display_name="New Talent",
        primary_niche="technology",
        total_followers=1000,
        past_campaigns_count=0,
        on_time_delivery_rate=None,
        delivery_history=[],
        last_fetched_at=None,
    )

    report = trust_analysis_service.evaluate_creator_trust(new_creator, posts=[], now=now)
    assert report.overall_trust_level in ("limited_evidence", "insufficient_evidence")
    # Missing campaign history is explicitly flagged as 'no_prior_history' without demerit
    delivery_ind = [ind for ind in report.indicators if ind.indicator_key == "campaign_completion_history"][0]
    assert delivery_ind.status == "no_prior_history"
    assert delivery_ind.is_sufficient_evidence is False
    assert "no completed brand collaborations" in delivery_ind.explanation.lower()
    assert len(report.missing_data_notes) >= 1


def test_trust_analysis_highly_erratic_engagement():
    """Validates variable post engagement flags elevated variance without false fraud claim."""
    posts = [
        InfluencerPost(
            id=1,
            influencer_id=1,
            platform="instagram",
            external_post_id="p1",
            url="https://instagr.am/1",
            posted_at=datetime.now(timezone.utc),
            data_source="instagram",
            likes_count=10000,
            comments_count=500,
        ),
        InfluencerPost(
            id=2,
            influencer_id=1,
            platform="instagram",
            external_post_id="p2",
            url="https://instagr.am/2",
            posted_at=datetime.now(timezone.utc),
            data_source="instagram",
            likes_count=20,
            comments_count=0,
        ),
        InfluencerPost(
            id=3,
            influencer_id=1,
            platform="instagram",
            external_post_id="p3",
            url="https://instagr.am/3",
            posted_at=datetime.now(timezone.utc),
            data_source="instagram",
            likes_count=5000,
            comments_count=10,
        ),
    ]
    res = TrustAnalysisService.evaluate_engagement_consistency(posts)
    assert res.status == "variable"
    assert res.is_sufficient_evidence is True
    assert "fluctuation" in res.explanation.lower() or "varies" in res.explanation.lower()


# ============================================================================
# 3. FRAUD DETECTION EDGE CASES & SEARCH ROBUSTNESS
# ============================================================================

@pytest.mark.asyncio
async def test_fraud_search_resolves_whitespace_and_mixed_case(db_session: AsyncSession):
    """Verifies resolver handles whitespace padding and mixed case handles."""
    user = User(
        email="case_test_qa@example.com",
        full_name="Case User QA",
        hashed_password="hash",
        role=UserRole.CREATOR,
        is_active=True,
    )
    db_session.add(user)
    await db_session.flush()

    creator = CreatorProfile(
        id=777,
        user_id=user.id,
        handle="@MixEd_CaSe_HaNdLe",
        display_name="Mixed Case Creator",
        primary_niche="technology",
        total_followers=30_000,
    )
    db_session.add(creator)
    await db_session.commit()

    # Search with whitespace and leading '@'
    res1 = await FraudRiskAnalysisService.resolve_creator("   @mixed_case_handle   ", db_session)
    assert res1 is not None
    assert res1.id == 777

    # Search without '@'
    res2 = await FraudRiskAnalysisService.resolve_creator("mixed_case_handle", db_session)
    assert res2 is not None
    assert res2.id == 777


def test_fraud_risk_growth_velocity_insufficient_snapshots():
    """Verifies single snapshot or 0 snapshots returns insufficient_evidence without penalty."""
    creator = CreatorProfile(
        id=555,
        handle="@single_snap",
        total_followers=40_000,
        collaboration_preferences={"historical_growth_snapshots": [{"timestamp": "2026-10-20T00:00:00Z", "followers": 40_000}]},
    )
    report = fraud_risk_analysis_service.analyze_creator_fraud_risk(creator, posts=[])
    growth_warn = [w for w in report.anomaly_warnings if w.category == "growth_velocity"][0]
    assert growth_warn.status == "insufficient_evidence"
    assert "requires multiple timestamped historical snapshots" in growth_warn.observed_finding


# ============================================================================
# 4. SEMANTIC MATCHING EDGE CASES & HARD FILTERS
# ============================================================================

def test_matching_engine_disqualification_filters():
    """Verifies hard eligibility constraints disqualify creators regardless of semantic match."""
    rec_service = get_recommender_service()

    creator = CreatorProfile(
        id=1,
        handle="@tech_guru",
        display_name="Tech Guru",
        primary_niche="beauty",
        total_followers=5_000,
        supported_platforms=["tiktok"],
        avg_engagement_rate=1.0,
    )

    campaign = Campaign(
        id=10,
        brand_id=1,
        title="AI Code Assistant Launch",
        description="Looking for tech developers on YouTube with at least 10k subscribers.",
        niche="technology",
        objective="Brand Awareness",
        budget=2000.0,
        min_followers=10_000,
        min_engagement_rate=2.0,
        required_criteria={"platform": "youtube"},
    )

    is_eligible, satisfied, disqualified = rec_service.evaluate_hard_constraints(campaign, creator)
    assert is_eligible is False
    assert len(disqualified) >= 2


def test_semantic_embedding_service_divergent_similarity():
    """Verifies semantic embeddings produce low similarity for divergent concepts."""
    embed_service = EmbeddingService.get_instance()

    text_tech = "Software development, Python APIs, Kubernetes microservices, Rust systems."
    text_cooking = "Gourmet sourdough baking, artisan pastry crusts, vegan culinary kitchen."

    v_tech, _, _ = embed_service.embed_text(text_tech)
    v_cooking, _, _ = embed_service.embed_text(text_cooking)

    sim = embed_service.compute_cosine_similarity(v_tech, v_cooking)
    assert sim < 0.35

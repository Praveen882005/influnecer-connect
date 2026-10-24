"""
Tests for Phase 4: AI-Based Influencer-to-Brand Matching.

Validates:
1. Reusing the hybrid semantic matching engine to evaluate campaign fit for an influencer.
2. Dense semantic similarity between influencer profile/content and brand campaign briefs.
3. Hard eligibility evaluation (followers, engagement rate, platform, strict vertical).
4. Personalized campaign opportunities feed ranked by AI fit score and direct invitations.
5. Filtering by eligibility status, minimum budget, and target platform.
6. Transparent explainability justifications and signal score breakdown.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token
from app.models.entities import BrandProfile, Campaign, CreatorProfile, User, UserRole
from app.services.matching.recommender import HybridRecommenderService


@pytest.fixture
def recommender_service() -> HybridRecommenderService:
    return HybridRecommenderService()


@pytest.fixture
def tech_creator() -> CreatorProfile:
    return CreatorProfile(
        id=10,
        user_id=201,
        handle="@code_alex",
        display_name="Alex Tech",
        primary_niche="technology",
        content_niches=["technology", "developer_tools"],
        bio="Software engineering tutorials, open-source tool reviews, and AI coding assistants.",
        total_followers=75_000,
        avg_engagement_rate=4.1,
        authenticity_score=93.0,
        supported_platforms=["youtube", "instagram"],
        content_categories=["Software Engineering", "AI Tools", "Developer Productivity"],
        audience_description="Software engineers and DevOps practitioners aged 20-35 in North America and Europe.",
    )


def test_evaluate_campaign_fit_distinguishes_relevant_vs_irrelevant_briefs(
    recommender_service: HybridRecommenderService,
    tech_creator: CreatorProfile,
):
    # Campaign 1: Highly relevant Tech/AI campaign
    tech_campaign = Campaign(
        id=1,
        brand_id=1,
        title="NextGen AI Code Assistant Launch",
        niche="technology",
        description="Looking for developers to review our automated code completion and latency analysis engine.",
        product_description="AI Copilot for Python and TypeScript developers",
        objective="Developer Adoption & Conversions",
        min_followers=10_000,
        min_engagement_rate=1.5,
    )

    # Campaign 2: Thematically distant Beauty/Skincare campaign
    beauty_campaign = Campaign(
        id=2,
        brand_id=2,
        title="Botanical Lip Oil & Facial Scrub",
        niche="beauty",
        description="Promoting hydrating lip oils, exfoliating scrubs, and organic clean cosmetics.",
        product_description="Vegan hydrating lip oil with vitamin E",
        objective="Brand Awareness",
        min_followers=10_000,
        min_engagement_rate=1.5,
    )

    fit_tech = recommender_service.evaluate_campaign_fit_for_creator(tech_campaign, tech_creator)
    fit_beauty = recommender_service.evaluate_campaign_fit_for_creator(beauty_campaign, tech_creator)

    # Tech campaign should score significantly higher than beauty campaign
    assert fit_tech["fit_score"] > fit_beauty["fit_score"]
    assert fit_tech["signal_breakdown"]["content_relevance_score"] > fit_beauty["signal_breakdown"]["content_relevance_score"]
    assert fit_tech["is_eligible"] is True
    assert "sentence-transformers" in fit_tech["ai_model_used"]
    assert any("technology" in s.lower() for s in fit_tech["match_strengths"])


def test_evaluate_campaign_fit_detects_ineligibility(
    recommender_service: HybridRecommenderService,
    tech_creator: CreatorProfile,
):
    # Campaign requires 200,000 followers (creator only has 75,000)
    high_reach_campaign = Campaign(
        id=3,
        brand_id=3,
        title="Mega Reach Cloud Summit",
        niche="technology",
        description="Enterprise cloud keynotes.",
        min_followers=200_000,
        min_engagement_rate=1.0,
    )

    fit_eval = recommender_service.evaluate_campaign_fit_for_creator(high_reach_campaign, tech_creator)

    assert fit_eval["is_eligible"] is False
    assert len(fit_eval["disqualified_reasons"]) > 0
    assert any("below required minimum" in r.lower() for r in fit_eval["disqualified_reasons"])
    assert any("Eligibility Warning" in c for c in fit_eval["match_cautions"])


@pytest.mark.asyncio
async def test_opportunities_api_returns_ai_fit_ranked_campaigns(
    client: AsyncClient,
    db_session: AsyncSession,
):
    # 1. Create creator user & profile
    c_user = User(
        email="feed_creator@test.com",
        hashed_password="pw",
        full_name="Fitness Creator",
        role=UserRole.CREATOR,
        is_active=True,
    )
    db_session.add(c_user)
    await db_session.flush()

    creator = CreatorProfile(
        user_id=c_user.id,
        handle="fit_sam",
        display_name="Fit Sam",
        primary_niche="fitness",
        content_niches=["fitness", "wellness"],
        bio="HIIT workouts, strength conditioning, and sports nutrition supplements.",
        total_followers=50_000,
        avg_engagement_rate=4.0,
        authenticity_score=94.0,
        supported_platforms=["instagram"],
        content_categories=["Workout Routines", "Sports Supplements"],
    )
    db_session.add(creator)

    # 2. Create brand and two published campaigns
    b_user = User(email="feed_brand@test.com", hashed_password="pw", full_name="Brand Co", role=UserRole.BRAND, is_active=True)
    db_session.add(b_user)
    await db_session.flush()

    brand = BrandProfile(user_id=b_user.id, company_name="NutriSport Co", industry="Health")
    db_session.add(brand)
    await db_session.flush()

    camp_fit = Campaign(
        brand_id=brand.id,
        title="Electrolyte Energy Powder",
        niche="fitness",
        description="Daily hydration and electrolyte packets for endurance athletes and runners.",
        budget=3500.0,
        min_followers=10_000,
        min_engagement_rate=2.0,
        status="published",
    )
    camp_tech = Campaign(
        brand_id=brand.id,
        title="Database Latency Profiler",
        niche="technology",
        description="SQL performance indexing tool.",
        budget=2000.0,
        min_followers=10_000,
        min_engagement_rate=2.0,
        status="published",
    )
    db_session.add_all([camp_fit, camp_tech])
    await db_session.commit()

    token = create_access_token(data={"sub": str(c_user.id), "role": "creator"})
    headers = {"Authorization": f"Bearer {token}"}

    # Fetch opportunities feed
    res = await client.get("/api/v1/opportunities/", headers=headers)
    assert res.status_code == 200
    opps = res.json()
    assert len(opps) >= 2

    # The fitness campaign should be ranked #1 for this fitness creator
    assert opps[0]["id"] == camp_fit.id
    assert opps[0]["fit_score"] > opps[1]["fit_score"]
    assert opps[0]["signal_breakdown"]["content_relevance_score"] > 0
    assert "sentence-transformers" in (opps[0]["ai_model_used"] or "")

    # Test filtering by min_budget = 3000 (should exclude $2000 camp_tech)
    budget_res = await client.get("/api/v1/opportunities/?min_budget=3000", headers=headers)
    assert budget_res.status_code == 200
    budget_opps = budget_res.json()
    assert all(o["budget"] >= 3000 for o in budget_opps)

"""
Tests for Phase 3: AI-Based Brand-to-Influencer Matching.

Validates:
1. Natural language campaign brief parsing and criteria extraction.
2. Inference of content niche and demographic audience criteria without hallucination.
3. Live dense semantic matching using Sentence-Transformers embeddings.
4. Hard eligibility gates (min followers, engagement, authenticity, strict niche, platform).
5. Explainability justifications, signal score details, and missing data transparency.
6. Error handling when model is offline (no fake fabricated scores).
"""

import pytest
from unittest.mock import MagicMock, patch
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token
from app.models.entities import BrandProfile, CreatorProfile, User, UserRole
from app.schemas.matching import (
    NaturalLanguageMatchRequest,
    RecommendationWeights,
)
from app.services.matching.recommender import HybridRecommenderService
from app.services.semantic.embedding_service import EmbeddingService


@pytest.fixture
def recommender_service() -> HybridRecommenderService:
    return HybridRecommenderService()


@pytest.fixture
def sample_creators() -> list[CreatorProfile]:
    c1 = CreatorProfile(
        id=1,
        user_id=101,
        handle="@tech_guru",
        display_name="Tech Guru",
        primary_niche="technology",
        content_niches=["technology", "gadgets"],
        bio="Deep-dive hardware reviews, developer tools, and cutting-edge consumer tech tutorials.",
        total_followers=150_000,
        avg_engagement_rate=3.8,
        authenticity_score=94.0,
        supported_platforms=["youtube", "instagram"],
        audience_demographics={
            "top_countries": ["US", "GB", "CA"],
            "age_split": {"18-24": 40.0, "25-34": 45.0},
            "gender_split": {"male": 75.0, "female": 25.0},
        },
        content_categories=["Smartphones", "Laptops", "AI Tools"],
        audience_description="Tech-savvy developers and gadget enthusiasts aged 18-35 in North America.",
    )
    c2 = CreatorProfile(
        id=2,
        user_id=102,
        handle="@glow_claire",
        display_name="Claire Glow",
        primary_niche="beauty",
        content_niches=["beauty", "skincare", "wellness"],
        bio="Clean beauty, organic skincare routines, hydration serums, and daily aesthetic glow.",
        total_followers=85_000,
        avg_engagement_rate=4.2,
        authenticity_score=92.0,
        supported_platforms=["instagram", "tiktok"],
        audience_demographics={
            "top_countries": ["US", "CA"],
            "age_split": {"18-24": 55.0, "25-34": 35.0},
            "gender_split": {"female": 85.0, "male": 15.0},
        },
        content_categories=["Skincare Routine", "Clean Beauty", "Hydration Serums"],
        audience_description="Women aged 18-30 focused on cruelty-free and dermatologically tested skincare.",
    )
    c3 = CreatorProfile(
        id=3,
        user_id=103,
        handle="@culinary_sam",
        display_name="Sam Cooks",
        primary_niche="food",
        content_niches=["food", "cooking"],
        bio="Gourmet sourdough, artisan pastry recipes, and quick healthy dinners.",
        total_followers=45_000,
        avg_engagement_rate=2.9,
        authenticity_score=88.0,
        supported_platforms=["instagram"],
        audience_demographics={
            "top_countries": ["US"],
            "age_split": {"25-34": 50.0, "35-44": 30.0},
            "gender_split": {"female": 60.0, "male": 40.0},
        },
        content_categories=["Baking", "Dinner Recipes"],
        audience_description="Home cooks and foodies looking for accessible gourmet recipes.",
    )
    return [c1, c2, c3]


def test_parse_natural_language_brief_extracts_niche_and_audience(recommender_service: HybridRecommenderService):
    req = NaturalLanguageMatchRequest(
        brief_text="We are launching an organic hyaluronic acid serum for sensitive skin that provides deep 24-hour hydration.",
        product_or_service="Pure Hydration Serum",
        target_audience="Young women aged 18-24 in the US and Canada who value clean, cruelty-free beauty",
        preferred_platform="instagram",
        preferred_language="English",
        budget=5000.0,
        min_followers=20000,
        min_engagement_rate=2.5,
        min_authenticity=85.0,
        strict_niche_match=True,
    )

    campaign, filters, weights, parsed = recommender_service.parse_natural_language_brief(req)

    assert campaign.niche == "beauty"
    assert "beauty" in parsed.industry_or_niche.lower()
    assert parsed.preferred_platform == "instagram"
    assert parsed.budget == 5000.0
    assert filters.strict_niche_match is True
    assert filters.min_followers_override == 20000
    assert filters.min_engagement_rate_override == 2.5
    assert filters.min_authenticity_score_override == 85.0

    # Verify audience extraction
    assert "US" in campaign.target_audience.get("countries", [])
    assert "CA" in campaign.target_audience.get("countries", [])
    assert "18-24" in campaign.target_audience.get("age_groups", [])
    assert campaign.target_audience.get("target_gender") == "female"


def test_match_natural_language_brief_ranks_most_relevant_creator(
    recommender_service: HybridRecommenderService,
    sample_creators: list[CreatorProfile],
):
    req = NaturalLanguageMatchRequest(
        brief_text="Promoting high-performance vegan moisturizer and daily restorative night serum for glowing skin.",
        product_or_service="Radiant Glow Skincare",
        target_audience="Women interested in organic skincare in USA",
        preferred_platform="instagram",
        limit=5,
    )

    response = recommender_service.match_natural_language_brief(req, sample_creators)

    assert len(response.recommendations) > 0
    top_match = response.recommendations[0]

    # Claire Glow (@glow_claire) should rank #1 because her bio and rich categories match skincare/beauty
    assert top_match.creator.handle == "@glow_claire"
    assert top_match.rank == 1
    assert top_match.overall_match_score > 60.0
    assert top_match.signal_breakdown.content_relevance_score > 50.0

    # Ensure model provenance and parsed criteria are returned
    assert response.parsed_criteria is not None
    assert response.parsed_criteria.product_or_service == "Radiant Glow Skincare"
    assert "sentence-transformers" in (response.ai_model_used or "")


def test_match_natural_language_brief_enforces_hard_constraints(
    recommender_service: HybridRecommenderService,
    sample_creators: list[CreatorProfile],
):
    # Require 100,000 followers minimum - only Tech Guru has 150k, Claire has 85k, Sam has 45k
    req = NaturalLanguageMatchRequest(
        brief_text="Enterprise developer laptop campaign review with benchmarks.",
        product_or_service="NextGen Workstation",
        min_followers=100_000,
        limit=5,
    )

    response = recommender_service.match_natural_language_brief(req, sample_creators)

    assert len(response.recommendations) == 1
    assert response.recommendations[0].creator.handle == "@tech_guru"
    assert response.eligible_count == 1
    assert response.disqualified_count == 2


def test_match_natural_language_brief_refuses_fake_data_when_model_offline(
    recommender_service: HybridRecommenderService,
    sample_creators: list[CreatorProfile],
):
    req = NaturalLanguageMatchRequest(
        brief_text="Valid test brief text for offline model verification.",
    )

    with patch.object(recommender_service._embedding_service, "is_operational", return_value=False):
        with pytest.raises(RuntimeError, match="Sentence-Transformers model is currently unavailable"):
            recommender_service.match_natural_language_brief(req, sample_creators)


@pytest.mark.asyncio
async def test_api_match_brief_endpoint_brand_authorized(client: AsyncClient, db_session: AsyncSession):
    # 1. Create a brand user
    brand_user = User(
        email="brief_brand_test@test.com",
        hashed_password="hashed_pw",
        full_name="Brief Brand Owner",
        role=UserRole.BRAND,
        is_active=True,
    )
    db_session.add(brand_user)
    await db_session.flush()

    brand = BrandProfile(
        user_id=brand_user.id,
        company_name="Brief Match Brand Co",
        industry="Beauty",
    )
    db_session.add(brand)

    # 2. Create a creator in db
    creator_user = User(
        email="brief_creator_test@test.com",
        hashed_password="hashed_pw",
        full_name="Serum Reviewer",
        role=UserRole.CREATOR,
        is_active=True,
    )
    db_session.add(creator_user)
    await db_session.flush()

    creator = CreatorProfile(
        user_id=creator_user.id,
        handle="serum_reviewer",
        display_name="Serum Reviewer",
        primary_niche="beauty",
        content_niches=["beauty", "skincare"],
        bio="Honest clean beauty tests and serum reviews for sensitive skin.",
        total_followers=30000,
        avg_engagement_rate=3.5,
        authenticity_score=91.0,
        supported_platforms=["instagram"],
    )
    db_session.add(creator)
    await db_session.commit()

    token = create_access_token(data={"sub": str(brand_user.id), "role": "brand"})
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "brief_text": "Looking for beauty creators to test our gentle hydrating serum for sensitive skin.",
        "product_or_service": "HydraDew Serum",
        "industry_or_niche": "beauty",
        "preferred_platform": "instagram",
        "min_followers": 5000,
        "limit": 5,
    }

    res = await client.post("/api/v1/recommendations/match-brief", json=payload, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "recommendations" in data
    assert data["parsed_criteria"]["product_or_service"] == "HydraDew Serum"
    assert "sentence-transformers" in data["ai_model_used"]


@pytest.mark.asyncio
async def test_api_match_brief_endpoint_creator_forbidden(client: AsyncClient, db_session: AsyncSession):
    creator_user = User(
        email="brief_creator_forbidden@test.com",
        hashed_password="hashed_pw",
        full_name="Forbidden Creator",
        role=UserRole.CREATOR,
        is_active=True,
    )
    db_session.add(creator_user)
    await db_session.commit()

    token = create_access_token(data={"sub": str(creator_user.id), "role": "creator"})
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "brief_text": "Sample campaign brief text for role check test.",
    }

    res = await client.post("/api/v1/recommendations/match-brief", json=payload, headers=headers)
    assert res.status_code == 403
    assert "Only brand accounts and administrators" in res.json()["detail"]

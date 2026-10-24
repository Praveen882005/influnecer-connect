"""
Recommendations & AI Brand Fit Matching Endpoints (Phase 15).

Provides:
- GET /recommendations/campaign/{campaign_id}: Deterministic Top-K recommendations for a campaign.
- POST /recommendations/campaign/{campaign_id}/custom: Recommendations with custom configurable weights and filters.
- POST /recommendations/evaluate: Ad-hoc single creator evaluation against campaign brief.
- GET /recommendations/weights-schema: Engine weights schema and normalization rules.
"""

import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.entities import BrandProfile, Campaign, CreatorProfile, User, UserRole
from app.schemas.matching import (
    CreatorRecommendation,
    MatchScoreExplanation,
    MatchSignalBreakdown,
    NaturalLanguageMatchRequest,
    ParsedMatchingCriteria,
    RecommendationFilterOptions,
    RecommendationRequest,
    RecommendationResponse,
    RecommendationWeights,
)
from app.services.matching.recommender import (
    ENGAGEMENT_BENCHMARKS,
    HybridRecommenderService,
    get_recommender_service,
)

router = APIRouter()


async def _authorize_campaign_access(
    campaign: Campaign,
    current_user: User,
    db: AsyncSession,
) -> None:
    """Verifies that the authenticated user is the campaign brand owner or an admin."""
    if current_user.role == UserRole.ADMIN:
        return

    if current_user.role == UserRole.BRAND:
        brand_res = await db.execute(
            select(BrandProfile).where(BrandProfile.user_id == current_user.id)
        )
        brand = brand_res.scalar_one_or_none()
        if not brand or campaign.brand_id != brand.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to view recommendations for this campaign.",
            )
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Only brand owners and administrators can request campaign recommendations.",
    )


@router.get(
    "/campaign/{campaign_id}",
    response_model=RecommendationResponse,
    summary="Get deterministic Top-K creator recommendations for a campaign",
    description=(
        "Executes 9-step hybrid recommendation pipeline applying hard eligibility constraints, "
        "dense 384-dimensional semantic similarity, tier-normalized engagement, authenticity heuristics, "
        "and audience fit with missing-signal weight redistribution."
    ),
)
async def recommend_creators_for_campaign(
    campaign_id: int,
    limit: int = Query(10, ge=1, le=50, description="Top-K recommendations limit"),
    strict_niche: bool = Query(False, description="Whether to require strict niche matching as a hard filter"),
    platform: Optional[str] = Query(None, description="Required platform (e.g. 'instagram')"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    recommender: HybridRecommenderService = Depends(get_recommender_service),
) -> RecommendationResponse:
    # 1. Role-based Guard: Only Brand and Admin users can access recommendation engine
    if current_user.role not in (UserRole.BRAND, UserRole.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only brand owners and administrators can request campaign recommendations.",
        )

    # 2. Fetch Campaign
    c_res = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = c_res.scalar_one_or_none()
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Campaign {campaign_id} not found",
        )

    # 3. Ownership Authorization Check
    await _authorize_campaign_access(campaign, current_user, db)

    # 2. Fetch Creators Candidate Pool
    creators_res = await db.execute(select(CreatorProfile))
    creators = list(creators_res.scalars().all())

    filters = RecommendationFilterOptions(
        limit=limit,
        strict_niche_match=strict_niche,
        required_platform=platform,
    )

    # 3. Execute 9-Step Recommendation Pipeline
    response = recommender.generate_recommendations(
        campaign=campaign,
        creators=creators,
        weights=RecommendationWeights(),
        filters=filters,
    )
    return response


@router.post(
    "/campaign/{campaign_id}/custom",
    response_model=RecommendationResponse,
    summary="Get recommendations with custom configurable weights and filters",
    description="Allows brands to configure scoring weights (must sum to 1.0) and hard eligibility filters.",
)
async def recommend_creators_custom(
    campaign_id: int,
    payload: RecommendationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    recommender: HybridRecommenderService = Depends(get_recommender_service),
) -> RecommendationResponse:
    if current_user.role not in (UserRole.BRAND, UserRole.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only brand owners and administrators can request campaign recommendations.",
        )

    c_res = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = c_res.scalar_one_or_none()
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Campaign {campaign_id} not found",
        )

    await _authorize_campaign_access(campaign, current_user, db)

    creators_res = await db.execute(select(CreatorProfile))
    creators = list(creators_res.scalars().all())

    weights = payload.weights or RecommendationWeights()
    filters = payload.filters or RecommendationFilterOptions()

    response = recommender.generate_recommendations(
        campaign=campaign,
        creators=creators,
        weights=weights,
        filters=filters,
    )
    return response


@router.post(
    "/creator/{creator_id}/fit",
    response_model=CreatorRecommendation,
    summary="Evaluate single creator fit against campaign parameters",
)
@router.post(
    "/evaluate",
    response_model=CreatorRecommendation,
    summary="Ad-hoc single creator evaluation against campaign parameters",
    description="Evaluates a specific creator against custom campaign parameters (backwards-compatible).",
)
async def evaluate_single_fit(
    payload: Dict[str, Any],
    creator_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    recommender: HybridRecommenderService = Depends(get_recommender_service),
) -> CreatorRecommendation:
    if creator_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="creator_id is required",
        )
    c_res = await db.execute(select(CreatorProfile).where(CreatorProfile.id == creator_id))
    creator = c_res.scalar_one_or_none()
    if not creator:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Creator {creator_id} not found",
        )

    # Synthesize ephemeral campaign model
    dummy_campaign = Campaign(
        id=0,
        brand_id=0,
        title=payload.get("title", "Ad-hoc Evaluation"),
        niche=payload.get("niche", creator.primary_niche or "general"),
        description=payload.get("description", ""),
        product_description=payload.get("product_description", ""),
        objective=payload.get("objective", "Brand Awareness"),
        target_audience=payload.get("target_audience", {}),
        min_followers=payload.get("min_followers", 0),
        min_engagement_rate=payload.get("min_engagement_rate", 0.0),
        required_criteria=payload.get("required_criteria", {}),
    )

    response = recommender.generate_recommendations(
        campaign=dummy_campaign,
        creators=[creator],
        weights=RecommendationWeights(),
        filters=RecommendationFilterOptions(limit=1),
    )

    if not response.recommendations:
        # Candidate failed hard constraints
        _, satisfied, disqualified = recommender.evaluate_hard_constraints(dummy_campaign, creator)
        creator_out = CreatorProfileOut.model_validate(creator)
        return CreatorRecommendation(
            creator=creator_out,
            overall_match_score=0.0,
            signal_breakdown=MatchSignalBreakdown(
                content_relevance_score=0.0,
                audience_affinity_score=0.0,
                engagement_quality_score=0.0,
                authenticity_heuristic_score=0.0,
                signals_used=[],
                missing_metrics=disqualified,
            ),
            explanation=MatchScoreExplanation(
                summary="Creator did not satisfy hard eligibility constraints for this campaign brief.",
                strengths=[],
                cautions=disqualified,
                hard_constraints_satisfied=satisfied,
                unavailable_fields=[],
            ),
            rank=1,
        )

    return response.recommendations[0]


@router.post(
    "/match-brief",
    response_model=RecommendationResponse,
    summary="Match influencers from natural-language campaign brief (Phase 3)",
    description=(
        "Converts natural-language campaign brief into structured matching criteria, "
        "computes genuine 384-dimensional dense semantic similarity using Sentence-Transformers, "
        "applies hard eligibility constraints, evaluates engagement, authenticity, and audience fit, "
        "and returns ranked influencers with explainability and missing data warnings."
    ),
)
async def match_creators_from_brief(
    payload: NaturalLanguageMatchRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    recommender: HybridRecommenderService = Depends(get_recommender_service),
) -> RecommendationResponse:
    # 1. Role Guard: Only Brand and Admin users can access AI brief matching
    if current_user.role not in (UserRole.BRAND, UserRole.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only brand accounts and administrators can request AI influencer matching.",
        )

    # 2. Verify AI Service Availability (No fake substitutions if model is offline)
    if not recommender._embedding_service.is_operational():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Sentence-Transformers embedding model 'all-MiniLM-L6-v2' is unavailable. "
                   "AI semantic matching cannot execute without genuine latent vector embeddings.",
        )

    # 3. Fetch Creator Pool
    creators_res = await db.execute(select(CreatorProfile))
    creators = list(creators_res.scalars().all())

    # 4. Execute AI Matching Pipeline
    try:
        response = recommender.match_natural_language_brief(
            request=payload,
            creators=creators,
        )
        return response
    except Exception as e:
        logger.error(f"AI matching pipeline error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI matching pipeline failed: {str(e)}",
        )


@router.get(
    "/weights-schema",
    summary="Get default scoring weights and benchmark metadata",
    description="Returns default weight configuration, tier benchmarks, and explainability rules.",
)
def get_weights_schema() -> Dict[str, Any]:
    default_w = RecommendationWeights()
    return {
        "default_weights": {
            "semantic_content": default_w.weight_semantic_content,
            "engagement_quality": default_w.weight_engagement_quality,
            "authenticity": default_w.weight_authenticity,
            "audience_fit": default_w.weight_audience_fit,
            "sum": 1.0,
        },
        "normalization_rules": {
            "hard_constraints": "Binary gate (pass/fail); creators failing hard constraints are disqualified before weighted scoring.",
            "missing_signals": "Proportional weight redistribution among available signals; no fake data fabrication.",
            "score_scale": "0.0 to 100.0, rounded to 1 decimal place.",
            "tie_breaking": "composite_score DESC, authenticity_score DESC, avg_engagement_rate DESC, creator_id ASC.",
        },
        "engagement_tier_benchmarks": {
            tier: {"min_followers": min_f, "max_followers": max_f, "benchmark_rate_pct": bench}
            for tier, (min_f, max_f, bench) in ENGAGEMENT_BENCHMARKS.items()
        },
    }

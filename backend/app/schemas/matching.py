"""
Pydantic Schemas for Phase 15: Hybrid Brand-Influencer Matching & Explainable Recommendations.

Provides schemas for:
- Configurable scoring weights (must sum to 1.0)
- Hard eligibility filter options
- Signal-level scoring and evidence breakdown
- Explainable match justifications and unavailable field tracking
- Deterministic Top-K ranked recommendation responses
"""

import math
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, model_validator

from app.schemas.creator import CreatorProfileOut


# Canonical Disclaimers
OPTIMALITY_DISCLAIMER = (
    "Recommendations are algorithmic heuristic matches based on available profile signals and prototype proximity; "
    "this does not claim an optimal or exhaustive market search."
)

AUTHENTICITY_DISCLAIMER = (
    "Note: Authenticity score is an algorithmic anomaly heuristic evaluating engagement consistency and ratio distributions, "
    "not definitive proof of fraudulent activity."
)


class RecommendationWeights(BaseModel):
    """
    Configurable scoring weights for hybrid recommendation engine.
    Weights must be non-negative and strictly sum to 1.0.
    """
    weight_semantic_content: float = Field(default=0.35, ge=0.0, le=1.0, description="Weight for semantic content & niche similarity.")
    weight_engagement_quality: float = Field(default=0.25, ge=0.0, le=1.0, description="Weight for follower-tier normalized engagement.")
    weight_authenticity: float = Field(default=0.20, ge=0.0, le=1.0, description="Weight for authenticity audit score and anomaly heuristics.")
    weight_audience_fit: float = Field(default=0.20, ge=0.0, le=1.0, description="Weight for demographic and geographic alignment.")

    @model_validator(mode="after")
    def validate_weights_sum(self) -> "RecommendationWeights":
        total = (
            self.weight_semantic_content
            + self.weight_engagement_quality
            + self.weight_authenticity
            + self.weight_audience_fit
        )
        if not math.isclose(total, 1.0, abs_tol=1e-3):
            raise ValueError(f"Recommendation weights must sum to 1.0 (received {total:.4f}).")
        return self


class RecommendationFilterOptions(BaseModel):
    """Hard eligibility constraints and execution options."""
    strict_niche_match: bool = Field(default=False, description="Require creator primary niche or content niches to match campaign niche.")
    required_platform: Optional[str] = Field(default=None, description="Require creator to support specific platform (e.g. 'instagram').")
    min_followers_override: Optional[int] = Field(default=None, ge=0, description="Override campaign min_followers threshold.")
    min_engagement_rate_override: Optional[float] = Field(default=None, ge=0.0, description="Override campaign min_engagement_rate.")
    min_authenticity_score_override: Optional[float] = Field(default=None, ge=0.0, le=100.0, description="Require minimum authenticity score.")
    limit: int = Field(default=10, ge=1, le=50, description="Top-K recommendations limit.")


class RecommendationRequest(BaseModel):
    """Custom request payload for configurable recommendations."""
    weights: Optional[RecommendationWeights] = None
    filters: Optional[RecommendationFilterOptions] = None


class SignalScoreDetail(BaseModel):
    """Score, evidence, and active weight for a single scoring signal."""
    score: float = Field(..., ge=0.0, le=100.0, description="Normalized signal score on 0-100 scale.")
    raw_value: Optional[Any] = Field(default=None, description="Raw unnormalized signal value (e.g. cosine sim 0.72, engagement 4.5%).")
    configured_weight: float = Field(..., ge=0.0, le=1.0, description="Base weight configured for this signal.")
    active_weight: float = Field(..., ge=0.0, le=1.0, description="Redistributed weight applied after accounting for missing signals.")
    is_available: bool = Field(default=True, description="Whether data was available to evaluate this signal.")
    evidence: List[str] = Field(default_factory=list, description="Explanatory evidence bullets contributing to the score.")


class MatchSignalBreakdown(BaseModel):
    """Backwards-compatible signal breakdown matrix."""
    content_relevance_score: float = Field(..., ge=0, le=100)
    audience_affinity_score: float = Field(..., ge=0, le=100)
    engagement_quality_score: float = Field(..., ge=0, le=100)
    authenticity_heuristic_score: float = Field(..., ge=0, le=100)
    signals_used: List[str] = Field(default_factory=list)
    missing_metrics: List[str] = Field(default_factory=list)
    signal_details: Optional[Dict[str, SignalScoreDetail]] = None


class MatchScoreExplanation(BaseModel):
    """Human-readable explanation of why a creator matched."""
    summary: str
    strengths: List[str] = Field(default_factory=list)
    cautions: List[str] = Field(default_factory=list)
    hard_constraints_satisfied: List[str] = Field(default_factory=list, description="List of hard eligibility constraints passed.")
    unavailable_fields: List[str] = Field(default_factory=list, description="List of important profile fields that were unmonitored or unavailable.")
    authenticity_disclaimer: str = Field(default=AUTHENTICITY_DISCLAIMER)
    optimality_disclaimer: str = Field(default=OPTIMALITY_DISCLAIMER)


class CreatorRecommendation(BaseModel):
    """Single creator recommendation item."""
    creator: CreatorProfileOut
    overall_match_score: float = Field(..., ge=0, le=100)
    signal_breakdown: MatchSignalBreakdown
    explanation: MatchScoreExplanation
    rank: int


class RecommendationResponse(BaseModel):
    """Top-K recommendation response bundle."""
    campaign_id: Optional[int] = None
    brand_id: Optional[int] = None
    total_analyzed: int
    eligible_count: Optional[int] = None
    disqualified_count: Optional[int] = None
    configured_weights: Optional[Dict[str, float]] = None
    latency_ms: Optional[float] = None
    recommendations: List[CreatorRecommendation] = Field(default_factory=list)
    disclaimer: str = Field(default=OPTIMALITY_DISCLAIMER)

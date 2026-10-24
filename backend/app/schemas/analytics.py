from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class EngagementMetricsOut(BaseModel):
    """
    Transparent engagement metrics computation with sample provenance and freshness indicators.
    Formula: ((average likes + average comments) / follower count) * 100.
    """
    creator_id: int
    handle: str
    follower_count: int
    sample_size_posts: int
    sample_start_date: Optional[datetime] = None
    sample_end_date: Optional[datetime] = None
    avg_likes: Optional[float] = None
    avg_comments: Optional[float] = None
    calculated_engagement_rate: Optional[float] = None
    calculation_formula: str = "((avg_likes + avg_comments) / follower_count) * 100"
    calculation_status: str = Field(
        ...,
        description="'complete', 'zero_followers_uncomputable', 'empty_post_history', 'partial_metrics'"
    )
    metrics_availability: Dict[str, bool] = Field(default_factory=dict)
    data_freshness: str = Field(..., description="'fresh' (<=30 days), 'stale' (>30 days), or 'unknown'")
    last_fetched_at: Optional[datetime] = None
    calculated_at: datetime
    notes: List[str] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class ReviewSignalOut(BaseModel):
    """
    Transparent review signal for creator account evaluation.
    Presented as evidence for human consideration, NOT definitive proof of fraud.
    """
    signal_key: str
    display_name: str
    status: str = Field(..., description="'normal', 'review_recommended', 'anomaly_flagged', 'insufficient_data'")
    observed_value: Optional[Any] = None
    benchmark_or_expected: Optional[Any] = None
    evidence_summary: str
    context_and_guidance: str
    is_exclusion_warranted: bool = Field(
        default=False,
        description="Always False: automated systems must not exclude creators on unsupported assumptions."
    )


class AuthenticityReportOut(BaseModel):
    """
    Comprehensive authenticity analysis with multi-signal evidence,
    clear heuristics documentation, and supervised model interface status.
    """
    creator_id: int
    handle: str
    authenticity_score: float = Field(..., ge=0.0, le=100.0)
    model_used: str
    model_type: str = "deterministic_heuristic"
    signals: List[ReviewSignalOut]
    strengths: List[str] = Field(default_factory=list)
    review_notes: List[str] = Field(default_factory=list)
    historical_observations_count: int = 0
    data_provenance: str = "Brand Bridge Ingestion & Engagement Engine"
    calculated_at: datetime
    disclaimer: str = (
        "Signals are review heuristics to assist human marketers, NOT proof of fraud. "
        "Brand Bridge does not automatically exclude creators based on unsupported assumptions."
    )
    supervised_model_status: Dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(from_attributes=True)


class FullAnalyticsReportOut(BaseModel):
    """Unified analytics bundle combining engagement calculations and authenticity review signals."""
    creator_id: int
    handle: str
    engagement: EngagementMetricsOut
    authenticity: AuthenticityReportOut
    generated_at: datetime


class ModelMetadataOut(BaseModel):
    """Architectural documentation detailing active heuristics vs planned/unimplemented supervised models."""
    active_baseline_model: Dict[str, Any]
    supervised_future_model: Dict[str, Any]
    deterministic_heuristics_catalog: List[Dict[str, Any]]
    unimplemented_features_catalog: List[Dict[str, Any]]


# ============================================================================
# PHASE 17: CAMPAIGN ANALYTICS & DASHBOARD SCHEMAS
# ============================================================================

class BrandCampaignSummaryOut(BaseModel):
    campaign_id: int
    title: str
    status: str
    budget: float
    shortlist_count: int
    invitations_sent: int
    invitations_accepted: int
    invitations_declined: int
    acceptance_rate_pct: float


class BrandParticipationFunnelOut(BaseModel):
    stage_1_shortlisted: int
    stage_2_invited: int
    stage_3_viewed: int
    stage_4_responded: int
    stage_5_confirmed: int
    shortlist_to_invite_pct: float
    invite_to_view_pct: float
    view_to_response_pct: float
    response_to_confirm_pct: float


class BrandDailyActivityOut(BaseModel):
    date: str
    shortlists_added: int
    invitations_sent: int
    invitations_accepted: int


class BrandAnalyticsOut(BaseModel):
    brand_id: int
    company_name: str
    total_campaigns: int
    active_campaigns: int
    draft_campaigns: int
    completed_campaigns: int
    total_budget: float
    total_shortlisted: int
    shortlist_by_status: Dict[str, int]
    total_invitations_sent: int
    invitations_accepted: int
    invitations_declined: int
    invitations_pending: int
    invitations_expired: int
    invitations_canceled: int
    response_rate_pct: float
    acceptance_rate_pct: float
    avg_response_time_hours: Optional[float] = None
    total_committed_compensation: float
    funnel: BrandParticipationFunnelOut
    daily_activity: List[BrandDailyActivityOut]
    campaigns_summary: List[BrandCampaignSummaryOut]
    platform_vs_social_disclaimer: str = (
        "Platform activity (invitations, shortlists, responses) is measured from live application events. "
        "Post-campaign reach, conversions, sales attribution and financial ROI require reliable cost and "
        "verified external tracking data and are not estimated in this phase."
    )


class CreatorOpportunitiesAnalyticsOut(BaseModel):
    total_eligible_opportunities: int
    saved_opportunities: int
    dismissed_opportunities: int


class CreatorInvitationsAnalyticsOut(BaseModel):
    total_received: int
    accepted: int
    declined: int
    pending: int
    expired: int
    canceled: int
    response_rate_pct: float
    acceptance_rate_pct: float
    total_earned_compensation: float
    avg_offer_value: float


class CreatorDataFreshnessOut(BaseModel):
    data_source: str
    freshness_status: str
    last_fetched_at: Optional[datetime] = None
    profile_completeness_pct: int
    is_verified: bool
    is_platform_verified: bool


class CreatorRecentActivityOut(BaseModel):
    invitation_id: int
    campaign_title: str
    brand_name: str
    status: str
    compensation_offered: Optional[float] = None
    created_at: datetime
    responded_at: Optional[datetime] = None


class CreatorAnalyticsOut(BaseModel):
    creator_id: int
    handle: str
    display_name: str
    opportunities: CreatorOpportunitiesAnalyticsOut
    invitations: CreatorInvitationsAnalyticsOut
    freshness: CreatorDataFreshnessOut
    recent_activity: List[CreatorRecentActivityOut]
    active_partnerships_count: int
    platform_vs_social_disclaimer: str = (
        "Platform collaboration activity and invitation response history are measured from live internal events. "
        "External social reach, post impressions, and audience sales attribution require platform API verification "
        "and are not claimed without reliable conversion tracking."
    )


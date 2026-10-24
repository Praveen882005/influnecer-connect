from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class ForecastAssumptionsInput(BaseModel):
    """
    Transparent input assumptions for sales outcome scenario modeling.
    Explicitly provided by the user or derived from verified brand historical benchmarks.
    """
    impressions: int = Field(..., ge=1, description="Expected impressions or reach across creators/posts")
    click_through_rate: float = Field(
        ...,
        ge=0.0,
        le=100.0,
        description="Estimated click-through rate percentage (e.g. 2.0 for 2.0%)"
    )
    conversion_rate: float = Field(
        ...,
        ge=0.0,
        le=100.0,
        description="Estimated visitor-to-sale conversion rate percentage (e.g. 2.5 for 2.5%)"
    )
    average_order_value: float = Field(
        ...,
        gt=0.0,
        description="Expected average order value in currency units (e.g. 65.00)"
    )
    campaign_cost: float = Field(
        ...,
        gt=0.0,
        description="Total campaign investment or creator payouts (e.g. 2500.00)"
    )
    forecast_name: Optional[str] = Field("Campaign Sales Forecast", max_length=255)
    notes: Optional[str] = None


class ScenarioProjection(BaseModel):
    """
    Scenario calculation outcome computed using deterministic, audited formulas:
      - Estimated clicks = impressions × (click-through rate / 100)
      - Estimated conversions = clicks × (conversion rate / 100)
      - Estimated gross revenue = conversions × average order value
      - Estimated net profit = gross revenue − campaign cost
      - Estimated ROI = ((gross revenue − campaign cost) / campaign cost) × 100
      - Estimated CPC = campaign cost / clicks
      - Estimated CPA = campaign cost / conversions
    """
    scenario_name: str = Field(..., description="'Conservative', 'Baseline', or 'Optimistic'")
    multiplier_description: str
    impressions: int
    click_through_rate: float
    conversion_rate: float
    average_order_value: float
    campaign_cost: float
    estimated_clicks: int
    estimated_conversions: int
    estimated_gross_revenue: float
    estimated_net_profit: float
    estimated_roi_pct: float
    estimated_cpc: Optional[float] = None
    estimated_cpa: Optional[float] = None


class ForecastCalculationResponse(BaseModel):
    """
    Multi-scenario sales forecast response with explicit formula disclosures,
    confidence parameters, and predictive model eligibility documentation.
    """
    campaign_id: Optional[int] = None
    campaign_title: Optional[str] = None
    source_data_origin: str = Field(
        ...,
        description="'user_assumptions', 'brand_historical', 'creator_audience_blend', or 'platform_benchmark'"
    )
    confidence_level: str = "Indicative Scenario Model (Transparent Heuristics)"
    disclaimer: str = (
        "ESTIMATE / ALGORITHMIC PROJECTION ONLY — NOT A GUARANTEED SALES PROMISE. "
        "Outcome calculations are mathematical projections derived strictly from the specified assumptions. "
        "External factors such as landing page performance, audience fatigue, creative quality, "
        "and algorithmic reach volatility are outside algorithmic guarantees."
    )
    limitations: List[str] = Field(default_factory=list)
    formulas_used: Dict[str, str] = Field(default_factory=dict)
    predictive_model_status: str
    assumptions: ForecastAssumptionsInput
    scenarios: Dict[str, ScenarioProjection]
    actual_comparison: Optional[Dict[str, Any]] = None
    calculated_at: datetime


class CampaignForecastSaveRequest(ForecastAssumptionsInput):
    """Request payload to save a forecast scenario to the database for a campaign."""
    campaign_id: Optional[int] = None
    source_data_origin: str = "user_assumptions"


class CampaignForecastOut(BaseModel):
    """Stored forecast record for audit and evaluation against actuals."""
    id: int
    campaign_id: Optional[int] = None
    brand_id: int
    forecast_name: str
    source_data_origin: str
    impressions: int
    click_through_rate: float
    conversion_rate: float
    average_order_value: float
    campaign_cost: float
    conservative_projection: Dict[str, Any]
    baseline_projection: Dict[str, Any]
    optimistic_projection: Dict[str, Any]
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CampaignActualOutcomeCreate(BaseModel):
    """Payload to log real post-campaign sales and performance metrics."""
    actual_impressions: Optional[int] = Field(None, ge=0)
    actual_clicks: Optional[int] = Field(None, ge=0)
    actual_conversions: Optional[int] = Field(None, ge=0)
    actual_gross_revenue: Optional[float] = Field(None, ge=0.0)
    actual_spend: Optional[float] = Field(None, ge=0.0)
    attribution_provider: Optional[str] = Field("Manual Tracking", max_length=100)
    tracked_period_start: Optional[datetime] = None
    tracked_period_end: Optional[datetime] = None
    notes: Optional[str] = None


class CampaignActualOutcomeUpdate(CampaignActualOutcomeCreate):
    pass


class CampaignActualOutcomeOut(BaseModel):
    """Persisted actual post-campaign outcome."""
    id: int
    campaign_id: int
    brand_id: int
    actual_impressions: Optional[int] = None
    actual_clicks: Optional[int] = None
    actual_conversions: Optional[int] = None
    actual_gross_revenue: Optional[float] = None
    actual_spend: Optional[float] = None
    actual_roi_pct: Optional[float] = None
    actual_ctr_pct: Optional[float] = None
    actual_cvr_pct: Optional[float] = None
    actual_cpc: Optional[float] = None
    actual_cpa: Optional[float] = None
    attribution_provider: str
    tracked_period_start: Optional[datetime] = None
    tracked_period_end: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class HistoricalBenchmarkOut(BaseModel):
    """
    Brand's historical performance benchmark derived from completed campaigns with actuals.
    Also documents why supervised ML predictive models are enabled or withheld.
    """
    tracked_campaigns_count: int
    has_sufficient_data: bool = Field(
        ...,
        description="True if tracked completed campaigns >= 30, justifying supervised regression modeling"
    )
    avg_ctr_pct: Optional[float] = None
    avg_cvr_pct: Optional[float] = None
    avg_aov: Optional[float] = None
    avg_roi_pct: Optional[float] = None
    default_impressions: int = 50000
    default_budget: float = 2500.0
    predictive_model_status: str
    data_source_note: str


class CampaignForecastingBundleOut(BaseModel):
    """Complete campaign forecasting context including benchmarks, saved forecasts, and actuals."""
    campaign_id: int
    campaign_title: str
    campaign_budget: float
    currency: str
    suggested_assumptions: ForecastAssumptionsInput
    forecasts: List[CampaignForecastOut] = Field(default_factory=list)
    actual_outcome: Optional[CampaignActualOutcomeOut] = None
    variance_analysis: Optional[Dict[str, Any]] = None
    historical_benchmark: HistoricalBenchmarkOut

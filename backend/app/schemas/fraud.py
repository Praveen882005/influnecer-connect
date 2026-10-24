from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class FraudSearchRequest(BaseModel):
    """
    Search input payload supporting handle, profile URL, or numeric creator ID.
    """
    query: str = Field(
        ...,
        min_length=1,
        max_length=500,
        description="Creator handle (e.g. '@tech_guru'), full profile URL, or creator ID"
    )
    campaign_id: Optional[int] = Field(None, description="Optional campaign context for relevance checks")


class ObservedFactOut(BaseModel):
    """Empirical observed fact directly from database records without inference."""
    fact_key: str
    label: str
    value: Any
    details: str
    timestamp: Optional[datetime] = None
    source: str = "Verified Application Catalog"

    model_config = ConfigDict(from_attributes=True)


class CalculatedIndicatorOut(BaseModel):
    """Derived mathematical metric computed from observed facts."""
    indicator_key: str
    display_name: str
    formula: str
    observed_value: Any
    benchmark: str
    is_outlier: bool

    model_config = ConfigDict(from_attributes=True)


class AnomalyWarningOut(BaseModel):
    """Evidence-based anomaly review signal for human consideration, NOT proof of fraud."""
    anomaly_key: str
    category: str = Field(..., description="'engagement_anomaly', 'interaction_pattern', 'growth_velocity', 'profile_inconsistency'")
    display_name: str
    status: str = Field(..., description="'normal', 'review_recommended', 'anomaly_flagged', 'insufficient_evidence'")
    status_label: str
    observed_finding: str
    evidence: Dict[str, Any] = Field(default_factory=dict)
    limitations: str
    recommended_manual_checks: List[str] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class FraudAnalysisReportOut(BaseModel):
    """
    Comprehensive influencer fraud-risk and anomaly audit report.
    Presents empirical evidence, calculated ratios, and heuristic warnings
    to assist human marketers without making unsupported accusations.
    """
    creator_id: int
    handle: str
    display_name: Optional[str] = None
    profile_url: Optional[str] = None
    total_followers: int
    avatar_url: Optional[str] = None
    overall_risk_level: str = Field(
        ...,
        description="'low_observed_risk', 'moderate_observed_risk', 'high_observed_risk', 'insufficient_evidence'"
    )
    risk_score: Optional[float] = Field(
        None,
        ge=0.0,
        le=100.0,
        description="Anomaly risk index (0-100). Higher represents higher observed anomaly probability. None if insufficient evidence."
    )
    evidence_coverage_pct: float = Field(
        ...,
        ge=0.0,
        le=100.0,
        description="Percentage of fraud risk indicators with sufficient empirical data."
    )
    observed_facts: List[ObservedFactOut]
    calculated_indicators: List[CalculatedIndicatorOut]
    anomaly_warnings: List[AnomalyWarningOut]
    recommended_actions: List[str] = Field(default_factory=list)
    manual_verification_checklist: List[str] = Field(default_factory=list)
    disclaimer: str = (
        "RISK INDICATOR NOTICE: Signals represent review heuristics to assist human marketers, "
        "NOT definitive proof of fraud. Brand Bridge strictly prohibits automated account exclusion "
        "or labeling creators as fraudsters based solely on algorithmic scores."
    )
    ml_classifier_status: str = (
        "SUPERVISED_CLASSIFIER_STATUS: Withheld. Supervised machine learning classification "
        "requires ground-truth audited fraud outcome datasets to report valid precision, recall, and F1 scores. "
        "Brand Bridge employs transparent multi-signal deterministic heuristics to eliminate synthetic hallucination."
    )
    data_freshness_status: str = "fresh"
    analyzed_at: datetime

    model_config = ConfigDict(from_attributes=True)

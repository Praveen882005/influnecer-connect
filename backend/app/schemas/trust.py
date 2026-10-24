from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class TrustIndicatorOut(BaseModel):
    """
    Transparent, evidence-based trust indicator with documented definitions
    and traceable evidence references.
    """
    indicator_key: str
    display_name: str
    definition: str
    status: str = Field(
        ...,
        description="'verified_track_record', 'healthy_alignment', 'consistent', 'variable', 'insufficient_evidence', 'no_prior_history', 'partial_profile_data'"
    )
    status_label: str
    is_sufficient_evidence: bool = Field(
        ...,
        description="True if enough empirical data existed to evaluate; False if data was missing or inadequate."
    )
    observed_evidence: Dict[str, Any] = Field(default_factory=dict)
    benchmark_or_reference: Optional[Dict[str, Any]] = None
    explanation: str
    context_and_guidance: str

    model_config = ConfigDict(from_attributes=True)


class TrustAnalysisReportOut(BaseModel):
    """
    Comprehensive influencer trustworthiness report.
    Strictly separated from campaign suitability and fraud risk.
    Does not penalize creators for missing indicators.
    """
    creator_id: int
    handle: str
    display_name: str
    overall_trust_level: str = Field(
        ...,
        description="'high_confidence', 'moderate_confidence', 'limited_evidence', 'insufficient_evidence'"
    )
    trust_score: Optional[float] = Field(
        None,
        ge=0.0,
        le=100.0,
        description="Composite score (0-100) calculated ONLY across indicators with sufficient evidence. None if evidence is inadequate."
    )
    evidence_coverage_pct: float = Field(
        ...,
        ge=0.0,
        le=100.0,
        description="Percentage of supported trust indicators (0-100) with sufficient observed evidence."
    )
    indicators: List[TrustIndicatorOut]
    strengths: List[str] = Field(default_factory=list)
    cautions: List[str] = Field(default_factory=list)
    missing_data_notes: List[str] = Field(default_factory=list)
    distinction_notice: str = (
        "Trustworthiness Analysis strictly evaluates professional reliability, past delivery history, "
        "data currency, and engagement consistency. It does NOT evaluate Campaign Suitability "
        "(which depends on audience demographics and creative brief fit) or Fraud Risk "
        "(which inspects bot interaction anomalies)."
    )
    methodology_and_limitations: str = (
        "Indicators are evidence-based review heuristics traceable to live application events and post history. "
        "Brand Bridge does not present automated heuristics as validated predictions of future performance."
    )
    calculated_at: datetime

    model_config = ConfigDict(from_attributes=True)

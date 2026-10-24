from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field, model_validator
from app.models.entities import CampaignStatus

ALLOWED_STATUS_TRANSITIONS: Dict[CampaignStatus, set] = {
    CampaignStatus.DRAFT: {
        CampaignStatus.PUBLISHED,
        CampaignStatus.ACTIVE,
        CampaignStatus.ARCHIVED,
        CampaignStatus.CANCELLED,
    },
    CampaignStatus.PUBLISHED: {
        CampaignStatus.PAUSED,
        CampaignStatus.COMPLETED,
        CampaignStatus.ARCHIVED,
        CampaignStatus.CANCELLED,
    },
    CampaignStatus.ACTIVE: {
        CampaignStatus.PAUSED,
        CampaignStatus.COMPLETED,
        CampaignStatus.ARCHIVED,
        CampaignStatus.CANCELLED,
    },
    CampaignStatus.PAUSED: {
        CampaignStatus.PUBLISHED,
        CampaignStatus.ACTIVE,
        CampaignStatus.COMPLETED,
        CampaignStatus.ARCHIVED,
        CampaignStatus.CANCELLED,
    },
    CampaignStatus.IN_REVIEW: {
        CampaignStatus.PUBLISHED,
        CampaignStatus.ACTIVE,
        CampaignStatus.CANCELLED,
    },
    CampaignStatus.COMPLETED: {
        CampaignStatus.ARCHIVED,
    },
    CampaignStatus.ARCHIVED: set(),  # Terminal state: cannot transition out
    CampaignStatus.CANCELLED: {
        CampaignStatus.ARCHIVED,
    },
}


class CampaignBase(BaseModel):
    title: str = Field(..., min_length=3, max_length=255)
    name: Optional[str] = None
    description: str = Field(..., min_length=10)
    product_description: Optional[str] = ""
    niche: str = Field(..., min_length=2)
    objective: str = Field(default="Brand Awareness", min_length=2)
    target_audience: Dict[str, Any] = Field(default_factory=dict)
    target_location: str = "Global"
    budget: float = Field(..., gt=0, description="Baseline or total campaign budget")
    budget_min: Optional[float] = Field(None, ge=0)
    budget_max: Optional[float] = Field(None, ge=0)
    currency: str = Field(default="USD", max_length=10)
    required_criteria: Dict[str, Any] = Field(default_factory=dict)
    preferred_criteria: Dict[str, Any] = Field(default_factory=dict)
    deliverables: List[str] = Field(default_factory=list)
    min_followers: int = Field(default=0, ge=0)
    min_engagement_rate: float = Field(default=0.0, ge=0.0, le=100.0)
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    deadline: Optional[datetime] = None

    @model_validator(mode="after")
    def validate_campaign_boundaries(self) -> "CampaignBase":
        # Support title alias 'name'
        if self.name and not self.title:
            self.title = self.name

        # Validate budget range
        if self.budget_min is not None and self.budget_max is not None:
            if self.budget_min > self.budget_max:
                raise ValueError("Minimum budget (budget_min) cannot exceed maximum budget (budget_max).")

        # Validate campaign dates
        if self.start_date and self.end_date:
            if self.end_date < self.start_date:
                raise ValueError("Campaign end date cannot be earlier than start date.")

        if self.deadline and self.end_date:
            if self.deadline > self.end_date:
                raise ValueError("Application deadline cannot be after the campaign end date.")

        return self


class CampaignCreate(CampaignBase):
    status: CampaignStatus = CampaignStatus.ACTIVE

    @model_validator(mode="after")
    def validate_creation_dates(self) -> "CampaignCreate":
        # Prevent deadline in the past for new published campaigns
        if self.deadline:
            now = datetime.now(timezone.utc)
            deadline_utc = self.deadline if self.deadline.tzinfo else self.deadline.replace(tzinfo=timezone.utc)
            # Allow up to 5 minutes tolerance for network latency
            if deadline_utc.timestamp() < (now.timestamp() - 300):
                raise ValueError("Application deadline cannot be set to a date in the past.")
        return self


class CampaignUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=255)
    name: Optional[str] = None
    description: Optional[str] = Field(None, min_length=10)
    product_description: Optional[str] = None
    niche: Optional[str] = None
    objective: Optional[str] = None
    target_audience: Optional[Dict[str, Any]] = None
    target_location: Optional[str] = None
    budget: Optional[float] = Field(None, gt=0)
    budget_min: Optional[float] = Field(None, ge=0)
    budget_max: Optional[float] = Field(None, ge=0)
    currency: Optional[str] = None
    required_criteria: Optional[Dict[str, Any]] = None
    preferred_criteria: Optional[Dict[str, Any]] = None
    deliverables: Optional[List[str]] = None
    min_followers: Optional[int] = Field(None, ge=0)
    min_engagement_rate: Optional[float] = Field(None, ge=0.0, le=100.0)
    status: Optional[CampaignStatus] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    deadline: Optional[datetime] = None

    @model_validator(mode="after")
    def validate_update_boundaries(self) -> "CampaignUpdate":
        if self.name and not self.title:
            self.title = self.name
        if self.budget_min is not None and self.budget_max is not None:
            if self.budget_min > self.budget_max:
                raise ValueError("Minimum budget (budget_min) cannot exceed maximum budget (budget_max).")
        if self.start_date and self.end_date:
            if self.end_date < self.start_date:
                raise ValueError("Campaign end date cannot be earlier than start date.")
        return self


class CampaignStatusUpdate(BaseModel):
    status: CampaignStatus


class CampaignOut(CampaignBase):
    id: int
    brand_id: int
    status: CampaignStatus
    created_at: datetime
    updated_at: datetime
    brand_name: Optional[str] = None
    proposal_count: Optional[int] = 0

    model_config = ConfigDict(from_attributes=True)


class PaginatedCampaigns(BaseModel):
    items: List[CampaignOut]
    total: int
    skip: int
    limit: int
    has_more: bool

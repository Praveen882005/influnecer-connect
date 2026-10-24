"""
Pydantic Schemas for Phase 16: Two-Sided Workflow (Shortlists, Invitations, Opportunities, Notifications).
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.creator import CreatorProfileOut


# ============================================================================
# SHORTLIST SCHEMAS
# ============================================================================

SHORTLIST_STATUSES = [
    "considering",
    "contacted",
    "invited",
    "negotiating",
    "confirmed",
    "declined",
    "archived",
]


class ShortlistCreate(BaseModel):
    creator_id: int
    campaign_id: Optional[int] = None
    notes: Optional[str] = ""
    status: Optional[str] = "considering"


class ShortlistUpdate(BaseModel):
    notes: Optional[str] = None
    status: Optional[str] = None


class ShortlistOut(BaseModel):
    id: int
    brand_id: int
    creator_id: int
    campaign_id: Optional[int] = None
    campaign_title: Optional[str] = None
    status: str
    notes: str
    creator: Optional[CreatorProfileOut] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# INVITATION SCHEMAS
# ============================================================================

class InvitationCreate(BaseModel):
    campaign_id: int
    creator_id: int
    message: Optional[str] = "We would love to invite you to collaborate on our upcoming campaign!"
    compensation_offered: Optional[float] = Field(default=None, ge=0.0)
    deliverables_requested: Optional[List[str]] = Field(default_factory=list)
    expires_in_days: Optional[int] = Field(default=14, ge=1, le=90)


class InvitationStatusUpdate(BaseModel):
    status: str = Field(..., description="Target status: 'accepted', 'declined', or 'canceled'")
    decline_reason: Optional[str] = None


class InvitationOut(BaseModel):
    id: int
    campaign_id: int
    campaign_title: str
    brand_id: int
    brand_name: str
    creator_id: int
    creator_name: Optional[str] = None
    creator_handle: Optional[str] = None
    message: str
    status: str
    compensation_offered: Optional[float] = None
    deliverables_requested: List[str] = Field(default_factory=list)
    expires_at: Optional[datetime] = None
    responded_at: Optional[datetime] = None
    decline_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# OPPORTUNITY SCHEMAS (CREATOR VIEW)
# ============================================================================

class CampaignOpportunityOut(BaseModel):
    id: int
    brand_id: int
    brand_name: str
    title: str
    niche: str
    objective: str
    description: str
    product_description: Optional[str] = ""
    budget: float
    currency: str
    target_location: str
    deliverables: List[str] = Field(default_factory=list)
    min_followers: int
    min_engagement_rate: float
    status: str
    created_at: datetime

    # Creator-specific context
    is_saved: bool = False
    is_dismissed: bool = False
    has_invitation: bool = False
    invitation_id: Optional[int] = None
    invitation_status: Optional[str] = None
    fit_score: Optional[float] = None
    fit_summary: Optional[str] = None
    match_strengths: List[str] = Field(default_factory=list)
    match_cautions: List[str] = Field(default_factory=list)
    hard_constraints_satisfied: List[str] = Field(default_factory=list)
    is_eligible: bool = True
    disqualified_reasons: List[str] = Field(default_factory=list)
    signal_breakdown: Optional[Dict[str, float]] = None
    ai_model_used: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class OpportunityInteractionRequest(BaseModel):
    action: str = Field(..., description="'save', 'unsave', 'dismiss', or 'undismiss'")


# ============================================================================
# IN-APP NOTIFICATION SCHEMAS
# ============================================================================

class NotificationOut(BaseModel):
    id: int
    user_id: int
    title: str
    message: str
    notification_type: str
    is_read: bool
    link_url: Optional[str] = None
    data: Dict[str, Any] = Field(default_factory=dict)
    read_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NotificationListResponse(BaseModel):
    unread_count: int
    notifications: List[NotificationOut]
    delivery_provider_disclaimer: str = (
        "Persistent in-app notification delivery active. External SMS and email alerts are disabled without configured provider credentials."
    )

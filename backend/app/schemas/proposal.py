from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field
from app.models.entities import ProposalStatus


class ProposalBase(BaseModel):
    pitch: str = Field(..., min_length=10)
    proposed_rate: float = Field(..., ge=0)
    estimated_delivery_days: int = Field(default=7, ge=1)


class ProposalCreate(ProposalBase):
    campaign_id: int


class ProposalUpdate(BaseModel):
    pitch: Optional[str] = None
    proposed_rate: Optional[float] = None
    estimated_delivery_days: Optional[int] = None
    status: Optional[ProposalStatus] = None
    deliverable_links: Optional[List[str]] = None
    feedback: Optional[str] = None


class ProposalOut(ProposalBase):
    id: int
    campaign_id: int
    creator_id: int
    status: ProposalStatus
    deliverable_links: List[str]
    feedback: str
    created_at: datetime
    updated_at: datetime
    creator_name: Optional[str] = None
    creator_handle: Optional[str] = None
    campaign_title: Optional[str] = None
    brand_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

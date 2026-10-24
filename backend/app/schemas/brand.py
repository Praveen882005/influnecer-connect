from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field, model_validator


class BrandProfileBase(BaseModel):
    company_name: str = Field(..., min_length=2)
    industry: str = Field(..., min_length=2)
    website: Optional[str] = ""
    description: Optional[str] = ""
    logo_url: Optional[str] = ""
    location: Optional[str] = ""
    brand_values: List[str] = Field(default_factory=list)
    target_demographics: Dict[str, Any] = Field(default_factory=dict)


class BrandProfileCreate(BrandProfileBase):
    pass


class BrandProfileUpdate(BaseModel):
    company_name: Optional[str] = None
    companyName: Optional[str] = None
    industry: Optional[str] = None
    website: Optional[str] = None
    description: Optional[str] = None
    logo_url: Optional[str] = None
    logoUrl: Optional[str] = None
    location: Optional[str] = None
    target_region: Optional[str] = None
    targetRegion: Optional[str] = None
    brand_values: Optional[List[str]] = None
    target_demographics: Optional[Dict[str, Any]] = None
    minEngagement: Optional[float] = None
    minAuthenticity: Optional[float] = None

    @model_validator(mode="after")
    def map_camel_case(self) -> "BrandProfileUpdate":
        if self.companyName and not self.company_name:
            self.company_name = self.companyName
        if self.logoUrl and not self.logo_url:
            self.logo_url = self.logoUrl
        if self.targetRegion and not self.location:
            self.location = self.targetRegion
        if not self.target_demographics:
            self.target_demographics = {}
        if self.minEngagement is not None:
            self.target_demographics["min_engagement"] = self.minEngagement
        if self.minAuthenticity is not None:
            self.target_demographics["min_authenticity"] = self.minAuthenticity
        return self


class BrandProfileOut(BrandProfileBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    owner_name: Optional[str] = None
    owner_email: Optional[str] = None
    completeness_score: int = 0
    completeness: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)

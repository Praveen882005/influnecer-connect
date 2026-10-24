from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field, model_validator
from app.models.entities import INITIAL_NICHES


class PlatformConnection(BaseModel):
    connected: bool = False
    verified: bool = False
    handle: Optional[str] = None
    account_id: Optional[str] = None
    verified_at: Optional[datetime] = None


class CreatorProfileBase(BaseModel):
    handle: str = Field(..., min_length=2)
    display_name: str = Field(..., min_length=2)
    bio: Optional[str] = ""
    profile_image_url: Optional[str] = ""
    primary_niche: str
    secondary_niches: List[str] = Field(default_factory=list)
    content_niches: List[str] = Field(default_factory=list)
    supported_platforms: List[str] = Field(default_factory=list)
    platforms: Dict[str, Any] = Field(default_factory=dict)
    language: str = "English"
    collaboration_preferences: Dict[str, Any] = Field(default_factory=dict)

    # Social Performance Metrics
    total_followers: int = 0
    following_count: Optional[int] = None
    posts_count: Optional[int] = None
    avg_engagement_rate: Optional[float] = 0.0
    audience_demographics: Dict[str, Any] = Field(default_factory=dict)
    authenticity_score: float = 90.0
    sample_content_keywords: List[str] = Field(default_factory=list)

    # Rich Influencer Profile (Phase 2)
    profile_url: Optional[str] = None
    audience_description: Optional[str] = None
    avg_likes: Optional[int] = None
    avg_comments: Optional[int] = None
    avg_views: Optional[int] = None
    brand_suitability: Optional[Dict[str, Any]] = Field(default_factory=dict)
    content_categories: Optional[List[str]] = Field(default_factory=list)
    past_campaigns_count: Optional[int] = 0
    on_time_delivery_rate: Optional[float] = None
    delivery_history: Optional[List[Dict[str, Any]]] = Field(default_factory=list)

    # Provenance & Platform Verification Status
    data_source: str = "user_manual"
    last_fetched_at: Optional[datetime] = None
    freshness_status: str = "manual"
    is_verified: bool = False
    is_platform_verified: bool = False
    connected_platforms: Dict[str, Any] = Field(default_factory=dict)


class CreatorProfileCreate(CreatorProfileBase):
    pass


class CreatorProfileUpdate(BaseModel):
    handle: Optional[str] = None
    display_name: Optional[str] = None
    displayName: Optional[str] = None
    bio: Optional[str] = None
    profile_image_url: Optional[str] = None
    profileImageUrl: Optional[str] = None
    primary_niche: Optional[str] = None
    primaryNiche: Optional[str] = None
    secondary_niches: Optional[List[str]] = None
    content_niches: Optional[List[str]] = None
    supported_platforms: Optional[List[str]] = None
    platforms: Optional[Dict[str, Any]] = None
    language: Optional[str] = None
    collaboration_preferences: Optional[Dict[str, Any]] = None
    location: Optional[str] = None

    # Social Metrics
    total_followers: Optional[int] = None
    following_count: Optional[int] = None
    posts_count: Optional[int] = None
    avg_engagement_rate: Optional[float] = None
    audience_demographics: Optional[Dict[str, Any]] = None
    authenticity_score: Optional[float] = None
    sample_content_keywords: Optional[List[str]] = None

    # Rich Influencer Profile (Phase 2)
    profile_url: Optional[str] = None
    profileUrl: Optional[str] = None
    audience_description: Optional[str] = None
    audienceDescription: Optional[str] = None
    avg_likes: Optional[int] = None
    avgLikes: Optional[int] = None
    avg_comments: Optional[int] = None
    avgComments: Optional[int] = None
    avg_views: Optional[int] = None
    avgViews: Optional[int] = None
    brand_suitability: Optional[Dict[str, Any]] = None
    brandSuitability: Optional[Dict[str, Any]] = None
    content_categories: Optional[List[str]] = None
    contentCategories: Optional[List[str]] = None
    past_campaigns_count: Optional[int] = None
    on_time_delivery_rate: Optional[float] = None
    delivery_history: Optional[List[Dict[str, Any]]] = None

    # Media Kit Form Rates (camelCase support from UI)
    rateYoutubeDedicated: Optional[str] = None
    rateYoutubeIntegration: Optional[str] = None
    rateInstagramReel: Optional[str] = None

    @model_validator(mode="after")
    def map_camel_case(self) -> "CreatorProfileUpdate":
        if self.displayName and not self.display_name:
            self.display_name = self.displayName
        if self.profileImageUrl and not self.profile_image_url:
            self.profile_image_url = self.profileImageUrl
        if self.primaryNiche and not self.primary_niche:
            self.primary_niche = self.primaryNiche
        if not self.collaboration_preferences:
            self.collaboration_preferences = {}
        if self.location:
            self.collaboration_preferences["location"] = self.location
        if self.rateYoutubeDedicated:
            self.collaboration_preferences["rate_youtube_dedicated"] = self.rateYoutubeDedicated
        if self.rateYoutubeIntegration:
            self.collaboration_preferences["rate_youtube_integration"] = self.rateYoutubeIntegration
        if self.rateInstagramReel:
            self.collaboration_preferences["rate_instagram_reel"] = self.rateInstagramReel
        if self.profileUrl and not self.profile_url:
            self.profile_url = self.profileUrl
        if self.audienceDescription and not self.audience_description:
            self.audience_description = self.audienceDescription
        if self.avgLikes is not None and self.avg_likes is None:
            self.avg_likes = self.avgLikes
        if self.avgComments is not None and self.avg_comments is None:
            self.avg_comments = self.avgComments
        if self.avgViews is not None and self.avg_views is None:
            self.avg_views = self.avgViews
        if self.brandSuitability and not self.brand_suitability:
            self.brand_suitability = self.brandSuitability
        if self.contentCategories and not self.content_categories:
            self.content_categories = self.contentCategories
        return self


class PlatformVerificationRequest(BaseModel):
    platform: str = Field(..., description="Target platform, e.g. instagram or youtube")
    external_account_handle: str = Field(..., min_length=2)
    verification_code: Optional[str] = None


class CreatorProfileOut(CreatorProfileBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    owner_name: Optional[str] = None
    owner_email: Optional[str] = None
    completeness_score: int = 0
    completeness: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)


class CreatorFilter(BaseModel):
    niche: Optional[str] = None
    min_followers: Optional[int] = None
    max_followers: Optional[int] = None
    min_engagement: Optional[float] = None
    min_authenticity: Optional[float] = None
    platform: Optional[str] = None
    query: Optional[str] = None

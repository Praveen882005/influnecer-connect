from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ProviderProfileData(BaseModel):
    """Normalized creator profile extracted from an external data source or provider."""
    handle: str = Field(..., description="Unique platform handle or username, formatted with @")
    display_name: str
    bio: Optional[str] = ""
    profile_image_url: Optional[str] = ""
    primary_niche: str = "technology"
    secondary_niches: List[str] = Field(default_factory=list)
    content_niches: List[str] = Field(default_factory=list)
    supported_platforms: List[str] = Field(default_factory=list)
    platforms: Dict[str, Any] = Field(default_factory=dict)
    language: str = "English"
    total_followers: int = 0
    following_count: Optional[int] = None
    posts_count: Optional[int] = None
    avg_engagement_rate: float = 0.0
    authenticity_score: float = 90.0
    audience_demographics: Dict[str, Any] = Field(default_factory=dict)
    sample_content_keywords: List[str] = Field(default_factory=list)
    source_identifier: str = Field(..., description="External account or record ID")
    source_type: str = Field(..., description="e.g. synthetic_fixture, csv_upload, provider_api")
    last_fetched_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_platform_verified: bool = False


class ProviderPostData(BaseModel):
    """Normalized social post with provenance tracking and explicit metric availability."""
    platform: str
    external_post_id: str
    url: str
    caption: Optional[str] = ""
    media_type: str = "video"
    posted_at: datetime
    likes_count: Optional[int] = None
    comments_count: Optional[int] = None
    views_count: Optional[int] = None
    shares_count: Optional[int] = None
    engagement_rate: Optional[float] = None
    metrics_availability: Dict[str, bool] = Field(
        default_factory=dict,
        description="Explicit mapping distinguishing reported 0s from unmonitored NULL metrics"
    )
    data_source: str
    last_synced_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class BaseSocialProviderAdapter(ABC):
    """
    Provider-neutral interface for external social platform ingestion.
    Guarantees clean isolation between ingestion logic and specific platform APIs.
    """

    @property
    @abstractmethod
    def provider_id(self) -> str:
        """Machine identifier (e.g. 'instagram_graph_api', 'youtube_data_v3', 'synthetic_sample')."""
        pass

    @property
    @abstractmethod
    def display_name(self) -> str:
        """Human-readable provider label."""
        pass

    @abstractmethod
    def is_enabled(self) -> bool:
        """
        Determines whether this provider adapter is currently operational.
        Live social APIs must return False until full platform approval, permissions,
        and account eligibility are verified.
        """
        pass

    @abstractmethod
    def get_status_summary(self) -> Dict[str, Any]:
        """Provides operational details, current quota, and permission eligibility."""
        pass

    @abstractmethod
    async def fetch_profile(self, handle_or_id: str) -> Optional[ProviderProfileData]:
        """Fetches profile for given handle or platform identifier."""
        pass

    @abstractmethod
    async def fetch_recent_posts(self, handle_or_id: str, limit: int = 10) -> List[ProviderPostData]:
        """Fetches recent posts with explicit unavailable-metric handling."""
        pass


class SyntheticSampleAdapter(BaseSocialProviderAdapter):
    """
    Adapter for local benchmark fixtures and synthetic development datasets.
    Active in development/testing mode for reproducible evaluation.
    """

    @property
    def provider_id(self) -> str:
        return "synthetic_sample"

    @property
    def display_name(self) -> str:
        return "Synthetic Benchmark Fixtures Adapter"

    def is_enabled(self) -> bool:
        return True

    def get_status_summary(self) -> Dict[str, Any]:
        return {
            "provider_id": self.provider_id,
            "display_name": self.display_name,
            "status": "active",
            "is_enabled": True,
            "disclaimer": "Serves synthetic development benchmark datasets clearly labelled as non-live data.",
            "data_provenance": "data/samples/synthetic_creators.json",
        }

    async def fetch_profile(self, handle_or_id: str) -> Optional[ProviderProfileData]:
        clean_handle = handle_or_id if handle_or_id.startswith("@") else f"@{handle_or_id}"
        return ProviderProfileData(
            handle=clean_handle,
            display_name=f"Synthetic Creator ({clean_handle})",
            bio="Synthetic profile generated for automated testing and ingestion verification.",
            primary_niche="technology",
            total_followers=25000,
            avg_engagement_rate=3.5,
            authenticity_score=92.0,
            source_identifier=f"synth_{clean_handle.replace('@', '')}",
            source_type="synthetic_fixture",
            is_platform_verified=False,
        )

    async def fetch_recent_posts(self, handle_or_id: str, limit: int = 10) -> List[ProviderPostData]:
        clean_handle = handle_or_id if handle_or_id.startswith("@") else f"@{handle_or_id}"
        now = datetime.now(timezone.utc)
        return [
            ProviderPostData(
                platform="youtube",
                external_post_id=f"synth_post_{clean_handle}_{i}",
                url=f"https://youtube.com/watch?v=synth_{i}",
                caption=f"Synthetic demonstration video #{i} highlighting developer productivity.",
                media_type="video",
                posted_at=now,
                likes_count=1200 + (i * 100),
                views_count=24000 + (i * 2000),
                comments_count=180 + (i * 15),
                shares_count=None,  # Explicitly unavailable on standard video endpoint
                engagement_rate=4.2,
                metrics_availability={
                    "likes": True,
                    "views": True,
                    "comments": True,
                    "shares": False,  # Explicit NULL
                },
                data_source="synthetic_benchmark",
                last_synced_at=now,
            )
            for i in range(1, min(limit + 1, 4))
        ]


class InstagramGraphApiAdapter(BaseSocialProviderAdapter):
    """
    Provider adapter for official Meta / Instagram Graph API.
    Preserved as a disabled stub until platform permissions, App Review,
    and business verification are finalized.
    """

    @property
    def provider_id(self) -> str:
        return "instagram_graph_api"

    @property
    def display_name(self) -> str:
        return "Instagram Graph API (Official Meta Partner Adapter)"

    def is_enabled(self) -> bool:
        # Strictly disabled until platform verification is satisfied
        return False

    def get_status_summary(self) -> Dict[str, Any]:
        return {
            "provider_id": self.provider_id,
            "display_name": self.display_name,
            "status": "disabled",
            "is_enabled": False,
            "reason": (
                "Live Instagram Graph API integration is disabled pending platform App Review, "
                "business verification, and Page permissions. Brand Bridge does not scrape or bypass restrictions."
            ),
            "required_permissions": [
                "instagram_basic",
                "instagram_manage_insights",
                "pages_read_engagement",
            ],
            "api_version": "v21.0",
        }

    async def fetch_profile(self, handle_or_id: str) -> Optional[ProviderProfileData]:
        raise NotImplementedError(
            "Live Instagram Graph API is currently disabled. Use the CSV/JSON ingestion pipeline or synthetic adapter."
        )

    async def fetch_recent_posts(self, handle_or_id: str, limit: int = 10) -> List[ProviderPostData]:
        raise NotImplementedError(
            "Live Instagram Graph API is currently disabled. Use the CSV/JSON ingestion pipeline or synthetic adapter."
        )


class YouTubeDataApiAdapter(BaseSocialProviderAdapter):
    """
    Provider adapter for Google / YouTube Data API v3.
    Preserved as a disabled stub until production API key quota and OAuth verification are finalized.
    """

    @property
    def provider_id(self) -> str:
        return "youtube_data_api_v3"

    @property
    def display_name(self) -> str:
        return "YouTube Data API v3 (Google Cloud)"

    def is_enabled(self) -> bool:
        return False

    def get_status_summary(self) -> Dict[str, Any]:
        return {
            "provider_id": self.provider_id,
            "display_name": self.display_name,
            "status": "disabled",
            "is_enabled": False,
            "reason": (
                "Live YouTube Data API v3 integration is disabled pending Google Cloud production quota "
                "and OAuth consent audit. Web scraping is strictly prohibited."
            ),
            "required_scopes": ["https://www.googleapis.com/auth/youtube.readonly"],
            "api_version": "v3",
        }

    async def fetch_profile(self, handle_or_id: str) -> Optional[ProviderProfileData]:
        raise NotImplementedError("Live YouTube Data API is currently disabled.")

    async def fetch_recent_posts(self, handle_or_id: str, limit: int = 10) -> List[ProviderPostData]:
        raise NotImplementedError("Live YouTube Data API is currently disabled.")


# Provider registry
PROVIDER_ADAPTERS: Dict[str, BaseSocialProviderAdapter] = {
    "synthetic_sample": SyntheticSampleAdapter(),
    "instagram_graph_api": InstagramGraphApiAdapter(),
    "youtube_data_api_v3": YouTubeDataApiAdapter(),
}

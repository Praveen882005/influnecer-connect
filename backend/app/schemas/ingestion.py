from datetime import datetime, timezone
import re
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from app.models.entities import ImportJobStatus, INITIAL_NICHES


def parse_numeric_followers(val: Any) -> int:
    """Parses follower counts from integer, float, or string representations like '450k', '1.2m'."""
    if val is None or val == "":
        return 0
    if isinstance(val, (int, float)):
        return max(0, int(val))

    s = str(val).strip().lower().replace(",", "")
    if s.endswith("k"):
        try:
            return max(0, int(float(s[:-1]) * 1000))
        except ValueError:
            return 0
    elif s.endswith("m"):
        try:
            return max(0, int(float(s[:-1]) * 1000000))
        except ValueError:
            return 0
    try:
        return max(0, int(float(s)))
    except ValueError:
        return 0


def parse_explicit_metric(val: Any) -> Optional[int]:
    """
    Parses count metrics while strictly distinguishing genuine 0 from missing/unavailable metrics.
    Returns None if missing/empty (which maps to SQL NULL). Never substitutes 0 for missing metrics.
    """
    if val is None:
        return None
    s = str(val).strip()
    if s == "" or s.lower() in ("none", "null", "n/a", "unavailable", "-"):
        return None
    try:
        parsed = int(float(s.replace(",", "")))
        return max(0, parsed)
    except (ValueError, TypeError):
        return None


class RawProfileInput(BaseModel):
    """
    Flexible schema for CSV and JSON raw creator records.
    Normalizes field naming variations across external sources.
    """
    handle: Optional[str] = None
    username: Optional[str] = None
    display_name: Optional[str] = None
    name: Optional[str] = None
    bio: Optional[str] = ""
    profile_image_url: Optional[str] = ""
    primary_niche: Optional[str] = None
    niche: Optional[str] = None
    secondary_niches: Optional[List[str]] = Field(default_factory=list)
    supported_platforms: Optional[List[str]] = Field(default_factory=list)
    platform: Optional[str] = None
    platforms: Optional[Dict[str, Any]] = Field(default_factory=dict)
    language: Optional[str] = "English"
    total_followers: Optional[Any] = None
    followers: Optional[Any] = None
    following_count: Optional[Any] = None
    posts_count: Optional[Any] = None
    avg_engagement_rate: Optional[Any] = None
    engagement_rate: Optional[Any] = None
    authenticity_score: Optional[Any] = None
    audience_demographics: Optional[Dict[str, Any]] = Field(default_factory=dict)
    location: Optional[str] = None
    source_identifier: Optional[str] = None
    source_type: str = "csv_or_json_import"

    @model_validator(mode="after")
    def normalize_profile(self) -> "RawProfileInput":
        # 1. Resolve handle / username
        raw_handle = self.handle or self.username
        if not raw_handle or not str(raw_handle).strip():
            raise ValueError("Handle or username is required for creator profile.")
        clean_handle = str(raw_handle).strip()
        if not clean_handle.startswith("@"):
            clean_handle = f"@{clean_handle}"
        # Validate handle character pattern
        if not re.match(r"^@[a-zA-Z0-9_.-]{2,50}$", clean_handle):
            raise ValueError(f"Invalid handle format: '{clean_handle}'. Must be 2-50 alphanumeric characters.")
        self.handle = clean_handle

        # 2. Resolve display name
        raw_name = self.display_name or self.name or clean_handle.replace("@", "")
        self.display_name = str(raw_name).strip()
        if len(self.display_name) < 2:
            raise ValueError(f"Display name must be at least 2 characters, got '{self.display_name}'.")

        # 3. Resolve niche
        raw_niche = (self.primary_niche or self.niche or "technology").lower().strip()
        self.primary_niche = raw_niche if raw_niche in INITIAL_NICHES else "technology"

        # 4. Normalize follower count
        raw_foll = self.total_followers if self.total_followers is not None else self.followers
        self.total_followers = parse_numeric_followers(raw_foll)

        # 5. Parse engagement rate
        raw_eng = self.avg_engagement_rate if self.avg_engagement_rate is not None else self.engagement_rate
        if raw_eng is not None and str(raw_eng).strip():
            try:
                eng_val = float(str(raw_eng).replace("%", "").strip())
                self.avg_engagement_rate = max(0.0, min(100.0, eng_val))
            except ValueError:
                self.avg_engagement_rate = 0.0
        else:
            self.avg_engagement_rate = 0.0

        # 6. Authenticity score (defaults to 90.0 if omitted)
        if self.authenticity_score is not None and str(self.authenticity_score).strip():
            try:
                self.authenticity_score = max(50.0, min(100.0, float(self.authenticity_score)))
            except ValueError:
                self.authenticity_score = 90.0
        else:
            self.authenticity_score = 90.0

        # 7. Platforms list
        if self.platform and not self.supported_platforms:
            self.supported_platforms = [self.platform.lower().strip()]
        elif not self.supported_platforms:
            self.supported_platforms = ["youtube"]

        return self


class RawPostInput(BaseModel):
    """
    Flexible schema for social post records.
    Strictly distinguishes genuine 0 interaction counts from unavailable metrics.
    """
    influencer_handle: str = Field(..., description="Target creator handle with @")
    platform: str = Field(default="youtube")
    external_post_id: Optional[str] = None
    post_id: Optional[str] = None
    url: Optional[str] = ""
    caption: Optional[str] = ""
    media_type: Optional[str] = "video"
    posted_at: Optional[Any] = None
    likes_count: Optional[Any] = None
    likes: Optional[Any] = None
    comments_count: Optional[Any] = None
    comments: Optional[Any] = None
    views_count: Optional[Any] = None
    views: Optional[Any] = None
    shares_count: Optional[Any] = None
    shares: Optional[Any] = None
    engagement_rate: Optional[Any] = None

    @model_validator(mode="after")
    def normalize_post(self) -> "RawPostInput":
        # Normalize handle
        if not self.influencer_handle:
            raise ValueError("Target influencer handle is required for post record.")
        h = str(self.influencer_handle).strip()
        self.influencer_handle = h if h.startswith("@") else f"@{h}"

        # Resolve external post ID
        ext_id = self.external_post_id or self.post_id
        if not ext_id or not str(ext_id).strip():
            # Derive synthetic external ID if missing
            self.external_post_id = f"post_{self.influencer_handle.replace('@', '')}_{int(datetime.now().timestamp())}"
        else:
            self.external_post_id = str(ext_id).strip()

        # Normalize URL
        if not self.url or not self.url.strip():
            self.url = f"https://{self.platform.lower()}.com/p/{self.external_post_id}"

        return self


class ImportJobOut(BaseModel):
    id: int
    job_type: str
    source_provenance: str
    status: ImportJobStatus
    total_records: int
    processed_records: int
    failed_records: int
    error_summary: List[Dict[str, Any]]
    created_at: datetime
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ImportUploadResponse(BaseModel):
    job_id: int
    status: str
    job_type: str
    total_records: int
    processed_records: int
    failed_records: int
    message: str
    error_summary: List[Dict[str, Any]]
    provenance: str


class ProviderAdapterStatus(BaseModel):
    provider_id: str
    display_name: str
    status: str
    is_enabled: bool
    reason: Optional[str] = None
    disclaimer: Optional[str] = None

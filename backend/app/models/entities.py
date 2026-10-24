import enum
import json
import math
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.types import JSON, TypeDecorator
from sqlalchemy.orm import relationship
from app.core.database import Base


def utcnow() -> datetime:
    """Returns current UTC timestamp with timezone metadata."""
    return datetime.now(timezone.utc)


class ValidatedEmbeddingVector(TypeDecorator):
    """
    SQLAlchemy TypeDecorator enforcing that embedding vectors:
    1. Are structured numerical lists/arrays of finite floats.
    2. Cannot be passed as arbitrary unvalidated strings or unstructured payloads.
    3. Are serialized to portable JSON for universal database dialect compatibility
       (PostgreSQL JSON/JSONB/Text and SQLite Text).
    """

    impl = Text
    cache_ok = True

    def process_bind_param(self, value: Any, dialect: Any) -> Optional[str]:
        if value is None:
            return None

        # Disallow raw strings or bytes - embeddings must not be arbitrary unvalidated strings
        if isinstance(value, (str, bytes)):
            raise ValueError(
                "Embedding vector cannot be stored as an arbitrary unvalidated string. "
                "Provide a structured List[float] of numeric values."
            )

        if not isinstance(value, (list, tuple)):
            raise ValueError(
                f"Embedding vector must be a List[float], received {type(value).__name__}"
            )

        if len(value) == 0:
            raise ValueError("Embedding vector cannot be an empty array.")

        cleaned: List[float] = []
        for idx, item in enumerate(value):
            if isinstance(item, bool) or not isinstance(item, (int, float)):
                raise ValueError(
                    f"Embedding vector element at index {idx} must be a numeric float, "
                    f"got {type(item).__name__}: {item!r}"
                )
            f_val = float(item)
            if not math.isfinite(f_val):
                raise ValueError(
                    f"Embedding vector element at index {idx} must be a finite float (not NaN or Inf)."
                )
            cleaned.append(f_val)

        return json.dumps(cleaned)

    def process_result_value(self, value: Optional[str], dialect: Any) -> Optional[List[float]]:
        if value is None:
            return None
        try:
            parsed = json.loads(value)
            if isinstance(parsed, list):
                return [float(x) for x in parsed]
        except Exception:
            return None
        return None


class UserRole(str, enum.Enum):
    BRAND = "brand"
    CREATOR = "creator"
    ADMIN = "admin"


class CampaignStatus(str, enum.Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ACTIVE = "active"
    PAUSED = "paused"
    IN_REVIEW = "in_review"
    COMPLETED = "completed"
    ARCHIVED = "archived"
    CANCELLED = "cancelled"


class ProposalStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"
    COMPLETED = "completed"


class InvitationStatus(str, enum.Enum):
    PENDING = "pending"
    SENT = "sent"
    VIEWED = "viewed"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    CANCELED = "canceled"
    EXPIRED = "expired"


class ImportJobStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class User(Base):
    """Core authentication, credentials, and account identity model."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.CREATOR, index=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    brand_profile = relationship("BrandProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    creator_profile = relationship("CreatorProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    audit_events = relationship("AuditEvent", back_populates="user")


INITIAL_NICHES = [
    "beauty",
    "food",
    "fitness",
    "fashion",
    "home",
    "technology",
    "parenting",
    "wellness",
]


class BrandProfile(Base):
    """Company and enterprise brand organization profile."""

    __tablename__ = "brand_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    company_name = Column(String(255), nullable=False, index=True)
    logo_url = Column(String(500), default="")
    industry = Column(String(100), nullable=False, index=True)
    website = Column(String(255), default="")
    description = Column(Text, default="")
    location = Column(String(100), default="")
    brand_values = Column(JSON, default=list)  # list of strings
    target_demographics = Column(JSON, default=dict)  # age, location, gender preferences
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    user = relationship("User", back_populates="brand_profile")
    campaigns = relationship("Campaign", back_populates="brand", cascade="all, delete-orphan")
    shortlists = relationship("Shortlist", back_populates="brand", cascade="all, delete-orphan")
    campaign_forecasts = relationship("CampaignForecast", back_populates="brand", cascade="all, delete-orphan")
    campaign_actual_outcomes = relationship("CampaignActualOutcome", back_populates="brand", cascade="all, delete-orphan")

    def calculate_completeness(self) -> Dict[str, Any]:
        """Calculates brand profile completeness score and missing field checklist."""
        checklist = {
            "company_name": bool(self.company_name and self.company_name.strip()),
            "industry": bool(self.industry and self.industry.strip()),
            "website": bool(self.website and self.website.strip()),
            "description": bool(self.description and len(self.description.strip()) >= 15),
            "logo_url": bool(self.logo_url and self.logo_url.strip()),
            "location": bool(self.location and self.location.strip()),
            "brand_values": bool(self.brand_values and len(self.brand_values) > 0),
        }
        completed = sum(1 for v in checklist.values() if v)
        total = len(checklist)
        score = int((completed / total) * 100)
        return {
            "score": score,
            "completed_count": completed,
            "total_count": total,
            "missing_fields": [k for k, v in checklist.items() if not v],
        }


class CreatorProfile(Base):
    """
    Influencer / Creator public portfolio and social platform statistics.
    Available also via the alias InfluencerProfile.
    """

    __tablename__ = "creator_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    handle = Column(String(100), unique=True, index=True, nullable=False)
    display_name = Column(String(255), nullable=False)
    bio = Column(Text, default="")
    profile_image_url = Column(String(500), default="")
    primary_niche = Column(String(100), nullable=False, index=True)
    secondary_niches = Column(JSON, default=list)  # list of strings
    content_niches = Column(JSON, default=list)  # e.g. ["technology", "wellness"]
    supported_platforms = Column(JSON, default=list)  # e.g. ["youtube", "instagram", "tiktok"]
    platforms = Column(JSON, default=dict)  # {"youtube": {"followers": 120000, "avg_views": 45000}, ...}
    language = Column(String(50), default="English")
    collaboration_preferences = Column(JSON, default=dict)  # sponsorship rates, gifting policy, deliverables

    # Follower and interaction metrics (nullable when unimported or private)
    total_followers = Column(Integer, default=0, nullable=False, index=True)
    following_count = Column(Integer, nullable=True)
    posts_count = Column(Integer, nullable=True)
    avg_engagement_rate = Column(Float, default=0.0, nullable=False)
    audience_demographics = Column(JSON, default=dict)  # {"age_split": {...}, "gender_split": {...}}
    authenticity_score = Column(Float, default=90.0, nullable=False)  # 0 to 100
    sample_content_keywords = Column(JSON, default=list)  # topics, keywords, post summaries
    content_embedding = Column(ValidatedEmbeddingVector, nullable=True)  # Structured float array

    # Rich Profile & Performance Extensions (Phase 2)
    profile_url = Column(String(500), nullable=True)
    audience_description = Column(Text, nullable=True)
    avg_likes = Column(Integer, nullable=True)
    avg_comments = Column(Integer, nullable=True)
    avg_views = Column(Integer, nullable=True)
    brand_suitability = Column(JSON, default=dict)  # {"safety_level": "brand_safe", "sponsored_ratio": 0.20, "notes": "..."}
    content_categories = Column(JSON, default=list)  # list of strings e.g. ["Consumer Electronics", "AI Tools"]
    past_campaigns_count = Column(Integer, default=0, nullable=False)
    on_time_delivery_rate = Column(Float, nullable=True)  # percentage e.g. 98.0
    delivery_history = Column(JSON, default=list)  # list of past campaign milestone summaries

    # Provenance, Verification & Data Freshness
    data_source = Column(String(100), default="user_manual", nullable=False)  # "user_manual", "instagram_graph_api", "youtube_v3"
    last_fetched_at = Column(DateTime, nullable=True)
    freshness_status = Column(String(50), default="manual", nullable=False)  # "fresh", "stale", "manual", "syncing"
    is_verified = Column(Boolean, default=False, nullable=False)
    is_platform_verified = Column(Boolean, default=False, nullable=False)
    connected_platforms = Column(JSON, default=dict)  # {"instagram": {"connected": false, "verified": false}, ...}

    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    user = relationship("User", back_populates="creator_profile")
    posts = relationship("InfluencerPost", back_populates="influencer", cascade="all, delete-orphan")
    proposals = relationship("Proposal", back_populates="creator", cascade="all, delete-orphan")
    shortlisted_by = relationship("Shortlist", back_populates="creator", cascade="all, delete-orphan")
    invitations = relationship("Invitation", back_populates="creator", cascade="all, delete-orphan")

    def calculate_completeness(self) -> Dict[str, Any]:
        """Calculates creator profile completeness score and missing field checklist."""
        checklist = {
            "display_name": bool(self.display_name and self.display_name.strip()),
            "handle": bool(self.handle and self.handle.strip()),
            "bio": bool(self.bio and len(self.bio.strip()) >= 15),
            "primary_niche": bool(self.primary_niche and self.primary_niche.strip()),
            "profile_image_url": bool(self.profile_image_url and self.profile_image_url.strip()),
            "content_niches": bool(
                (self.content_niches and len(self.content_niches) > 0)
                or (self.content_categories and len(self.content_categories) > 0)
            ),
            "supported_platforms": bool(
                (self.supported_platforms and len(self.supported_platforms) > 0)
                or (self.platforms and len(self.platforms) > 0)
            ),
            "collaboration_preferences": bool(self.collaboration_preferences and len(self.collaboration_preferences) > 0),
            "language": bool(self.language and self.language.strip()),
            "audience_description": bool(self.audience_description and self.audience_description.strip()),
        }
        completed = sum(1 for v in checklist.values() if v)
        total = len(checklist)
        score = int((completed / total) * 100)
        return {
            "score": score,
            "completed_count": completed,
            "total_count": total,
            "missing_fields": [k for k, v in checklist.items() if not v],
        }


# Alias InfluencerProfile to CreatorProfile for domain terminology symmetry
InfluencerProfile = CreatorProfile


class InfluencerPost(Base):
    """
    Individual social media post published by an influencer.
    Records provenance, ingestion metadata, and explicit metric availability.
    Unavailable metrics are represented as NULL (None) rather than misleading 0 values.
    """

    __tablename__ = "influencer_posts"

    id = Column(Integer, primary_key=True, index=True)
    influencer_id = Column(Integer, ForeignKey("creator_profiles.id", ondelete="CASCADE"), index=True, nullable=False)
    platform = Column(String(50), nullable=False, index=True)  # youtube, instagram, tiktok, etc.
    external_post_id = Column(String(255), nullable=False, index=True)
    url = Column(String(500), nullable=False)
    caption = Column(Text, default="")
    media_type = Column(String(50), default="video", nullable=False)
    posted_at = Column(DateTime, nullable=False)

    # Ingestion provenance and freshness
    data_source = Column(String(100), nullable=False, index=True)  # e.g. "youtube_api_v3", "instagram_graph_api", "csv_import"
    last_synced_at = Column(DateTime, default=utcnow, nullable=False)

    # Social Performance Metrics (Explicitly Nullable for unavailable platform statistics)
    likes_count = Column(Integer, nullable=True)
    comments_count = Column(Integer, nullable=True)
    views_count = Column(Integer, nullable=True)
    shares_count = Column(Integer, nullable=True)
    engagement_rate = Column(Float, nullable=True)

    # Explicit Availability Mapping: e.g. {"likes": True, "comments": True, "views": True, "shares": False}
    # Distinguishes genuine zero interactions from unmonitored or private metrics.
    metrics_availability = Column(JSON, default=dict, nullable=False)

    # Validated semantic embedding vector for topic/content matching
    embedding_vector = Column(ValidatedEmbeddingVector, nullable=True)

    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    influencer = relationship("CreatorProfile", back_populates="posts")

    __table_args__ = (
        UniqueConstraint("platform", "external_post_id", name="uq_platform_external_post_id"),
        Index("ix_influencer_posts_influencer_platform", "influencer_id", "platform"),
    )

    def is_metric_available(self, metric_name: str) -> bool:
        """Determines whether a specific metric was reported by the source platform."""
        return bool(self.metrics_availability.get(metric_name, False))

    def get_metric(self, metric_name: str) -> Optional[Any]:
        """
        Retrieves metric value if marked as available by the source API;
        returns None if unavailable, preventing false zero reporting.
        """
        if not self.is_metric_available(metric_name):
            return None
        return getattr(self, f"{metric_name}_count", getattr(self, metric_name, None))


class Campaign(Base):
    """Brand marketing collaboration campaign."""

    __tablename__ = "campaigns"

    id = Column(Integer, primary_key=True, index=True)
    brand_id = Column(Integer, ForeignKey("brand_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    product_description = Column(Text, default="", nullable=True)
    niche = Column(String(100), nullable=False, index=True)
    objective = Column(String(100), default="Brand Awareness", nullable=False)
    target_audience = Column(JSON, default=dict)
    target_location = Column(String(100), default="Global", nullable=False)
    budget = Column(Float, nullable=False)
    budget_min = Column(Float, nullable=True)
    budget_max = Column(Float, nullable=True)
    currency = Column(String(10), default="USD", nullable=False)
    required_criteria = Column(JSON, default=dict)
    preferred_criteria = Column(JSON, default=dict)
    deliverables = Column(JSON, default=list)  # list of deliverable descriptions
    min_followers = Column(Integer, default=0, nullable=False)
    min_engagement_rate = Column(Float, default=0.0, nullable=False)
    status = Column(Enum(CampaignStatus), default=CampaignStatus.ACTIVE, nullable=False, index=True)
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    deadline = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    brand = relationship("BrandProfile", back_populates="campaigns")
    proposals = relationship("Proposal", back_populates="campaign", cascade="all, delete-orphan")
    invitations = relationship("Invitation", back_populates="campaign", cascade="all, delete-orphan")
    forecasts = relationship("CampaignForecast", back_populates="campaign", cascade="all, delete-orphan")
    actual_outcome = relationship("CampaignActualOutcome", back_populates="campaign", uselist=False, cascade="all, delete-orphan")


class Proposal(Base):
    """Creator pitch and deliverable contract submission for a campaign."""

    __tablename__ = "proposals"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False, index=True)
    creator_id = Column(Integer, ForeignKey("creator_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    pitch = Column(Text, nullable=False)
    proposed_rate = Column(Float, nullable=False)
    estimated_delivery_days = Column(Integer, default=7, nullable=False)
    status = Column(Enum(ProposalStatus), default=ProposalStatus.PENDING, nullable=False, index=True)
    deliverable_links = Column(JSON, default=list)  # URLs submitted upon completion
    feedback = Column(Text, default="")
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    campaign = relationship("Campaign", back_populates="proposals")
    creator = relationship("CreatorProfile", back_populates="proposals")


class CampaignForecast(Base):
    """
    Projected sales potential and campaign performance scenarios.
    Stores explicit user assumptions (reach, CTR, CVR, AOV, cost) and calculated
    conservative, baseline, and optimistic scenarios with full formula transparency.
    """

    __tablename__ = "campaign_forecasts"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=True, index=True)
    brand_id = Column(Integer, ForeignKey("brand_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    forecast_name = Column(String(255), default="Campaign Sales Forecast", nullable=False)
    source_data_origin = Column(String(100), default="user_assumptions", nullable=False)  # user_assumptions, historical_blend, benchmark

    # Explicit input assumptions
    impressions = Column(Integer, nullable=False)
    click_through_rate = Column(Float, nullable=False)  # % e.g. 2.0
    conversion_rate = Column(Float, nullable=False)     # % e.g. 2.5
    average_order_value = Column(Float, nullable=False) # $ e.g. 65.0
    campaign_cost = Column(Float, nullable=False)       # $ e.g. 2500.0

    # Multi-scenario computed projections
    conservative_projection = Column(JSON, nullable=False, default=dict)
    baseline_projection = Column(JSON, nullable=False, default=dict)
    optimistic_projection = Column(JSON, nullable=False, default=dict)

    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    campaign = relationship("Campaign", back_populates="forecasts")
    brand = relationship("BrandProfile", back_populates="campaign_forecasts")


class CampaignActualOutcome(Base):
    """
    Verified post-campaign performance results and sales attribution.
    Stored strictly separately from projections to evaluate forecasting accuracy
    and eliminate synthetic hallucination.
    """

    __tablename__ = "campaign_actual_outcomes"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    brand_id = Column(Integer, ForeignKey("brand_profiles.id", ondelete="CASCADE"), nullable=False, index=True)

    # Actual observed metrics
    actual_impressions = Column(Integer, nullable=True)
    actual_clicks = Column(Integer, nullable=True)
    actual_conversions = Column(Integer, nullable=True)
    actual_gross_revenue = Column(Float, nullable=True)
    actual_spend = Column(Float, nullable=True)

    # Calculated derived metrics
    actual_roi_pct = Column(Float, nullable=True)
    actual_ctr_pct = Column(Float, nullable=True)
    actual_cvr_pct = Column(Float, nullable=True)
    actual_cpc = Column(Float, nullable=True)
    actual_cpa = Column(Float, nullable=True)

    # Attribution & audit details
    attribution_provider = Column(String(100), default="Manual Tracking", nullable=False)
    tracked_period_start = Column(DateTime, nullable=True)
    tracked_period_end = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    campaign = relationship("Campaign", back_populates="actual_outcome")
    brand = relationship("BrandProfile", back_populates="campaign_actual_outcomes")


class Shortlist(Base):
    """Saved candidate influencer shortlist curated by a brand."""

    __tablename__ = "shortlists"

    id = Column(Integer, primary_key=True, index=True)
    brand_id = Column(Integer, ForeignKey("brand_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    creator_id = Column(Integer, ForeignKey("creator_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=True, index=True)
    status = Column(String(50), default="considering", nullable=False, index=True)  # considering, contacted, invited, negotiating, confirmed, archived
    notes = Column(Text, default="")
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    brand = relationship("BrandProfile", back_populates="shortlists")
    creator = relationship("CreatorProfile", back_populates="shortlisted_by")
    campaign = relationship("Campaign")

    __table_args__ = (
        Index("ix_shortlists_brand_creator_campaign", "brand_id", "creator_id", "campaign_id"),
    )


class Invitation(Base):
    """Brand invitation extended to an influencer for a specific campaign."""

    __tablename__ = "invitations"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False, index=True)
    creator_id = Column(Integer, ForeignKey("creator_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    message = Column(Text, default="")
    status = Column(String(50), default="pending", nullable=False, index=True)  # pending, sent, viewed, accepted, declined, canceled, expired
    compensation_offered = Column(Float, nullable=True)
    deliverables_requested = Column(JSON, default=list)
    expires_at = Column(DateTime, nullable=True)
    responded_at = Column(DateTime, nullable=True)
    decline_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    campaign = relationship("Campaign", back_populates="invitations")
    creator = relationship("CreatorProfile", back_populates="invitations")

    __table_args__ = (
        Index("ix_invitations_campaign_creator", "campaign_id", "creator_id"),
    )


class CreatorOpportunityInteraction(Base):
    """Creator interaction tracking for campaign discovery opportunities (saved/dismissed)."""

    __tablename__ = "creator_opportunity_interactions"

    id = Column(Integer, primary_key=True, index=True)
    creator_id = Column(Integer, ForeignKey("creator_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(50), nullable=False, index=True)  # "saved" or "dismissed"
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    creator = relationship("CreatorProfile")
    campaign = relationship("Campaign")

    __table_args__ = (
        UniqueConstraint("creator_id", "campaign_id", name="uq_creator_campaign_interaction"),
    )


class Notification(Base):
    """In-app alert and operational notification delivered to a user."""

    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    notification_type = Column(String(50), default="info", nullable=False, index=True)
    is_read = Column(Boolean, default=False, nullable=False, index=True)
    link_url = Column(String(500), nullable=True)
    data = Column(JSON, default=dict)
    read_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    user = relationship("User", back_populates="notifications")


class ImportJob(Base):
    """Data ingestion and catalog synchronization audit record."""

    __tablename__ = "import_jobs"

    id = Column(Integer, primary_key=True, index=True)
    job_type = Column(String(100), nullable=False, index=True)  # "influencer_catalog_import", "post_metrics_sync"
    source_provenance = Column(String(255), nullable=False)  # filename, URI, or API endpoint
    status = Column(Enum(ImportJobStatus), default=ImportJobStatus.PENDING, nullable=False, index=True)
    total_records = Column(Integer, default=0, nullable=False)
    processed_records = Column(Integer, default=0, nullable=False)
    failed_records = Column(Integer, default=0, nullable=False)
    error_summary = Column(JSON, default=list, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)


class AuditEvent(Base):
    """System-wide security, administrative, and compliance audit trail."""

    __tablename__ = "audit_events"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action = Column(String(100), nullable=False, index=True)
    resource_type = Column(String(100), nullable=False, default="system", index=True)
    resource_id = Column(String(100), nullable=True)
    ip_address = Column(String(100), nullable=True)
    status = Column(String(50), nullable=False, default="success", index=True)
    details = Column(JSON, default=dict, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    user = relationship("User", back_populates="audit_events")


# Alias AuditLog to AuditEvent for backward compatibility
AuditLog = AuditEvent

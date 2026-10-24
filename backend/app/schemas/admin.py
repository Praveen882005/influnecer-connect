from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from app.models.entities import ImportJobStatus, UserRole


class AdminUserItem(BaseModel):
    """
    Public administrative representation of a platform user.
    CRITICAL: Does NOT contain password hashes, security tokens, or credential secrets.
    """
    id: int
    email: EmailStr
    full_name: str
    role: UserRole
    is_active: bool
    created_at: datetime
    updated_at: datetime
    brand_profile_id: Optional[int] = None
    creator_profile_id: Optional[int] = None
    brand_company_name: Optional[str] = None
    creator_handle: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class AdminUsersListResponse(BaseModel):
    items: List[AdminUserItem]
    total: int
    page: int
    per_page: int
    pages: int


class AdminUserStatusUpdate(BaseModel):
    is_active: bool
    reason: Optional[str] = Field(None, max_length=500)


class AdminUserRoleUpdate(BaseModel):
    role: UserRole
    reason: Optional[str] = Field(None, max_length=500)


class AdminAuditEventItem(BaseModel):
    id: int
    user_id: Optional[int] = None
    user_email: Optional[str] = None
    action: str
    resource_type: str
    resource_id: Optional[str] = None
    ip_address: Optional[str] = None
    status: str
    details: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AdminAuditEventsListResponse(BaseModel):
    items: List[AdminAuditEventItem]
    total: int
    page: int
    per_page: int
    pages: int


class SubsystemHealth(BaseModel):
    name: str
    category: str
    status: str  # "operational", "degraded", "down", "ready", "connected"
    latency_ms: Optional[float] = None
    details: str


class AdminSystemHealthData(BaseModel):
    liveness_status: str
    readiness_status: str
    is_ready: bool
    app_name: str
    version: str
    environment: str
    uptime_seconds: float
    database_engine: str
    database_connected: bool
    database_status: str
    subsystems: List[SubsystemHealth]
    active_memory_cache_entries: int
    timestamp: datetime
    security_redaction_notice: str = "All credentials, secret keys, and connection passwords have been redacted."


class AdminDiagnosticsResult(BaseModel):
    status: str
    tests_run: int
    tests_passed: int
    tests_failed: int
    duration_ms: float
    subsystems_tested: Dict[str, str]
    message: str
    timestamp: datetime


class AdminModelRegistryItem(BaseModel):
    model_id: str
    name: str
    version: str
    type: str  # "semantic_embedding", "heuristic_recommender", "authenticity_heuristic", "niche_prototype"
    status: str  # "active", "ready", "fallback_stub"
    architecture: str
    dimensions: Optional[int] = None
    device: str
    description: str
    limitations: str
    benchmark_latency_ms: Optional[float] = None


class AdminModelRegistryData(BaseModel):
    models: List[AdminModelRegistryItem]
    cache_entries: int
    cache_max_size: int
    active_device: str
    timestamp: datetime


class AdminProviderConnectionItem(BaseModel):
    provider_id: str
    name: str
    platform: str
    status: str  # "active", "disabled_restricted", "mock_preview"
    auth_mode: str
    description: str
    access_tier: str
    rate_limits: str
    restriction_reason: Optional[str] = None
    data_points_available: List[str]


class AdminImportsListResponse(BaseModel):
    items: List[Dict[str, Any]]
    total: int
    page: int
    per_page: int
    pages: int


class AdminOverviewData(BaseModel):
    total_users: int
    users_by_role: Dict[str, int]
    active_users: int
    suspended_users: int
    total_campaigns: int
    active_campaigns: int
    total_proposals: int
    total_shortlists: int
    total_invitations: int
    total_import_jobs: int
    failed_import_jobs: int
    audit_events_24h: int
    system_status: str
    readiness_status: str

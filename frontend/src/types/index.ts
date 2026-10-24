export type UserRole = 'brand' | 'creator' | 'admin';

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  brand_profile_id?: number | null;
  creator_profile_id?: number | null;
}

export interface AuthResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in?: number;
  user: User;
}

export interface BrandProfile {
  id: number;
  user_id: number;
  company_name: string;
  industry: string;
  website: string;
  description: string;
  logo_url?: string;
  location?: string;
  brand_values: string[];
  target_demographics: {
    age_groups?: string[];
    countries?: string[];
    min_engagement?: number;
    min_authenticity?: number;
    [key: string]: unknown;
  };
  created_at: string;
  updated_at: string;
  owner_name?: string | null;
  owner_email?: string | null;
  completeness_score?: number;
  completeness?: {
    score: number;
    missing_fields: string[];
    filled_fields: string[];
    total_fields: number;
    filled_count: number;
  };
}

export interface PlatformStat {
  followers?: number;
  avg_views?: number;
  avg_likes?: number;
  avg_concurrent_viewers?: number;
}

export interface CreatorProfile {
  id: number;
  user_id: number;
  handle: string;
  display_name: string;
  bio: string;
  profile_image_url?: string;
  primary_niche: string;
  secondary_niches: string[];
  content_niches?: string[];
  supported_platforms?: string[];
  platforms: Record<string, PlatformStat>;
  language?: string;
  collaboration_preferences?: {
    location?: string;
    rate_youtube_dedicated?: string;
    rate_youtube_integration?: string;
    rate_instagram_reel?: string;
    [key: string]: unknown;
  };
  total_followers: number;
  following_count?: number | null;
  posts_count?: number | null;
  avg_engagement_rate: number;
  audience_demographics: {
    age_split?: Record<string, number>;
    gender_split?: Record<string, number>;
    top_countries?: string[];
    [key: string]: unknown;
  };
  authenticity_score: number;
  sample_content_keywords: string[];
  profile_url?: string | null;
  audience_description?: string | null;
  avg_likes?: number | null;
  avg_comments?: number | null;
  avg_views?: number | null;
  brand_suitability?: {
    safety_level?: string;
    sponsored_content_ratio?: number;
    family_friendly?: boolean;
    suitability_tags?: string[];
    notes?: string;
    [key: string]: unknown;
  };
  content_categories?: string[];
  past_campaigns_count?: number;
  on_time_delivery_rate?: number | null;
  delivery_history?: Array<{
    campaign_title: string;
    brand_name?: string;
    status: string;
    completed_at?: string;
    on_time?: boolean;
    [key: string]: unknown;
  }>;
  data_source?: string;
  last_fetched_at?: string | null;
  freshness_status?: string;
  is_verified: boolean;
  is_platform_verified?: boolean;
  connected_platforms?: Record<string, {
    connected: boolean;
    verified: boolean;
    handle?: string;
    account_id?: string;
    verified_at?: string;
  }>;
  owner_name?: string | null;
  owner_email?: string | null;
  completeness_score?: number;
  completeness?: {
    score: number;
    missing_fields: string[];
    filled_fields: string[];
    total_fields: number;
    filled_count: number;
  };
  created_at: string;
  updated_at: string;
}

export type CampaignStatus =
  | 'draft'
  | 'published'
  | 'active'
  | 'paused'
  | 'in_review'
  | 'completed'
  | 'archived'
  | 'cancelled';

export interface Campaign {
  id: number;
  brand_id: number;
  title: string;
  name?: string;
  description: string;
  product_description?: string;
  niche: string;
  objective?: string;
  target_audience: {
    age_groups?: string[];
    countries?: string[];
    interests?: string[];
    [key: string]: unknown;
  };
  target_location?: string;
  budget: number;
  budget_min?: number | null;
  budget_max?: number | null;
  currency?: string;
  required_criteria?: Record<string, unknown>;
  preferred_criteria?: Record<string, unknown>;
  deliverables: string[];
  min_followers: number;
  min_engagement_rate: number;
  status: CampaignStatus;
  start_date?: string | null;
  end_date?: string | null;
  deadline?: string | null;
  created_at: string;
  updated_at: string;
  brand_name?: string | null;
  proposal_count?: number;
}

export type ProposalStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn' | 'completed';

export interface Proposal {
  id: number;
  campaign_id: number;
  creator_id: number;
  pitch: string;
  proposed_rate: number;
  estimated_delivery_days: number;
  status: ProposalStatus;
  deliverable_links: string[];
  feedback: string;
  created_at: string;
  updated_at: string;
  creator_name?: string | null;
  creator_handle?: string | null;
  campaign_title?: string | null;
  brand_name?: string | null;
}

export interface SignalScoreDetail {
  score: number;
  raw_value?: any;
  configured_weight: number;
  active_weight: number;
  is_available: boolean;
  evidence: string[];
}

export interface MatchSignalBreakdown {
  content_relevance_score: number;
  audience_affinity_score: number;
  engagement_quality_score: number;
  authenticity_heuristic_score: number;
  signals_used: string[];
  missing_metrics: string[];
  signal_details?: Record<string, SignalScoreDetail>;
}

export interface MatchScoreExplanation {
  summary: string;
  strengths: string[];
  cautions: string[];
  hard_constraints_satisfied?: string[];
  unavailable_fields?: string[];
  authenticity_disclaimer: string;
  optimality_disclaimer?: string;
}

export interface CreatorRecommendation {
  creator: CreatorProfile;
  overall_match_score: number;
  signal_breakdown: MatchSignalBreakdown;
  explanation: MatchScoreExplanation;
  rank: number;
}

export interface ParsedMatchingCriteria {
  brief_text: string;
  product_or_service?: string;
  target_audience?: string;
  industry_or_niche?: string;
  campaign_objective?: string;
  preferred_platform?: string;
  preferred_language?: string;
  budget?: number;
  min_followers?: number;
  min_engagement_rate?: number;
  min_authenticity?: number;
  strict_niche_match: boolean;
}

export interface NaturalLanguageMatchRequest {
  brief_text: string;
  product_or_service?: string;
  target_audience?: string;
  industry_or_niche?: string;
  campaign_objective?: string;
  preferred_platform?: string;
  preferred_language?: string;
  budget?: number;
  min_followers?: number;
  min_engagement_rate?: number;
  min_authenticity?: number;
  strict_niche_match?: boolean;
  limit?: number;
  weights?: {
    weight_semantic_content: number;
    weight_engagement_quality: number;
    weight_authenticity: number;
    weight_audience_fit: number;
  };
}

export interface RecommendationResponse {
  campaign_id?: number | null;
  brand_id?: number | null;
  total_analyzed: number;
  eligible_count?: number;
  disqualified_count?: number;
  configured_weights?: Record<string, number>;
  latency_ms?: number;
  recommendations: CreatorRecommendation[];
  parsed_criteria?: ParsedMatchingCriteria;
  ai_model_used?: string;
  disclaimer?: string;
}

export interface AnalyticsOverview {
  total_campaigns: number;
  total_creators: number;
  total_brands: number;
  total_proposals: number;
  accepted_proposals: number;
  proposal_acceptance_rate: number;
  cumulative_audience_reach: number;
  platform_avg_engagement_rate: number;
  platform_avg_authenticity_heuristic: number;
  user_context?: Record<string, unknown>;
  data_provenance: string;
}

export type ImportJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ImportErrorItem {
  row: number;
  record_identifier: string;
  error: string;
}

export interface ImportJob {
  id: number;
  job_type: string;
  source_provenance: string;
  status: ImportJobStatus;
  total_records: number;
  processed_records: number;
  failed_records: number;
  error_summary: ImportErrorItem[];
  created_at: string;
  completed_at?: string | null;
}

export interface ImportUploadResponse {
  job_id: number;
  status: string;
  job_type: string;
  total_records: number;
  processed_records: number;
  failed_records: number;
  message: string;
  error_summary: ImportErrorItem[];
  provenance: string;
}

export interface ProviderAdapterStatus {
  provider_id: string;
  display_name: string;
  status: string;
  is_enabled: boolean;
  reason?: string | null;
  disclaimer?: string | null;
}

export interface SeedSyntheticResponse {
  status: string;
  message: string;
  disclaimer?: string;
  creators_job?: ImportJob;
  posts_job?: ImportJob;
}

export interface EngagementMetrics {
  creator_id: number;
  handle: string;
  follower_count: number;
  sample_size_posts: number;
  sample_start_date?: string | null;
  sample_end_date?: string | null;
  avg_likes?: number | null;
  avg_comments?: number | null;
  calculated_engagement_rate?: number | null;
  calculation_formula: string;
  calculation_status: string;
  metrics_availability: Record<string, boolean>;
  data_freshness: string;
  last_fetched_at?: string | null;
  calculated_at: string;
  notes: string[];
}

export interface ReviewSignal {
  signal_key: string;
  display_name: string;
  status: 'normal' | 'review_recommended' | 'anomaly_flagged' | 'insufficient_data';
  observed_value?: unknown;
  benchmark_or_expected?: unknown;
  evidence_summary: string;
  context_and_guidance: string;
  is_exclusion_warranted: boolean;
}

export interface AuthenticityReport {
  creator_id: number;
  handle: string;
  authenticity_score: number;
  model_used: string;
  model_type: string;
  signals: ReviewSignal[];
  strengths: string[];
  review_notes: string[];
  historical_observations_count: number;
  data_provenance: string;
  calculated_at: string;
  disclaimer: string;
  supervised_model_status: Record<string, unknown>;
}

export interface FullAnalyticsReport {
  creator_id: number;
  handle: string;
  engagement: EngagementMetrics;
  authenticity: AuthenticityReport;
  generated_at: string;
}

export interface ModelMetadata {
  active_baseline_model: Record<string, unknown>;
  supervised_future_model: Record<string, unknown>;
  deterministic_heuristics_catalog: Array<Record<string, unknown>>;
  unimplemented_features_catalog: Array<Record<string, unknown>>;
}

// ============================================================================
// Phase 16: Two-Sided Workflow Types (Shortlists, Invitations, Opportunities, Notifications)
// ============================================================================

export type ShortlistStatus =
  | 'considering'
  | 'contacted'
  | 'invited'
  | 'negotiating'
  | 'confirmed'
  | 'declined'
  | 'archived';

export interface ShortlistItem {
  id: number;
  brand_id: number;
  creator_id: number;
  campaign_id?: number | null;
  campaign_title?: string | null;
  status: ShortlistStatus;
  notes: string;
  creator?: CreatorProfile | null;
  created_at: string;
  updated_at: string;
}

export type InvitationStatusType =
  | 'pending'
  | 'sent'
  | 'viewed'
  | 'accepted'
  | 'declined'
  | 'canceled'
  | 'expired';

export interface WorkflowInvitation {
  id: number;
  campaign_id: number;
  campaign_title: string;
  brand_id: number;
  brand_name: string;
  creator_id: number;
  creator_name?: string | null;
  creator_handle?: string | null;
  message: string;
  status: InvitationStatusType;
  compensation_offered?: number | null;
  deliverables_requested: string[];
  expires_at?: string | null;
  responded_at?: string | null;
  decline_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignOpportunity {
  id: number;
  brand_id: number;
  brand_name: string;
  title: string;
  niche: string;
  objective: string;
  description: string;
  product_description?: string;
  budget: number;
  currency: string;
  target_location: string;
  deliverables: string[];
  min_followers: number;
  min_engagement_rate: number;
  status: string;
  created_at: string;
  is_saved: boolean;
  is_dismissed: boolean;
  has_invitation: boolean;
  invitation_id?: number | null;
  invitation_status?: string | null;
  fit_score?: number | null;
  fit_summary?: string | null;
  match_strengths: string[];
}

export interface NotificationItem {
  id: number;
  user_id: number;
  title: string;
  message: string;
  notification_type: string;
  is_read: boolean;
  link_url?: string | null;
  data: Record<string, unknown>;
  read_at?: string | null;
  created_at: string;
}

export interface NotificationListResponse {
  unread_count: number;
  notifications: NotificationItem[];
  delivery_provider_disclaimer: string;
}

// ============================================================================
// Phase 17: Campaign Analytics Types
// ============================================================================

export interface BrandCampaignSummary {
  campaign_id: number;
  title: string;
  status: string;
  budget: number;
  shortlist_count: number;
  invitations_sent: number;
  invitations_accepted: number;
  invitations_declined: number;
  acceptance_rate_pct: number;
}

export interface BrandParticipationFunnel {
  stage_1_shortlisted: number;
  stage_2_invited: number;
  stage_3_viewed: number;
  stage_4_responded: number;
  stage_5_confirmed: number;
  shortlist_to_invite_pct: number;
  invite_to_view_pct: number;
  view_to_response_pct: number;
  response_to_confirm_pct: number;
}

export interface BrandDailyActivity {
  date: string;
  shortlists_added: number;
  invitations_sent: number;
  invitations_accepted: number;
}

export interface BrandAnalyticsData {
  brand_id: number;
  company_name: string;
  total_campaigns: number;
  active_campaigns: number;
  draft_campaigns: number;
  completed_campaigns: number;
  total_budget: number;
  total_shortlisted: number;
  shortlist_by_status: Record<string, number>;
  total_invitations_sent: number;
  invitations_accepted: number;
  invitations_declined: number;
  invitations_pending: number;
  invitations_expired: number;
  invitations_canceled: number;
  response_rate_pct: number;
  acceptance_rate_pct: number;
  avg_response_time_hours?: number | null;
  total_committed_compensation: number;
  funnel: BrandParticipationFunnel;
  daily_activity: BrandDailyActivity[];
  campaigns_summary: BrandCampaignSummary[];
  platform_vs_social_disclaimer: string;
}

export interface CreatorOpportunitiesAnalytics {
  total_eligible_opportunities: number;
  saved_opportunities: number;
  dismissed_opportunities: number;
}

export interface CreatorInvitationsAnalytics {
  total_received: number;
  accepted: number;
  declined: number;
  pending: number;
  expired: number;
  canceled: number;
  response_rate_pct: number;
  acceptance_rate_pct: number;
  total_earned_compensation: number;
  avg_offer_value: number;
}

export interface CreatorDataFreshness {
  data_source: string;
  freshness_status: string;
  last_fetched_at?: string | null;
  profile_completeness_pct: number;
  is_verified: boolean;
  is_platform_verified: boolean;
}

export interface CreatorRecentActivity {
  invitation_id: number;
  campaign_title: string;
  brand_name: string;
  status: string;
  compensation_offered?: number | null;
  created_at: string;
  responded_at?: string | null;
}

export interface CreatorAnalyticsData {
  creator_id: number;
  handle: string;
  display_name: string;
  opportunities: CreatorOpportunitiesAnalytics;
  invitations: CreatorInvitationsAnalytics;
  freshness: CreatorDataFreshness;
  recent_activity: CreatorRecentActivity[];
  active_partnerships_count: number;
  platform_vs_social_disclaimer: string;
}

// ============================================================================
// Phase 18: Admin & Operations Types
// ============================================================================

export interface AdminUserItem {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  brand_profile_id?: number | null;
  creator_profile_id?: number | null;
  brand_company_name?: string | null;
  creator_handle?: string | null;
}

export interface AdminUsersListResponse {
  items: AdminUserItem[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface AdminAuditEventItem {
  id: number;
  user_id?: number | null;
  user_email?: string | null;
  action: string;
  resource_type: string;
  resource_id?: string | null;
  ip_address?: string | null;
  status: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface AdminAuditEventsListResponse {
  items: AdminAuditEventItem[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface SubsystemHealth {
  name: string;
  category: string;
  status: string;
  latency_ms?: number | null;
  details: string;
}

export interface AdminSystemHealthData {
  liveness_status: string;
  readiness_status: string;
  is_ready: boolean;
  app_name: string;
  version: string;
  environment: string;
  uptime_seconds: number;
  database_engine: string;
  database_connected: boolean;
  database_status: string;
  subsystems: SubsystemHealth[];
  active_memory_cache_entries: number;
  timestamp: string;
  security_redaction_notice: string;
}

export interface AdminDiagnosticsResult {
  status: string;
  tests_run: number;
  tests_passed: number;
  tests_failed: number;
  duration_ms: number;
  subsystems_tested: Record<string, string>;
  message: string;
  timestamp: string;
}

export interface AdminModelRegistryItem {
  model_id: string;
  name: string;
  version: string;
  type: string;
  status: string;
  architecture: string;
  dimensions?: number | null;
  device: string;
  description: string;
  limitations: string;
  benchmark_latency_ms?: number | null;
}

export interface AdminModelRegistryData {
  models: AdminModelRegistryItem[];
  cache_entries: number;
  cache_max_size: number;
  active_device: string;
  timestamp: string;
}

export interface AdminProviderConnectionItem {
  provider_id: string;
  name: string;
  platform: string;
  status: string;
  auth_mode: string;
  description: string;
  access_tier: string;
  rate_limits: string;
  restriction_reason?: string | null;
  data_points_available: string[];
}

export interface AdminOverviewData {
  total_users: number;
  users_by_role: Record<string, number>;
  active_users: number;
  suspended_users: number;
  total_campaigns: number;
  active_campaigns: number;
  total_proposals: number;
  total_shortlists: number;
  total_invitations: number;
  total_import_jobs: number;
  failed_import_jobs: number;
  audit_events_24h: number;
  system_status: string;
  readiness_status: string;
}




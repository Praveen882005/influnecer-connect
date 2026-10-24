import { ApiClientError, type ApiErrorResponse, type RequestOptions } from './types';
import type {
  AdminAuditEventItem,
  AdminAuditEventsListResponse,
  AdminDiagnosticsResult,
  AdminModelRegistryData,
  AdminOverviewData,
  AdminProviderConnectionItem,
  AdminSystemHealthData,
  AdminUserItem,
  AdminUsersListResponse,
  AnalyticsOverview,
  AuthenticityReport,
  AuthResponse,
  BrandAnalyticsData,
  BrandProfile,
  Campaign,
  CampaignActualOutcome,
  CampaignForecast,
  CampaignForecastingBundle,
  CampaignOpportunity,
  CreatorAnalyticsData,
  CreatorProfile,
  CreatorRecommendation,
  EngagementMetrics,
  ForecastAssumptionsInput,
  ForecastCalculationResponse,
  FraudAnalysisReport,
  FullAnalyticsReport,
  HistoricalBenchmark,
  ImportJob,
  ImportUploadResponse,
  ModelMetadata,
  NotificationItem,
  NotificationListResponse,
  NaturalLanguageMatchRequest,
  Proposal,
  ProviderAdapterStatus,
  RecommendationResponse,
  SeedSyntheticResponse,
  ShortlistItem,
  TrustAnalysisReport,
  User,
  UserRole,
  WorkflowInvitation,
} from '../types';

// Configurable base URL with sensible default for local FastAPI dev backend
const DEFAULT_API_BASE_URL = 'http://localhost:8000/api';

export class ApiClient {
  private baseUrl: string;
  private tokenGetter?: () => string | null;

  constructor(baseUrl?: string, tokenGetter?: () => string | null) {
    this.baseUrl = (baseUrl || import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, '');
    this.tokenGetter = tokenGetter;
  }

  public setTokenGetter(getter: () => string | null) {
    this.tokenGetter = getter;
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public getToken(): string | null {
    return this.tokenGetter ? this.tokenGetter() : null;
  }

  public async downloadCsv(endpoint: string, filename: string, params?: Record<string, any>): Promise<void> {
    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const url = this.buildUrl(endpoint, params);
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`CSV download failed with status ${response.status}`);
    }
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);
  }

  private buildUrl(endpoint: string, params?: Record<string, string | number | boolean | undefined>): string {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = new URL(`${this.baseUrl}${cleanEndpoint}`);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    return url.toString();
  }

  private extractFieldErrors(detail: unknown, errorObj?: ApiErrorResponse['error']): Record<string, string> {
    const fieldErrors: Record<string, string> = {};
    const errorList = Array.isArray(detail) ? detail : errorObj?.details;
    if (Array.isArray(errorList)) {
      errorList.forEach((err) => {
        if (err.loc && err.loc.length > 0) {
          const field = String(err.loc[err.loc.length - 1]);
          fieldErrors[field] = err.msg;
        }
      });
    }
    return fieldErrors;
  }

  public async request<T>(endpoint: string, options: RequestOptions = {}, body?: unknown): Promise<T> {
    const url = this.buildUrl(endpoint, options.params);
    const headers = new Headers(options.headers || {});

    if (!headers.has('Content-Type') && body !== undefined && !(body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    headers.set('Accept', 'application/json');

    if (options.requiresAuth !== false && this.tokenGetter) {
      const token = this.tokenGetter();
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    } else if (options.requiresAuth !== false && !headers.has('Authorization')) {
      const storedToken = localStorage.getItem('brand_bridge_token') || localStorage.getItem('access_token');
      if (storedToken) {
        headers.set('Authorization', `Bearer ${storedToken}`);
      }
    }

    const fetchConfig: RequestInit = {
      ...options,
      headers,
      body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
    };

    let response: Response;
    try {
      response = await fetch(url, fetchConfig);
    } catch (networkError) {
      throw new ApiClientError(
        'The backend API is currently unreachable. Please verify your connection or server status.',
        0,
        networkError instanceof Error ? networkError.message : 'NetworkError'
      );
    }

    if (!response.ok) {
      let errorData: ApiErrorResponse | null = null;
      try {
        errorData = await response.json();
      } catch {
        // Response was not JSON
      }

      const status = response.status;
      let message = 'An unexpected API error occurred.';

      if (errorData?.error?.message) {
        message = errorData.error.message;
      } else if (errorData?.detail) {
        if (typeof errorData.detail === 'string') {
          message = errorData.detail;
        } else if (Array.isArray(errorData.detail) && errorData.detail.length > 0) {
          const firstErr = errorData.detail[0];
          message = firstErr ? `${firstErr.loc ? firstErr.loc.join('.') + ': ' : ''}${firstErr.msg}` : message;
        }
      } else if (errorData?.message) {
        message = errorData.message;
      } else if (status === 404) {
        message = `Requested endpoint '${endpoint}' is unavailable (404 Not Found).`;
      } else if (status === 401) {
        message = 'Authentication required. Please sign in to continue.';
      } else if (status === 403) {
        message = 'Access forbidden. Your account does not have sufficient permissions.';
      } else if (status >= 500) {
        message = 'The server encountered an error processing your request.';
      }

      const fieldErrors = this.extractFieldErrors(errorData?.detail, errorData?.error);
      throw new ApiClientError(message, status, (errorData?.detail || errorData?.error?.details) as any, fieldErrors, errorData?.error?.error_type);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return (await response.json()) as T;
  }

  public get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  public post<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'POST' }, body);
  }

  public put<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'PUT' }, body);
  }

  public patch<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'PATCH' }, body);
  }

  public delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Reusable domain API endpoints namespace (compatible with existing prototype studio & contexts)
export const api = {
  auth: {
    me: () => apiClient.get<User>('/auth/me'),
    login: (credentials: { email: string; password: string }) =>
      apiClient.post<AuthResponse>('/auth/login', credentials),
    register: (data: {
      email: string;
      password: string;
      full_name: string;
      role: UserRole;
      company_name?: string;
      industry?: string;
      handle?: string;
      primary_niche?: string;
    }) => apiClient.post<AuthResponse>('/auth/register', data),
    logout: (refreshToken?: string) =>
      apiClient.post<{ message: string; logged_out: boolean }>('/auth/logout', {
        refresh_token: refreshToken,
      }),
    refresh: (refreshToken: string) =>
      apiClient.post<AuthResponse>('/auth/refresh', { refresh_token: refreshToken }),
    demoLogin: (role: UserRole) =>
      apiClient.post<AuthResponse>(`/auth/demo-login?role=${role}`),
  },

  campaigns: {
    list: (params?: { niche?: string; status?: string; min_budget?: number }) =>
      apiClient.get<Campaign[]>('/campaigns', { params }),
    get: (id: number) => apiClient.get<Campaign>(`/campaigns/${id}`),
    create: (data: Partial<Campaign>) => apiClient.post<Campaign>('/campaigns', data),
    getMyCampaigns: () => apiClient.get<Campaign[]>('/campaigns/mine'),
    submitProposal: (
      campaignId: number,
      data: { pitch: string; proposed_rate: number; estimated_delivery_days: number }
    ) => apiClient.post<Proposal>(`/campaigns/${campaignId}/proposals`, data),
    listProposals: (campaignId: number) =>
      apiClient.get<Proposal[]>(`/campaigns/${campaignId}/proposals`),
  },

  creators: {
    list: (params?: { q?: string; niche?: string; min_followers?: number; min_engagement?: number; min_authenticity?: number }) =>
      apiClient.get<CreatorProfile[]>('/creators', { params }),
    get: (id: number) => apiClient.get<CreatorProfile>(`/creators/${id}`),
    getMyProfile: () => apiClient.get<CreatorProfile>('/creators/profile/me'),
    updateMyProfile: (data: Record<string, unknown>) => apiClient.put<CreatorProfile>('/creators/me', data),
  },

  brands: {
    getMyProfile: () => apiClient.get<BrandProfile>('/brands/profile/me'),
    updateMyProfile: (data: Record<string, unknown>) => apiClient.put<BrandProfile>('/brands/me', data),
  },

  proposals: {
    myProposals: () => apiClient.get<Proposal[]>('/proposals/me'),
    getMyProposals: () => apiClient.get<Proposal[]>('/proposals/me'),
    getByCampaign: (campaignId: number) => apiClient.get<Proposal[]>(`/campaigns/${campaignId}/proposals`),
    create: (data: { campaign_id: number; pitch: string; proposed_rate: number; estimated_delivery_days: number }) =>
      apiClient.post<Proposal>('/proposals', data),
    submit: (data: { campaign_id: number; pitch: string; proposed_rate: number; estimated_delivery_days: number }) =>
      apiClient.post<Proposal>('/proposals', data),
    updateStatus: (proposalId: number, data: string | { status: string; feedback?: string; deliverable_links?: string[] }) =>
      apiClient.patch<Proposal>(
        `/proposals/${proposalId}/status`,
        typeof data === 'string' ? { status: data } : data
      ),
  },

  recommendations: {
    forCampaign: (campaignId: number, minScore?: number) =>
      apiClient.get<RecommendationResponse>(`/recommendations/campaign/${campaignId}`, {
        params: minScore !== undefined ? { min_score: minScore } : undefined,
      }),
    matchBrief: (payload: NaturalLanguageMatchRequest) =>
      apiClient.post<RecommendationResponse>('/recommendations/match-brief', payload),
    evaluateFit: (creatorId: number, campaignData: Partial<Campaign>) =>
      apiClient.post<CreatorRecommendation>(`/recommendations/creator/${creatorId}/fit`, campaignData),
  },

  shortlists: {
    list: () => apiClient.get<CreatorProfile[]>('/shortlists'),
    listItems: (params?: { campaign_id?: number; status?: string }) =>
      apiClient.get<ShortlistItem[]>('/shortlists/items', { params }),
    add: (data: { creator_id: number; campaign_id?: number; notes?: string; status?: string }) =>
      apiClient.post<ShortlistItem>('/shortlists', data),
    update: (id: number, data: { notes?: string; status?: string }) =>
      apiClient.patch<ShortlistItem>(`/shortlists/${id}`, data),
    remove: (creatorIdOrShortlistId: number) =>
      apiClient.delete<{ message: string; shortlisted: boolean }>(`/shortlists/${creatorIdOrShortlistId}`),
  },

  invitations: {
    create: (data: {
      campaign_id: number;
      creator_id: number;
      message?: string;
      compensation_offered?: number;
      deliverables_requested?: string[];
      expires_in_days?: number;
    }) => apiClient.post<WorkflowInvitation>('/invitations', data),
    listBrand: (params?: { campaign_id?: number; status?: string }) =>
      apiClient.get<WorkflowInvitation[]>('/invitations/brand', { params }),
    listCreator: (params?: { status?: string }) =>
      apiClient.get<WorkflowInvitation[]>('/invitations/creator', { params }),
    get: (id: number) => apiClient.get<WorkflowInvitation>(`/invitations/${id}`),
    updateStatus: (id: number, data: { status: string; decline_reason?: string }) =>
      apiClient.patch<WorkflowInvitation>(`/invitations/${id}/status`, data),
  },

  opportunities: {
    list: (params?: {
      search?: string;
      niche?: string;
      min_budget?: number;
      platform?: string;
      only_eligible?: boolean;
      include_dismissed?: boolean;
    }) =>
      apiClient.get<CampaignOpportunity[]>('/opportunities', { params }),
    interact: (
      campaignId: number,
      action: 'save' | 'unsave' | 'dismiss' | 'undismiss'
    ) =>
      apiClient.post<{
        success: boolean;
        campaign_id: number;
        action: string;
        is_saved: boolean;
        is_dismissed: boolean;
      }>(`/opportunities/${campaignId}/interact`, { action }),
  },

  notifications: {
    list: (params?: { unread_only?: boolean; limit?: number }) =>
      apiClient.get<NotificationListResponse>('/notifications', { params }),
    markRead: (id: number) =>
      apiClient.patch<NotificationItem>(`/notifications/${id}/read`),
    markAllRead: () =>
      apiClient.post<{ updated_count: number }>('/notifications/mark-all-read'),
  },

  analytics: {
    overview: () => apiClient.get<AnalyticsOverview>('/analytics/overview'),
    brand: (params?: { campaign_id?: number; start_date?: string; end_date?: string }) =>
      apiClient.get<BrandAnalyticsData>('/analytics/brand', { params }),
    exportBrandUrl: (params?: { campaign_id?: number; start_date?: string; end_date?: string }) => {
      const token = apiClient.getToken();
      const url = new URL(`${apiClient.getBaseUrl()}/analytics/brand/export`);
      if (token) url.searchParams.append('token', token);
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          if (v !== undefined) url.searchParams.append(k, String(v));
        });
      }
      return url.toString();
    },
    exportBrandCsv: (filename: string, params?: { campaign_id?: number; start_date?: string; end_date?: string }) =>
      apiClient.downloadCsv('/analytics/brand/export', filename, params),
    creator: (params?: { start_date?: string; end_date?: string }) =>
      apiClient.get<CreatorAnalyticsData>('/analytics/creator', { params }),
    exportCreatorUrl: (params?: { start_date?: string; end_date?: string }) => {
      const token = apiClient.getToken();
      const url = new URL(`${apiClient.getBaseUrl()}/analytics/creator/export`);
      if (token) url.searchParams.append('token', token);
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          if (v !== undefined) url.searchParams.append(k, String(v));
        });
      }
      return url.toString();
    },
    exportCreatorCsv: (filename: string, params?: { start_date?: string; end_date?: string }) =>
      apiClient.downloadCsv('/analytics/creator/export', filename, params),
    creatorEngagement: (creatorId: number) =>
      apiClient.get<EngagementMetrics>(`/analytics/creator/${creatorId}/engagement`),
    creatorAuthenticity: (creatorId: number) =>
      apiClient.get<AuthenticityReport>(`/analytics/creator/${creatorId}/authenticity`),
    creatorFullReport: (creatorId: number) =>
      apiClient.get<FullAnalyticsReport>(`/analytics/creator/${creatorId}/full-report`),
    creatorTrust: (creatorId: number, campaignNiche?: string) =>
      apiClient.get<TrustAnalysisReport>(`/analytics/creator/${creatorId}/trust`, {
        params: campaignNiche ? { campaign_niche: campaignNiche } : undefined,
      }),
    modelMetadata: () =>
      apiClient.get<ModelMetadata>('/analytics/model-metadata'),
  },

  forecasting: {
    calculate: (assumptions: ForecastAssumptionsInput, campaignId?: number) =>
      apiClient.post<ForecastCalculationResponse>('/forecasting/calculate', assumptions, {
        params: campaignId ? { campaign_id: campaignId } : undefined,
      }),
    benchmark: () =>
      apiClient.get<HistoricalBenchmark>('/forecasting/benchmark'),
    getCampaignContext: (campaignId: number) =>
      apiClient.get<CampaignForecastingBundle>(`/forecasting/campaign/${campaignId}`),
    saveForecast: (campaignId: number, assumptions: ForecastAssumptionsInput) =>
      apiClient.post<CampaignForecast>(`/forecasting/campaign/${campaignId}`, assumptions),
    listForecasts: (campaignId: number) =>
      apiClient.get<CampaignForecast[]>(`/forecasting/campaign/${campaignId}/forecasts`),
    recordActualOutcome: (campaignId: number, data: Partial<CampaignActualOutcome>) =>
      apiClient.post<CampaignActualOutcome>(`/forecasting/campaign/${campaignId}/actual`, data),
    getActualOutcome: (campaignId: number) =>
      apiClient.get<CampaignActualOutcome | null>(`/forecasting/campaign/${campaignId}/actual`),
  },

  fraud: {
    search: (query: string, campaignId?: number) =>
      apiClient.post<FraudAnalysisReport>('/fraud/search', { query, campaign_id: campaignId }),
    getReport: (creatorId: number, campaignId?: number) =>
      apiClient.get<FraudAnalysisReport>(`/fraud/creator/${creatorId}`, {
        params: campaignId ? { campaign_id: campaignId } : undefined,
      }),
  },

  data: {
    seed: () =>
      apiClient.post<{
        message: string;
        creators_added?: number;
        creators_count?: number;
        campaigns_count?: number;
      }>('/data/seed-sample-data'),
    seedSampleData: () =>
      apiClient.post<{
        message: string;
        creators_added?: number;
        creators_count?: number;
        campaigns_count?: number;
      }>('/data/seed-sample-data'),
    importJobs: (params?: { limit?: number; offset?: number }) =>
      apiClient.get<ImportJob[]>('/data/jobs', { params }),
    getImportJob: (id: number) =>
      apiClient.get<ImportJob>(`/data/jobs/${id}`),
    seedSynthetic: () =>
      apiClient.post<SeedSyntheticResponse>('/data/seed-synthetic'),
    uploadDataset: (formData: FormData) =>
      apiClient.post<ImportUploadResponse>('/data/upload', formData),
    providerAdapters: () =>
      apiClient.get<ProviderAdapterStatus[]>('/data/provider-adapters'),
  },

  admin: {
    overview: () => apiClient.get<AdminOverviewData>('/admin/overview'),
    users: (params?: { q?: string; role?: string; status?: string; page?: number; per_page?: number }) =>
      apiClient.get<AdminUsersListResponse>('/admin/users', { params }),
    getUser: (userId: number) =>
      apiClient.get<AdminUserItem>(`/admin/users/${userId}`),
    updateUserStatus: (userId: number, data: { is_active: boolean; reason?: string }) =>
      apiClient.patch<AdminUserItem>(`/admin/users/${userId}/status`, data),
    updateUserRole: (userId: number, data: { role: string; reason?: string }) =>
      apiClient.patch<AdminUserItem>(`/admin/users/${userId}/role`, data),
    auditEvents: (params?: { q?: string; action?: string; resource_type?: string; status?: string; page?: number; per_page?: number }) =>
      apiClient.get<AdminAuditEventsListResponse>('/admin/audit-events', { params }),
    getAuditEvent: (eventId: number) =>
      apiClient.get<AdminAuditEventItem>(`/admin/audit-events/${eventId}`),
    systemHealth: () =>
      apiClient.get<AdminSystemHealthData>('/admin/system/health'),
    runDiagnostics: () =>
      apiClient.post<AdminDiagnosticsResult>('/admin/system/diagnostics'),
    models: () =>
      apiClient.get<AdminModelRegistryData>('/admin/models'),
    flushModelCache: () =>
      apiClient.post<{ status: string; message: string; flushed_entries: number }>('/admin/models/flush-cache'),
    providers: () =>
      apiClient.get<AdminProviderConnectionItem[]>('/admin/providers'),
    imports: (params?: { page?: number; per_page?: number; status?: string }) =>
      apiClient.get<{ items: Array<Record<string, unknown>>; total: number; page: number; per_page: number; pages: number }>('/admin/imports', { params }),
  },

  health: Object.assign(
    () => apiClient.get<{ status: string; timestamp: string }>('/health'),
    {
      get: () => apiClient.get<{ status: string; timestamp: string }>('/health'),
    }
  ),
};

import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from 'recharts';
import { api } from '../../api/client';
import { CampaignForecastingPanel } from '../../components/CampaignForecastingPanel';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  Select,
  Table,
  type Column,
} from '../../design-system';
import type {
  BrandAnalyticsData,
  BrandCampaignSummary,
  Campaign,
} from '../../types';

export const BrandAnalyticsPage: React.FC = () => {
  const [data, setData] = useState<BrandAnalyticsData | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<string>('30d');
  const [viewMode, setViewMode] = useState<'overview' | 'forecasting'>('overview');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const calculateDateRange = (range: string) => {
    const now = new Date();
    if (range === 'all') return { startDate: undefined, endDate: undefined };
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
    const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: now.toISOString().split('T')[0],
    };
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);

      const { startDate, endDate } = calculateDateRange(timeRange);
      const campId = selectedCampaignId !== 'all' ? Number(selectedCampaignId) : undefined;

      const [analyticsData, myCampaigns] = await Promise.all([
        api.analytics.brand({
          campaign_id: campId,
          start_date: startDate,
          end_date: endDate,
        }),
        api.campaigns.getMyCampaigns().catch(() => [] as Campaign[]),
      ]);

      setData(analyticsData);
      setCampaigns(myCampaigns);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load brand campaign analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCampaignId, timeRange]);

  const [isExporting, setIsExporting] = useState(false);

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const { startDate, endDate } = calculateDateRange(timeRange);
      const campId = selectedCampaignId !== 'all' ? Number(selectedCampaignId) : undefined;
      const filename = `brand_analytics_${campId || 'all'}_${new Date().toISOString().split('T')[0]}.csv`;
      await api.analytics.exportBrandCsv(filename, {
        campaign_id: campId,
        start_date: startDate,
        end_date: endDate,
      });
    } catch {
      const { startDate, endDate } = calculateDateRange(timeRange);
      const campId = selectedCampaignId !== 'all' ? Number(selectedCampaignId) : undefined;
      const exportUrl = api.analytics.exportBrandUrl({
        campaign_id: campId,
        start_date: startDate,
        end_date: endDate,
      });
      window.open(exportUrl, '_blank');
    } finally {
      setIsExporting(false);
    }
  };

  const columns: Column<BrandCampaignSummary>[] = [
    {
      key: 'title',
      header: 'Campaign Name',
      render: (row) => (
        <div>
          <span className="font-semibold text-slate-900">{row.title}</span>
          <div className="text-[11px] text-slate-400 font-mono">ID #{row.campaign_id}</div>
        </div>
      ),
    },
    {
      key: 'budget',
      header: 'Total Budget',
      align: 'right',
      render: (row) => (
        <span className="font-semibold text-slate-900">
          ${row.budget ? row.budget.toLocaleString() : '0'}
        </span>
      ),
    },
    {
      key: 'shortlist_count',
      header: 'Shortlisted',
      align: 'right',
      render: (row) => <span className="font-mono text-slate-700">{row.shortlist_count}</span>,
    },
    {
      key: 'invitations_sent',
      header: 'Invited',
      align: 'right',
      render: (row) => <span className="font-mono text-slate-700">{row.invitations_sent}</span>,
    },
    {
      key: 'invitations_accepted',
      header: 'Confirmed (Accepted)',
      align: 'right',
      render: (row) => (
        <span className="font-bold text-emerald-700">{row.invitations_accepted}</span>
      ),
    },
    {
      key: 'acceptance_rate_pct',
      header: 'Acceptance Rate',
      align: 'right',
      render: (row) => (
        <Badge
          variant={row.acceptance_rate_pct >= 50 ? 'success' : row.acceptance_rate_pct > 0 ? 'brand' : 'neutral'}
          size="sm"
        >
          {row.acceptance_rate_pct}%
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (row) => {
        const isLive = ['active', 'published'].includes(row.status.toLowerCase());
        return (
          <Badge variant={isLive ? 'brand' : 'neutral'} size="sm">
            {row.status.toUpperCase()}
          </Badge>
        );
      },
    },
  ];

  // Funnel chart data transformation
  const funnelStages = data
    ? [
        {
          stage: '1. Shortlisted',
          count: data.funnel.stage_1_shortlisted,
          conversion: '100%',
          fill: '#0284c7',
        },
        {
          stage: '2. Invited',
          count: data.funnel.stage_2_invited,
          conversion: `${data.funnel.shortlist_to_invite_pct}% of shortlist`,
          fill: '#0ea5e9',
        },
        {
          stage: '3. Viewed',
          count: data.funnel.stage_3_viewed,
          conversion: `${data.funnel.invite_to_view_pct}% of invited`,
          fill: '#38bdf8',
        },
        {
          stage: '4. Responded',
          count: data.funnel.stage_4_responded,
          conversion: `${data.funnel.view_to_response_pct}% of viewed`,
          fill: '#10b981',
        },
        {
          stage: '5. Confirmed',
          count: data.funnel.stage_5_confirmed,
          conversion: `${data.funnel.response_to_confirm_pct}% of response`,
          fill: '#059669',
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Page Title & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            Campaign Activity &amp; Funnel Analytics
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time pipeline metrics, invitation response rates, and creator participation funnels.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="w-44">
            <Select
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
              options={[
                { value: 'all', label: 'All Campaigns' },
                ...campaigns.map((c) => ({
                  value: String(c.id),
                  label: c.title.length > 20 ? `${c.title.substring(0, 20)}...` : c.title,
                })),
              ]}
            />
          </div>

          <div className="w-36">
            <Select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              options={[
                { value: '7d', label: 'Last 7 Days' },
                { value: '30d', label: 'Last 30 Days' },
                { value: '90d', label: 'Last Quarter' },
                { value: 'all', label: 'All Time' },
              ]}
            />
          </div>

          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Icon name="Download" size="sm" />}
            onClick={handleExportCsv}
            disabled={isExporting}
          >
            {isExporting ? 'Exporting...' : 'Export CSV'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            leftIcon={<Icon name="RotateCw" size="sm" />}
            onClick={loadData}
            disabled={loading}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Error alert */}
      {errorMessage && (
        <Alert variant="danger" title="Analytics Load Error" onClose={() => setErrorMessage(null)}>
          {errorMessage}
        </Alert>
      )}

      {/* View Mode Switcher Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => setViewMode('overview')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 flex items-center gap-2 transition-all ${
            viewMode === 'overview'
              ? 'border-sky-600 text-sky-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Icon name="Activity" size="xs" />
          Campaign Pipeline &amp; Funnel Activity
        </button>
        <button
          type="button"
          onClick={() => setViewMode('forecasting')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 flex items-center gap-2 transition-all ${
            viewMode === 'forecasting'
              ? 'border-sky-600 text-sky-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Icon name="TrendingUp" size="xs" />
          Sales Potential &amp; Outcome Forecaster
        </button>
      </div>

      {viewMode === 'forecasting' ? (
        <div className="space-y-4">
          <CampaignForecastingPanel
            campaignId={selectedCampaignId !== 'all' ? Number(selectedCampaignId) : undefined}
            campaignTitle={
              selectedCampaignId !== 'all'
                ? campaigns.find((c) => String(c.id) === selectedCampaignId)?.title
                : undefined
            }
            initialCost={
              selectedCampaignId !== 'all'
                ? campaigns.find((c) => String(c.id) === selectedCampaignId)?.budget
                : 2500
            }
          />
        </div>
      ) : (
        <>
          {/* Transparency & Scope Disclaimer Banner */}
          <div className="bg-sky-50 border border-sky-200 p-3.5 rounded-[6px] text-xs text-sky-900 flex items-start gap-2.5">
            <Icon name="Info" size="sm" className="text-sky-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>Application Event Provenance:</strong>{' '}
              {data?.platform_vs_social_disclaimer ||
                'Platform activity is aggregated from live shortlist and invitation states. External social post impressions, reach, sales conversions, and ROI attribution require third-party tracking pixels not enabled in this phase.'}
            </div>
          </div>

      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Campaigns */}
        <Card orientation="vertical" padding="md" className="border-l-4 border-l-sky-500 bg-white">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Campaigns</span>
            <Icon name="Briefcase" size="sm" className="text-sky-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {loading ? '...' : data?.active_campaigns ?? 0}
          </div>
          <div className="text-xs text-slate-500 mt-1 font-medium">
            {data?.total_campaigns ?? 0} total campaigns · {data?.draft_campaigns ?? 0} drafts
          </div>
        </Card>

        {/* Shortlisted Creators */}
        <Card orientation="vertical" padding="md" className="border-l-4 border-l-indigo-500 bg-white">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Shortlist Pipeline</span>
            <Icon name="Bookmark" size="sm" className="text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {loading ? '...' : data?.total_shortlisted ?? 0}
          </div>
          <div className="text-xs text-slate-500 mt-1 font-medium">
            Candidates evaluated across active campaigns
          </div>
        </Card>

        {/* Invitations Sent & Response Rate */}
        <Card orientation="vertical" padding="md" className="border-l-4 border-l-emerald-500 bg-white">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Response Rate</span>
            <Icon name="Send" size="sm" className="text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {loading ? '...' : `${data?.response_rate_pct ?? 0}%`}
          </div>
          <div className="text-xs text-emerald-700 mt-1 font-medium">
            {data?.invitations_accepted ?? 0} accepted · {data?.total_invitations_sent ?? 0} total sent
          </div>
        </Card>

        {/* Committed Compensation */}
        <Card orientation="vertical" padding="md" className="border-l-4 border-l-amber-500 bg-white">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Committed Payout</span>
            <Icon name="DollarSign" size="sm" className="text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {loading ? '...' : `$${(data?.total_committed_compensation ?? 0).toLocaleString()}`}
          </div>
          <div className="text-xs text-slate-500 mt-1 font-medium">
            Allocated across confirmed partnerships
          </div>
        </Card>
      </div>

      {/* Visual Analytics Grid: Funnel & Daily Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Participation Funnel Card */}
        <Card orientation="vertical" padding="md" className="bg-white">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-base font-bold text-slate-900">Creator Participation Funnel</h3>
              <p className="text-xs text-slate-500">
                Progression from initial shortlist bookmarking to partnership confirmation.
              </p>
            </div>
            <Badge variant="brand" size="sm">
              {data?.acceptance_rate_pct ?? 0}% Overall Conversion
            </Badge>
          </div>

          {loading ? (
            <div className="h-64 flex items-center justify-center text-slate-400 text-xs">
              <Icon name="RotateCw" size="md" className="animate-spin text-sky-600 mr-2" />
              Loading participation funnel...
            </div>
          ) : funnelStages.every((s) => s.count === 0) ? (
            <div className="h-64 flex items-center justify-center">
              <EmptyState
                title="No Funnel Data Yet"
                description="Shortlist and invite creators to generate live participation conversion metrics."
                icon="Layers"
              />
            </div>
          ) : (
            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnelStages} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" stroke="#64748b" fontSize={11} />
                  <YAxis type="category" dataKey="stage" stroke="#64748b" fontSize={11} width={95} />
                  <Tooltip
                    formatter={(value: any, _name: any, item: any) => [
                      `${value} creators (${item.payload.conversion})`,
                      'Creators',
                    ]}
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: '6px', fontSize: '12px' }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {funnelStages.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Daily Activity Timeline Card */}
        <Card orientation="vertical" padding="md" className="bg-white">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-base font-bold text-slate-900">Collaboration Activity Trend</h3>
              <p className="text-xs text-slate-500">
                Daily volume of creator shortlists, sent outreach, and accepted partnerships.
              </p>
            </div>
            <span className="text-xs text-slate-400 font-mono">Date Aggregated</span>
          </div>

          {loading ? (
            <div className="h-64 flex items-center justify-center text-slate-400 text-xs">
              <Icon name="RotateCw" size="md" className="animate-spin text-sky-600 mr-2" />
              Loading timeline trend...
            </div>
          ) : !data || data.daily_activity.length === 0 ? (
            <div className="h-64 flex items-center justify-center">
              <EmptyState
                title="No Activity in Period"
                description="Activity over time will chart here as your brand shortlists and invites creators."
                icon="TrendingUp"
              />
            </div>
          ) : (
            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.daily_activity} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorInvites" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0284c7" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#0284c7" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorAccepts" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={10} />
                  <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: '6px', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Area
                    type="monotone"
                    dataKey="invitations_sent"
                    name="Invites Sent"
                    stroke="#0284c7"
                    fillOpacity={1}
                    fill="url(#colorInvites)"
                  />
                  <Area
                    type="monotone"
                    dataKey="invitations_accepted"
                    name="Invites Accepted"
                    stroke="#10b981"
                    fillOpacity={1}
                    fill="url(#colorAccepts)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {/* Campaign Detailed Performance Table */}
      <Card orientation="vertical" padding="md" className="bg-white">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Campaign-Level Activity Summary</h3>
            <p className="text-xs text-slate-500">
              Granular breakdown of budgets, creator engagement, and acceptance rates by campaign.
            </p>
          </div>
          <Badge variant="brand" size="sm">
            {data?.campaigns_summary.length ?? 0} Campaigns
          </Badge>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading campaign summaries...</div>
        ) : !data || data.campaigns_summary.length === 0 ? (
          <EmptyState
            title="No Campaigns Found"
            description="Create campaigns to start tracking individual response and participation metrics."
            icon="Briefcase"
          />
        ) : (
          <Table
            columns={columns}
            data={data.campaigns_summary}
            keyExtractor={(row) => String(row.campaign_id)}
          />
        )}
      </Card>
        </>
      )}
    </div>
  );
};

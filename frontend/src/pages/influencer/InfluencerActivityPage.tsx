import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { api } from '../../api/client';
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
  CreatorAnalyticsData,
  CreatorRecentActivity,
} from '../../types';

export const InfluencerActivityPage: React.FC = () => {
  const [data, setData] = useState<CreatorAnalyticsData | null>(null);
  const [timeRange, setTimeRange] = useState<string>('30d');
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
      const analyticsData = await api.analytics.creator({
        start_date: startDate,
        end_date: endDate,
      });
      setData(analyticsData);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load creator analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [timeRange]);

  const [isExporting, setIsExporting] = useState(false);

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const { startDate, endDate } = calculateDateRange(timeRange);
      const filename = `influencer_activity_${new Date().toISOString().split('T')[0]}.csv`;
      await api.analytics.exportCreatorCsv(filename, {
        start_date: startDate,
        end_date: endDate,
      });
    } catch {
      const { startDate, endDate } = calculateDateRange(timeRange);
      const exportUrl = api.analytics.exportCreatorUrl({
        start_date: startDate,
        end_date: endDate,
      });
      window.open(exportUrl, '_blank');
    } finally {
      setIsExporting(false);
    }
  };

  const columns: Column<CreatorRecentActivity>[] = [
    {
      key: 'campaignTitle',
      header: 'Campaign & Brand',
      render: (row) => (
        <div>
          <div className="font-semibold text-slate-900">{row.campaign_title}</div>
          <div className="text-xs text-slate-500 font-medium">{row.brand_name}</div>
        </div>
      ),
    },
    {
      key: 'compensation_offered',
      header: 'Offered Compensation',
      align: 'right',
      render: (row) => (
        <span className="font-bold text-slate-900">
          ${row.compensation_offered ? row.compensation_offered.toLocaleString() : '0'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Invitation Status',
      align: 'center',
      render: (row) => {
        const st = row.status.toLowerCase();
        const variant =
          st === 'accepted' ? 'success' : st === 'declined' ? 'danger' : 'warning';
        return <Badge variant={variant} size="sm">{row.status.toUpperCase()}</Badge>;
      },
    },
    {
      key: 'created_at',
      header: 'Received On',
      render: (row) => (
        <span className="text-xs text-slate-600">
          {new Date(row.created_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'responded_at',
      header: 'Responded On',
      render: (row) => (
        <span className="text-xs text-slate-500">
          {row.responded_at ? new Date(row.responded_at).toLocaleDateString() : 'Awaiting decision'}
        </span>
      ),
    },
  ];

  // Invitations status breakdown for Pie Chart
  const statusPieData = data
    ? [
        { name: 'Accepted', value: data.invitations.accepted, color: '#10b981' },
        { name: 'Declined', value: data.invitations.declined, color: '#f43f5e' },
        { name: 'Pending', value: data.invitations.pending, color: '#0ea5e9' },
        { name: 'Expired', value: data.invitations.expired, color: '#94a3b8' },
      ].filter((item) => item.value > 0)
    : [];

  // Opportunities chart data
  const opportunitiesBarData = data
    ? [
        {
          name: 'Total Eligible',
          count: data.opportunities.total_eligible_opportunities,
          fill: '#0284c7',
        },
        {
          name: 'Saved by You',
          count: data.opportunities.saved_opportunities,
          fill: '#10b981',
        },
        {
          name: 'Dismissed',
          count: data.opportunities.dismissed_opportunities,
          fill: '#94a3b8',
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Page Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            Influencer Collaboration Analytics
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Track campaign opportunities, brand invitation response history, and profile data freshness.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
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

      {errorMessage && (
        <Alert variant="danger" title="Error" onClose={() => setErrorMessage(null)}>
          {errorMessage}
        </Alert>
      )}

      {/* Transparency Banner */}
      <div className="bg-sky-50 border border-sky-200 p-3.5 rounded-[6px] text-xs text-sky-900 flex items-start gap-2.5">
        <Icon name="Info" size="sm" className="text-sky-600 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong>Collaboration Data Provenance:</strong>{' '}
          {data?.platform_vs_social_disclaimer ||
            'Platform metrics are computed directly from brand invitations and opportunity interactions. Post-campaign audience impressions, conversions, and attribution require platform social API sync.'}
        </div>
      </div>

      {/* Top Level Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Partnerships */}
        <Card orientation="vertical" padding="md" className="border-l-4 border-l-emerald-500 bg-white">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Confirmed Partnerships</span>
            <Icon name="CheckCircle" size="sm" className="text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {loading ? '...' : data?.active_partnerships_count ?? 0}
          </div>
          <div className="text-xs text-emerald-700 mt-1 font-medium">
            Accepted brand campaign collaborations
          </div>
        </Card>

        {/* Total Earned Value */}
        <Card orientation="vertical" padding="md" className="border-l-4 border-l-sky-500 bg-white">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Earned Compensation</span>
            <Icon name="DollarSign" size="sm" className="text-sky-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {loading ? '...' : `$${(data?.invitations.total_earned_compensation ?? 0).toLocaleString()}`}
          </div>
          <div className="text-xs text-slate-500 mt-1 font-medium">
            Avg offer: ${(data?.invitations.avg_offer_value ?? 0).toLocaleString()}
          </div>
        </Card>

        {/* Response Rate */}
        <Card orientation="vertical" padding="md" className="border-l-4 border-l-indigo-500 bg-white">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Invitation Response</span>
            <Icon name="Clock" size="sm" className="text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {loading ? '...' : `${data?.invitations.response_rate_pct ?? 0}%`}
          </div>
          <div className="text-xs text-slate-500 mt-1 font-medium">
            {data?.invitations.accepted ?? 0} accepted · {data?.invitations.total_received ?? 0} total received
          </div>
        </Card>

        {/* Profile Completeness & Freshness */}
        <Card orientation="vertical" padding="md" className="border-l-4 border-l-amber-500 bg-white">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Profile Completeness</span>
            <Icon name="Shield" size="sm" className="text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {loading ? '...' : `${data?.freshness.profile_completeness_pct ?? 0}%`}
          </div>
          <div className="text-xs text-slate-500 mt-1 font-medium capitalize">
            Status: <strong>{data?.freshness.freshness_status ?? 'manual'}</strong>
          </div>
        </Card>
      </div>

      {/* Visual Analytics Grid: Opportunities vs Invitations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Invitations Status Breakdown Chart */}
        <Card orientation="vertical" padding="md" className="bg-white">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-base font-bold text-slate-900">Invitation Response Breakdown</h3>
              <p className="text-xs text-slate-500">Distribution of received brand collaboration offers.</p>
            </div>
            <Badge variant="brand" size="sm">
              {data?.invitations.total_received ?? 0} Total
            </Badge>
          </div>

          {loading ? (
            <div className="h-64 flex items-center justify-center text-slate-400 text-xs">
              <Icon name="RotateCw" size="md" className="animate-spin text-sky-600 mr-2" />
              Loading invitation analytics...
            </div>
          ) : statusPieData.length === 0 ? (
            <div className="h-64 flex items-center justify-center">
              <EmptyState
                title="No Invitations in Period"
                description="When brands discover your channel and send direct invitations, your response metrics will appear here."
                icon="Mail"
              />
            </div>
          ) : (
            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {statusPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => [`${val} invitations`, 'Volume']}
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: '6px', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Opportunities Feed Activity Chart */}
        <Card orientation="vertical" padding="md" className="bg-white">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-base font-bold text-slate-900">Campaign Opportunities Interaction</h3>
              <p className="text-xs text-slate-500">Discovered briefs vs your saved shortlists and dismissed feeds.</p>
            </div>
            <Badge variant="neutral" size="sm">Discovery Feed</Badge>
          </div>

          {loading ? (
            <div className="h-64 flex items-center justify-center text-slate-400 text-xs">
              <Icon name="RotateCw" size="md" className="animate-spin text-sky-600 mr-2" />
              Loading opportunity metrics...
            </div>
          ) : opportunitiesBarData.every((b) => b.count === 0) ? (
            <div className="h-64 flex items-center justify-center">
              <EmptyState
                title="No Opportunities Data"
                description="Explore the open campaign opportunities feed to save or pitch briefs."
                icon="Compass"
              />
            </div>
          ) : (
            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={opportunitiesBarData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                  <Tooltip
                    formatter={(val: any) => [`${val} campaigns`, 'Count']}
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: '6px', fontSize: '12px' }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {opportunitiesBarData.map((entry, index) => (
                      <Cell key={`bar-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {/* Recent Campaign Activity Table */}
      <Card orientation="vertical" padding="md" className="bg-white">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Recent Invitation &amp; Outreach Activity</h3>
            <p className="text-xs text-slate-500">Direct partnership offers and logged decision timestamps.</p>
          </div>
          <Badge variant="brand" size="sm">
            {data?.recent_activity.length ?? 0} Records
          </Badge>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading recent activity...</div>
        ) : !data || data.recent_activity.length === 0 ? (
          <EmptyState
            title="No Recent Activity"
            description="When brands send you campaign collaboration invitations, they will track here in real time."
            icon="Mail"
          />
        ) : (
          <Table
            columns={columns}
            data={data.recent_activity}
            keyExtractor={(row) => String(row.invitation_id)}
          />
        )}
      </Card>
    </div>
  );
};

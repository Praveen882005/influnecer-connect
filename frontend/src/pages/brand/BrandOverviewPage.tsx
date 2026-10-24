import React, { useEffect, useState } from 'react';
import { api } from '../../api';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  Table,
  type Column,
} from '../../design-system';
import type { BrandAnalyticsData, Campaign, ShortlistItem } from '../../types';

interface BrandOverviewProps {
  onNavigate: (routeId: string) => void;
}

export const BrandOverviewPage: React.FC<BrandOverviewProps> = ({ onNavigate }) => {
  const [analytics, setAnalytics] = useState<BrandAnalyticsData | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [shortlistItems, setShortlistItems] = useState<ShortlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchOverviewData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [analyticsRes, campaignsRes, shortlistRes] = await Promise.all([
        api.analytics.brand().catch(() => null),
        api.campaigns.getMyCampaigns().catch(() => [] as Campaign[]),
        api.shortlists.listItems().catch(() => [] as ShortlistItem[]),
      ]);
      setAnalytics(analyticsRes);
      setCampaigns(campaignsRes);
      setShortlistItems(shortlistRes);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to load brand overview telemetry.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOverviewData();
  }, []);

  const candidateColumns: Column<ShortlistItem>[] = [
    {
      key: 'creator_id',
      header: 'Creator Profile',
      render: (row) => {
        const displayName = row.creator?.display_name || row.creator?.handle || `Creator #${row.creator_id}`;
        const handleText = row.creator?.handle ? `@${row.creator.handle}` : `ID #${row.creator_id}`;
        return (
          <div>
            <div className="font-semibold text-slate-900 text-sm">
              {displayName}
            </div>
            <div className="text-[11px] text-slate-500 font-mono">{handleText}</div>
          </div>
        );
      },
    },
    {
      key: 'campaign_title',
      header: 'Campaign Scoped',
      render: (row) => (
        <span className="font-medium text-slate-800 text-xs">
          {row.campaign_title || 'General Pipeline'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Pipeline Stage',
      align: 'center',
      render: (row) => (
        <Badge
          variant={
            row.status === 'confirmed'
              ? 'success'
              : row.status === 'invited'
              ? 'brand'
              : row.status === 'declined'
              ? 'danger'
              : 'neutral'
          }
          size="sm"
        >
          {row.status.toUpperCase()}
        </Badge>
      ),
    },
    {
      key: 'notes',
      header: 'Evaluation Notes',
      render: (row) => (
        <span className="text-xs text-slate-600 line-clamp-1">
          {row.notes || '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Action',
      align: 'right',
      render: () => (
        <Button variant="ghost" size="xs" onClick={() => onNavigate('shortlists')}>
          Manage
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner Notice */}
      <div className="p-3 bg-sky-50 border border-sky-200 rounded-[6px] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-sky-900">
        <div className="flex items-center gap-2">
          <Icon name="Shield" size="sm" className="text-sky-600" />
          <span>
            <strong>Brand Bridge Governance:</strong> Direct milestone escrow and creator verification active.
          </span>
        </div>
        <button
          onClick={() => onNavigate('campaigns')}
          className="text-sky-700 hover:text-sky-900 font-semibold underline text-left sm:text-right"
        >
          + Launch Campaign Brief
        </button>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">Brand Campaign Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time pipeline metrics, creator candidate shortlists, and direct collaboration invitations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            leftIcon={<Icon name="Users" size="sm" />}
            onClick={() => onNavigate('discover')}
          >
            Discover Creators
          </Button>
          <Button
            variant="primary"
            leftIcon={<Icon name="Plus" size="sm" />}
            onClick={() => onNavigate('campaigns')}
          >
            New Campaign
          </Button>
        </div>
      </div>

      {errorMsg && (
        <Alert
          variant="danger"
          title="Telemetry Synchronization Alert"
          onClose={() => setErrorMsg(null)}
        >
          {errorMsg}
        </Alert>
      )}

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card orientation="vertical" padding="md" className="border-l-4 border-l-sky-500">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Campaigns</span>
            <Icon name="Briefcase" size="sm" className="text-sky-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {isLoading ? '...' : analytics?.active_campaigns ?? campaigns.filter((c) => c.status === 'active' || c.status === 'published').length}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {campaigns.length} total briefs initialized
          </div>
        </Card>

        <Card orientation="vertical" padding="md" className="border-l-4 border-l-indigo-500">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Shortlisted Candidates</span>
            <Icon name="Bookmark" size="sm" className="text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {isLoading ? '...' : analytics?.total_shortlisted ?? shortlistItems.length}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {analytics?.funnel?.stage_5_confirmed ?? 0} confirmed collaborations
          </div>
        </Card>

        <Card orientation="vertical" padding="md" className="border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Invitations Sent</span>
            <Icon name="Send" size="sm" className="text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {isLoading ? '...' : analytics?.total_invitations_sent ?? 0}
          </div>
          <div className="text-xs text-emerald-600 mt-1 flex items-center gap-1 font-medium">
            <Icon name="TrendingUp" size="xs" />
            {analytics?.response_rate_pct ?? 0}% creator response rate
          </div>
        </Card>

        <Card orientation="vertical" padding="md" className="border-l-4 border-l-teal-500">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Committed Budget</span>
            <Icon name="DollarSign" size="sm" className="text-teal-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            ${isLoading ? '...' : (analytics?.total_committed_compensation ?? 0).toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Agreed creator milestones
          </div>
        </Card>
      </div>

      {/* Subsystem Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card
          orientation="vertical"
          padding="md"
          className="hover:border-sky-400 transition-colors cursor-pointer"
          onClick={() => onNavigate('shortlists')}
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-sky-50 text-sky-600 rounded-lg">
              <Icon name="Users" size="md" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">Campaign Shortlists</h3>
              <p className="text-xs text-slate-500 mt-0.5">Evaluate candidates and send direct brief invitations.</p>
            </div>
          </div>
        </Card>

        <Card
          orientation="vertical"
          padding="md"
          className="hover:border-sky-400 transition-colors cursor-pointer"
          onClick={() => onNavigate('invitations')}
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <Icon name="Mail" size="md" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">Active Invitations</h3>
              <p className="text-xs text-slate-500 mt-0.5">Track creator acceptance decisions and terms.</p>
            </div>
          </div>
        </Card>

        <Card
          orientation="vertical"
          padding="md"
          className="hover:border-sky-400 transition-colors cursor-pointer"
          onClick={() => onNavigate('analytics')}
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <Icon name="BarChart2" size="md" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">Participation Funnel</h3>
              <p className="text-xs text-slate-500 mt-0.5">5-stage conversion funnels, daily timelines &amp; CSV export.</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Candidate Activity Table */}
      <Card orientation="vertical" padding="md">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Recent Candidate Pipeline Activity</h3>
            <p className="text-xs text-slate-500">Live candidates shortlisted across your active campaign briefs.</p>
          </div>
          <Button variant="ghost" size="xs" onClick={() => onNavigate('shortlists')}>
            View Full Shortlist
          </Button>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading candidate pipeline...</div>
        ) : shortlistItems.length === 0 ? (
          <EmptyState
            title="No Candidates Shortlisted Yet"
            description="Explore verified creators and save them to campaign shortlists to begin collaboration outreach."
            icon="Users"
          />
        ) : (
          <Table
            columns={candidateColumns}
            data={shortlistItems.slice(0, 5)}
            keyExtractor={(row) => String(row.id)}
          />
        )}
      </Card>
    </div>
  );
};

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
            <div className="font-bold font-['Manrope',sans-serif] text-[#17243A] text-sm">
              {displayName}
            </div>
            <div className="text-[11px] text-[#697386] font-mono">{handleText}</div>
          </div>
        );
      },
    },
    {
      key: 'campaign_title',
      header: 'Campaign Scoped',
      render: (row) => (
        <span className="font-semibold text-[#17243A] text-xs">
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
        <span className="text-xs text-[#697386] line-clamp-1">
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
    <div className="space-y-6 text-left">
      {/* Top Banner Notice */}
      <div className="p-3.5 bg-[#F0F4FE] border border-[#BFDBFE] rounded-[10px] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-[#1E3A8A]">
        <div className="flex items-center gap-2.5">
          <Icon name="Shield" size="sm" className="text-[#4169E1]" />
          <span>
            <strong>Brand Bridge Governance:</strong> Direct milestone escrow and creator verification active.
          </span>
        </div>
        <button
          onClick={() => onNavigate('campaigns')}
          className="text-[#4169E1] hover:text-[#2563EB] font-bold underline text-left sm:text-right cursor-pointer"
        >
          + Launch Campaign Brief
        </button>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-['Manrope',sans-serif] tracking-tight text-[#17243A]">Brand Campaign Dashboard</h1>
          <p className="text-sm text-[#697386] mt-1">
            Real-time pipeline metrics, creator candidate shortlists, and direct collaboration invitations.
          </p>
        </div>
        <div className="flex items-center gap-3">
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
        <Card orientation="vertical" padding="md" className="border-l-4 border-l-[#4169E1] rounded-[14px]">
          <div className="flex items-center justify-between text-[#697386] mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Active Campaigns</span>
            <Icon name="Briefcase" size="sm" className="text-[#4169E1]" />
          </div>
          <div className="text-2xl font-extrabold font-['Manrope',sans-serif] text-[#17243A]">
            {isLoading ? '...' : analytics?.active_campaigns ?? campaigns.filter((c) => c.status === 'active' || c.status === 'published').length}
          </div>
          <div className="text-xs text-[#697386] mt-1">
            {campaigns.length} total briefs initialized
          </div>
        </Card>

        <Card orientation="vertical" padding="md" className="border-l-4 border-l-[#4F46E5] rounded-[14px]">
          <div className="flex items-center justify-between text-[#697386] mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Shortlisted Candidates</span>
            <Icon name="Bookmark" size="sm" className="text-[#4F46E5]" />
          </div>
          <div className="text-2xl font-extrabold font-['Manrope',sans-serif] text-[#17243A]">
            {isLoading ? '...' : analytics?.total_shortlisted ?? shortlistItems.length}
          </div>
          <div className="text-xs text-[#697386] mt-1">
            {analytics?.funnel?.stage_5_confirmed ?? 0} confirmed collaborations
          </div>
        </Card>

        <Card orientation="vertical" padding="md" className="border-l-4 border-l-[#21865B] rounded-[14px]">
          <div className="flex items-center justify-between text-[#697386] mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Invitations Sent</span>
            <Icon name="Send" size="sm" className="text-[#21865B]" />
          </div>
          <div className="text-2xl font-extrabold font-['Manrope',sans-serif] text-[#17243A]">
            {isLoading ? '...' : analytics?.total_invitations_sent ?? 0}
          </div>
          <div className="text-xs text-[#21865B] mt-1 flex items-center gap-1 font-semibold">
            <Icon name="TrendingUp" size="xs" />
            {analytics?.response_rate_pct ?? 0}% creator response rate
          </div>
        </Card>

        <Card orientation="vertical" padding="md" className="border-l-4 border-l-[#0D9488] rounded-[14px]">
          <div className="flex items-center justify-between text-[#697386] mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Committed Budget</span>
            <Icon name="DollarSign" size="sm" className="text-[#0D9488]" />
          </div>
          <div className="text-2xl font-extrabold font-['Manrope',sans-serif] text-[#17243A]">
            ${isLoading ? '...' : (analytics?.total_committed_compensation ?? 0).toLocaleString()}
          </div>
          <div className="text-xs text-[#697386] mt-1">
            Agreed creator milestones
          </div>
        </Card>
      </div>

      {/* Subsystem Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card
          orientation="vertical"
          padding="md"
          className="hover:border-[#4169E1] rounded-[14px] transition-all cursor-pointer shadow-2xs hover:shadow-xs"
          onClick={() => onNavigate('discover')}
        >
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-[#DCE5FA] text-[#4169E1] rounded-[10px]">
              <Icon name="Zap" size="md" />
            </div>
            <div>
              <h3 className="font-bold font-['Manrope',sans-serif] text-[#17243A] text-sm">AI Brief Matching</h3>
              <p className="text-xs text-[#697386] mt-0.5">Semantic search with 4-signal ranking and suitability filters.</p>
            </div>
          </div>
        </Card>

        <Card
          orientation="vertical"
          padding="md"
          className="hover:border-[#C24141] rounded-[14px] transition-all cursor-pointer shadow-2xs hover:shadow-xs"
          onClick={() => onNavigate('discover')}
        >
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-[#FDF2F2] text-[#C24141] rounded-[10px]">
              <Icon name="ShieldAlert" size="md" />
            </div>
            <div>
              <h3 className="font-bold font-['Manrope',sans-serif] text-[#17243A] text-sm">Fraud Risk Auditor</h3>
              <p className="text-xs text-[#697386] mt-0.5">Audit bot signals, engagement asymmetry, and growth velocity.</p>
            </div>
          </div>
        </Card>

        <Card
          orientation="vertical"
          padding="md"
          className="hover:border-[#4F46E5] rounded-[14px] transition-all cursor-pointer shadow-2xs hover:shadow-xs"
          onClick={() => onNavigate('shortlists')}
        >
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-[#EEF2FF] text-[#4F46E5] rounded-[10px]">
              <Icon name="Star" size="md" />
            </div>
            <div>
              <h3 className="font-bold font-['Manrope',sans-serif] text-[#17243A] text-sm">Candidate Shortlists</h3>
              <p className="text-xs text-[#697386] mt-0.5">Review 5 trust indicators, delivery history &amp; send invites.</p>
            </div>
          </div>
        </Card>

        <Card
          orientation="vertical"
          padding="md"
          className="hover:border-[#21865B] rounded-[14px] transition-all cursor-pointer shadow-2xs hover:shadow-xs"
          onClick={() => onNavigate('analytics')}
        >
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-[#E8F5EE] text-[#21865B] rounded-[10px]">
              <Icon name="TrendingUp" size="md" />
            </div>
            <div>
              <h3 className="font-bold font-['Manrope',sans-serif] text-[#17243A] text-sm">Forecast &amp; Outcomes</h3>
              <p className="text-xs text-[#697386] mt-0.5">Conservative/Baseline/Optimistic ROI simulator &amp; actuals variance.</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Candidate Activity Table */}
      <Card orientation="vertical" padding="md" className="rounded-[14px]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold font-['Manrope',sans-serif] text-[#17243A]">Recent Candidate Pipeline Activity</h3>
            <p className="text-xs text-[#697386]">Live candidates shortlisted across your active campaign briefs.</p>
          </div>
          <Button variant="ghost" size="xs" onClick={() => onNavigate('shortlists')}>
            View Full Shortlist
          </Button>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-xs text-[#697386]">Loading candidate pipeline...</div>
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

import React, { useEffect, useState } from 'react';
import { api } from '../../api';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  Table,
  type Column,
} from '../../design-system';
import type { CreatorAnalyticsData, WorkflowInvitation } from '../../types';

interface InfluencerOverviewProps {
  onNavigate: (routeId: string) => void;
}

export const InfluencerOverviewPage: React.FC<InfluencerOverviewProps> = ({ onNavigate }) => {
  const [analytics, setAnalytics] = useState<CreatorAnalyticsData | null>(null);
  const [invitations, setInvitations] = useState<WorkflowInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchOverview = async () => {
      setIsLoading(true);
      try {
        const [analyticsRes, invsRes] = await Promise.all([
          api.analytics.creator().catch(() => null),
          api.invitations.listCreator().catch(() => [] as WorkflowInvitation[]),
        ]);
        if (isMounted) {
          setAnalytics(analyticsRes);
          setInvitations(invsRes);
        }
      } catch {
        // Fallback gracefully
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchOverview();
    return () => {
      isMounted = false;
    };
  }, []);

  const activePartnerships = invitations.filter(
    (i) => i.status === 'accepted' || i.status === 'sent' || i.status === 'viewed'
  );

  const columns: Column<WorkflowInvitation>[] = [
    {
      key: 'campaign_title',
      header: 'Campaign Collaboration',
      render: (row) => (
        <div>
          <div className="font-bold font-['Manrope',sans-serif] text-[#17243A] text-sm">{row.campaign_title || 'Direct Brief'}</div>
          <div className="text-xs text-[#697386] font-medium">From: {row.brand_name || 'Brand Partner'}</div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Proposal Status',
      align: 'center',
      render: (row) => (
        <Badge
          variant={
            row.status === 'accepted'
              ? 'success'
              : row.status === 'sent' || row.status === 'viewed'
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
      key: 'compensation_offered',
      header: 'Compensation',
      align: 'right',
      render: (row) => (
        <span className="font-mono font-bold text-[#17243A] text-xs">
          ${(row.compensation_offered ?? 0).toLocaleString()} USD
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Received Date',
      render: (row) => (
        <span className="text-xs text-[#697386]">
          {new Date(row.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Action',
      align: 'right',
      render: () => (
        <Button variant="ghost" size="xs" onClick={() => onNavigate('invitations')}>
          Review
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6 text-left">
      {/* Top Banner Notice */}
      <div className="p-3.5 bg-[#F0F4FE] border border-[#BFDBFE] rounded-[10px] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-[#1E3A8A]">
        <div className="flex items-center gap-2.5">
          <Icon name="CheckCircle" size="sm" className="text-[#4169E1]" />
          <span>
            <strong>Creator Workspace:</strong> Profile verification and direct brand invitation pipeline active.
          </span>
        </div>
        <button
          onClick={() => onNavigate('opportunities')}
          className="text-[#4169E1] hover:text-[#2563EB] font-bold underline text-left sm:text-right cursor-pointer"
        >
          Explore Open Opportunities &rarr;
        </button>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-['Manrope',sans-serif] tracking-tight text-[#17243A]">Creator Collaboration Hub</h1>
          <p className="text-sm text-[#697386] mt-1">
            Track active partnerships, review incoming brand offers, and monitor profile completeness.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            leftIcon={<Icon name="Compass" size="sm" />}
            onClick={() => onNavigate('opportunities')}
          >
            Find Opportunities
          </Button>
          <Button
            variant="primary"
            leftIcon={<Icon name="Mail" size="sm" />}
            onClick={() => onNavigate('invitations')}
          >
            Invitations ({invitations.filter((i) => i.status === 'sent' || i.status === 'viewed').length})
          </Button>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card orientation="vertical" padding="md" className="border-l-4 border-l-[#4169E1] rounded-[14px]">
          <div className="flex items-center justify-between text-[#697386] mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Open Opportunities</span>
            <Icon name="Compass" size="sm" className="text-[#4169E1]" />
          </div>
          <div className="text-2xl font-extrabold font-['Manrope',sans-serif] text-[#17243A]">
            {isLoading ? '...' : analytics?.opportunities.total_eligible_opportunities ?? 0}
          </div>
          <div className="text-xs text-[#697386] mt-1">
            {analytics?.opportunities.saved_opportunities ?? 0} saved briefs
          </div>
        </Card>

        <Card orientation="vertical" padding="md" className="border-l-4 border-l-[#21865B] rounded-[14px]">
          <div className="flex items-center justify-between text-[#697386] mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Earned Compensation</span>
            <Icon name="DollarSign" size="sm" className="text-[#21865B]" />
          </div>
          <div className="text-2xl font-extrabold font-['Manrope',sans-serif] text-[#17243A]">
            ${isLoading ? '...' : (analytics?.invitations.total_earned_compensation ?? 0).toLocaleString()}
          </div>
          <div className="text-xs text-[#21865B] mt-1 flex items-center gap-1 font-semibold">
            <Icon name="TrendingUp" size="xs" />
            {analytics?.active_partnerships_count ?? 0} confirmed partnerships
          </div>
        </Card>

        <Card orientation="vertical" padding="md" className="border-l-4 border-l-[#4F46E5] rounded-[14px]">
          <div className="flex items-center justify-between text-[#697386] mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Offers Received</span>
            <Icon name="Mail" size="sm" className="text-[#4F46E5]" />
          </div>
          <div className="text-2xl font-extrabold font-['Manrope',sans-serif] text-[#17243A]">
            {isLoading ? '...' : analytics?.invitations.total_received ?? invitations.length}
          </div>
          <div className="text-xs text-[#697386] mt-1">
            {analytics?.invitations.response_rate_pct ?? 0}% response rate
          </div>
        </Card>

        <Card orientation="vertical" padding="md" className="border-l-4 border-l-[#B7791F] rounded-[14px]">
          <div className="flex items-center justify-between text-[#697386] mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Profile Completeness</span>
            <Icon name="CheckCircle" size="sm" className="text-[#B7791F]" />
          </div>
          <div className="text-2xl font-extrabold font-['Manrope',sans-serif] text-[#17243A]">
            {isLoading ? '...' : `${analytics?.freshness.profile_completeness_pct ?? 0}%`}
          </div>
          <div className="text-xs text-[#697386] mt-1 capitalize">
            Data status: {analytics?.freshness.freshness_status ?? 'verified'}
          </div>
        </Card>
      </div>

      {/* Subsystem Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card
          orientation="vertical"
          padding="md"
          className="hover:border-[#4169E1] rounded-[14px] transition-all cursor-pointer shadow-2xs hover:shadow-xs"
          onClick={() => onNavigate('opportunities')}
        >
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-[#DCE5FA] text-[#4169E1] rounded-[10px]">
              <Icon name="Zap" size="md" />
            </div>
            <div>
              <h3 className="font-bold font-['Manrope',sans-serif] text-[#17243A] text-sm">Opportunity Feed</h3>
              <p className="text-xs text-[#697386] mt-0.5">Explore active brand campaigns matching your profile.</p>
            </div>
          </div>
        </Card>

        <Card
          orientation="vertical"
          padding="md"
          className="hover:border-[#4F46E5] rounded-[14px] transition-all cursor-pointer shadow-2xs hover:shadow-xs"
          onClick={() => onNavigate('invitations')}
        >
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-[#EEF2FF] text-[#4F46E5] rounded-[10px]">
              <Icon name="Inbox" size="md" />
            </div>
            <div>
              <h3 className="font-bold font-['Manrope',sans-serif] text-[#17243A] text-sm">Direct Invitations</h3>
              <p className="text-xs text-[#697386] mt-0.5">Review exclusive brand collaboration proposals.</p>
            </div>
          </div>
        </Card>

        <Card
          orientation="vertical"
          padding="md"
          className="hover:border-[#21865B] rounded-[14px] transition-all cursor-pointer shadow-2xs hover:shadow-xs"
          onClick={() => onNavigate('activity')}
        >
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-[#E8F5EE] text-[#21865B] rounded-[10px]">
              <Icon name="Activity" size="md" />
            </div>
            <div>
              <h3 className="font-bold font-['Manrope',sans-serif] text-[#17243A] text-sm">Deliverables &amp; Proof</h3>
              <p className="text-xs text-[#697386] mt-0.5">Submit post URLs, track milestone payouts &amp; status.</p>
            </div>
          </div>
        </Card>

        <Card
          orientation="vertical"
          padding="md"
          className="hover:border-[#B7791F] rounded-[14px] transition-all cursor-pointer shadow-2xs hover:shadow-xs"
          onClick={() => onNavigate('profile')}
        >
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-[#FEF7EC] text-[#B7791F] rounded-[10px]">
              <Icon name="User" size="md" />
            </div>
            <div>
              <h3 className="font-bold font-['Manrope',sans-serif] text-[#17243A] text-sm">Media Kit Profile</h3>
              <p className="text-xs text-[#697386] mt-0.5">Manage connected platforms, audience demographics &amp; bio.</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Active Partnerships & Offers Table */}
      <Card orientation="vertical" padding="md" className="rounded-[14px]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold font-['Manrope',sans-serif] text-[#17243A]">Active Campaign Collaborations &amp; Offers</h3>
            <p className="text-xs text-[#697386]">Live brand partnerships requiring milestone submission or offer review.</p>
          </div>
          <Button variant="ghost" size="xs" onClick={() => onNavigate('invitations')}>
            View All Offers
          </Button>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-xs text-[#697386]">Loading active collaborations...</div>
        ) : activePartnerships.length === 0 ? (
          <EmptyState
            title="No Active Partnerships Yet"
            description="Browse open brand briefs or respond to invitations to begin sponsored collaborations."
            icon="Inbox"
          />
        ) : (
          <Table
            columns={columns}
            data={activePartnerships.slice(0, 5)}
            keyExtractor={(row) => String(row.id)}
          />
        )}
      </Card>
    </div>
  );
};

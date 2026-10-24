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
          <div className="font-semibold text-slate-900 text-sm">{row.campaign_title || 'Direct Brief'}</div>
          <div className="text-xs text-slate-500 font-medium">From: {row.brand_name || 'Brand Partner'}</div>
        </div>
      ),
    },
    {
      key: 'deliverables_requested',
      header: 'Deliverables Scope',
      render: (row) => (
        <span className="text-xs text-slate-700 line-clamp-1">
          {row.deliverables_requested?.join(', ') || row.message || 'Standard Deliverables'}
        </span>
      ),
    },
    {
      key: 'compensation_offered',
      header: 'Agreed / Offered Fee',
      align: 'right',
      render: (row) => (
        <span className="font-bold text-slate-900 text-sm">
          {row.compensation_offered ? `$${row.compensation_offered.toLocaleString()}` : 'Negotiable'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
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
    <div className="space-y-6">
      {/* Top Banner Notice */}
      <div className="p-3 bg-sky-50 border border-sky-200 rounded-[6px] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-sky-900">
        <div className="flex items-center gap-2">
          <Icon name="CheckCircle" size="sm" className="text-sky-600" />
          <span>
            <strong>Creator Workspace:</strong> Profile verification and direct brand invitation pipeline active.
          </span>
        </div>
        <button
          onClick={() => onNavigate('opportunities')}
          className="text-sky-700 hover:text-sky-900 font-semibold underline text-left sm:text-right"
        >
          Explore Open Opportunities &rarr;
        </button>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">Creator Collaboration Hub</h1>
          <p className="text-sm text-slate-500 mt-1">
            Track active partnerships, review incoming brand offers, and monitor profile completeness.
          </p>
        </div>
        <div className="flex items-center gap-2">
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
        <Card orientation="vertical" padding="md" className="border-l-4 border-l-sky-500">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Open Opportunities</span>
            <Icon name="Compass" size="sm" className="text-sky-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {isLoading ? '...' : analytics?.opportunities.total_eligible_opportunities ?? 0}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {analytics?.opportunities.saved_opportunities ?? 0} saved briefs
          </div>
        </Card>

        <Card orientation="vertical" padding="md" className="border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Earned Compensation</span>
            <Icon name="DollarSign" size="sm" className="text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            ${isLoading ? '...' : (analytics?.invitations.total_earned_compensation ?? 0).toLocaleString()}
          </div>
          <div className="text-xs text-emerald-600 mt-1 flex items-center gap-1 font-medium">
            <Icon name="TrendingUp" size="xs" />
            {analytics?.active_partnerships_count ?? 0} confirmed partnerships
          </div>
        </Card>

        <Card orientation="vertical" padding="md" className="border-l-4 border-l-indigo-500">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Offers Received</span>
            <Icon name="Mail" size="sm" className="text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {isLoading ? '...' : analytics?.invitations.total_received ?? invitations.length}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {analytics?.invitations.response_rate_pct ?? 0}% response rate
          </div>
        </Card>

        <Card orientation="vertical" padding="md" className="border-l-4 border-l-teal-500">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Profile Completeness</span>
            <Icon name="CheckCircle" size="sm" className="text-teal-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {isLoading ? '...' : `${analytics?.freshness.profile_completeness_pct ?? 0}%`}
          </div>
          <div className="text-xs text-slate-500 mt-1 capitalize">
            Data status: {analytics?.freshness.freshness_status ?? 'verified'}
          </div>
        </Card>
      </div>

      {/* Subsystem Navigation */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card
          orientation="vertical"
          padding="md"
          className="hover:border-sky-400 transition-colors cursor-pointer"
          onClick={() => onNavigate('opportunities')}
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-sky-50 text-sky-600 rounded-lg">
              <Icon name="Compass" size="md" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">Campaign Opportunities</h3>
              <p className="text-xs text-slate-500 mt-0.5">Explore active briefs with explainable fit scores.</p>
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
              <h3 className="font-semibold text-slate-900 text-sm">Direct Brand Invitations</h3>
              <p className="text-xs text-slate-500 mt-0.5">Review partnership scopes, deliverables, and fees.</p>
            </div>
          </div>
        </Card>

        <Card
          orientation="vertical"
          padding="md"
          className="hover:border-sky-400 transition-colors cursor-pointer"
          onClick={() => onNavigate('activity')}
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <Icon name="BarChart2" size="md" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">Collaboration Analytics</h3>
              <p className="text-xs text-slate-500 mt-0.5">Response charts, earned fees breakdown &amp; CSV export.</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Active Deliverables / Collaborations Table */}
      <Card orientation="vertical" padding="md">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Active Brand Collaborations &amp; Offers</h3>
            <p className="text-xs text-slate-500">Pending offers and confirmed deliverables tracking.</p>
          </div>
          <Button variant="ghost" size="xs" onClick={() => onNavigate('invitations')}>
            View All Invitations
          </Button>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading active collaborations...</div>
        ) : activePartnerships.length === 0 ? (
          <EmptyState
            title="No Active Collaborations Yet"
            description="When brands extend direct collaboration invitations, they will appear here for review and deliverable tracking."
            icon="Mail"
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

import React, { useEffect, useState } from 'react';
import { api } from '../../api';
import {
  Badge,
  Button,
  Card,
  Icon,
  Table,
  type Column,
} from '../../design-system';
import type { AdminAuditEventItem, AdminOverviewData } from '../../types';

interface AdminOverviewProps {
  onNavigate: (routeId: string) => void;
}

export const AdminOverviewPage: React.FC<AdminOverviewProps> = ({ onNavigate }) => {
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [recentAudits, setRecentAudits] = useState<AdminAuditEventItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchOverview = async () => {
      try {
        const [overviewRes, auditRes] = await Promise.all([
          api.admin.overview(),
          api.admin.auditEvents({ per_page: 5 }),
        ]);
        if (isMounted) {
          setData(overviewRes);
          setRecentAudits(auditRes.items || []);
        }
      } catch {
        // Fallback gracefully on network error
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchOverview();
    return () => {
      isMounted = false;
    };
  }, []);

  const columns: Column<AdminAuditEventItem>[] = [
    {
      key: 'created_at',
      header: 'Time (UTC)',
      render: (row) => (
        <span className="text-xs text-slate-500 font-mono">
          {new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      ),
    },
    {
      key: 'user_email',
      header: 'Actor',
      render: (row) => (
        <span className="font-semibold text-slate-900 text-xs">
          {row.user_email || 'System / Unauthenticated'}
        </span>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      render: (row) => (
        <Badge variant="neutral" size="sm" className="font-mono text-xs">
          {row.action}
        </Badge>
      ),
    },
    {
      key: 'resource_type',
      header: 'Resource',
      render: (row) => (
        <span className="text-xs text-slate-700">
          {row.resource_type} {row.resource_id ? `#${row.resource_id}` : ''}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Result',
      align: 'center',
      render: (row) => (
        <Badge
          variant={
            row.status.toLowerCase() === 'success'
              ? 'success'
              : row.status.toLowerCase() === 'denied'
              ? 'warning'
              : 'danger'
          }
          size="sm"
        >
          {row.status.toUpperCase()}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">System Operations &amp; Governance</h1>
            <Badge variant="brand" size="sm">Admin Root Console</Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Real-time platform throughput, user registry health, and matching engine telemetry.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            leftIcon={<Icon name="Database" size="sm" />}
            onClick={() => onNavigate('data-imports')}
          >
            Data Ingestion
          </Button>
          <Button
            variant="primary"
            leftIcon={<Icon name="ActivitySquare" size="sm" />}
            onClick={() => onNavigate('system-health')}
          >
            {isLoading ? 'Checking Health...' : data?.readiness_status === 'ready' ? 'System Status (Ready)' : 'System Status (Degraded)'}
          </Button>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card orientation="vertical" padding="md" className="border-l-4 border-l-sky-500">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Registered Users</span>
            <Icon name="Users" size="sm" className="text-sky-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {isLoading ? '...' : (data?.total_users ?? 0).toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {data?.users_by_role?.brand ?? 0} Brands · {data?.users_by_role?.creator ?? 0} Creators · {data?.users_by_role?.admin ?? 0} Admins
          </div>
        </Card>

        <Card orientation="vertical" padding="md" className="border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Campaigns</span>
            <Icon name="Briefcase" size="sm" className="text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {isLoading ? '...' : `${data?.active_campaigns ?? 0} Active`}
          </div>
          <div className="text-xs text-emerald-600 mt-1 flex items-center gap-1 font-medium">
            <Icon name="TrendingUp" size="xs" />
            {data?.total_campaigns ?? 0} total campaigns initialized
          </div>
        </Card>

        <Card orientation="vertical" padding="md" className="border-l-4 border-l-indigo-500">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Invitations &amp; Workflows</span>
            <Icon name="Mail" size="sm" className="text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {isLoading ? '...' : (data?.total_invitations ?? 0).toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {data?.total_shortlists ?? 0} shortlists · {data?.total_proposals ?? 0} pitches
          </div>
        </Card>

        <Card orientation="vertical" padding="md" className="border-l-4 border-l-teal-500">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Audit Events (24h)</span>
            <Icon name="Shield" size="sm" className="text-teal-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {isLoading ? '...' : (data?.audit_events_24h ?? 0).toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 mt-1 font-medium">
            Immutable security trail verified
          </div>
        </Card>
      </div>

      {/* Subsystem Shortcuts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card
          orientation="vertical"
          padding="md"
          className="hover:border-sky-400 transition-colors cursor-pointer"
          onClick={() => onNavigate('users')}
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-sky-50 text-sky-600 rounded-lg">
              <Icon name="Users" size="md" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">User Directory Management</h3>
              <p className="text-xs text-slate-500 mt-0.5">Manage roles, statuses, and safe suspensions.</p>
            </div>
          </div>
        </Card>

        <Card
          orientation="vertical"
          padding="md"
          className="hover:border-sky-400 transition-colors cursor-pointer"
          onClick={() => onNavigate('models')}
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <Icon name="Cpu" size="md" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">AI Model Registry</h3>
              <p className="text-xs text-slate-500 mt-0.5">Inspect all-MiniLM-L6-v2, architectures, and cache.</p>
            </div>
          </div>
        </Card>

        <Card
          orientation="vertical"
          padding="md"
          className="hover:border-sky-400 transition-colors cursor-pointer"
          onClick={() => onNavigate('audit-events')}
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <Icon name="FileText" size="md" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">Immutable Audit Logs</h3>
              <p className="text-xs text-slate-500 mt-0.5">Inspect compliance, roles, and security events.</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Platform Operations */}
      <Card orientation="vertical" padding="md">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Recent Platform Audit Events</h3>
            <p className="text-xs text-slate-500">Live feed of transactions, administrative actions, and security logs.</p>
          </div>
          <Button variant="ghost" size="xs" onClick={() => onNavigate('audit-events')}>
            View Full Audit Log
          </Button>
        </div>
        {recentAudits.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            {isLoading ? 'Loading audit records...' : 'No audit records logged yet.'}
          </div>
        ) : (
          <Table columns={columns} data={recentAudits} keyExtractor={(row) => String(row.id)} />
        )}
      </Card>
    </div>
  );
};

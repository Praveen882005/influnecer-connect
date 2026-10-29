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
        <span className="text-xs text-[#697386] font-mono">
          {new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      ),
    },
    {
      key: 'user_email',
      header: 'Actor',
      render: (row) => (
        <span className="font-semibold text-[#17243A] text-xs">
          {row.user_email || `User #${row.user_id || 'System'}`}
        </span>
      ),
    },
    {
      key: 'action',
      header: 'Action Event',
      render: (row) => (
        <span className="font-mono text-xs text-[#17243A] font-semibold">
          {row.action}
        </span>
      ),
    },
    {
      key: 'resource_type',
      header: 'Target Resource',
      render: (row) => (
        <span className="text-xs text-[#697386] font-mono">
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
          variant={row.status === 'success' ? 'success' : row.status === 'failure' ? 'danger' : 'neutral'}
          size="sm"
        >
          {row.status.toUpperCase()}
        </Badge>
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
            <strong>Master Admin Console:</strong> Platform-level oversight, role-based governance, and immutable audit logs active.
          </span>
        </div>
        <button
          onClick={() => onNavigate('system-health')}
          className="text-[#4169E1] hover:text-[#2563EB] font-bold underline text-left sm:text-right cursor-pointer"
        >
          View System Health &rarr;
        </button>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-['Manrope',sans-serif] tracking-tight text-[#17243A]">Admin Operations Center</h1>
          <p className="text-sm text-[#697386] mt-1">
            Global governance console for system health, platform users, AI model telemetry, and immutable audit trails.
          </p>
        </div>
        <div className="flex items-center gap-3">
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
        <Card orientation="vertical" padding="md" className="border-l-4 border-l-[#4169E1] rounded-[14px]">
          <div className="flex items-center justify-between text-[#697386] mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Registered Users</span>
            <Icon name="Users" size="sm" className="text-[#4169E1]" />
          </div>
          <div className="text-2xl font-extrabold font-['Manrope',sans-serif] text-[#17243A]">
            {isLoading ? '...' : (data?.total_users ?? 0).toLocaleString()}
          </div>
          <div className="text-xs text-[#697386] mt-1">
            {data?.users_by_role?.brand ?? 0} Brands · {data?.users_by_role?.creator ?? 0} Creators · {data?.users_by_role?.admin ?? 0} Admins
          </div>
        </Card>

        <Card orientation="vertical" padding="md" className="border-l-4 border-l-[#21865B] rounded-[14px]">
          <div className="flex items-center justify-between text-[#697386] mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Active Campaigns</span>
            <Icon name="Briefcase" size="sm" className="text-[#21865B]" />
          </div>
          <div className="text-2xl font-extrabold font-['Manrope',sans-serif] text-[#17243A]">
            {isLoading ? '...' : `${data?.active_campaigns ?? 0} Active`}
          </div>
          <div className="text-xs text-[#21865B] mt-1 flex items-center gap-1 font-semibold">
            <Icon name="TrendingUp" size="xs" />
            {data?.total_campaigns ?? 0} total campaigns initialized
          </div>
        </Card>

        <Card orientation="vertical" padding="md" className="border-l-4 border-l-[#4F46E5] rounded-[14px]">
          <div className="flex items-center justify-between text-[#697386] mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Invitations &amp; Workflows</span>
            <Icon name="Mail" size="sm" className="text-[#4F46E5]" />
          </div>
          <div className="text-2xl font-extrabold font-['Manrope',sans-serif] text-[#17243A]">
            {isLoading ? '...' : (data?.total_invitations ?? 0).toLocaleString()}
          </div>
          <div className="text-xs text-[#697386] mt-1">
            {data?.total_shortlists ?? 0} shortlists · {data?.total_proposals ?? 0} pitches
          </div>
        </Card>

        <Card orientation="vertical" padding="md" className="border-l-4 border-l-[#B7791F] rounded-[14px]">
          <div className="flex items-center justify-between text-[#697386] mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Audit Events (24h)</span>
            <Icon name="Shield" size="sm" className="text-[#B7791F]" />
          </div>
          <div className="text-2xl font-extrabold font-['Manrope',sans-serif] text-[#17243A]">
            {isLoading ? '...' : (data?.audit_events_24h ?? 0).toLocaleString()}
          </div>
          <div className="text-xs text-[#697386] mt-1 font-medium">
            Immutable security trail verified
          </div>
        </Card>
      </div>

      {/* Subsystem Shortcuts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card
          orientation="vertical"
          padding="md"
          className="hover:border-[#4169E1] rounded-[14px] transition-all cursor-pointer shadow-2xs hover:shadow-xs"
          onClick={() => onNavigate('users')}
        >
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-[#DCE5FA] text-[#4169E1] rounded-[10px]">
              <Icon name="UserCheck" size="md" />
            </div>
            <div>
              <h3 className="font-bold font-['Manrope',sans-serif] text-[#17243A] text-sm">User Management</h3>
              <p className="text-xs text-[#697386] mt-0.5">Filter roles, toggle active status, and audit accounts.</p>
            </div>
          </div>
        </Card>

        <Card
          orientation="vertical"
          padding="md"
          className="hover:border-[#4F46E5] rounded-[14px] transition-all cursor-pointer shadow-2xs hover:shadow-xs"
          onClick={() => onNavigate('data-imports')}
        >
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-[#EEF2FF] text-[#4F46E5] rounded-[10px]">
              <Icon name="Database" size="md" />
            </div>
            <div>
              <h3 className="font-bold font-['Manrope',sans-serif] text-[#17243A] text-sm">Data Ingestion</h3>
              <p className="text-xs text-[#697386] mt-0.5">Trigger seed data, sample fixtures &amp; bulk records.</p>
            </div>
          </div>
        </Card>

        <Card
          orientation="vertical"
          padding="md"
          className="hover:border-[#21865B] rounded-[14px] transition-all cursor-pointer shadow-2xs hover:shadow-xs"
          onClick={() => onNavigate('models')}
        >
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-[#E8F5EE] text-[#21865B] rounded-[10px]">
              <Icon name="Cpu" size="md" />
            </div>
            <div>
              <h3 className="font-bold font-['Manrope',sans-serif] text-[#17243A] text-sm">Model Registry</h3>
              <p className="text-xs text-[#697386] mt-0.5">Vector encoders, TF-IDF stats &amp; memory allocations.</p>
            </div>
          </div>
        </Card>

        <Card
          orientation="vertical"
          padding="md"
          className="hover:border-[#B7791F] rounded-[14px] transition-all cursor-pointer shadow-2xs hover:shadow-xs"
          onClick={() => onNavigate('audit-events')}
        >
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-[#FEF7EC] text-[#B7791F] rounded-[10px]">
              <Icon name="FileText" size="md" />
            </div>
            <div>
              <h3 className="font-bold font-['Manrope',sans-serif] text-[#17243A] text-sm">Audit Trail</h3>
              <p className="text-xs text-[#697386] mt-0.5">Security event logs, status changes &amp; IP telemetry.</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Security Audits Table */}
      <Card orientation="vertical" padding="md" className="rounded-[14px]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold font-['Manrope',sans-serif] text-[#17243A]">Recent Security &amp; Mutation Audits</h3>
            <p className="text-xs text-[#697386]">Latest 5 operational audit events captured by middleware telemetry.</p>
          </div>
          <Button variant="ghost" size="xs" onClick={() => onNavigate('audit-events')}>
            View All Events
          </Button>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-xs text-[#697386]">Loading audit trail...</div>
        ) : recentAudits.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#697386]">No audit events recorded yet.</div>
        ) : (
          <Table
            columns={columns}
            data={recentAudits}
            keyExtractor={(row) => String(row.id)}
          />
        )}
      </Card>
    </div>
  );
};

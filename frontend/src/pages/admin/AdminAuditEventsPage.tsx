import React, { useEffect, useState } from 'react';
import { api } from '../../api';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  Input,
  Modal,
  Select,
  Table,
  type Column,
} from '../../design-system';
import type { AdminAuditEventItem } from '../../types';

export const AdminAuditEventsPage: React.FC = () => {
  const [events, setEvents] = useState<AdminAuditEventItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [perPage] = useState(20);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');

  // Modal inspection
  const [inspectedEvent, setInspectedEvent] = useState<AdminAuditEventItem | null>(null);

  const fetchEvents = async () => {
    setIsLoading(true);
    try {
      const res = await api.admin.auditEvents({
        q: searchQuery.trim() || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        action: actionFilter !== 'all' ? actionFilter : undefined,
        page,
        per_page: perPage,
      });
      setEvents(res.items);
      setTotal(res.total);
      setPages(res.pages);
    } catch {
      // Graceful fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [page, statusFilter, actionFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchEvents();
  };

  const columns: Column<AdminAuditEventItem>[] = [
    {
      key: 'created_at',
      header: 'Timestamp (UTC)',
      render: (row) => (
        <span className="text-xs text-slate-500 font-mono">
          {new Date(row.created_at).toLocaleString([], {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}
        </span>
      ),
    },
    {
      key: 'user_email',
      header: 'Actor',
      render: (row) => (
        <div>
          <span className="font-semibold text-slate-900 text-xs">
            {row.user_email || 'System / Unauthenticated'}
          </span>
          {row.user_id && (
            <span className="text-slate-400 text-xs ml-1">(#{row.user_id})</span>
          )}
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Action / Event',
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
      key: 'ip_address',
      header: 'Client IP',
      render: (row) => (
        <span className="text-xs text-slate-500 font-mono">
          {row.ip_address || '—'}
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
    {
      key: 'actions',
      header: 'Details',
      align: 'right',
      render: (row) => (
        <Button variant="ghost" size="xs" onClick={() => setInspectedEvent(row)}>
          Inspect
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">Immutable Audit Log</h1>
            <Badge variant="brand" size="sm">{total} Recorded Events</Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Complete compliance trail of security events, administrative adjustments, and sensitive operations.
          </p>
        </div>
      </div>

      {/* Search & Filters */}
      <Card orientation="vertical" padding="md">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className="sm:col-span-5">
            <label className="block text-xs font-medium text-slate-700 mb-1">Search Audit Trails</label>
            <Input
              placeholder="Search action, resource, or actor email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Icon name="Search" size="sm" className="text-slate-400" />}
            />
          </div>

          <div className="sm:col-span-3">
            <label className="block text-xs font-medium text-slate-700 mb-1">Action Type</label>
            <Select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { value: 'all', label: 'All Actions' },
                { value: 'ADMIN_USER_STATUS_CHANGE', label: 'User Status Change' },
                { value: 'ADMIN_USER_ROLE_CHANGE', label: 'User Role Change' },
                { value: 'ADMIN_DIAGNOSTICS_RUN', label: 'Diagnostics Run' },
                { value: 'ADMIN_MODEL_CACHE_FLUSH', label: 'Model Cache Flush' },
                { value: 'USER_REGISTER', label: 'User Registration' },
              ]}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1">Result Status</label>
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { value: 'all', label: 'All Results' },
                { value: 'success', label: 'Success Only' },
                { value: 'denied', label: 'Denied / Blocked' },
                { value: 'failed', label: 'Failed Only' },
              ]}
            />
          </div>

          <div className="sm:col-span-2">
            <Button variant="primary" type="submit" className="w-full" leftIcon={<Icon name="Search" size="sm" />}>
              Filter Logs
            </Button>
          </div>
        </form>
      </Card>

      {/* Events Table */}
      <Card orientation="vertical" padding="md">
        {isLoading ? (
          <div className="py-16 text-center text-xs text-slate-400">Loading audit records...</div>
        ) : events.length === 0 ? (
          <EmptyState
            title="No Audit Events Found"
            description="No operations match your current query or filter parameters."
            icon="Shield"
          />
        ) : (
          <>
            <Table columns={columns} data={events} keyExtractor={(row) => String(row.id)} />

            {/* Pagination */}
            {pages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-3 text-xs text-slate-500">
                <span>
                  Showing page <strong className="text-slate-800">{page}</strong> of <strong className="text-slate-800">{pages}</strong> ({total} total records)
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="secondary"
                    size="xs"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="xs"
                    disabled={page >= pages}
                    onClick={() => setPage((p) => Math.min(pages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Inspected Event Details Modal */}
      <Modal
        isOpen={!!inspectedEvent}
        onClose={() => setInspectedEvent(null)}
        title={`Audit Event #${inspectedEvent?.id}: ${inspectedEvent?.action}`}
        size="lg"
      >
        {inspectedEvent && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
              <div>
                <span className="text-slate-500 block font-medium">Actor</span>
                <span className="font-semibold text-slate-900">{inspectedEvent.user_email || 'System'}</span>
              </div>
              <div>
                <span className="text-slate-500 block font-medium">Timestamp</span>
                <span className="font-mono text-slate-800">{inspectedEvent.created_at}</span>
              </div>
              <div>
                <span className="text-slate-500 block font-medium">Resource</span>
                <span className="font-medium text-slate-800">
                  {inspectedEvent.resource_type} {inspectedEvent.resource_id ? `(${inspectedEvent.resource_id})` : ''}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block font-medium">Client IP Address</span>
                <span className="font-mono text-slate-800">{inspectedEvent.ip_address || '—'}</span>
              </div>
            </div>

            <div>
              <span className="text-xs font-semibold text-slate-700 block mb-1">
                Sanitized Payload / Parameters (Confidential Credentials Redacted)
              </span>
              <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg text-xs font-mono overflow-auto max-h-60">
                {JSON.stringify(inspectedEvent.details, null, 2)}
              </pre>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="secondary" size="sm" onClick={() => setInspectedEvent(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { api } from '../../api';
import {
  Alert,
  Avatar,
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
import type { AdminUserItem, UserRole } from '../../types';

export const AdminUsersPage: React.FC = () => {
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [perPage] = useState(15);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'danger'; message: string } | null>(null);

  // Status Modal State
  const [statusModalUser, setStatusModalUser] = useState<AdminUserItem | null>(null);
  const [statusReason, setStatusReason] = useState('');
  const [isSubmittingStatus, setIsSubmittingStatus] = useState(false);

  // Role Modal State
  const [roleModalUser, setRoleModalUser] = useState<AdminUserItem | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('creator');
  const [roleReason, setRoleReason] = useState('');
  const [isSubmittingRole, setIsSubmittingRole] = useState(false);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await api.admin.users({
        q: searchQuery.trim() || undefined,
        role: roleFilter !== 'all' ? roleFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        page,
        per_page: perPage,
      });
      setUsers(res.items);
      setTotal(res.total);
      setPages(res.pages);
    } catch (err: any) {
      setFeedback({
        type: 'danger',
        message: err?.message || 'Failed to load user directory.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, roleFilter, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const handleConfirmStatusChange = async () => {
    if (!statusModalUser) return;
    setIsSubmittingStatus(true);
    setFeedback(null);
    try {
      const targetIsActive = !statusModalUser.is_active;
      await api.admin.updateUserStatus(statusModalUser.id, {
        is_active: targetIsActive,
        reason: statusReason.trim() || undefined,
      });
      setFeedback({
        type: 'success',
        message: `User ${statusModalUser.email} has been successfully ${targetIsActive ? 'reactivated' : 'suspended'}.`,
      });
      setStatusModalUser(null);
      setStatusReason('');
      fetchUsers();
    } catch (err: any) {
      setFeedback({
        type: 'danger',
        message: err?.response?.data?.detail || err?.message || 'Failed to update user account status.',
      });
    } finally {
      setIsSubmittingStatus(false);
    }
  };

  const handleConfirmRoleChange = async () => {
    if (!roleModalUser) return;
    setIsSubmittingRole(true);
    setFeedback(null);
    try {
      await api.admin.updateUserRole(roleModalUser.id, {
        role: selectedRole,
        reason: roleReason.trim() || undefined,
      });
      setFeedback({
        type: 'success',
        message: `User ${roleModalUser.email} role has been updated to '${selectedRole}'.`,
      });
      setRoleModalUser(null);
      setRoleReason('');
      fetchUsers();
    } catch (err: any) {
      setFeedback({
        type: 'danger',
        message: err?.response?.data?.detail || err?.message || 'Failed to update user account role.',
      });
    } finally {
      setIsSubmittingRole(false);
    }
  };

  const columns: Column<AdminUserItem>[] = [
    {
      key: 'full_name',
      header: 'User Identity',
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.full_name} size="sm" />
          <div>
            <div className="font-semibold text-slate-900 text-sm flex items-center gap-1.5">
              {row.full_name}
              {row.role === 'admin' && (
                <Badge variant="brand" size="sm">Admin</Badge>
              )}
            </div>
            <div className="text-xs text-slate-500 font-mono">{row.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (row) => (
        <div>
          <Badge
            variant={row.role === 'brand' ? 'brand' : 'neutral'}
            size="sm"
          >
            {row.role.toUpperCase()}
          </Badge>
          <div className="text-xs text-slate-400 mt-0.5">
            {row.brand_company_name ? row.brand_company_name : row.creator_handle ? row.creator_handle : `ID #${row.id}`}
          </div>
        </div>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      align: 'center',
      render: (row) => (
        <Badge variant={row.is_active ? 'success' : 'danger'} size="sm">
          {row.is_active ? 'Active' : 'Suspended'}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      header: 'Joined Date',
      render: (row) => (
        <span className="text-xs text-slate-600">
          {new Date(row.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Governance Actions',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="xs"
            onClick={() => {
              setRoleModalUser(row);
              setSelectedRole(row.role);
              setRoleReason('');
            }}
          >
            Change Role
          </Button>
          <Button
            variant={row.is_active ? 'danger' : 'secondary'}
            size="xs"
            onClick={() => {
              setStatusModalUser(row);
              setStatusReason('');
            }}
          >
            {row.is_active ? 'Suspend' : 'Activate'}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">User Directory &amp; Governance</h1>
            <Badge variant="neutral" size="sm">{total} Accounts</Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Search, filter, inspect profiles, and manage access statuses with mandatory audit logging.
          </p>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <Alert
          variant={feedback.type === 'success' ? 'success' : 'danger'}
          onClose={() => setFeedback(null)}
        >
          {feedback.message}
        </Alert>
      )}

      {/* Search & Filter Toolbar */}
      <Card orientation="vertical" padding="md">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className="sm:col-span-5">
            <label className="block text-xs font-medium text-slate-700 mb-1">Search User Directory</label>
            <Input
              placeholder="Search by full name or email address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Icon name="Search" size="sm" className="text-slate-400" />}
            />
          </div>

          <div className="sm:col-span-3">
            <label className="block text-xs font-medium text-slate-700 mb-1">Filter by Role</label>
            <Select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { value: 'all', label: 'All Roles' },
                { value: 'brand', label: 'Brands Only' },
                { value: 'creator', label: 'Creators Only' },
                { value: 'admin', label: 'Administrators Only' },
              ]}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { value: 'all', label: 'All Statuses' },
                { value: 'active', label: 'Active Only' },
                { value: 'suspended', label: 'Suspended Only' },
              ]}
            />
          </div>

          <div className="sm:col-span-2">
            <Button variant="primary" type="submit" className="w-full" leftIcon={<Icon name="Search" size="sm" />}>
              Filter
            </Button>
          </div>
        </form>
      </Card>

      {/* Users Table */}
      <Card orientation="vertical" padding="md">
        {isLoading ? (
          <div className="py-16 text-center text-xs text-slate-400">Loading user accounts...</div>
        ) : users.length === 0 ? (
          <EmptyState
            title="No Users Match Query"
            description="Try modifying search keywords or resetting filters to find matching platform accounts."
            icon="Users"
          />
        ) : (
          <>
            <Table columns={columns} data={users} keyExtractor={(row) => String(row.id)} />

            {/* Pagination Controls */}
            {pages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-3 text-xs text-slate-500">
                <span>
                  Showing page <strong className="text-slate-800">{page}</strong> of <strong className="text-slate-800">{pages}</strong> ({total} total users)
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

      {/* Status Management Confirmation Modal */}
      <Modal
        isOpen={!!statusModalUser}
        onClose={() => setStatusModalUser(null)}
        title={statusModalUser?.is_active ? 'Confirm Account Suspension' : 'Confirm Account Reactivation'}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            {statusModalUser?.is_active
              ? `Are you sure you want to suspend ${statusModalUser?.email}? The user will be immediately logged out and blocked from platform services.`
              : `Are you sure you want to reactivate ${statusModalUser?.email}? The user will regain immediate access to platform workspaces.`}
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Audit Reason / Case Reference (Logged Permanently)
            </label>
            <Input
              placeholder="e.g. Terms of service violation, fraud investigation, request by user..."
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="ghost" size="sm" onClick={() => setStatusModalUser(null)}>
              Cancel
            </Button>
            <Button
              variant={statusModalUser?.is_active ? 'danger' : 'primary'}
              size="sm"
              disabled={isSubmittingStatus}
              onClick={handleConfirmStatusChange}
            >
              {isSubmittingStatus
                ? 'Updating...'
                : statusModalUser?.is_active
                ? 'Confirm Suspension'
                : 'Confirm Reactivation'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Role Management Confirmation Modal */}
      <Modal
        isOpen={!!roleModalUser}
        onClose={() => setRoleModalUser(null)}
        title="Change Platform User Role"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Updating the role for <strong>{roleModalUser?.email}</strong> will adjust their access permissions and assigned application workspace.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Select New Role</label>
            <Select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as UserRole)}
              options={[
                { value: 'brand', label: 'Brand (Campaign Creation & Shortlists)' },
                { value: 'creator', label: 'Creator (Discovery & Brief Responses)' },
                { value: 'admin', label: 'Administrator (Operations & System Controls)' },
              ]}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Audit Justification (Logged in Audit Log)
            </label>
            <Input
              placeholder="Reason for role alteration..."
              value={roleReason}
              onChange={(e) => setRoleReason(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="ghost" size="sm" onClick={() => setRoleModalUser(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={isSubmittingRole}
              onClick={handleConfirmRoleChange}
            >
              {isSubmittingRole ? 'Saving...' : 'Confirm Role Change'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

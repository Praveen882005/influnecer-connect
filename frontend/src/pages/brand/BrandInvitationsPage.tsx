import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
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
  Table,
  type Column,
} from '../../design-system';
import { ConfirmationModal } from '../../components/feedback';
import type { WorkflowInvitation } from '../../types';

export const BrandInvitationsPage: React.FC = () => {
  const [invitations, setInvitations] = useState<WorkflowInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cancellingInvite, setCancellingInvite] = useState<{ id: number; name: string } | null>(null);

  // Detail modal
  const [selectedInvite, setSelectedInvite] = useState<WorkflowInvitation | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const invsData = await api.invitations.listBrand();
      setInvitations(invsData);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load brand invitations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCancelInvitation = (id: number, name: string) => {
    setCancellingInvite({ id, name });
  };

  const handleConfirmCancel = async () => {
    if (!cancellingInvite) return;
    const { id, name } = cancellingInvite;
    setCancellingInvite(null);
    try {
      const updated = await api.invitations.updateStatus(id, { status: 'canceled' });
      setInvitations((prev) => prev.map((i) => (i.id === id ? updated : i)));
      setActionFeedback(`Invitation to ${name} was cancelled.`);
      setTimeout(() => setActionFeedback(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to cancel invitation.');
    }
  };

  const filteredInvitations = invitations.filter((inv) => {
    const creatorName = inv.creator_name || '';
    const creatorHandle = inv.creator_handle || '';
    const campaignTitle = inv.campaign_title || '';
    const matchesSearch =
      creatorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      creatorHandle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      campaignTitle.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' || inv.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'accepted':
        return <Badge variant="success" size="sm">ACCEPTED</Badge>;
      case 'declined':
        return <Badge variant="danger" size="sm">DECLINED</Badge>;
      case 'canceled':
        return <Badge variant="neutral" size="sm">CANCELED</Badge>;
      case 'expired':
        return <Badge variant="neutral" size="sm">EXPIRED</Badge>;
      case 'viewed':
        return <Badge variant="brand" size="sm">VIEWED</Badge>;
      default:
        return <Badge variant="warning" size="sm">SENT / PENDING</Badge>;
    }
  };

  const columns: Column<WorkflowInvitation>[] = [
    {
      key: 'creator',
      header: 'Creator',
      render: (inv) => (
        <div className="flex items-center gap-3">
          <Avatar name={inv.creator_name || 'Creator'} size="sm" />
          <div>
            <div className="font-semibold text-slate-900">{inv.creator_name || `Creator #${inv.creator_id}`}</div>
            <div className="text-xs text-slate-500 font-mono">{inv.creator_handle || '@creator'}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'campaign',
      header: 'Campaign & Scope',
      render: (inv) => (
        <div>
          <div className="font-medium text-slate-900">{inv.campaign_title}</div>
          <div className="text-xs text-slate-500">
            {inv.deliverables_requested && inv.deliverables_requested.length > 0
              ? inv.deliverables_requested.join(', ')
              : 'Direct Collaboration'}
          </div>
        </div>
      ),
    },
    {
      key: 'fee',
      header: 'Offered Fee',
      align: 'right',
      render: (inv) => (
        <span className="font-semibold text-slate-900">
          ${inv.compensation_offered ? inv.compensation_offered.toLocaleString() : '0'}
        </span>
      ),
    },
    {
      key: 'sentDate',
      header: 'Sent On',
      render: (inv) => (
        <span className="text-xs text-slate-600">
          {new Date(inv.created_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (inv) => getStatusBadge(inv.status),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (inv) => {
        const isActionable = ['pending', 'sent', 'viewed'].includes(inv.status.toLowerCase());
        return (
          <div className="flex items-center justify-end gap-1.5">
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setSelectedInvite(inv)}
            >
              Details
            </Button>
            {isActionable && (
              <Button
                variant="ghost"
                size="xs"
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                onClick={() => handleCancelInvitation(inv.id, inv.creator_name || 'Creator')}
              >
                Cancel
              </Button>
            )}
            {inv.status === 'accepted' && (
              <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                Confirmed
              </span>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">Direct Campaign Invitations</h1>
          <p className="text-sm text-slate-500 mt-1">
            Track, manage, and inspect direct outreach invitations extended to shortlisted creators.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="brand" size="md">
            {invitations.length} Total Invitations
          </Badge>
          <Button variant="outline" size="sm" leftIcon="RotateCw" onClick={loadData} disabled={loading}>
            Refresh
          </Button>
        </div>
      </div>

      {actionFeedback && (
        <Alert variant="success" title="Success" onClose={() => setActionFeedback(null)}>
          {actionFeedback}
        </Alert>
      )}
      {errorMessage && (
        <Alert variant="danger" title="Error" onClose={() => setErrorMessage(null)}>
          {errorMessage}
        </Alert>
      )}

      {/* Persistent delivery notice */}
      <div className="bg-sky-50 border border-sky-200 p-3 rounded-[6px] text-xs text-sky-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="Bell" size="sm" className="text-sky-600" />
          <span>
            <strong>In-App Notification Mode:</strong> Creators receive instant in-app alerts and timeline status updates. External email/SMS dispatch remains disabled until production provider API keys are verified.
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card orientation="vertical" padding="sm" className="bg-white">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex-1 w-full">
            <Input
              placeholder="Search invitations by creator, handle, or campaign..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Icon name="Search" size="sm" className="text-slate-400" />}
            />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            {['all', 'sent', 'viewed', 'accepted', 'declined', 'canceled'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-[5px] text-xs font-medium capitalize transition-colors ${
                  statusFilter === st
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Table / Empty State */}
      {loading ? (
        <Card padding="lg">
          <div className="flex items-center justify-center py-12 gap-3 text-slate-500 text-sm">
            <Icon name="RotateCw" size="md" className="animate-spin text-sky-600" />
            <span>Loading invitations...</span>
          </div>
        </Card>
      ) : filteredInvitations.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            title="No Invitations Found"
            description="You have not extended any direct campaign invitations matching this criteria yet. Shortlist creators to send targeted invitations."
            icon="Mail"
          />
        </Card>
      ) : (
        <Card orientation="vertical" padding="none" className="bg-white overflow-hidden shadow-sm">
          <Table<WorkflowInvitation>
            columns={columns}
            data={filteredInvitations}
            keyExtractor={(i) => String(i.id)}
          />
        </Card>
      )}

      {/* Invitation Detail Modal */}
      {selectedInvite && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedInvite(null)}
          title={`Invitation: ${selectedInvite.campaign_title}`}
          size="md"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-[6px] border border-slate-100">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Recipient Creator</span>
                <div className="font-semibold text-slate-900">{selectedInvite.creator_name || `Creator #${selectedInvite.creator_id}`}</div>
                <div className="text-xs text-slate-500 font-mono">{selectedInvite.creator_handle || '@creator'}</div>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Status</span>
                {getStatusBadge(selectedInvite.status)}
              </div>
            </div>

            <div>
              <span className="text-xs font-semibold text-slate-700 block mb-1">Invitation Message</span>
              <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded border border-slate-200">
                "{selectedInvite.message || 'No personalized message provided.'}"
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 bg-slate-50 rounded border border-slate-100">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Proposed Fee</span>
                <strong className="text-slate-900 text-sm">
                  ${selectedInvite.compensation_offered ? selectedInvite.compensation_offered.toLocaleString() : '0'}
                </strong>
              </div>
              <div className="p-2.5 bg-slate-50 rounded border border-slate-100">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Requested Scope</span>
                <span className="text-slate-800">
                  {selectedInvite.deliverables_requested && selectedInvite.deliverables_requested.length > 0
                    ? selectedInvite.deliverables_requested.join(', ')
                    : 'Standard collaboration'}
                </span>
              </div>
            </div>

            {selectedInvite.decline_reason && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800">
                <strong>Decline Reason Provided:</strong> {selectedInvite.decline_reason}
              </div>
            )}

            <div className="text-[11px] text-slate-400 space-y-1 pt-2 border-t border-slate-100">
              <div>Created: {new Date(selectedInvite.created_at).toLocaleString()}</div>
              {selectedInvite.responded_at && (
                <div>Responded: {new Date(selectedInvite.responded_at).toLocaleString()}</div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedInvite(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Cancellation Confirmation Dialog */}
      <ConfirmationModal
        isOpen={cancellingInvite !== null}
        onClose={() => setCancellingInvite(null)}
        onConfirm={handleConfirmCancel}
        title="Cancel Campaign Invitation"
        message={`Are you sure you want to cancel the invitation sent to ${cancellingInvite?.name}? The creator will be notified of the cancellation.`}
        confirmLabel="Cancel Invitation"
        isDestructive
      />
    </div>
  );
};

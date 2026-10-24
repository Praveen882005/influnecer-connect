import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  Modal,
  Table,
  type Column,
} from '../../design-system';
import type { WorkflowInvitation } from '../../types';

export const InfluencerInvitationsPage: React.FC = () => {
  const [invitations, setInvitations] = useState<WorkflowInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'accepted' | 'declined'>('all');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Detail Modal & Action State
  const [selectedInvite, setSelectedInvite] = useState<WorkflowInvitation | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [isDeclineModalOpen, setIsDeclineModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const loadInvitations = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const data = await api.invitations.listCreator();
      setInvitations(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load received campaign invitations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvitations();
  }, []);

  const handleOpenDetail = async (inv: WorkflowInvitation) => {
    setSelectedInvite(inv);
    // If status is 'sent', fetching single detail transitions it to 'viewed' in backend
    if (inv.status === 'sent') {
      try {
        const fresh = await api.invitations.get(inv.id);
        setSelectedInvite(fresh);
        setInvitations((prev) => prev.map((i) => (i.id === fresh.id ? fresh : i)));
      } catch {
        // Non-blocking view update
      }
    }
  };

  const handleAccept = async (id: number, brand: string) => {
    try {
      setIsProcessing(true);
      const updated = await api.invitations.updateStatus(id, { status: 'accepted' });
      setInvitations((prev) => prev.map((i) => (i.id === id ? updated : i)));
      if (selectedInvite?.id === id) {
        setSelectedInvite(updated);
      }
      setFeedback(
        `Congratulations! You accepted the partnership offer from ${brand}. In-app notification delivered to brand.`
      );
      setTimeout(() => setFeedback(null), 5000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to accept invitation.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenDeclineModal = (inv: WorkflowInvitation) => {
    setSelectedInvite(inv);
    setDeclineReason('');
    setIsDeclineModalOpen(true);
  };

  const handleConfirmDecline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvite) return;
    try {
      setIsProcessing(true);
      const updated = await api.invitations.updateStatus(selectedInvite.id, {
        status: 'declined',
        decline_reason: declineReason || undefined,
      });
      setInvitations((prev) => prev.map((i) => (i.id === selectedInvite.id ? updated : i)));
      setSelectedInvite(updated);
      setIsDeclineModalOpen(false);
      setFeedback(`You declined the invitation from ${selectedInvite.brand_name}.`);
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to decline invitation.');
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredInvites = invitations.filter((inv) => {
    const st = inv.status.toLowerCase();
    if (activeTab === 'pending') return ['pending', 'sent', 'viewed'].includes(st);
    if (activeTab === 'accepted') return st === 'accepted';
    if (activeTab === 'declined') return st === 'declined';
    return true;
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
        return <Badge variant="warning" size="sm">PENDING</Badge>;
    }
  };

  const columns: Column<WorkflowInvitation>[] = [
    {
      key: 'brandName',
      header: 'Brand & Campaign',
      render: (row) => (
        <div>
          <div className="font-semibold text-slate-900">{row.brand_name}</div>
          <div className="text-xs text-slate-600 mt-0.5">{row.campaign_title}</div>
        </div>
      ),
    },
    {
      key: 'deliverables',
      header: 'Requested Scope',
      render: (row) => (
        <span className="text-xs text-slate-700">
          {row.deliverables_requested && row.deliverables_requested.length > 0
            ? row.deliverables_requested.join(', ')
            : 'Standard Collaboration'}
        </span>
      ),
    },
    {
      key: 'offeredFee',
      header: 'Compensation',
      align: 'right',
      render: (row) => (
        <span className="font-bold text-slate-900">
          ${row.compensation_offered ? row.compensation_offered.toLocaleString() : '0'}
        </span>
      ),
    },
    {
      key: 'expiryDate',
      header: 'Respond Before',
      render: (row) => (
        <span className="text-xs text-slate-500">
          {row.expires_at ? new Date(row.expires_at).toLocaleDateString() : 'No expiry'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (row) => getStatusBadge(row.status),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => {
        const isActionable = ['pending', 'sent', 'viewed'].includes(row.status.toLowerCase());
        return (
          <div className="flex items-center justify-end gap-1.5">
            <Button
              variant="ghost"
              size="xs"
              onClick={() => handleOpenDetail(row)}
            >
              Review Offer
            </Button>
            {isActionable && (
              <>
                <Button
                  variant="primary"
                  size="xs"
                  onClick={() => handleAccept(row.id, row.brand_name)}
                  disabled={isProcessing}
                >
                  Accept
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  className="text-rose-600 hover:text-rose-700"
                  onClick={() => handleOpenDeclineModal(row)}
                  disabled={isProcessing}
                >
                  Decline
                </Button>
              </>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">Brand Collaboration Invitations</h1>
          <p className="text-sm text-slate-500 mt-1">
            Review targeted campaign offers extended directly from brand teams. Accept to activate milestone workspaces.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon="RotateCw"
            onClick={loadInvitations}
            disabled={loading}
          >
            Refresh
          </Button>
        </div>
      </div>

      {feedback && (
        <Alert variant="success" title="Success" onClose={() => setFeedback(null)}>
          {feedback}
        </Alert>
      )}
      {errorMessage && (
        <Alert variant="danger" title="Error" onClose={() => setErrorMessage(null)}>
          {errorMessage}
        </Alert>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2">
        {(['all', 'pending', 'accepted', 'declined'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-[5px] capitalize transition-colors ${
              activeTab === tab
                ? 'bg-sky-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <Card padding="lg">
          <div className="flex items-center justify-center py-12 gap-3 text-slate-500 text-sm">
            <Icon name="RotateCw" size="md" className="animate-spin text-sky-600" />
            <span>Loading invitations...</span>
          </div>
        </Card>
      ) : filteredInvites.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            title="No Invitations in this View"
            description="Brands that discover and shortlist your profile will send direct invitations with proposed budgets and deliverables."
            icon="Mail"
          />
        </Card>
      ) : (
        <Card orientation="vertical" padding="none" className="bg-white overflow-hidden shadow-sm">
          <Table<WorkflowInvitation>
            columns={columns}
            data={filteredInvites}
            keyExtractor={(i) => String(i.id)}
          />
        </Card>
      )}

      {/* Review Offer Modal with Timeline */}
      {selectedInvite && !isDeclineModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedInvite(null)}
          title={`Offer: ${selectedInvite.campaign_title}`}
          size="lg"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-[6px] border border-slate-200">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Brand Partner</span>
                <span className="text-base font-bold text-slate-900">{selectedInvite.brand_name}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-0.5">Current Status</span>
                {getStatusBadge(selectedInvite.status)}
              </div>
            </div>

            {/* Workflow Timeline */}
            <div className="p-3 bg-white border border-slate-200 rounded-[6px]">
              <span className="text-xs font-semibold text-slate-700 block mb-2">Workflow Timeline</span>
              <div className="flex items-center justify-between text-xs text-slate-500 relative">
                <div className="flex flex-col items-center">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px]">
                    1
                  </div>
                  <span className="mt-1 font-medium text-slate-800">Sent</span>
                  <span className="text-[10px] text-slate-400">{new Date(selectedInvite.created_at).toLocaleDateString()}</span>
                </div>
                <div className="h-0.5 flex-1 bg-slate-200 mx-2" />
                <div className="flex flex-col items-center">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${
                    selectedInvite.status !== 'sent' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
                  }`}>
                    2
                  </div>
                  <span className="mt-1 font-medium text-slate-800">Viewed</span>
                  <span className="text-[10px] text-slate-400">
                    {selectedInvite.status !== 'sent' ? 'Confirmed' : 'Pending'}
                  </span>
                </div>
                <div className="h-0.5 flex-1 bg-slate-200 mx-2" />
                <div className="flex flex-col items-center">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${
                    selectedInvite.status === 'accepted'
                      ? 'bg-emerald-600 text-white'
                      : selectedInvite.status === 'declined'
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-100 text-slate-400'
                  }`}>
                    3
                  </div>
                  <span className="mt-1 font-medium text-slate-800">
                    {selectedInvite.status === 'accepted'
                      ? 'Accepted'
                      : selectedInvite.status === 'declined'
                      ? 'Declined'
                      : 'Decision'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {selectedInvite.responded_at
                      ? new Date(selectedInvite.responded_at).toLocaleDateString()
                      : 'Awaiting'}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <span className="text-xs font-semibold text-slate-700 block mb-1">Brand Brief &amp; Objectives</span>
              <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded border border-slate-200 leading-relaxed">
                "{selectedInvite.message || 'Direct invitation to collaborate.'}"
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded border border-slate-100">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Proposed Fee</span>
                <strong className="text-slate-900 text-base">
                  ${selectedInvite.compensation_offered ? selectedInvite.compensation_offered.toLocaleString() : '0'}
                </strong>
              </div>
              <div className="p-3 bg-slate-50 rounded border border-slate-100">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Requested Scope</span>
                <span className="text-slate-800 font-medium">
                  {selectedInvite.deliverables_requested && selectedInvite.deliverables_requested.length > 0
                    ? selectedInvite.deliverables_requested.join(', ')
                    : 'Standard collaboration'}
                </span>
              </div>
            </div>

            {selectedInvite.expires_at && (
              <div className="text-xs text-slate-500">
                Must respond before: <strong>{new Date(selectedInvite.expires_at).toLocaleString()}</strong>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => setSelectedInvite(null)}>
                Close
              </Button>
              {['pending', 'sent', 'viewed'].includes(selectedInvite.status.toLowerCase()) && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-rose-600 hover:text-rose-700"
                    onClick={() => handleOpenDeclineModal(selectedInvite)}
                    disabled={isProcessing}
                  >
                    Decline Invitation
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleAccept(selectedInvite.id, selectedInvite.brand_name)}
                    disabled={isProcessing}
                  >
                    Accept Offer &amp; Confirm
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Decline Reason Modal */}
      {isDeclineModalOpen && selectedInvite && (
        <Modal
          isOpen={true}
          onClose={() => setIsDeclineModalOpen(false)}
          title={`Decline Invitation from ${selectedInvite.brand_name}`}
          size="md"
        >
          <form onSubmit={handleConfirmDecline} className="space-y-4">
            <p className="text-xs text-slate-600">
              Please share a brief reason with {selectedInvite.brand_name} so they understand your scheduling, fee, or niche alignment preferences.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reason for Declining (Optional)
              </label>
              <textarea
                className="w-full p-2.5 rounded-[5px] border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-rose-600"
                rows={3}
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="e.g. Schedule conflicts this quarter, rates outside current minimums, or brand category conflict..."
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="ghost" size="sm" onClick={() => setIsDeclineModalOpen(false)}>
                Back
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="bg-rose-600 hover:bg-rose-700 text-white"
                type="submit"
                disabled={isProcessing}
              >
                {isProcessing ? 'Submitting...' : 'Confirm Decline'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

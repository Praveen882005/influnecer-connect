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
} from '../../design-system';
import { ConfirmationModal } from '../../components/feedback';
import { RichInfluencerProfileModal } from '../../components/RichInfluencerProfileModal';
import type { Campaign, CreatorProfile, ShortlistItem, ShortlistStatus } from '../../types';

export const BrandShortlistsPage: React.FC = () => {
  const [items, setItems] = useState<ShortlistItem[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [selectedProfileCreator, setSelectedProfileCreator] = useState<CreatorProfile | null>(null);

  // Edit Notes & Status Modal
  const [selectedItem, setSelectedItem] = useState<ShortlistItem | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editStatus, setEditStatus] = useState<ShortlistStatus>('considering');
  const [isUpdating, setIsUpdating] = useState(false);

  // Send Direct Invite Modal
  const [inviteItem, setInviteItem] = useState<ShortlistItem | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | ''>('');
  const [inviteFee, setInviteFee] = useState<string>('2500');
  const [inviteDeliverables, setInviteDeliverables] = useState<string>('1x YouTube Dedicated, 1x Social Post');
  const [inviteMessage, setInviteMessage] = useState<string>('We would love to collaborate with you on our upcoming brand campaign.');
  const [isInviting, setIsInviting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const [shortlistData, campaignsData] = await Promise.all([
        api.shortlists.listItems(),
        api.campaigns.getMyCampaigns().catch(() => [] as Campaign[]),
      ]);
      setItems(shortlistData);
      setCampaigns(campaignsData);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load brand shortlists.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenEdit = (item: ShortlistItem) => {
    setSelectedItem(item);
    setEditNotes(item.notes || '');
    setEditStatus(item.status);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    try {
      setIsUpdating(true);
      const updated = await api.shortlists.update(selectedItem.id, {
        notes: editNotes,
        status: editStatus,
      });
      setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
      setSuccessMsg(`Shortlist notes and workflow status updated for creator.`);
      setSelectedItem(null);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update shortlist entry.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleOpenInvite = (item: ShortlistItem) => {
    setInviteItem(item);
    if (item.campaign_id) {
      setSelectedCampaignId(item.campaign_id);
    } else if (campaigns.length > 0 && campaigns[0]?.id) {
      setSelectedCampaignId(campaigns[0].id);
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteItem || !selectedCampaignId) return;
    try {
      setIsInviting(true);
      const deliverablesList = inviteDeliverables
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      await api.invitations.create({
        campaign_id: Number(selectedCampaignId),
        creator_id: inviteItem.creator_id,
        compensation_offered: parseFloat(inviteFee) || 0,
        deliverables_requested: deliverablesList,
        message: inviteMessage,
        expires_in_days: 14,
      });

      // Update local item status to 'invited'
      setItems((prev) =>
        prev.map((it) =>
          it.id === inviteItem.id
            ? { ...it, status: 'invited', campaign_id: Number(selectedCampaignId) }
            : it
        )
      );

      setSuccessMsg(
        `Campaign invitation successfully dispatched to ${inviteItem.creator?.display_name || 'creator'}. In-app notification delivered.`
      );
      setInviteItem(null);
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to dispatch invitation.');
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemove = (id: number) => {
    setDeletingId(id);
  };

  const handleConfirmRemove = async () => {
    if (deletingId === null) return;
    const id = deletingId;
    setDeletingId(null);
    try {
      await api.shortlists.remove(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      setSuccessMsg('Creator removed from shortlist.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to remove creator from shortlist.');
    }
  };

  const filteredItems = items.filter((item) => {
    if (statusFilter === 'all') return true;
    return item.status.toLowerCase() === statusFilter.toLowerCase();
  });

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'success';
      case 'invited':
        return 'brand';
      case 'negotiating':
        return 'brand';
      case 'declined':
        return 'danger';
      case 'archived':
        return 'neutral';
      default:
        return 'warning';
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-950">Saved Creator Shortlists</h2>
          <p className="text-xs text-slate-500">
            Bookmarked creator profiles ready for direct brief invitations, private notes, and pipeline tracking.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="brand" size="md">
            {items.length} Creators Saved
          </Badge>
          <Button variant="outline" size="sm" leftIcon="RotateCw" onClick={loadData} disabled={loading}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <Alert variant="success" title="Success" onClose={() => setSuccessMsg(null)}>
          {successMsg}
        </Alert>
      )}
      {errorMsg && (
        <Alert variant="danger" title="Error" onClose={() => setErrorMsg(null)}>
          {errorMsg}
        </Alert>
      )}

      {/* Filter Bar */}
      <Card orientation="vertical" padding="sm" className="bg-white">
        <div className="flex items-center gap-2 overflow-x-auto py-1">
          <span className="text-xs font-semibold text-slate-500 mr-2">Pipeline Status:</span>
          {['all', 'considering', 'contacted', 'invited', 'negotiating', 'confirmed', 'declined', 'archived'].map(
            (st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-[5px] text-xs font-medium capitalize transition-colors ${
                  statusFilter === st
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {st}
              </button>
            )
          )}
        </div>
      </Card>

      {/* Content */}
      {loading ? (
        <Card padding="lg">
          <div className="flex items-center justify-center py-12 gap-3 text-slate-500 text-sm">
            <Icon name="RotateCw" size="md" className="animate-spin text-sky-600" />
            <span>Loading campaign shortlists...</span>
          </div>
        </Card>
      ) : filteredItems.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            title="Shortlist is Currently Empty"
            description="Browse the Discover Creators catalog or run AI Matching to save creator candidates into campaign shortlists."
            icon="Star"
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map((item) => {
            const creator = item.creator;
            const name = creator?.display_name || `Creator #${item.creator_id}`;
            const handle = creator?.handle || '@creator';
            const niche = creator?.primary_niche || 'General';
            const reach = creator?.total_followers
              ? `${(creator.total_followers / 1000).toFixed(0)}K Reach`
              : 'Audience N/A';
            const engagement = creator?.avg_engagement_rate
              ? `${creator.avg_engagement_rate.toFixed(1)}%`
              : 'N/A';

            return (
              <Card key={item.id} padding="lg" className="flex flex-col justify-between border border-slate-200">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={name} size="md" status="online" />
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 leading-tight">{name}</h3>
                        <span className="text-xs text-slate-500 font-mono">{handle}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={getStatusBadgeVariant(item.status)} size="sm">
                        {item.status.toUpperCase()}
                      </Badge>
                      <Badge variant="neutral" size="sm">
                        {niche}
                      </Badge>
                    </div>
                  </div>

                  {item.campaign_title && (
                    <div className="mb-3 px-2 py-1 bg-sky-50 border border-sky-100 rounded text-[11px] text-sky-800 flex items-center gap-1.5">
                      <Icon name="Briefcase" size="xs" className="text-sky-600" />
                      <span>Campaign: <strong>{item.campaign_title}</strong></span>
                    </div>
                  )}

                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-[5px] mb-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase">
                        Internal Campaign Notes
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(item)}
                        className="text-[11px] text-sky-600 hover:text-sky-700 font-medium"
                      >
                        Edit Notes
                      </button>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed italic">
                      "{item.notes || 'No private notes added yet.'}"
                    </p>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-600 mb-4">
                    <span>Audience: <strong>{reach}</strong></span>
                    <span>·</span>
                    <span>Avg Engagement: <strong className="text-sky-700">{engagement}</strong></span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon="Trash2"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => handleRemove(item.id)}
                  >
                    Remove
                  </Button>
                  <div className="flex items-center gap-2">
                    {item.creator && (
                      <Button
                        variant="secondary"
                        size="sm"
                        leftIcon="Eye"
                        onClick={() => setSelectedProfileCreator(item.creator!)}
                      >
                        Profile &amp; Trust
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon="Edit3"
                      onClick={() => handleOpenEdit(item)}
                    >
                      Status / Notes
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      leftIcon="Send"
                      onClick={() => handleOpenInvite(item)}
                    >
                      Send Direct Invite
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Notes & Status Modal */}
      {selectedItem && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedItem(null)}
          title={`Update Shortlist: ${selectedItem.creator?.display_name || 'Creator'}`}
          size="md"
        >
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Workflow Status
              </label>
              <select
                className="w-full h-9 px-3 rounded-[5px] border border-slate-300 text-sm text-slate-900 bg-white"
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as ShortlistStatus)}
              >
                <option value="considering">Considering</option>
                <option value="contacted">Contacted</option>
                <option value="invited">Invited</option>
                <option value="negotiating">Negotiating</option>
                <option value="confirmed">Confirmed</option>
                <option value="declined">Declined</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Private Evaluation Notes
              </label>
              <textarea
                className="w-full p-2.5 rounded-[5px] border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-sky-600"
                rows={4}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Add confidential notes on creator fit, audience quality, or discussion status..."
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button variant="ghost" size="sm" onClick={() => setSelectedItem(null)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" disabled={isUpdating}>
                {isUpdating ? 'Saving...' : 'Save Updates'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Send Direct Invite Modal */}
      {inviteItem && (
        <Modal
          isOpen={true}
          onClose={() => setInviteItem(null)}
          title={`Invite ${inviteItem.creator?.display_name || 'Creator'} to Campaign`}
          size="lg"
        >
          <form onSubmit={handleSendInvite} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Select Target Campaign
              </label>
              {campaigns.length === 0 ? (
                <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                  No active campaigns found. Please create a campaign first before sending an invitation.
                </p>
              ) : (
                <select
                  className="w-full h-9 px-3 rounded-[5px] border border-slate-300 text-sm text-slate-900 bg-white"
                  value={selectedCampaignId}
                  onChange={(e) => setSelectedCampaignId(Number(e.target.value))}
                  required
                >
                  <option value="" disabled>Select a campaign...</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} ({c.status}) — Budget: ${c.budget}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Proposed Compensation ($ USD)
                </label>
                <Input
                  type="number"
                  value={inviteFee}
                  onChange={(e) => setInviteFee(e.target.value)}
                  placeholder="2500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Deliverables Scope (comma-separated)
                </label>
                <Input
                  value={inviteDeliverables}
                  onChange={(e) => setInviteDeliverables(e.target.value)}
                  placeholder="1x Dedicated Video, 2x Reels"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Personalized Invitation Message
              </label>
              <textarea
                className="w-full p-2.5 rounded-[5px] border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-sky-600"
                rows={3}
                value={inviteMessage}
                onChange={(e) => setInviteMessage(e.target.value)}
                placeholder="Explain why you want to partner and outline key campaign goals..."
                required
              />
            </div>

            <div className="bg-slate-50 border border-slate-200 p-3 rounded text-[11px] text-slate-600 flex items-start gap-2">
              <Icon name="Info" size="sm" className="text-sky-600 shrink-0 mt-0.5" />
              <span>
                Dispatches a persistent in-app invitation notification to the creator's account with state tracking.
                External email/SMS delivery is kept disabled without verified provider credentials.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button variant="ghost" size="sm" onClick={() => setInviteItem(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                leftIcon={<Icon name="Send" size="sm" />}
                disabled={isInviting || !selectedCampaignId}
              >
                {isInviting ? 'Sending Invite...' : 'Send Campaign Invitation'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Remove Confirmation Dialog */}
      <ConfirmationModal
        isOpen={deletingId !== null}
        onClose={() => setDeletingId(null)}
        onConfirm={handleConfirmRemove}
        title="Remove Creator from Shortlist"
        message="Are you sure you want to remove this creator from your shortlist? You can re-add them from the Creator Directory at any time."
        confirmLabel="Remove Creator"
        isDestructive
      />

      {/* Rich Influencer Profile Intelligence Modal */}
      <RichInfluencerProfileModal
        creator={selectedProfileCreator}
        isOpen={!!selectedProfileCreator}
        onClose={() => setSelectedProfileCreator(null)}
        isShortlisted={true}
      />
    </div>
  );
};

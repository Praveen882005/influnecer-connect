import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  Input,
  Modal,
  Select,
  Skeleton,
  Table,
  type Column,
} from '../../design-system';
import { FormField, FormTextarea } from '../../components/forms';
import { useToast } from '../../components/feedback';
import { apiClient } from '../../api';
import { ApiClientError } from '../../api/types';
import type { Campaign, CampaignStatus } from '../../types';

export const BrandCampaignsPage: React.FC = () => {
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterNiche, setFilterNiche] = useState<string>('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;
  const [totalCount, setTotalCount] = useState(0);

  // Detail Modal State
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Edit Modal State
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editBudget, setEditBudget] = useState(0);
  const [editDeliverables, setEditDeliverables] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Status transition loading state
  const [transitioningId, setTransitioningId] = useState<number | null>(null);

  const fetchCampaigns = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const params: Record<string, any> = {
        skip: (currentPage - 1) * pageSize,
        limit: pageSize,
      };
      if (filterStatus !== 'all') {
        params.status = filterStatus;
      }
      if (filterNiche !== 'all') {
        params.niche = filterNiche;
      }
      if (searchQuery.trim()) {
        params.q = searchQuery.trim();
      }

      const res = await apiClient.get<Campaign[]>('/campaigns/my', { params });
      setCampaigns(res);
      setTotalCount(res.length >= pageSize ? (currentPage + 1) * pageSize : (currentPage - 1) * pageSize + res.length);
    } catch (err) {
      if (err instanceof ApiClientError && err.isUnavailable) {
        setLoadError('Backend service is offline. Campaign board running in local state mode.');
      } else {
        const msg = err instanceof Error ? err.message : 'Failed to fetch campaigns.';
        setLoadError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, [currentPage, filterStatus, filterNiche, searchQuery]);

  const handleStatusTransition = async (campaignId: number, newStatus: CampaignStatus) => {
    setTransitioningId(campaignId);
    try {
      const updated = await apiClient.patch<Campaign>(`/campaigns/${campaignId}/status`, {
        status: newStatus,
      });

      setCampaigns((prev) => prev.map((c) => (c.id === campaignId ? updated : c)));
      if (selectedCampaign?.id === campaignId) {
        setSelectedCampaign(updated);
      }
      success('Campaign Status Updated', `Campaign status changed to ${newStatus}.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Status transition failed.';
      toastError('Status Change Error', msg);
    } finally {
      setTransitioningId(null);
    }
  };

  const handleDeleteCampaign = async (campaignId: number) => {
    try {
      await apiClient.delete(`/campaigns/${campaignId}`);
      setCampaigns((prev) => prev.filter((c) => c.id !== campaignId));
      if (selectedCampaign?.id === campaignId) {
        setIsDetailModalOpen(false);
      }
      success('Campaign Removed', 'Campaign has been deleted or archived.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete campaign.';
      toastError('Action Failed', msg);
    }
  };

  const handleOpenEdit = (c: Campaign) => {
    setEditingCampaign(c);
    setEditTitle(c.title);
    setEditDescription(c.description);
    setEditBudget(c.budget);
    setEditDeliverables(Array.isArray(c.deliverables) ? c.deliverables.join(', ') : String(c.deliverables || ''));
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingCampaign) return;
    setIsUpdating(true);
    try {
      const deliverablesList = editDeliverables
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean);

      const updated = await apiClient.put<Campaign>(`/campaigns/${editingCampaign.id}`, {
        title: editTitle,
        description: editDescription,
        budget: Number(editBudget),
        deliverables: deliverablesList,
      });

      setCampaigns((prev) => prev.map((c) => (c.id === editingCampaign.id ? updated : c)));
      if (selectedCampaign?.id === editingCampaign.id) {
        setSelectedCampaign(updated);
      }
      setIsEditModalOpen(false);
      success('Campaign Updated', 'Your modifications have been persisted.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update campaign.';
      toastError('Update Error', msg);
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusBadge = (statusVal: string) => {
    const s = statusVal.toLowerCase();
    switch (s) {
      case 'published':
      case 'active':
        return <Badge variant="brand" size="sm">Published</Badge>;
      case 'draft':
        return <Badge variant="neutral" size="sm">Draft</Badge>;
      case 'paused':
        return <Badge variant="warning" size="sm">Paused</Badge>;
      case 'completed':
        return <Badge variant="success" size="sm">Completed</Badge>;
      case 'archived':
        return <Badge variant="neutral" size="sm">Archived</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{statusVal}</Badge>;
    }
  };

  const filtered = campaigns.filter((c) => {
    if (filterNiche !== 'all' && c.niche.toLowerCase() !== filterNiche.toLowerCase()) {
      return false;
    }
    return true;
  });

  const columns: Column<Campaign>[] = [
    {
      key: 'title',
      header: 'Campaign Brief & Objective',
      render: (row) => (
        <div className="max-w-md">
          <button
            type="button"
            onClick={() => {
              setSelectedCampaign(row);
              setIsDetailModalOpen(true);
            }}
            className="font-semibold text-slate-900 hover:text-sky-700 text-left cursor-pointer block truncate"
          >
            {row.title}
          </button>
          <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
            <span className="font-medium text-slate-700">{row.objective || 'Brand Awareness'}</span>
            <span>•</span>
            <span className="truncate max-w-[200px]">
              {Array.isArray(row.deliverables) ? row.deliverables.join(', ') : row.deliverables}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'niche',
      header: 'Category Niche',
      render: (row) => <Badge variant="neutral" size="sm" className="capitalize">{row.niche}</Badge>,
    },
    {
      key: 'budget',
      header: 'Budget Range',
      align: 'right',
      render: (row) => (
        <div className="text-right">
          <span className="font-bold text-slate-900">
            {row.currency || 'USD'} ${(row.budget ?? 0).toLocaleString()}
          </span>
          {row.budget_min && row.budget_max ? (
            <div className="text-[10px] text-slate-400">
              ${(row.budget_min ?? 0).toLocaleString()} - ${(row.budget_max ?? 0).toLocaleString()}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Lifecycle State',
      align: 'center',
      render: (row) => getStatusBadge(row.status),
    },
    {
      key: 'proposal_count',
      header: 'Inbound Pitches',
      align: 'center',
      render: (row) => (
        <span className="font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded text-xs border border-sky-100">
          {row.proposal_count || 0} Pitches
        </span>
      ),
    },
    {
      key: 'deadline',
      header: 'Deadline',
      render: (row) => (
        <span className="text-slate-600 font-mono text-xs">
          {row.deadline ? new Date(row.deadline).toLocaleDateString() : 'Rolling'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedCampaign(row);
              setIsDetailModalOpen(true);
            }}
          >
            Details
          </Button>

          {row.status !== 'archived' && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleOpenEdit(row)}
            >
              Edit
            </Button>
          )}

          {/* Quick status transition button */}
          {row.status === 'draft' && (
            <Button
              variant="primary"
              size="sm"
              isLoading={transitioningId === row.id}
              onClick={() => handleStatusTransition(row.id, 'published' as CampaignStatus)}
            >
              Publish
            </Button>
          )}

          {(row.status === 'published' || row.status === 'active') && (
            <Button
              variant="secondary"
              size="sm"
              isLoading={transitioningId === row.id}
              onClick={() => handleStatusTransition(row.id, 'paused' as CampaignStatus)}
            >
              Pause
            </Button>
          )}

          {row.status === 'paused' && (
            <Button
              variant="secondary"
              size="sm"
              isLoading={transitioningId === row.id}
              onClick={() => handleStatusTransition(row.id, 'published' as CampaignStatus)}
            >
              Resume
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 max-w-6xl text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">Brand Campaigns Board</h1>
          <p className="text-sm text-slate-500 mt-1">
            Publish briefs, manage active creator deliverables, monitor proposal pipelines, and govern lifecycle states.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            leftIcon="Plus"
            onClick={() => navigate('/brand/campaigns/new')}
          >
            Create New Campaign
          </Button>
        </div>
      </div>

      {loadError && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs flex items-center justify-between">
          <span>{loadError}</span>
          <Button variant="secondary" size="sm" onClick={fetchCampaigns}>
            Retry
          </Button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <Card orientation="vertical" padding="md">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <Input
              placeholder="Search campaigns by keyword, title, or brief..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <Select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            options={[
              { value: 'all', label: 'All Lifecycle States' },
              { value: 'published', label: 'Published / Active' },
              { value: 'draft', label: 'Drafts' },
              { value: 'paused', label: 'Paused' },
              { value: 'completed', label: 'Completed' },
              { value: 'archived', label: 'Archived' },
            ]}
          />

          <Select
            value={filterNiche}
            onChange={(e) => {
              setFilterNiche(e.target.value);
              setCurrentPage(1);
            }}
            options={[
              { value: 'all', label: 'All Niches' },
              { value: 'technology', label: 'Technology' },
              { value: 'beauty', label: 'Beauty' },
              { value: 'fitness', label: 'Fitness' },
              { value: 'fashion', label: 'Fashion' },
              { value: 'food', label: 'Food' },
              { value: 'home', label: 'Home' },
              { value: 'wellness', label: 'Wellness' },
            ]}
          />
        </div>
      </Card>

      {/* Content Area */}
      {isLoading ? (
        <Card orientation="vertical" padding="lg">
          <div className="space-y-3" role="status" aria-label="Loading campaigns">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </Card>
      ) : filtered.length === 0 ? (
        <Card orientation="vertical" padding="lg">
          <EmptyState
            title="No Campaigns Found"
            description={
              searchQuery || filterStatus !== 'all' || filterNiche !== 'all'
                ? 'No campaigns match your active search and filter parameters.'
                : 'You have not published any campaigns yet. Launch your first brief to begin receiving creator pitches.'
            }
            icon="Briefcase"
            action={
              <Button variant="primary" onClick={() => navigate('/brand/campaigns/new')}>
                Launch New Campaign
              </Button>
            }
          />
        </Card>
      ) : (
        <Card orientation="vertical" padding="none">
          <Table keyExtractor={(row) => String(row.id)} columns={columns} data={filtered} />
          {/* Pagination Footer */}
          <div className="flex items-center justify-between p-3 border-t border-slate-100 text-xs text-slate-500">
            <div>
              Showing page {currentPage} (of {totalCount || filtered.length} total, {filtered.length} visible items)
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={filtered.length < pageSize}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Campaign Detail Modal */}
      {selectedCampaign && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={selectedCampaign.title}
          description={`${selectedCampaign.objective || 'Campaign'} • ${selectedCampaign.niche}`}
          size="lg"
          footer={
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                {selectedCampaign.status !== 'archived' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                    onClick={() => handleDeleteCampaign(selectedCampaign.id)}
                  >
                    {selectedCampaign.status === 'draft' ? 'Delete Draft' : 'Archive Campaign'}
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {selectedCampaign.status !== 'archived' && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setIsDetailModalOpen(false);
                      handleOpenEdit(selectedCampaign);
                    }}
                  >
                    Edit Campaign
                  </Button>
                )}
                <Button variant="primary" onClick={() => setIsDetailModalOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          }
        >
          <div className="space-y-4 py-2 text-left text-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div>
                <span className="text-xs text-slate-500 block">Lifecycle State:</span>
                <span className="font-semibold text-slate-900 flex items-center gap-1.5 mt-0.5">
                  {getStatusBadge(selectedCampaign.status)}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Total Budget:</span>
                <span className="font-bold text-slate-900">
                  {selectedCampaign.currency || 'USD'} ${(selectedCampaign.budget ?? 0).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Application Deadline:</span>
                <span className="font-mono text-xs font-semibold text-slate-800">
                  {selectedCampaign.deadline ? new Date(selectedCampaign.deadline).toLocaleDateString() : 'Rolling'}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Target Location:</span>
                <span className="font-semibold text-slate-800">
                  {selectedCampaign.target_location || 'Global'}
                </span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Campaign Brief
              </h4>
              <p className="text-slate-600 whitespace-pre-line text-xs leading-relaxed bg-white p-3 rounded border border-slate-100">
                {selectedCampaign.description}
              </p>
            </div>

            {selectedCampaign.product_description && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Product Overview
                </h4>
                <p className="text-slate-600 text-xs bg-slate-50 p-2.5 rounded border border-slate-100">
                  {selectedCampaign.product_description}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Deliverables Scope
                </h4>
                <div className="text-xs text-slate-700 space-y-1">
                  {Array.isArray(selectedCampaign.deliverables) ? (
                    selectedCampaign.deliverables.map((d, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <Icon name="CheckCircle" size="xs" className="text-emerald-600" />
                        <span>{d}</span>
                      </div>
                    ))
                  ) : (
                    <div>{selectedCampaign.deliverables}</div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Creator Thresholds
                </h4>
                <div className="text-xs text-slate-600 space-y-1">
                  <div>Min Followers: <span className="font-semibold">{selectedCampaign.min_followers?.toLocaleString() || 'None'}</span></div>
                  <div>Min Engagement: <span className="font-semibold">{selectedCampaign.min_engagement_rate}%</span></div>
                </div>
              </div>
            </div>

            {/* Status transition controls inside details */}
            {selectedCampaign.status !== 'archived' && (
              <div className="pt-3 border-t border-slate-200">
                <span className="text-xs font-semibold text-slate-700 block mb-2">Change Lifecycle Status:</span>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedCampaign.status === 'draft' && (
                    <Button
                      variant="primary"
                      size="sm"
                      isLoading={transitioningId === selectedCampaign.id}
                      onClick={() => handleStatusTransition(selectedCampaign.id, 'published' as CampaignStatus)}
                    >
                      Publish Campaign
                    </Button>
                  )}
                  {(selectedCampaign.status === 'published' || selectedCampaign.status === 'active') && (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        isLoading={transitioningId === selectedCampaign.id}
                        onClick={() => handleStatusTransition(selectedCampaign.id, 'paused' as CampaignStatus)}
                      >
                        Pause Campaign
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        isLoading={transitioningId === selectedCampaign.id}
                        onClick={() => handleStatusTransition(selectedCampaign.id, 'completed' as CampaignStatus)}
                      >
                        Mark as Completed
                      </Button>
                    </>
                  )}
                  {selectedCampaign.status === 'paused' && (
                    <Button
                      variant="primary"
                      size="sm"
                      isLoading={transitioningId === selectedCampaign.id}
                      onClick={() => handleStatusTransition(selectedCampaign.id, 'published' as CampaignStatus)}
                    >
                      Resume Campaign
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-slate-500 hover:text-slate-800"
                    isLoading={transitioningId === selectedCampaign.id}
                    onClick={() => handleStatusTransition(selectedCampaign.id, 'archived' as CampaignStatus)}
                  >
                    Archive
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Edit Campaign Modal */}
      {editingCampaign && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title="Edit Campaign Details"
          description={`Update parameters for "${editingCampaign.title}"`}
          size="md"
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSaveEdit} isLoading={isUpdating}>
                Save Changes
              </Button>
            </div>
          }
        >
          <div className="space-y-4 py-2 text-left">
            <FormField label="Campaign Title" htmlFor="edit-camp-title" required>
              <Input
                id="edit-camp-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </FormField>

            <FormField label="Total Budget (USD)" htmlFor="edit-camp-budget" required>
              <Input
                id="edit-camp-budget"
                type="number"
                value={editBudget}
                onChange={(e) => setEditBudget(Number(e.target.value))}
              />
            </FormField>

            <FormField label="Deliverables (Comma-separated)" htmlFor="edit-camp-deliverables" required>
              <Input
                id="edit-camp-deliverables"
                value={editDeliverables}
                onChange={(e) => setEditDeliverables(e.target.value)}
              />
            </FormField>

            <FormTextarea
              id="edit-camp-desc"
              label="Campaign Description"
              rows={4}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              required
            />
          </div>
        </Modal>
      )}
    </div>
  );
};

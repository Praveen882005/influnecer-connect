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
  Skeleton,
} from '../../design-system';
import type { Campaign, CreatorProfile, ShortlistItem } from '../../types';
import { RichInfluencerProfileModal } from '../../components/RichInfluencerProfileModal';
import { AICampaignBriefMatcher } from '../../components/AICampaignBriefMatcher';

export const BrandDiscoverPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'directory' | 'ai_matching'>('directory');
  const [creators, setCreators] = useState<CreatorProfile[]>([]);
  const [shortlistItems, setShortlistItems] = useState<ShortlistItem[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNiche, setSelectedNiche] = useState('all');
  const [minFollowers, setMinFollowers] = useState<number | undefined>(undefined);

  // Shortlist Modal State
  const [shortlistCreator, setShortlistCreator] = useState<CreatorProfile | null>(null);
  const [selectedProfileCreator, setSelectedProfileCreator] = useState<CreatorProfile | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [isSavingShortlist, setIsSavingShortlist] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [creatorsData, shortlistsData, campaignsData] = await Promise.all([
        api.creators.list({
          q: searchTerm.trim() || undefined,
          niche: selectedNiche !== 'all' ? selectedNiche : undefined,
          min_followers: minFollowers,
        }),
        api.shortlists.listItems().catch(() => [] as ShortlistItem[]),
        api.campaigns.getMyCampaigns().catch(() => [] as Campaign[]),
      ]);
      setCreators(creatorsData);
      setShortlistItems(shortlistsData);
      setCampaigns(campaignsData);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load creator directory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedNiche]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const isCreatorShortlisted = (creatorId: number) => {
    return shortlistItems.some((s) => s.creator_id === creatorId);
  };

  const getShortlistId = (creatorId: number) => {
    return shortlistItems.find((s) => s.creator_id === creatorId)?.id;
  };

  const handleToggleShortlist = async (creator: CreatorProfile) => {
    const existingId = getShortlistId(creator.id);
    if (existingId) {
      try {
        await api.shortlists.remove(existingId);
        setShortlistItems((prev) => prev.filter((s) => s.id !== existingId));
        setFeedback(`Removed ${creator.handle} from your shortlists.`);
        setTimeout(() => setFeedback(null), 3000);
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to remove from shortlist.');
      }
    } else {
      setShortlistCreator(creator);
      setSelectedCampaignId(campaigns[0]?.id || '');
      setNotes('');
    }
  };

  const handleConfirmShortlist = async () => {
    if (!shortlistCreator) return;
    setIsSavingShortlist(true);
    try {
      const created = await api.shortlists.add({
        creator_id: shortlistCreator.id,
        campaign_id: selectedCampaignId ? Number(selectedCampaignId) : undefined,
        notes: notes.trim() || 'Saved from creator discovery catalog',
        status: 'considering',
      });
      setShortlistItems((prev) => [...prev, created]);
      setFeedback(`Added ${shortlistCreator.handle} to your campaign shortlist.`);
      setShortlistCreator(null);
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save creator to shortlist.');
    } finally {
      setIsSavingShortlist(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">Discover Creators</h1>
          <p className="text-sm text-slate-500 mt-1">
            Source verified creators evaluated across tier-normalized engagement benchmarks and authenticity signals.
          </p>
        </div>

        {/* Discovery Mode Switcher */}
        <div className="flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('directory')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeTab === 'directory'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Directory Catalog
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ai_matching')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
              activeTab === 'ai_matching'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>⚡ AI Brief Matching</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-500 text-white font-mono">Phase 3</span>
          </button>
        </div>
      </div>

      {feedback && (
        <Alert variant="success" onClose={() => setFeedback(null)}>
          {feedback}
        </Alert>
      )}

      {errorMsg && (
        <Alert variant="danger" onClose={() => setErrorMsg(null)}>
          {errorMsg}
        </Alert>
      )}

      {activeTab === 'ai_matching' ? (
        <AICampaignBriefMatcher
          onViewProfile={setSelectedProfileCreator}
          onToggleShortlist={handleToggleShortlist}
          isCreatorShortlisted={isCreatorShortlisted}
        />
      ) : (
        <>
          {/* Filter Bar */}
          <Card padding="md">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className="sm:col-span-5">
            <label className="block text-xs font-medium text-slate-700 mb-1">Search Keywords</label>
            <Input
              placeholder="Search by name, handle, or bio..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Icon name="Search" size="sm" className="text-slate-400" />}
            />
          </div>

          <div className="sm:col-span-3">
            <label className="block text-xs font-medium text-slate-700 mb-1">Content Vertical / Niche</label>
            <Select
              value={selectedNiche}
              onChange={(e) => setSelectedNiche(e.target.value)}
              options={[
                { value: 'all', label: 'All Content Niches' },
                { value: 'technology', label: 'Technology & Dev' },
                { value: 'beauty', label: 'Beauty & Skincare' },
                { value: 'food', label: 'Food & Culinary' },
                { value: 'fitness', label: 'Fitness & Health' },
                { value: 'fashion', label: 'Fashion & Style' },
                { value: 'home', label: 'Home & Decor' },
                { value: 'parenting', label: 'Parenting & Family' },
                { value: 'wellness', label: 'Wellness & Lifestyle' },
              ]}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1">Min Followers</label>
            <Select
              value={minFollowers === undefined ? 'any' : String(minFollowers)}
              onChange={(e) => setMinFollowers(e.target.value === 'any' ? undefined : Number(e.target.value))}
              options={[
                { value: 'any', label: 'Any Reach' },
                { value: '1000', label: '1,000+' },
                { value: '5000', label: '5,000+' },
                { value: '10000', label: '10,000+' },
                { value: '50000', label: '50,000+' },
              ]}
            />
          </div>

          <div className="sm:col-span-2 flex flex-col justify-end">
            <Button
              variant="primary"
              type="submit"
              className="w-full h-9.5"
              leftIcon={<Icon name="Search" size="sm" />}
            >
              Filter
            </Button>
          </div>
        </form>
      </Card>

      {/* Creators Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <Card key={n} padding="lg" orientation="vertical" className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Skeleton variant="circle" width={40} height={40} />
                  <div className="space-y-1.5">
                    <Skeleton variant="text" width={120} height={16} />
                    <Skeleton variant="text" width={80} height={12} />
                  </div>
                </div>
                <Skeleton variant="rect" width={70} height={20} />
              </div>
              <div className="space-y-1">
                <Skeleton variant="text" />
                <Skeleton variant="text" width="80%" />
              </div>
              <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded border border-slate-100">
                <Skeleton variant="text" height={24} />
                <Skeleton variant="text" height={24} />
                <Skeleton variant="text" height={24} />
              </div>
              <div className="flex justify-end gap-2 pt-1 border-t border-slate-100">
                <Skeleton variant="rect" width={90} height={32} />
                <Skeleton variant="rect" width={90} height={32} />
              </div>
            </Card>
          ))}
        </div>
      ) : creators.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            title="No Creators Found"
            description="Try modifying search keywords or resetting content niche filters to discover creators."
            icon="Users"
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {creators.map((c) => {
            const shortlisted = isCreatorShortlisted(c.id);
            return (
              <Card key={c.id} padding="lg" orientation="vertical" className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={c.display_name || c.handle} size="md" />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-900 text-sm">
                          {c.display_name || c.handle}
                        </h3>
                        {c.is_verified && (
                          <Badge variant="brand" size="sm">Verified</Badge>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 font-mono">{c.handle}</div>
                    </div>
                  </div>
                  <Badge variant="neutral" size="sm" className="capitalize">
                    {c.primary_niche}
                  </Badge>
                </div>

                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                  {c.bio || 'Verified content creator on Brand Bridge.'}
                </p>

                {/* Metrics Row */}
                <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded border border-slate-100 text-center font-mono">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-sans block">Audience</span>
                    <span className="text-xs font-bold text-slate-900">
                      {(c.total_followers ?? 0).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-sans block">Engagement</span>
                    <span className="text-xs font-bold text-sky-700">
                      {c.avg_engagement_rate ? `${c.avg_engagement_rate.toFixed(1)}%` : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-sans block">Authenticity</span>
                    <span className="text-xs font-bold text-emerald-700">
                      {c.authenticity_score ? `${c.authenticity_score.toFixed(0)}/100` : '—'}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-[11px] text-slate-400">
                    Source: {c.data_source || 'Catalog'}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setSelectedProfileCreator(c)}
                      leftIcon={<Icon name="Eye" size="sm" />}
                    >
                      View Profile
                    </Button>
                    <Button
                      variant={shortlisted ? 'secondary' : 'primary'}
                      size="sm"
                      onClick={() => handleToggleShortlist(c)}
                      leftIcon={<Icon name={shortlisted ? 'Check' : 'Plus'} size="sm" />}
                    >
                      {shortlisted ? 'Shortlisted' : 'Add to Shortlist'}
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  )}

      {/* Shortlist Confirmation Modal */}
      <Modal
        isOpen={!!shortlistCreator}
        onClose={() => setShortlistCreator(null)}
        title={`Add ${shortlistCreator?.handle} to Shortlist`}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Save <strong>{shortlistCreator?.display_name || shortlistCreator?.handle}</strong> to your campaign shortlist to begin direct evaluation and outreach.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Campaign Brief (Optional)
            </label>
            <Select
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value ? Number(e.target.value) : '')}
              options={[
                { value: '', label: 'General / Unassigned Pipeline' },
                ...campaigns.map((camp) => ({
                  value: camp.id,
                  label: `${camp.title} (${camp.niche})`,
                })),
              ]}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Confidential Evaluation Notes
            </label>
            <Input
              placeholder="e.g. Strong engagement on tech tutorials, target for Q4 launch..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="ghost" size="sm" onClick={() => setShortlistCreator(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={isSavingShortlist}
              onClick={handleConfirmShortlist}
            >
              {isSavingShortlist ? 'Saving...' : 'Save to Shortlist'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Rich Influencer Profile Intelligence Modal */}
      <RichInfluencerProfileModal
        creator={selectedProfileCreator}
        isOpen={!!selectedProfileCreator}
        onClose={() => setSelectedProfileCreator(null)}
        onShortlistToggle={handleToggleShortlist}
        isShortlisted={selectedProfileCreator ? isCreatorShortlisted(selectedProfileCreator.id) : false}
      />
    </div>
  );
};

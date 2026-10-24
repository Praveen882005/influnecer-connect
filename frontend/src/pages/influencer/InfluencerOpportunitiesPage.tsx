import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  Input,
  Modal,
  Select,
} from '../../design-system';
import type { CampaignOpportunity } from '../../types';

export const InfluencerOpportunitiesPage: React.FC = () => {
  const [opportunities, setOpportunities] = useState<CampaignOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [nicheFilter, setNicheFilter] = useState('all');
  const [showDismissed, setShowDismissed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedMessage, setSubmittedMessage] = useState<string | null>(null);

  // Modals
  const [selectedOpp, setSelectedOpp] = useState<CampaignOpportunity | null>(null);
  const [isExplanationModalOpen, setIsExplanationModalOpen] = useState(false);
  const [isBidModalOpen, setIsBidModalOpen] = useState(false);

  // Pitch form states
  const [proposedFee, setProposedFee] = useState('2500');
  const [turnaroundDays, setTurnaroundDays] = useState('14');
  const [pitchMessage, setPitchMessage] = useState('');
  const [isSubmittingPitch, setIsSubmittingPitch] = useState(false);

  const loadOpportunities = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const data = await api.opportunities.list({
        search: searchQuery || undefined,
        niche: nicheFilter !== 'all' ? nicheFilter : undefined,
        include_dismissed: showDismissed,
      });
      setOpportunities(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load campaign opportunities.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOpportunities();
  }, [nicheFilter, showDismissed]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadOpportunities();
  };

  const handleToggleSave = async (opp: CampaignOpportunity) => {
    try {
      const nextAction = opp.is_saved ? 'unsave' : 'save';
      const res = await api.opportunities.interact(opp.id, nextAction);
      setOpportunities((prev) =>
        prev.map((o) => (o.id === opp.id ? { ...o, is_saved: res.is_saved } : o))
      );
      setSubmittedMessage(
        res.is_saved ? `Opportunity "${opp.title}" saved to your shortlist.` : 'Opportunity unsaved.'
      );
      setTimeout(() => setSubmittedMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update saved status.');
    }
  };

  const handleToggleDismiss = async (opp: CampaignOpportunity) => {
    try {
      const nextAction = opp.is_dismissed ? 'undismiss' : 'dismiss';
      const res = await api.opportunities.interact(opp.id, nextAction);
      if (res.is_dismissed && !showDismissed) {
        setOpportunities((prev) => prev.filter((o) => o.id !== opp.id));
      } else {
        setOpportunities((prev) =>
          prev.map((o) => (o.id === opp.id ? { ...o, is_dismissed: res.is_dismissed } : o))
        );
      }
      setSubmittedMessage(
        res.is_dismissed
          ? `Brief dismissed from your feed.`
          : 'Opportunity restored to your active feed.'
      );
      setTimeout(() => setSubmittedMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update dismiss status.');
    }
  };

  const handleOpenBidModal = (opp: CampaignOpportunity) => {
    setSelectedOpp(opp);
    setProposedFee(String(opp.budget || 2500));
    setPitchMessage(
      `Hi ${opp.brand_name} team, I would love to partner on this campaign. My content portfolio specializes in ${opp.niche} and engages a dedicated community.`
    );
    setIsBidModalOpen(true);
  };

  const handleSubmitPitch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOpp) return;
    try {
      setIsSubmittingPitch(true);
      await api.campaigns.submitProposal(selectedOpp.id, {
        pitch: pitchMessage,
        proposed_rate: parseFloat(proposedFee) || 0,
        estimated_delivery_days: parseInt(turnaroundDays) || 14,
      });

      setIsBidModalOpen(false);
      setSubmittedMessage(
        `Your proposal for "${selectedOpp.title}" was submitted to ${selectedOpp.brand_name} at $${proposedFee}.`
      );
      setTimeout(() => setSubmittedMessage(null), 5000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit proposal.');
    } finally {
      setIsSubmittingPitch(false);
    }
  };

  const handleOpenExplanation = (opp: CampaignOpportunity) => {
    setSelectedOpp(opp);
    setIsExplanationModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">Open Campaign Opportunities</h1>
          <p className="text-sm text-slate-500 mt-1">
            Discover active brand briefs ranked by AI match compatibility, audience alignment, and content niche fit.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Icon name="RefreshCw" size="sm" />}
            onClick={loadOpportunities}
            disabled={loading}
          >
            Refresh
          </Button>
        </div>
      </div>

      {submittedMessage && (
        <Alert variant="success" title="Success" onClose={() => setSubmittedMessage(null)}>
          {submittedMessage}
        </Alert>
      )}
      {errorMessage && (
        <Alert variant="danger" title="Error" onClose={() => setErrorMessage(null)}>
          {errorMessage}
        </Alert>
      )}

      {/* Search and Filters */}
      <Card orientation="vertical" padding="sm" className="bg-white">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex-1 w-full">
            <Input
              placeholder="Search briefs by title, objective or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Icon name="Search" size="sm" className="text-slate-400" />}
            />
          </div>
          <div className="w-full sm:w-56">
            <Select
              value={nicheFilter}
              onChange={(e) => setNicheFilter(e.target.value)}
              options={[
                { value: 'all', label: 'All Content Niches' },
                { value: 'technology', label: 'Technology' },
                { value: 'wellness', label: 'Wellness' },
                { value: 'fitness', label: 'Fitness' },
                { value: 'fashion', label: 'Fashion' },
                { value: 'beauty', label: 'Beauty' },
                { value: 'food', label: 'Food' },
                { value: 'home', label: 'Home' },
                { value: 'parenting', label: 'Parenting' },
              ]}
            />
          </div>
          <div className="flex items-center gap-2 whitespace-nowrap text-xs text-slate-600">
            <input
              type="checkbox"
              id="show-dismissed"
              checked={showDismissed}
              onChange={(e) => setShowDismissed(e.target.checked)}
              className="rounded text-sky-600"
            />
            <label htmlFor="show-dismissed" className="cursor-pointer">
              Show Dismissed ({opportunities.filter((o) => o.is_dismissed).length})
            </label>
          </div>
          <Button variant="primary" size="sm" type="submit">
            Search
          </Button>
        </form>
      </Card>

      {/* Opportunities Grid */}
      {loading ? (
        <Card padding="lg">
          <div className="flex items-center justify-center py-12 gap-3 text-slate-500 text-sm">
            <Icon name="RotateCw" size="md" className="animate-spin text-sky-600" />
            <span>Evaluating eligible campaigns and calculating fit scores...</span>
          </div>
        </Card>
      ) : opportunities.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            title="No Opportunities Found"
            description="There are currently no active brand briefs matching your search filters. Check back soon or adjust filter criteria."
            icon="Compass"
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {opportunities.map((opp) => {
            const fitScore = opp.fit_score ?? 75;
            const badgeVariant = fitScore >= 80 ? 'success' : fitScore >= 60 ? 'brand' : 'neutral';

            return (
              <Card
                key={opp.id}
                orientation="vertical"
                padding="lg"
                className={`flex flex-col justify-between border ${
                  opp.has_invitation
                    ? 'border-sky-300 bg-sky-50/20'
                    : opp.is_dismissed
                    ? 'opacity-60 bg-slate-50'
                    : 'border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          {opp.brand_name}
                        </span>
                        {opp.has_invitation && (
                          <Badge variant="brand" size="sm">
                            ★ Direct Invite Received
                          </Badge>
                        )}
                      </div>
                      <h3 className="text-base font-bold text-slate-900 mt-0.5">{opp.title}</h3>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenExplanation(opp)}
                      className="cursor-pointer transition-transform hover:scale-105 rounded-[4px] focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:outline-none"
                      aria-label={`View match compatibility explanation for ${opp.title} (${fitScore}% fit)`}
                    >
                      <Badge variant={badgeVariant}>
                        <Icon name="Sparkles" size="xs" className="mr-1 inline" />
                        {fitScore}% Fit
                      </Badge>
                    </button>
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-2 mb-3">{opp.description}</p>

                  {opp.match_strengths.length > 0 && (
                    <div className="mb-3 px-2 py-1.5 bg-emerald-50/70 border border-emerald-100 rounded text-[11px] text-emerald-800 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 truncate">
                        <Icon name="CheckCircle2" size="xs" className="text-emerald-600 shrink-0" />
                        <span className="truncate">{opp.match_strengths[0]}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenExplanation(opp)}
                        className="text-emerald-700 hover:text-emerald-900 font-semibold underline shrink-0 ml-2 rounded focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:outline-none cursor-pointer"
                        aria-label={`Explain match reason: ${opp.match_strengths[0]}`}
                      >
                        Explain
                      </button>
                    </div>
                  )}

                  <div className="space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-3">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Campaign Budget:</span>
                      <span className="font-semibold text-slate-900">
                        ${(opp.budget ?? 0).toLocaleString()} {opp.currency}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Deliverables:</span>
                      <span className="font-medium text-slate-800">
                        {opp.deliverables.length > 0 ? opp.deliverables.join(', ') : 'Standard package'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Target Region:</span>
                      <span className="text-slate-600">{opp.target_location}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      variant={opp.is_saved ? 'secondary' : 'ghost'}
                      size="xs"
                      leftIcon={<Icon name="Bookmark" size="xs" />}
                      onClick={() => handleToggleSave(opp)}
                    >
                      {opp.is_saved ? 'Saved' : 'Save'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      className="text-slate-400 hover:text-slate-600"
                      onClick={() => handleToggleDismiss(opp)}
                    >
                      {opp.is_dismissed ? 'Restore' : 'Dismiss'}
                    </Button>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<Icon name="Send" size="xs" />}
                    onClick={() => handleOpenBidModal(opp)}
                  >
                    Submit Proposal
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Match Explanation Modal */}
      {isExplanationModalOpen && selectedOpp && (
        <Modal
          isOpen={true}
          onClose={() => setIsExplanationModalOpen(false)}
          title={`AI Match Fit: ${selectedOpp.title}`}
          size="md"
        >
          <div className="space-y-4">
            <div className="p-4 bg-sky-50 rounded-[6px] border border-sky-100 flex items-center justify-between">
              <div>
                <span className="text-xs text-sky-700 font-semibold uppercase">Overall Compatibility</span>
                <div className="text-2xl font-bold text-sky-950 mt-0.5">{selectedOpp.fit_score}% Fit</div>
              </div>
              <Badge variant="brand" size="md">
                {selectedOpp.niche.toUpperCase()}
              </Badge>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-slate-900 mb-1">Assessment Summary</h4>
              <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded border border-slate-200">
                {selectedOpp.fit_summary || 'Deterministic compatibility based on niche, engagement, and reach criteria.'}
              </p>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-slate-900 mb-2">Verified Matching Signals</h4>
              <ul className="space-y-2">
                {selectedOpp.match_strengths.map((strength, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-xs text-slate-700 bg-emerald-50/50 p-2 rounded border border-emerald-100"
                  >
                    <Icon name="CheckCircle" size="xs" className="text-emerald-600 shrink-0 mt-0.5" />
                    <span>{strength}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => setIsExplanationModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Pitch Modal */}
      {isBidModalOpen && selectedOpp && (
        <Modal
          isOpen={true}
          onClose={() => setIsBidModalOpen(false)}
          title={`Submit Proposal to ${selectedOpp.brand_name}`}
          size="lg"
        >
          <form onSubmit={handleSubmitPitch} className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-[6px] border border-slate-100 text-xs text-slate-600 space-y-1">
              <div><strong>Campaign:</strong> {selectedOpp.title}</div>
              <div><strong>Budget:</strong> ${(selectedOpp.budget ?? 0).toLocaleString()} {selectedOpp.currency}</div>
              <div><strong>Deliverables:</strong> {(selectedOpp.deliverables || []).join(', ') || 'Custom'}</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Proposed Rate ($ USD)
                </label>
                <Input
                  type="number"
                  value={proposedFee}
                  onChange={(e) => setProposedFee(e.target.value)}
                  placeholder="2500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Estimated Turnaround (Days)
                </label>
                <Input
                  type="number"
                  value={turnaroundDays}
                  onChange={(e) => setTurnaroundDays(e.target.value)}
                  placeholder="14"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Pitch &amp; Creator Vision
              </label>
              <textarea
                className="w-full p-2.5 rounded-[5px] border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-sky-600"
                rows={4}
                value={pitchMessage}
                onChange={(e) => setPitchMessage(e.target.value)}
                placeholder="Introduce your channel, creative concept, and why your audience fits the brand..."
                required
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button variant="ghost" size="sm" onClick={() => setIsBidModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" disabled={isSubmittingPitch}>
                {isSubmittingPitch ? 'Submitting...' : 'Submit Official Proposal'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

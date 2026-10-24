import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { Campaign } from '../types';

interface CampaignBoardProps {
  onOpenCreateCampaign: () => void;
  onSelectCampaignForAI: (campaign: Campaign) => void;
}

export const CampaignBoard: React.FC<CampaignBoardProps> = ({
  onOpenCreateCampaign,
  onSelectCampaignForAI,
}) => {
  const { user, isAuthenticated } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [nicheFilter, setNicheFilter] = useState<string>('');

  // Proposal submission modal state
  const [activeCampaignForPitch, setActiveCampaignForPitch] = useState<Campaign | null>(null);
  const [pitchText, setPitchText] = useState<string>('');
  const [proposedRate, setProposedRate] = useState<string>('');
  const [deliveryDays, setDeliveryDays] = useState<number>(7);
  const [pitchSuccess, setPitchSuccess] = useState<string | null>(null);
  const [pitchError, setPitchError] = useState<string | null>(null);
  const [isSubmittingPitch, setIsSubmittingPitch] = useState<boolean>(false);

  const loadCampaigns = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await api.campaigns.list({ niche: nicheFilter || undefined });
      setCampaigns(data);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Failed to load campaigns.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCampaigns();
  }, [nicheFilter]);

  const handleOpenPitch = (campaign: Campaign) => {
    setActiveCampaignForPitch(campaign);
    setPitchText('');
    setProposedRate(String(campaign.budget ?? ''));
    setDeliveryDays(7);
    setPitchSuccess(null);
    setPitchError(null);
  };

  const handleSubmitPitch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCampaignForPitch) return;
    setIsSubmittingPitch(true);
    setPitchError(null);
    setPitchSuccess(null);

    try {
      await api.proposals.submit({
        campaign_id: activeCampaignForPitch.id,
        pitch: pitchText,
        proposed_rate: parseFloat(proposedRate),
        estimated_delivery_days: deliveryDays,
      });
      setPitchSuccess('Proposal successfully submitted to the brand!');
      setTimeout(() => {
        setActiveCampaignForPitch(null);
        setPitchSuccess(null);
        loadCampaigns();
      }, 1500);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setPitchError(err.message);
      } else {
        setPitchError('Failed to submit proposal.');
      }
    } finally {
      setIsSubmittingPitch(false);
    }
  };

  return (
    <section className="campaigns-section" aria-labelledby="campaigns-title">
      <div className="catalog-header-bar">
        <div>
          <h2 id="campaigns-title" className="section-heading">Open Brand Campaigns</h2>
          <p className="section-subtext">
            Explore verified brand briefs, requirements, and deliverables. Creators can submit proposals directly.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {isAuthenticated && (user?.role === 'brand' || user?.role === 'admin') && (
            <button
              type="button"
              className="action-btn-primary"
              onClick={onOpenCreateCampaign}
            >
              + Create Campaign Brief
            </button>
          )}
        </div>
      </div>

      {/* Filter Row */}
      <div className="filters-strip">
        <div className="filter-controls-row">
          <select
            className="filter-select"
            value={nicheFilter}
            onChange={(e) => setNicheFilter(e.target.value)}
            aria-label="Filter campaigns by niche"
          >
            <option value="">All Campaign Niches</option>
            <option value="Tech & AI">Tech &amp; AI</option>
            <option value="Fitness & Wellness">Fitness &amp; Wellness</option>
            <option value="Sustainable Fashion">Sustainable Fashion</option>
            <option value="Gaming">Gaming &amp; Entertainment</option>
            <option value="Food & Culinary">Food &amp; Culinary</option>
          </select>
          {nicheFilter && (
            <button
              type="button"
              className="action-btn-sm"
              onClick={() => setNicheFilter('')}
            >
              Clear Filter
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="alert-box error" role="alert">
          {errorMsg}
        </div>
      )}

      {/* Campaigns Listing */}
      {isLoading ? (
        <div className="loading-grid">
          {[1, 2, 3].map((n) => (
            <div key={n} className="card skeleton-card">
              <div className="skeleton-line lg" />
              <div className="skeleton-line md" />
            </div>
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="empty-state-box">
          <p className="empty-title">No Active Campaigns Found</p>
          <p className="empty-desc">Check back soon or post a new campaign brief as a brand.</p>
        </div>
      ) : (
        <div className="campaign-cards-grid" role="list">
          {campaigns.map((camp) => (
            <article key={camp.id} className="campaign-card" role="listitem">
              <div className="campaign-card-header">
                <div>
                  <span className="campaign-brand-tag">{camp.brand_name || 'Brand Partner'}</span>
                  <h3 className="campaign-title">{camp.title}</h3>
                </div>
                <div className="campaign-budget-badge">
                  ${(camp.budget ?? 0).toLocaleString()} USD
                </div>
              </div>

              <p className="campaign-description">{camp.description}</p>

              {/* Deliverables List */}
              {camp.deliverables && camp.deliverables.length > 0 && (
                <div className="deliverables-box">
                  <span className="tiny-label">Expected Deliverables:</span>
                  <ul className="deliverables-checklist">
                    {camp.deliverables.map((d, idx) => (
                      <li key={idx}>✓ {d}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Requirement Tags */}
              <div className="campaign-requirements-row">
                <span className="req-pill">Niche: {camp.niche}</span>
                {camp.min_followers != null && camp.min_followers > 0 && (
                  <span className="req-pill">Min {camp.min_followers.toLocaleString()} Reach</span>
                )}
                {camp.min_engagement_rate != null && camp.min_engagement_rate > 0 && (
                  <span className="req-pill">&gt; {camp.min_engagement_rate}% Engagement</span>
                )}
                <span className="req-pill proposal-count">
                  {camp.proposal_count || 0} Proposals Submitted
                </span>
              </div>

              {/* Card Actions */}
              <div className="campaign-card-footer">
                <button
                  type="button"
                  className="action-btn-sm outline"
                  onClick={() => onSelectCampaignForAI(camp)}
                >
                  Match Creators with AI →
                </button>

                {user?.role === 'creator' && (
                  <button
                    type="button"
                    className="action-btn-sm primary"
                    onClick={() => handleOpenPitch(camp)}
                  >
                    Submit Proposal / Bid
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Proposal Pitch Modal */}
      {activeCampaignForPitch && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="pitch-modal-title">
          <div className="modal-card">
            <div className="modal-header">
              <h2 id="pitch-modal-title" className="modal-title">
                Pitch Campaign: {activeCampaignForPitch.title}
              </h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setActiveCampaignForPitch(null)}
              >
                &times;
              </button>
            </div>

            <p className="modal-subtitle">
              Brand Budget: ${(activeCampaignForPitch.budget ?? 0).toLocaleString()} · Niche: {activeCampaignForPitch.niche}
            </p>

            {pitchSuccess && (
              <div className="alert-box success" role="alert">
                {pitchSuccess}
              </div>
            )}
            {pitchError && (
              <div className="alert-box error" role="alert">
                {pitchError}
              </div>
            )}

            <form onSubmit={handleSubmitPitch} className="auth-form">
              <div className="form-group">
                <label className="form-label" htmlFor="pitch-text">
                  Your Pitch &amp; Creative Concept
                </label>
                <textarea
                  id="pitch-text"
                  required
                  rows={4}
                  className="form-input"
                  placeholder="Explain why your audience is the ideal fit, your creative hook, and how you will highlight the product..."
                  value={pitchText}
                  onChange={(e) => setPitchText(e.target.value)}
                />
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="proposed-rate">
                    Your Proposed Fee ($ USD)
                  </label>
                  <input
                    id="proposed-rate"
                    type="number"
                    required
                    min={1}
                    className="form-input"
                    value={proposedRate}
                    onChange={(e) => setProposedRate(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="delivery-days">
                    Turnaround Time (Days)
                  </label>
                  <input
                    id="delivery-days"
                    type="number"
                    required
                    min={1}
                    max={60}
                    className="form-input"
                    value={deliveryDays}
                    onChange={(e) => setDeliveryDays(parseInt(e.target.value, 10))}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="action-btn-primary full-width"
                disabled={isSubmittingPitch}
              >
                {isSubmittingPitch ? 'Submitting Pitch...' : 'Send Proposal to Brand'}
              </button>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { BrandProfile, Campaign, Proposal } from '../types';

export const BrandDashboard: React.FC = () => {
  const [profile, setProfile] = useState<BrandProfile | null>(null);
  const [myCampaigns, setMyCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [campaignProposals, setCampaignProposals] = useState<Proposal[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // New Campaign Form State
  const [showCreateForm, setShowCreateForm] = useState<boolean>(false);
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [budget, setBudget] = useState<string>('3000');
  const [niche, setNiche] = useState<string>('Tech & AI');
  const [deliverablesText, setDeliverablesText] = useState<string>('1x YouTube Dedicated Video\n2x Instagram Reels');
  const [minFollowers] = useState<string>('10000');
  const [minEngagement, setMinEngagement] = useState<string>('2.5');
  const [isCreating, setIsCreating] = useState<boolean>(false);

  const loadBrandData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [brandData, campaignsData] = await Promise.all([
        api.brands.getMyProfile(),
        api.campaigns.getMyCampaigns(),
      ]);
      setProfile(brandData);
      setMyCampaigns(campaignsData);
      if (campaignsData.length > 0 && campaignsData[0] && !selectedCampaignId) {
        setSelectedCampaignId(campaignsData[0].id);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Failed to load brand dashboard.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadProposalsForSelected = async (campaignId: number) => {
    try {
      const proposals = await api.proposals.getByCampaign(campaignId);
      setCampaignProposals(proposals);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      }
    }
  };

  useEffect(() => {
    loadBrandData();
  }, []);

  useEffect(() => {
    if (selectedCampaignId) {
      loadProposalsForSelected(selectedCampaignId);
    }
  }, [selectedCampaignId]);

  const handleCreateCampaignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setErrorMsg(null);
    setActionSuccess(null);

    const deliverablesList = deliverablesText
      .split('\n')
      .map((d) => d.trim())
      .filter((d) => d.length > 0);

    try {
      await api.campaigns.create({
        title,
        description,
        budget: parseFloat(budget),
        deliverables: deliverablesList,
        niche,
        min_followers: parseInt(minFollowers, 10) || 0,
        min_engagement_rate: parseFloat(minEngagement) || 0.0,
      });
      setActionSuccess('Campaign brief published successfully!');
      setShowCreateForm(false);
      setTitle('');
      setDescription('');
      await loadBrandData();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Failed to create campaign.');
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleProposalDecision = async (proposalId: number, newStatus: 'accepted' | 'rejected') => {
    try {
      await api.proposals.updateStatus(proposalId, {
        status: newStatus,
        feedback: newStatus === 'accepted' ? 'Accepted by Brand partner.' : 'Declined for current brief requirements.',
      });
      setActionSuccess(`Proposal marked as ${newStatus}.`);
      if (selectedCampaignId) {
        loadProposalsForSelected(selectedCampaignId);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      }
    }
  };

  if (isLoading) {
    return <div className="loading-state">Loading brand management studio...</div>;
  }

  return (
    <div className="brand-dashboard-layout">
      {/* Brand Header Banner */}
      <section className="profile-hero-card">
        <div className="profile-avatar-brand">
          {(profile?.company_name || 'BR').slice(0, 2).toUpperCase()}
        </div>
        <div className="profile-hero-info">
          <h2 className="profile-hero-title">{profile?.company_name}</h2>
          <span className="niche-badge">{profile?.industry}</span>
          <p className="profile-hero-desc">{profile?.description || 'Active brand account on Brand Bridge.'}</p>
          <div className="brand-values-row">
            {profile?.brand_values?.map((val) => (
              <span key={val} className="value-pill">★ {val}</span>
            ))}
          </div>
        </div>
        <button
          type="button"
          className="action-btn-primary"
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          {showCreateForm ? 'Cancel Brief' : '+ New Campaign Brief'}
        </button>
      </section>

      {actionSuccess && (
        <div className="alert-box success" role="alert">
          {actionSuccess}
        </div>
      )}
      {errorMsg && (
        <div className="alert-box error" role="alert">
          {errorMsg}
        </div>
      )}

      {/* Create Campaign Form Drawer */}
      {showCreateForm && (
        <section className="card form-drawer-card">
          <h3 className="section-label text-left">Publish New Campaign Brief</h3>
          <form onSubmit={handleCreateCampaignSubmit} className="auth-form">
            <div className="form-group">
              <label className="form-label" htmlFor="new-campaign-title">Campaign Title</label>
              <input
                id="new-campaign-title"
                type="text"
                required
                className="form-input"
                placeholder="e.g. Autumn Organic Skincare Line Launch"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="new-campaign-desc">Detailed Campaign Brief &amp; Guidelines</label>
              <textarea
                id="new-campaign-desc"
                required
                rows={3}
                className="form-input"
                placeholder="Explain the product value, messaging pillars, creator expectations..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="form-row-3">
              <div className="form-group">
                <label className="form-label" htmlFor="new-campaign-budget">Budget ($ USD)</label>
                <input
                  id="new-campaign-budget"
                  type="number"
                  required
                  min={100}
                  className="form-input"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="new-campaign-niche">Primary Niche</label>
                <select
                  id="new-campaign-niche"
                  className="form-input"
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                >
                  <option value="Tech & AI">Tech &amp; AI</option>
                  <option value="Fitness & Wellness">Fitness &amp; Wellness</option>
                  <option value="Sustainable Fashion">Sustainable Fashion</option>
                  <option value="Gaming & Streaming">Gaming &amp; Streaming</option>
                  <option value="Food & Culinary">Food &amp; Culinary</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="new-campaign-min-eng">Min Engagement (%)</label>
                <input
                  id="new-campaign-min-eng"
                  type="number"
                  step="0.1"
                  className="form-input"
                  value={minEngagement}
                  onChange={(e) => setMinEngagement(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="new-campaign-deliverables">Expected Deliverables (one per line)</label>
              <textarea
                id="new-campaign-deliverables"
                rows={2}
                className="form-input"
                value={deliverablesText}
                onChange={(e) => setDeliverablesText(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="action-btn-primary"
              disabled={isCreating}
            >
              {isCreating ? 'Publishing Brief...' : 'Publish Campaign Brief'}
            </button>
          </form>
        </section>
      )}

      {/* Campaign Management Matrix */}
      <section className="brand-campaigns-section">
        <h3 className="section-label text-left">Your Campaigns &amp; Inbound Bids</h3>
        {myCampaigns.length === 0 ? (
          <div className="empty-state-box">
            <p className="empty-title">You Have Not Published Any Campaigns Yet</p>
            <p className="empty-desc">Create your first brief to receive pitches from vetted creators.</p>
          </div>
        ) : (
          <div className="brand-workspace-grid">
            {/* Left: Campaign selector list */}
            <div className="campaign-selector-list" role="tablist">
              {myCampaigns.map((camp) => (
                <div
                  key={camp.id}
                  className={`campaign-select-card ${selectedCampaignId === camp.id ? 'active' : ''}`}
                  onClick={() => setSelectedCampaignId(camp.id)}
                  role="tab"
                  tabIndex={0}
                  aria-selected={selectedCampaignId === camp.id}
                >
                  <div className="select-card-header">
                    <h4 className="select-card-title">{camp.title}</h4>
                    <span className="budget-tag">${(camp.budget ?? 0).toLocaleString()}</span>
                  </div>
                  <span className="select-card-niche">{camp.niche}</span>
                  <div className="select-card-footer">
                    <span>{camp.proposal_count || 0} Proposals</span>
                    <span className={`status-pill ${camp.status}`}>{camp.status}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Right: Review proposals for active campaign */}
            <div className="proposals-review-panel">
              <div className="panel-header">
                <h4>Inbound Proposals &amp; Bids</h4>
                <span className="panel-count">{campaignProposals.length} submissions</span>
              </div>

              {campaignProposals.length === 0 ? (
                <div className="empty-panel-box">
                  <p>No proposals submitted for this campaign yet.</p>
                  <p className="tiny-muted">Creators can discover this campaign and submit pitches from the Campaigns feed.</p>
                </div>
              ) : (
                <div className="proposals-list" role="list">
                  {campaignProposals.map((prop) => (
                    <article key={prop.id} className="proposal-review-card" role="listitem">
                      <div className="proposal-card-header">
                        <div>
                          <h5 className="creator-bidder-name">{prop.creator_name}</h5>
                          <span className="creator-handle-tag">{prop.creator_handle}</span>
                        </div>
                        <div className="bid-amount-box">
                          <span className="bid-val">${(prop.proposed_rate ?? 0).toLocaleString()}</span>
                          <span className="bid-time">{prop.estimated_delivery_days} days delivery</span>
                        </div>
                      </div>

                      <p className="proposal-pitch-text">"{prop.pitch}"</p>

                      <div className="proposal-card-actions">
                        <span className={`status-pill ${prop.status}`}>
                          Status: {prop.status.toUpperCase()}
                        </span>

                        {prop.status === 'pending' && (
                          <div className="decision-btns-row">
                            <button
                              type="button"
                              className="action-btn-sm success"
                              onClick={() => handleProposalDecision(prop.id, 'accepted')}
                            >
                              ✓ Accept Pitch
                            </button>
                            <button
                              type="button"
                              className="action-btn-sm danger"
                              onClick={() => handleProposalDecision(prop.id, 'rejected')}
                            >
                              ✕ Decline
                            </button>
                          </div>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

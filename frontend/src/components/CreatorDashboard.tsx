import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { CreatorProfile, Proposal } from '../types';

export const CreatorDashboard: React.FC = () => {
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [myProposals, setMyProposals] = useState<Proposal[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Deliverable URL submission state
  const [submittingDeliverableId, setSubmittingDeliverableId] = useState<number | null>(null);
  const [deliverableUrl, setDeliverableUrl] = useState<string>('');

  const loadCreatorData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [creatorData, proposalsData] = await Promise.all([
        api.creators.getMyProfile(),
        api.proposals.getMyProposals(),
      ]);
      setProfile(creatorData);
      setMyProposals(proposalsData);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Failed to load creator studio.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCreatorData();
  }, []);

  const handleDeliverableSubmit = async (proposalId: number) => {
    if (!deliverableUrl.trim()) return;
    try {
      await api.proposals.updateStatus(proposalId, {
        deliverable_links: [deliverableUrl.trim()],
        status: 'completed',
        feedback: 'Deliverable proof link submitted by creator.',
      });
      setActionSuccess('Deliverable link submitted successfully!');
      setSubmittingDeliverableId(null);
      setDeliverableUrl('');
      await loadCreatorData();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      }
    }
  };

  if (isLoading) {
    return <div className="loading-state">Loading creator studio...</div>;
  }

  return (
    <div className="creator-dashboard-layout">
      {/* Creator Profile Summary Hero */}
      <section className="profile-hero-card">
        <div className="profile-avatar-creator">
          {(profile?.display_name || profile?.handle || 'CR').slice(0, 2).toUpperCase()}
        </div>
        <div className="profile-hero-info">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h2 className="profile-hero-title">{profile?.display_name}</h2>
            <span className="creator-handle-tag">{profile?.handle}</span>
            {profile?.is_verified && <span className="verified-badge-icon">✓</span>}
          </div>
          <span className="niche-badge">{profile?.primary_niche}</span>
          <p className="profile-hero-desc">{profile?.bio}</p>

          <div className="creator-stats-summary-row">
            <span className="metric-pill">
              Audience: <strong>{profile?.total_followers != null ? profile.total_followers.toLocaleString() : '0'}</strong>
            </span>
            <span className="metric-pill">
              Engagement: <strong>{profile?.avg_engagement_rate != null ? `${profile.avg_engagement_rate}%` : '—'}</strong>
            </span>
            <span className="metric-pill">
              Authenticity Index: <strong>{profile?.authenticity_score != null ? `${profile.authenticity_score}/100` : '—'}</strong>
            </span>
          </div>
        </div>
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

      {/* Submitted Proposals Tracker */}
      <section className="proposals-tracker-section">
        <div className="section-header-row">
          <h3 className="section-label text-left">My Active Pitches &amp; Deliverables</h3>
          <span className="badge-counter">{myProposals.length} Submitted</span>
        </div>

        {myProposals.length === 0 ? (
          <div className="empty-state-box">
            <p className="empty-title">You Have Not Submitted Any Pitches Yet</p>
            <p className="empty-desc">Explore the Open Campaigns board to find brand partnerships matching your audience.</p>
          </div>
        ) : (
          <div className="proposals-table-container">
            <table className="proposals-table">
              <thead>
                <tr>
                  <th>Campaign Brief</th>
                  <th>Brand Partner</th>
                  <th>Proposed Rate</th>
                  <th>Timeline</th>
                  <th>Status</th>
                  <th>Deliverables &amp; Actions</th>
                </tr>
              </thead>
              <tbody>
                {myProposals.map((prop) => (
                  <tr key={prop.id}>
                    <td>
                      <div className="table-campaign-title">{prop.campaign_title}</div>
                      <span className="table-pitch-preview">"{(prop.pitch || '').slice(0, 75)}..."</span>
                    </td>
                    <td>{prop.brand_name || 'Brand Partner'}</td>
                    <td><strong>${(prop.proposed_rate ?? 0).toLocaleString()}</strong></td>
                    <td>{prop.estimated_delivery_days} days</td>
                    <td>
                      <span className={`status-pill ${prop.status}`}>
                        {prop.status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      {prop.status === 'accepted' && (
                        <div>
                          {submittingDeliverableId === prop.id ? (
                            <div className="deliverable-input-inline">
                              <input
                                type="url"
                                className="form-input-sm"
                                placeholder="Paste live post/video URL..."
                                value={deliverableUrl}
                                onChange={(e) => setDeliverableUrl(e.target.value)}
                              />
                              <button
                                type="button"
                                className="action-btn-sm success"
                                onClick={() => handleDeliverableSubmit(prop.id)}
                              >
                                Submit Proof
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="action-btn-sm primary"
                              onClick={() => {
                                setSubmittingDeliverableId(prop.id);
                                setDeliverableUrl('');
                              }}
                            >
                              + Submit Deliverable URL
                            </button>
                          )}
                        </div>
                      )}

                      {prop.status === 'completed' && (
                        <div className="completed-links-box">
                          {prop.deliverable_links?.map((url, i) => (
                            <a
                              key={i}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="proof-link"
                            >
                              View Proof Link ↗
                            </a>
                          ))}
                        </div>
                      )}

                      {prop.status === 'pending' && (
                        <span className="tiny-muted">Awaiting brand review</span>
                      )}

                      {prop.status === 'rejected' && (
                        <span className="tiny-muted">Archived</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

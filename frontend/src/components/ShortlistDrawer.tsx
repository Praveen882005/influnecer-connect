import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { CreatorProfile } from '../types';

interface ShortlistDrawerProps {
  onSelectCreatorForAI: (creator: CreatorProfile) => void;
  onRemoveFromShortlist: (creatorId: number) => void;
}

export const ShortlistDrawer: React.FC<ShortlistDrawerProps> = ({
  onSelectCreatorForAI,
  onRemoveFromShortlist,
}) => {
  const [shortlistedCreators, setShortlistedCreators] = useState<CreatorProfile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadShortlist = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await api.shortlists.list();
      setShortlistedCreators(data);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Failed to load shortlist.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadShortlist();
  }, []);

  const handleRemove = async (id: number) => {
    await onRemoveFromShortlist(id);
    setShortlistedCreators((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <section className="shortlist-section" aria-labelledby="shortlist-title">
      <div className="catalog-header-bar">
        <div>
          <h2 id="shortlist-title" className="section-heading">Brand Creator Shortlist</h2>
          <p className="section-subtext">
            Creators saved for active and upcoming brand collaboration campaigns.
          </p>
        </div>
        <div className="catalog-stats-pill">
          {shortlistedCreators.length} Creators Saved
        </div>
      </div>

      {errorMsg && (
        <div className="alert-box error" role="alert">
          {errorMsg}
        </div>
      )}

      {isLoading ? (
        <div className="loading-state">Loading saved creators...</div>
      ) : shortlistedCreators.length === 0 ? (
        <div className="empty-state-box">
          <p className="empty-title">Your Shortlist is Currently Empty</p>
          <p className="empty-desc">
            Browse the Creator Directory or run the AI Matching Studio to save creators to your campaign shortlist.
          </p>
        </div>
      ) : (
        <div className="creator-cards-grid" role="list">
          {shortlistedCreators.map((c) => (
            <article key={c.id} className="creator-card" role="listitem">
              <div className="creator-card-header">
                <div className="creator-avatar-wrap">
                  <span className="creator-initials">
                    {(c.display_name || c.handle || 'CR').slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <div className="creator-meta">
                  <h3 className="creator-display-name">{c.display_name}</h3>
                  <span className="creator-handle-tag">{c.handle}</span>
                  <span className="niche-badge">{c.primary_niche}</span>
                </div>
              </div>

              <p className="creator-bio-text">{c.bio || 'Verified platform creator.'}</p>

              <div className="creator-metrics-row">
                <div className="metric-box">
                  <span className="metric-val">{(c.total_followers ?? 0).toLocaleString()}</span>
                  <span className="metric-lbl">Audience</span>
                </div>
                <div className="metric-box">
                  <span className="metric-val text-accent">{c.avg_engagement_rate != null ? `${c.avg_engagement_rate}%` : '—'}</span>
                  <span className="metric-lbl">Engagement</span>
                </div>
                <div className="metric-box">
                  <span className="metric-val text-success">{c.authenticity_score != null ? c.authenticity_score : '—'}</span>
                  <span className="metric-lbl">Authenticity</span>
                </div>
              </div>

              <div className="creator-card-footer">
                <button
                  type="button"
                  className="action-btn-sm danger"
                  onClick={() => handleRemove(c.id)}
                >
                  ✕ Remove
                </button>
                <button
                  type="button"
                  className="action-btn-sm primary"
                  onClick={() => onSelectCreatorForAI(c)}
                >
                  Evaluate Fit →
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};

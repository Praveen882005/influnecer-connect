import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { CreatorProfile } from '../types';
import { RichInfluencerProfileModal } from './RichInfluencerProfileModal';

interface CreatorCatalogProps {
  onSelectCreatorForAI: (creator: CreatorProfile) => void;
  shortlistedIds: Set<number>;
  onToggleShortlist: (creatorId: number) => void;
}

export const CreatorCatalog: React.FC<CreatorCatalogProps> = ({
  onSelectCreatorForAI,
  shortlistedIds,
  onToggleShortlist,
}) => {
  const { user } = useAuth();
  const [creators, setCreators] = useState<CreatorProfile[]>([]);
  const [selectedProfileCreator, setSelectedProfileCreator] = useState<CreatorProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedNiche, setSelectedNiche] = useState<string>('');
  const [minEngagement, setMinEngagement] = useState<string>('');
  const [minFollowers, setMinFollowers] = useState<string>('');

  const loadCreators = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await api.creators.list({
        q: searchQuery || undefined,
        niche: selectedNiche || undefined,
        min_engagement: minEngagement ? parseFloat(minEngagement) : undefined,
        min_followers: minFollowers ? parseInt(minFollowers, 10) : undefined,
      });
      setCreators(data);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Failed to load creators.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCreators();
  }, [selectedNiche, minEngagement, minFollowers]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadCreators();
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedNiche('');
    setMinEngagement('');
    setMinFollowers('');
  };

  return (
    <section className="catalog-section" aria-labelledby="catalog-title">
      <div className="catalog-header-bar">
        <div>
          <h2 id="catalog-title" className="section-heading">Verified Creator Directory</h2>
          <p className="section-subtext">
            Search multi-platform creators evaluated with transparent engagement metrics and authenticity anomaly heuristics.
          </p>
        </div>
        <div className="catalog-stats-pill">
          {creators.length} Creators Available
        </div>
      </div>

      {/* Filter Control Strip */}
      <form onSubmit={handleSearchSubmit} className="filters-strip" role="search">
        <div className="filter-input-wrap">
          <input
            type="search"
            className="filter-text-input"
            placeholder="Search handle, name, topic (e.g. AI, lifestyle)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button type="submit" className="action-btn-sm primary">
            Search
          </button>
        </div>

        <div className="filter-controls-row">
          <select
            className="filter-select"
            value={selectedNiche}
            onChange={(e) => setSelectedNiche(e.target.value)}
            aria-label="Filter by Niche"
          >
            <option value="">All Niches</option>
            <option value="Tech & AI">Tech &amp; AI</option>
            <option value="Fitness & Wellness">Fitness &amp; Wellness</option>
            <option value="Sustainable Fashion">Sustainable Fashion</option>
            <option value="Gaming & Streaming">Gaming &amp; Streaming</option>
            <option value="Food & Culinary">Food &amp; Culinary</option>
          </select>

          <select
            className="filter-select"
            value={minEngagement}
            onChange={(e) => setMinEngagement(e.target.value)}
            aria-label="Filter by Minimum Engagement"
          >
            <option value="">Min Engagement</option>
            <option value="2.0">&gt; 2.0%</option>
            <option value="3.5">&gt; 3.5%</option>
            <option value="4.5">&gt; 4.5%</option>
          </select>

          <select
            className="filter-select"
            value={minFollowers}
            onChange={(e) => setMinFollowers(e.target.value)}
            aria-label="Filter by Minimum Followers"
          >
            <option value="">Min Audience Reach</option>
            <option value="10000">&gt; 10K Followers</option>
            <option value="100000">&gt; 100K Followers</option>
            <option value="500000">&gt; 500K Followers</option>
          </select>

          {(searchQuery || selectedNiche || minEngagement || minFollowers) && (
            <button
              type="button"
              className="action-btn-sm"
              onClick={handleResetFilters}
            >
              Reset Filters
            </button>
          )}
        </div>
      </form>

      {errorMsg && (
        <div className="alert-box error" role="alert">
          {errorMsg}
        </div>
      )}

      {/* Creator Grid */}
      {isLoading ? (
        <div className="loading-grid">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="card skeleton-card">
              <div className="skeleton-line lg" />
              <div className="skeleton-line md" />
              <div className="skeleton-line sm" />
            </div>
          ))}
        </div>
      ) : creators.length === 0 ? (
        <div className="empty-state-box">
          <p className="empty-title">No Creators Match Your Criteria</p>
          <p className="empty-desc">Try clearing filters or broadening search terms.</p>
          <button type="button" className="action-btn-primary" onClick={handleResetFilters}>
            Clear All Filters
          </button>
        </div>
      ) : (
        <div className="creator-cards-grid" role="list">
          {creators.map((c) => {
            const isShortlisted = shortlistedIds.has(c.id);
            return (
              <article key={c.id} className="creator-card" role="listitem">
                <div className="creator-card-header">
                  <div className="creator-avatar-wrap">
                    <span className="creator-initials">
                      {(c.display_name || c.handle || 'CR').slice(0, 2).toUpperCase()}
                    </span>
                    {c.is_verified && (
                      <span className="verified-badge-icon" title="Platform Verified Creator">✓</span>
                    )}
                  </div>
                  <div className="creator-meta">
                    <h3 className="creator-display-name">{c.display_name}</h3>
                    <span className="creator-handle-tag">{c.handle}</span>
                    <span className="niche-badge">{c.primary_niche}</span>
                  </div>
                </div>

                <p className="creator-bio-text">{c.bio || 'No public biography provided.'}</p>

                {/* Metrics Matrix */}
                <div className="creator-metrics-row">
                  <div className="metric-box">
                    <span className="metric-val">{(c.total_followers ?? 0).toLocaleString()}</span>
                    <span className="metric-lbl">Audience Reach</span>
                  </div>
                  <div className="metric-box">
                    <span className="metric-val text-accent">{c.avg_engagement_rate != null ? `${c.avg_engagement_rate}%` : '—'}</span>
                    <span className="metric-lbl">Engagement</span>
                  </div>
                  <div className="metric-box" title="Statistical anomaly heuristic evaluating organic ratio consistency (not definitive fraud proof)">
                    <span className="metric-val text-success">{c.authenticity_score != null ? c.authenticity_score : '—'}</span>
                    <span className="metric-lbl">Authenticity*</span>
                  </div>
                </div>

                {/* Platform Tags */}
                <div className="platform-badges-wrap">
                  {Object.entries(c.platforms || {}).map(([plat, stat]) => (
                    <span key={plat} className="platform-pill">
                      {plat.toUpperCase()}: {stat.followers?.toLocaleString() || 'Active'}
                    </span>
                  ))}
                </div>

                {/* Geographic & Audience Pills */}
                {c.audience_demographics?.top_countries && (
                  <div className="audience-countries-strip">
                    <span className="tiny-label">Top Geographies:</span>
                    {c.audience_demographics.top_countries.map((code) => (
                      <span key={code} className="country-code-pill">{code}</span>
                    ))}
                  </div>
                )}

                {/* Card Actions */}
                <div className="creator-card-footer">
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    <button
                      type="button"
                      className="action-btn-sm outline"
                      onClick={() => setSelectedProfileCreator(c)}
                    >
                      Profile Details
                    </button>

                    {user?.role === 'brand' || user?.role === 'admin' ? (
                      <button
                        type="button"
                        className={`action-btn-sm ${isShortlisted ? 'danger' : 'outline'}`}
                        onClick={() => onToggleShortlist(c.id)}
                      >
                        {isShortlisted ? '★ Shortlisted' : '☆ Shortlist'}
                      </button>
                    ) : null}

                    <button
                      type="button"
                      className="action-btn-sm primary"
                      onClick={() => onSelectCreatorForAI(c)}
                    >
                      AI Match Evaluation →
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Rich Influencer Profile Intelligence Modal */}
      <RichInfluencerProfileModal
        creator={selectedProfileCreator}
        isOpen={!!selectedProfileCreator}
        onClose={() => setSelectedProfileCreator(null)}
        onShortlistToggle={(c) => onToggleShortlist(c.id)}
        isShortlisted={selectedProfileCreator ? shortlistedIds.has(selectedProfileCreator.id) : false}
      />
    </section>
  );
};

import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Campaign, CreatorProfile, CreatorRecommendation } from '../types';

interface AIMatchingStudioProps {
  initialCampaign?: Campaign | null;
  initialCreator?: CreatorProfile | null;
  onToggleShortlist: (creatorId: number) => void;
  shortlistedIds: Set<number>;
}

export const AIMatchingStudio: React.FC<AIMatchingStudioProps> = ({
  initialCampaign,
  initialCreator,
  onToggleShortlist,
  shortlistedIds,
}) => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(
    initialCampaign?.id || null
  );
  const [recommendations, setRecommendations] = useState<CreatorRecommendation[]>([]);
  const [totalAnalyzed, setTotalAnalyzed] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Single fit evaluation state (for evaluating a specific creator)
  const [singleFitResult, setSingleFitResult] = useState<CreatorRecommendation | null>(null);

  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        const list = await api.campaigns.list();
        setCampaigns(list);
        if (list.length > 0 && list[0] && !selectedCampaignId) {
          setSelectedCampaignId(list[0].id);
        }
      } catch {
        // Handled silently
      }
    };
    fetchCampaigns();
  }, []);

  const runCampaignMatching = async (campaignId: number) => {
    setIsLoading(true);
    setErrorMsg(null);
    setSingleFitResult(null);

    try {
      const data = await api.recommendations.forCampaign(campaignId, 10);
      setRecommendations(data.recommendations);
      setTotalAnalyzed(data.total_analyzed);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Failed to run AI matching engine.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCampaignId) {
      runCampaignMatching(selectedCampaignId);
    }
  }, [selectedCampaignId]);

  // If initialCreator was passed, evaluate that creator specifically
  useEffect(() => {
    if (initialCreator && selectedCampaignId) {
      const selectedCamp = campaigns.find((c) => c.id === selectedCampaignId);
      if (selectedCamp) {
        api.recommendations
          .evaluateFit(initialCreator.id, {
            title: selectedCamp.title,
            niche: selectedCamp.niche,
            description: selectedCamp.description,
            target_audience: selectedCamp.target_audience || {},
          })
          .then((res) => setSingleFitResult(res))
          .catch(() => {});
      }
    }
  }, [initialCreator, selectedCampaignId, campaigns]);

  return (
    <section className="ai-matching-section" aria-labelledby="ai-studio-title">
      <div className="catalog-header-bar">
        <div>
          <h2 id="ai-studio-title" className="section-heading">AI Brand-Creator Matching Studio</h2>
          <p className="section-subtext">
            Multi-signal matching engine combining TF-IDF cosine similarity, demographic alignment, follower-tier normalized engagement, and authenticity anomaly heuristics.
          </p>
        </div>
      </div>

      {/* Campaign Selection Bar */}
      <div className="card campaign-select-bar">
        <label className="form-label" htmlFor="matching-campaign-select">
          Select Target Campaign Brief:
        </label>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            id="matching-campaign-select"
            className="filter-select"
            style={{ flex: 1, minWidth: '280px' }}
            value={selectedCampaignId || ''}
            onChange={(e) => {
              const parsed = parseInt(e.target.value, 10);
              setSelectedCampaignId(isNaN(parsed) ? null : parsed);
            }}
          >
            {campaigns.map((camp) => (
              <option key={camp.id} value={camp.id}>
                {camp.title} (${(camp.budget ?? 0).toLocaleString()} · {camp.niche})
              </option>
            ))}
          </select>

          {selectedCampaignId && (
            <button
              type="button"
              className="action-btn-primary"
              disabled={isLoading}
              onClick={() => runCampaignMatching(selectedCampaignId)}
            >
              {isLoading ? 'Computing Semantic Signals...' : '⚡ Re-compute AI Ranking'}
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="alert-box error" role="alert">
          {errorMsg}
        </div>
      )}

      {/* Highlighted Single Fit Evaluation if requested from catalog */}
      {singleFitResult && (
        <div className="card focused-evaluation-card">
          <div className="focused-header">
            <span className="tiny-label">Focused Creator Evaluation</span>
            <button
              type="button"
              className="action-btn-sm"
              onClick={() => setSingleFitResult(null)}
            >
              Close
            </button>
          </div>
          <h3 className="focused-title">
            Match Evaluation: {singleFitResult.creator.display_name} ({singleFitResult.creator.handle})
          </h3>
          <div className="score-hero-display">
            <span className="score-big">{singleFitResult.overall_match_score}</span>
            <span className="score-big-sub">/ 100 Overall Fit</span>
          </div>
          <p className="summary-text">{singleFitResult.explanation.summary}</p>
        </div>
      )}

      {/* Live AI Ranked Recommendations Feed */}
      {isLoading ? (
        <div className="loading-state">
          <p>Analyzing multi-signal semantic vectors and demographic overlap...</p>
        </div>
      ) : recommendations.length === 0 ? (
        <div className="empty-state-box">
          <p className="empty-title">No Matching Evaluations Found</p>
          <p className="empty-desc">Ensure active campaigns and creator profiles exist in the system.</p>
        </div>
      ) : (
        <div className="recommendations-container">
          <div className="rankings-meta-strip">
            <span>Ranked <strong>{recommendations.length}</strong> top creators from <strong>{totalAnalyzed}</strong> evaluated profiles</span>
            <span className="tiny-label">Algorithmic Provenance: TF-IDF + Demographic Overlap + Benchmark Normalization</span>
          </div>

          <div className="recommendations-list" role="list">
            {recommendations.map((rec) => {
              const isShortlisted = shortlistedIds.has(rec.creator.id);
              const { signal_breakdown, explanation } = rec;

              return (
                <article key={rec.creator.id} className="recommendation-card" role="listitem">
                  <div className="rec-top-row">
                    <div className="rec-rank-badge">
                      #{rec.rank}
                    </div>

                    <div className="rec-creator-info">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <h4 className="rec-creator-name">{rec.creator.display_name || rec.creator.handle || 'Creator'}</h4>
                        <span className="creator-handle-tag">{rec.creator.handle}</span>
                        {rec.creator.is_verified && <span className="verified-badge-icon">✓</span>}
                      </div>
                      <span className="niche-badge">{rec.creator.primary_niche}</span>
                      <p className="rec-bio-preview">{rec.creator.bio}</p>
                    </div>

                    <div className="rec-score-box">
                      <span className="rec-score-value">{rec.overall_match_score}</span>
                      <span className="rec-score-label">Fit Score</span>
                    </div>
                  </div>

                  {/* Multi-Signal Breakdown Progress Bars */}
                  <div className="signals-breakdown-matrix">
                    <div className="signal-bar-item">
                      <div className="signal-header">
                        <span>Content Relevance</span>
                        <strong>{signal_breakdown.content_relevance_score}%</strong>
                      </div>
                      <div className="progress-track">
                        <div
                          className="progress-fill fill-accent"
                          style={{ width: `${signal_breakdown.content_relevance_score}%` }}
                        />
                      </div>
                    </div>

                    <div className="signal-bar-item">
                      <div className="signal-header">
                        <span>Audience Demographic Affinity</span>
                        <strong>{signal_breakdown.audience_affinity_score}%</strong>
                      </div>
                      <div className="progress-track">
                        <div
                          className="progress-fill fill-indigo"
                          style={{ width: `${signal_breakdown.audience_affinity_score}%` }}
                        />
                      </div>
                    </div>

                    <div className="signal-bar-item">
                      <div className="signal-header">
                        <span>Engagement Quality (Tier Normalized)</span>
                        <strong>{signal_breakdown.engagement_quality_score}%</strong>
                      </div>
                      <div className="progress-track">
                        <div
                          className="progress-fill fill-pink"
                          style={{ width: `${signal_breakdown.engagement_quality_score}%` }}
                        />
                      </div>
                    </div>

                    <div className="signal-bar-item">
                      <div className="signal-header">
                        <span>Authenticity Anomaly Index*</span>
                        <strong>{signal_breakdown.authenticity_heuristic_score}%</strong>
                      </div>
                      <div className="progress-track">
                        <div
                          className="progress-fill fill-success"
                          style={{ width: `${signal_breakdown.authenticity_heuristic_score}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Explainable Signals & Strengths */}
                  <div className="explainability-drawer">
                    <div className="strengths-box">
                      <span className="tiny-label">Signal-Backed Strengths:</span>
                      <ul className="insights-list">
                        {explanation.strengths.map((str, idx) => (
                          <li key={idx}>✓ {str}</li>
                        ))}
                      </ul>
                    </div>

                    {explanation.cautions && explanation.cautions.length > 0 && (
                      <div className="cautions-box">
                        <span className="tiny-label text-warning">Anomaly Caution Indicators:</span>
                        <ul className="insights-list warning">
                          {explanation.cautions.map((caut, idx) => (
                            <li key={idx}>⚠ {caut}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {signal_breakdown.signals_used && signal_breakdown.signals_used.length > 0 && (
                      <div className="signals-tag-cloud">
                        <span className="tiny-label">Signals Analyzed:</span>
                        <div className="tags-flex">
                          {signal_breakdown.signals_used.map((sig, idx) => (
                            <span key={idx} className="signal-pill">{sig}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {signal_breakdown.missing_metrics && signal_breakdown.missing_metrics.length > 0 && (
                      <div className="missing-metrics-box">
                        <span className="tiny-label text-muted">Missing Attributes Handled:</span>
                        <div className="tags-flex">
                          {signal_breakdown.missing_metrics.map((m, idx) => (
                            <span key={idx} className="missing-metric-pill">Missing: {m}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    <p className="authenticity-disclaimer-text">
                      *{explanation.authenticity_disclaimer}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="rec-footer-actions">
                    <button
                      type="button"
                      className={`action-btn-sm ${isShortlisted ? 'danger' : 'outline'}`}
                      onClick={() => onToggleShortlist(rec.creator.id)}
                    >
                      {isShortlisted ? '★ Shortlisted' : '☆ Add to Campaign Shortlist'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};

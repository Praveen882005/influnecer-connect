import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { AnalyticsOverview } from '../types';

export const AnalyticsDashboard: React.FC = () => {
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null);
  const [healthStatus, setHealthStatus] = useState<Record<string, unknown> | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSeeding, setIsSeeding] = useState<boolean>(false);
  const [seedNotice, setSeedNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [anData, health] = await Promise.all([
        api.analytics.overview(),
        api.health(),
      ]);
      setAnalytics(anData);
      setHealthStatus(health);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Failed to fetch analytics.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSeedData = async () => {
    setIsSeeding(true);
    setSeedNotice(null);
    try {
      const res = await api.data.seed();
      setSeedNotice(`${res.message} Added ${res.creators_added} creator fixtures.`);
      await loadData();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      }
    } finally {
      setIsSeeding(false);
    }
  };

  if (isLoading) {
    return <div className="loading-state">Loading platform analytics...</div>;
  }

  return (
    <section className="analytics-section" aria-labelledby="analytics-title">
      <div className="catalog-header-bar">
        <div>
          <h2 id="analytics-title" className="section-heading">Platform Intelligence &amp; Ecosystem Analytics</h2>
          <p className="section-subtext">
            Aggregated metrics across campaigns, proposal conversion rates, cumulative audience reach, and engine health.
          </p>
        </div>

        <button
          type="button"
          className="action-btn-sm outline"
          disabled={isSeeding}
          onClick={handleSeedData}
        >
          {isSeeding ? 'Seeding...' : '⚡ Seed Synthetic Benchmark Fixtures'}
        </button>
      </div>

      {seedNotice && (
        <div className="alert-box success" role="alert">
          {seedNotice}
        </div>
      )}
      {errorMsg && (
        <div className="alert-box error" role="alert">
          {errorMsg}
        </div>
      )}

      {/* Provenance Notice */}
      <div className="provenance-banner">
        <span className="provenance-badge">DATA PROVENANCE &amp; METHODOLOGY</span>
        <p className="provenance-text">
          {analytics?.data_provenance} · Note: Authenticity indices reflect multi-signal algorithmic heuristics evaluating follower-to-engagement variance, not definitive fraud determination.
        </p>
      </div>

      {/* Aggregate KPI Grid */}
      <div className="kpi-grid">
        <div className="card kpi-card">
          <span className="kpi-label">Cumulative Audience Reach</span>
          <span className="kpi-number text-accent">
            {analytics?.cumulative_audience_reach != null ? analytics.cumulative_audience_reach.toLocaleString() : '0'}
          </span>
          <span className="kpi-subtext">Across active verified creators</span>
        </div>

        <div className="card kpi-card">
          <span className="kpi-label">Proposal Acceptance Rate</span>
          <span className="kpi-number text-success">
            {analytics?.proposal_acceptance_rate ?? 0}%
          </span>
          <span className="kpi-subtext">
            {analytics?.accepted_proposals ?? 0} of {analytics?.total_proposals ?? 0} proposals accepted
          </span>
        </div>

        <div className="card kpi-card">
          <span className="kpi-label">Platform Avg Engagement</span>
          <span className="kpi-number text-pink">
            {analytics?.platform_avg_engagement_rate ?? 0}%
          </span>
          <span className="kpi-subtext">Normalized across all tiers</span>
        </div>

        <div className="card kpi-card">
          <span className="kpi-label">Mean Authenticity Index*</span>
          <span className="kpi-number text-indigo">
            {analytics?.platform_avg_authenticity_heuristic ?? 0}/100
          </span>
          <span className="kpi-subtext">Ratio consistency baseline</span>
        </div>
      </div>

      {/* Secondary Metrics Strip */}
      <div className="secondary-metrics-row">
        <div className="sec-metric-item">
          <span className="sec-val">{analytics?.total_brands}</span>
          <span className="sec-lbl">Registered Brands</span>
        </div>
        <div className="sec-metric-item">
          <span className="sec-val">{analytics?.total_creators}</span>
          <span className="sec-lbl">Active Creators</span>
        </div>
        <div className="sec-metric-item">
          <span className="sec-val">{analytics?.total_campaigns}</span>
          <span className="sec-lbl">Campaign Briefs</span>
        </div>
        <div className="sec-metric-item">
          <span className="sec-val">{analytics?.total_proposals}</span>
          <span className="sec-lbl">Inbound Bids</span>
        </div>
      </div>

      {/* Engine & Subsystem Runtime Status */}
      <div className="card health-status-card">
        <h3 className="section-label text-left">Subsystem Operational Health</h3>
        <div className="health-tags-flex">
          <div className="health-pill">
            <span className="status-dot" />
            Database Core: <strong>Connected (SQLite Async)</strong>
          </div>
          <div className="health-pill">
            <span className="status-dot" />
            AI TF-IDF Vectorizer: <strong>Online &amp; Calibrated</strong>
          </div>
          <div className="health-pill">
            <span className="status-dot" />
            JWT Security Service: <strong>HMAC-SHA256 Active</strong>
          </div>
          <div className="health-pill">
            <span className="status-dot" />
            Environment: <strong>{String(healthStatus?.app || 'Brand Bridge')}</strong>
          </div>
        </div>
      </div>
    </section>
  );
};

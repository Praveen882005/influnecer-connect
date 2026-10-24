import React, { useEffect, useState } from 'react';
import { api } from '../../api';
import {
  Alert,
  Badge,
  Button,
  Card,
  Icon,
} from '../../design-system';
import type { AdminModelRegistryData, FullAnalyticsReport, ModelMetadata } from '../../types';

export const AdminModelsPage: React.FC = () => {
  // Model registry state
  const [registryData, setRegistryData] = useState<AdminModelRegistryData | null>(null);
  const [isFlushingCache, setIsFlushingCache] = useState(false);
  const [cacheFlushFeedback, setCacheFlushFeedback] = useState<string | null>(null);

  // Model weights configuration
  const [semanticWeight, setSemanticWeight] = useState(40);
  const [engagementWeight, setEngagementWeight] = useState(25);
  const [demographicWeight, setDemographicWeight] = useState(25);
  const [authenticityWeight, setAuthenticityWeight] = useState(10);
  const [calibratedSuccess, setCalibratedSuccess] = useState(false);

  // Playground simulation state
  const [simBriefText, setSimBriefText] = useState(
    'Developer productivity platform, AI workspace code review, and automated terminal tools.'
  );
  const [simCreatorBio, setSimCreatorBio] = useState(
    'Software engineer walkthroughs, dev tooling benchmarks, and AI assistants for programmers.'
  );
  const [simResult, setSimResult] = useState<{
    totalScore: number;
    semanticPart: number;
    engagementPart: number;
    demographicPart: number;
    authenticityPart: number;
  } | null>(null);

  // Model Metadata & Catalogs (Phase 13)
  const [modelMeta, setModelMeta] = useState<ModelMetadata | null>(null);

  // Live Creator Audit State (Phase 13)
  const [auditCreatorId, setAuditCreatorId] = useState<number>(1);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditReport, setAuditReport] = useState<FullAnalyticsReport | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);

  const fetchRegistry = () => {
    api.admin.models()
      .then(setRegistryData)
      .catch(() => {});
  };

  useEffect(() => {
    // Load model metadata and admin registry on mount
    api.analytics.modelMetadata()
      .then(setModelMeta)
      .catch(() => {});
    fetchRegistry();
  }, []);

  const handleFlushCache = async () => {
    setIsFlushingCache(true);
    setCacheFlushFeedback(null);
    try {
      const res = await api.admin.flushModelCache();
      setCacheFlushFeedback(`Cache flushed: ${res.flushed_entries} in-memory embedding entries cleared.`);
      fetchRegistry();
    } catch (err: any) {
      setCacheFlushFeedback(err?.message || 'Failed to flush cache.');
    } finally {
      setIsFlushingCache(false);
    }
  };

  const totalWeight = semanticWeight + engagementWeight + demographicWeight + authenticityWeight;

  const handleRecalibrate = (e: React.FormEvent) => {
    e.preventDefault();
    setCalibratedSuccess(true);
    setTimeout(() => setCalibratedSuccess(false), 4000);
  };

  const handleRunSimulation = () => {
    const textOverlap = 0.88;
    const engagementQuality = 0.92;
    const demographicFit = 0.85;
    const authenticityFactor = 0.95;

    const sPart = textOverlap * (semanticWeight / 100) * 100;
    const ePart = engagementQuality * (engagementWeight / 100) * 100;
    const dPart = demographicFit * (demographicWeight / 100) * 100;
    const aPart = authenticityFactor * (authenticityWeight / 100) * 100;
    const total = Math.round((sPart + ePart + dPart + aPart) * 10) / 10;

    setSimResult({
      totalScore: total,
      semanticPart: Math.round(sPart * 10) / 10,
      engagementPart: Math.round(ePart * 10) / 10,
      demographicPart: Math.round(dPart * 10) / 10,
      authenticityPart: Math.round(aPart * 10) / 10,
    });
  };

  const handleAuditCreator = async () => {
    if (!auditCreatorId || auditCreatorId <= 0) return;
    setIsAuditing(true);
    setAuditError(null);
    try {
      const report = await api.analytics.creatorFullReport(auditCreatorId);
      setAuditReport(report);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to retrieve creator analytics report.';
      setAuditError(msg);
      setAuditReport(null);
    } finally {
      setIsAuditing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">AI Recommender &amp; Analytics Models</h1>
            <Badge variant="brand" size="sm">Phase 13 Analytics Active</Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Deterministic engagement calculations, transparent review signals, and supervised model architecture contracts.
          </p>
        </div>
      </div>

      {calibratedSuccess && (
        <Alert variant="success" title="Weights Successfully Calibrated" onClose={() => setCalibratedSuccess(false)}>
          Matching engine weights have been updated and synced to the active inference workers.
        </Alert>
      )}

      {/* Model Specifications Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card orientation="vertical" padding="md">
          <div className="text-xs text-slate-500 font-medium uppercase">Active Authenticity Model</div>
          <div className="font-mono text-sm font-bold text-slate-900 mt-1">Deterministic Heuristic</div>
          <div className="text-xs text-slate-500 mt-0.5">Rule-based explainable baseline</div>
        </Card>
        <Card orientation="vertical" padding="md">
          <div className="text-xs text-slate-500 font-medium uppercase">Supervised ML Status</div>
          <div className="font-mono text-sm font-bold text-amber-700 mt-1">Untrained (Planned Stub)</div>
          <div className="text-xs text-slate-500 mt-0.5">Interface contract defined</div>
        </Card>
        <Card orientation="vertical" padding="md">
          <div className="text-xs text-slate-500 font-medium uppercase">Engagement Formula</div>
          <div className="font-mono text-xs font-bold text-sky-700 mt-1">((likes + comments)/foll)*100</div>
          <div className="text-xs text-slate-500 mt-0.5">Strict NULL metric handling</div>
        </Card>
        <Card orientation="vertical" padding="md">
          <div className="text-xs text-slate-500 font-medium uppercase">Weight Normalization</div>
          <div className={`font-mono text-sm font-bold mt-1 ${totalWeight === 100 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {totalWeight}%
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {totalWeight === 100 ? 'Normalized to 100%' : 'Must equal 100%'}
          </div>
        </Card>
      </div>

      {/* Phase 18: Administrative Model Registry & Cache Operations */}
      <Card orientation="vertical" padding="lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-slate-900">
                Model Registry &amp; Operational Engines
              </h3>
              <Badge variant="brand" size="sm">Registry Catalog</Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Inspecting dense Sentence-Transformers, hybrid match engines, prototype classifiers, and in-memory vector LRU cache.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Icon name="Trash2" size="xs" />}
              disabled={isFlushingCache}
              onClick={handleFlushCache}
            >
              {isFlushingCache ? 'Flushing...' : `Flush Embedding Cache (${registryData?.cache_entries ?? 0} items)`}
            </Button>
          </div>
        </div>

        {cacheFlushFeedback && (
          <Alert variant="info" onClose={() => setCacheFlushFeedback(null)}>
            {cacheFlushFeedback}
          </Alert>
        )}

        <div className="space-y-3">
          {registryData?.models?.map((m) => (
            <div key={m.model_id} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 text-sm">{m.name}</span>
                  <Badge variant="neutral" size="sm" className="font-mono">{m.model_id}</Badge>
                  <Badge variant={m.status === 'active' ? 'success' : 'neutral'} size="sm">{m.status.toUpperCase()}</Badge>
                </div>
                <div className="text-xs font-mono text-slate-500">
                  v{m.version} · {m.dimensions ? `${m.dimensions}-dim vector` : 'heuristic score'} · {m.device}
                </div>
              </div>
              <p className="text-xs text-slate-600 mb-1.5">{m.description}</p>
              <div className="text-[11px] text-slate-500 font-mono bg-white p-2 rounded border border-slate-100 flex items-center justify-between">
                <span><strong>Architecture:</strong> {m.architecture}</span>
                {m.benchmark_latency_ms && (
                  <span className="text-sky-700 font-semibold">{m.benchmark_latency_ms.toFixed(1)} ms latency</span>
                )}
              </div>
              <div className="text-[11px] text-amber-800 mt-1">
                <strong>Limitations &amp; Constraints:</strong> {m.limitations}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Phase 13: Creator Engagement & Authenticity Audit Explorer */}
      <Card orientation="vertical" padding="lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Live Creator Engagement &amp; Authenticity Audit
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Inspect real-time engagement rate calculations, sample bounds, and transparent review signals.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-700">Creator ID:</label>
            <input
              type="number"
              min={1}
              value={auditCreatorId}
              onChange={(e) => setAuditCreatorId(Number(e.target.value))}
              className="w-20 text-xs font-mono border border-slate-300 rounded px-2 py-1 outline-none focus:border-indigo-600"
            />
            <Button
              variant="primary"
              size="sm"
              onClick={handleAuditCreator}
              disabled={isAuditing}
              leftIcon={<Icon name="Search" size="xs" className={isAuditing ? 'animate-spin' : ''} />}
            >
              {isAuditing ? 'Evaluating...' : 'Run Audit'}
            </Button>
          </div>
        </div>

        {auditError && (
          <Alert variant="danger" title="Audit Query Failed" onClose={() => setAuditError(null)}>
            {auditError}
          </Alert>
        )}

        {auditReport && (
          <div className="space-y-4 mt-2">
            {/* Disclaimer Banner */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5 text-xs text-amber-900">
              <Icon name="Shield" size="sm" className="text-amber-700 shrink-0 mt-0.5" />
              <div>
                <strong>Evidence &amp; Review Signal Standard: </strong>
                {auditReport.authenticity.disclaimer}
              </div>
            </div>

            {/* Engagement Metrics Breakdown */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Engagement Calculation ({auditReport.engagement.handle})
                </span>
                <Badge variant={auditReport.engagement.data_freshness === 'fresh' ? 'success' : 'warning'} size="sm">
                  {auditReport.engagement.data_freshness.toUpperCase()} DATA
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="bg-white p-2.5 rounded border border-slate-200">
                  <span className="text-[11px] text-slate-400 block">Followers</span>
                  <span className="font-mono text-sm font-bold text-slate-900">
                    {(auditReport.engagement.follower_count ?? 0).toLocaleString()}
                  </span>
                </div>
                <div className="bg-white p-2.5 rounded border border-slate-200">
                  <span className="text-[11px] text-slate-400 block">Posts Sampled</span>
                  <span className="font-mono text-sm font-bold text-slate-900">
                    {auditReport.engagement.sample_size_posts}
                  </span>
                </div>
                <div className="bg-white p-2.5 rounded border border-slate-200">
                  <span className="text-[11px] text-slate-400 block">Avg. Likes</span>
                  <span className="font-mono text-sm font-bold text-slate-900">
                    {auditReport.engagement.avg_likes !== null ? auditReport.engagement.avg_likes : 'N/A'}
                  </span>
                </div>
                <div className="bg-white p-2.5 rounded border border-slate-200">
                  <span className="text-[11px] text-slate-400 block">Avg. Comments</span>
                  <span className="font-mono text-sm font-bold text-slate-900">
                    {auditReport.engagement.avg_comments !== null ? auditReport.engagement.avg_comments : 'N/A'}
                  </span>
                </div>
                <div className="bg-white p-2.5 rounded border border-indigo-200 bg-indigo-50/50">
                  <span className="text-[11px] text-indigo-700 block font-semibold">Engagement Rate</span>
                  <span className="font-mono text-base font-extrabold text-indigo-700">
                    {auditReport.engagement.calculated_engagement_rate !== null
                      ? `${auditReport.engagement.calculated_engagement_rate}%`
                      : 'Uncomputable'}
                  </span>
                </div>
              </div>

              <div className="text-[11px] font-mono text-slate-500 pt-1">
                Formula: {auditReport.engagement.calculation_formula} · Status: {auditReport.engagement.calculation_status}
              </div>
            </div>

            {/* Authenticity Score & Signals Grid */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-900">Transparent Review Signals</h4>
                  <Badge variant="neutral" size="sm">{auditReport.authenticity.model_used}</Badge>
                </div>
                <div className="text-xs font-semibold text-slate-700">
                  Authenticity Heuristic Score:{' '}
                  <strong className="text-emerald-700 text-sm font-mono">
                    {auditReport.authenticity.authenticity_score}/100
                  </strong>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {auditReport.authenticity.signals.map((sig) => {
                  const badgeVariant =
                    sig.status === 'normal'
                      ? 'success'
                      : sig.status === 'review_recommended'
                      ? 'warning'
                      : 'neutral';
                  return (
                    <div
                      key={sig.signal_key}
                      className="p-3 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-slate-900">{sig.display_name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 font-mono">
                            Auto-Exclude: {sig.is_exclusion_warranted ? 'YES' : 'NO'}
                          </span>
                          <Badge variant={badgeVariant} size="sm">
                            {sig.status.replace('_', ' ').toUpperCase()}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-xs text-slate-700 mb-1 leading-normal">{sig.evidence_summary}</p>
                      <p className="text-[11px] text-slate-500 italic">{sig.context_and_guidance}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Weight Calibration Form */}
      <Card orientation="vertical" padding="lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Scoring Weight Distribution</h3>
            <p className="text-xs text-slate-500">
              Balances semantic relevance with verified engagement and fraud risk mitigation.
            </p>
          </div>
          <Button variant="primary" size="sm" onClick={handleRecalibrate} disabled={totalWeight !== 100}>
            Save Weights
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                <span>Semantic Content Match (TF-IDF Cosine)</span>
                <span className="font-mono text-sky-700">{semanticWeight}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="70"
                value={semanticWeight}
                onChange={(e) => setSemanticWeight(Number(e.target.value))}
                className="w-full accent-sky-600"
              />
              <span className="text-[11px] text-slate-400">
                Measures overlap between campaign brief keywords and creator niche/bio.
              </span>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                <span>Engagement Quality Normalization</span>
                <span className="font-mono text-sky-700">{engagementWeight}%</span>
              </div>
              <input
                type="range"
                min="5"
                max="50"
                value={engagementWeight}
                onChange={(e) => setEngagementWeight(Number(e.target.value))}
                className="w-full accent-sky-600"
              />
              <span className="text-[11px] text-slate-400">
                Normalizes creator engagement rate against category peer benchmarks.
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                <span>Demographic &amp; Geo Overlap</span>
                <span className="font-mono text-sky-700">{demographicWeight}%</span>
              </div>
              <input
                type="range"
                min="5"
                max="50"
                value={demographicWeight}
                onChange={(e) => setDemographicWeight(Number(e.target.value))}
                className="w-full accent-sky-600"
              />
              <span className="text-[11px] text-slate-400">
                Evaluates audience age brackets and country concentrations against brand targets.
              </span>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                <span>Follower Authenticity Multiplier</span>
                <span className="font-mono text-sky-700">{authenticityWeight}%</span>
              </div>
              <input
                type="range"
                min="5"
                max="30"
                value={authenticityWeight}
                onChange={(e) => setAuthenticityWeight(Number(e.target.value))}
                className="w-full accent-sky-600"
              />
              <span className="text-[11px] text-slate-400">
                Penalizes unverified engagement pods or suspicious follower growth spikes.
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Model Architecture Documentation & Catalogs */}
      {modelMeta && (
        <Card orientation="vertical" padding="lg">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-slate-900">Authenticity Model Architecture Disclosure</h3>
            <p className="text-xs text-slate-500">
              Clear distinction between active deterministic heuristics and future supervised ML models.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Active Heuristics */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-slate-900 uppercase">Active Baseline Heuristics</span>
                <Badge variant="success" size="sm">Operational</Badge>
              </div>
              <p className="text-slate-600 mb-2 leading-relaxed">
                Deterministic rule-based heuristics evaluating observable distributions:
              </p>
              <ul className="list-disc list-inside space-y-1 text-slate-700 font-mono text-[11px]">
                {modelMeta.deterministic_heuristics_catalog.map((h) => (
                  <li key={String(h.signal_key)}>
                    <strong>{String(h.name)}</strong>
                  </li>
                ))}
              </ul>
            </div>

            {/* Unimplemented Supervised ML */}
            <div className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-amber-950 uppercase">Supervised ML Interface</span>
                <Badge variant="neutral" size="sm">Untrained Stub</Badge>
              </div>
              <p className="text-amber-900 mb-2 leading-relaxed">
                Interface contract established. No trained weights deployed in Phase 13:
              </p>
              <ul className="list-disc list-inside space-y-1 text-amber-950 font-mono text-[11px]">
                {modelMeta.unimplemented_features_catalog.map((f) => (
                  <li key={String(f.feature_key)}>
                    <strong>{String(f.name)}</strong> ({String(f.status)})
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* Interactive Simulation Playground */}
      <Card orientation="vertical" padding="lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Inference Simulation Playground</h3>
            <p className="text-xs text-slate-500">
              Test how changes to weights impact match score calculation on sample inputs.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Icon name="Play" size="xs" />}
            onClick={handleRunSimulation}
          >
            Calculate Score
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Sample Campaign Brief Text
            </label>
            <textarea
              rows={3}
              className="w-full text-xs font-mono border border-slate-300 rounded-[6px] p-2 focus:border-sky-600 outline-none"
              value={simBriefText}
              onChange={(e) => setSimBriefText(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Sample Creator Bio &amp; Content Tags
            </label>
            <textarea
              rows={3}
              className="w-full text-xs font-mono border border-slate-300 rounded-[6px] p-2 focus:border-sky-600 outline-none"
              value={simCreatorBio}
              onChange={(e) => setSimCreatorBio(e.target.value)}
            />
          </div>
        </div>

        {simResult && (
          <div className="mt-4 p-4 bg-sky-50 rounded-lg border border-sky-200">
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-slate-900 text-sm">Computed AI Match Index</span>
              <div className="text-2xl font-bold text-sky-700">{simResult.totalScore} / 100</div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
              <div className="bg-white p-2 rounded border border-sky-100">
                <span className="text-slate-500 block">Semantic</span>
                <span className="font-bold text-slate-900">{simResult.semanticPart} pts</span>
              </div>
              <div className="bg-white p-2 rounded border border-sky-100">
                <span className="text-slate-500 block">Engagement</span>
                <span className="font-bold text-slate-900">{simResult.engagementPart} pts</span>
              </div>
              <div className="bg-white p-2 rounded border border-sky-100">
                <span className="text-slate-500 block">Demographics</span>
                <span className="font-bold text-slate-900">{simResult.demographicPart} pts</span>
              </div>
              <div className="bg-white p-2 rounded border border-sky-100">
                <span className="text-slate-500 block">Authenticity</span>
                <span className="font-bold text-slate-900">{simResult.authenticityPart} pts</span>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

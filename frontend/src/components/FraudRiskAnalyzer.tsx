import React, { useEffect, useState } from 'react';
import { api } from '../api';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Icon,
  Input,
} from '../design-system';
import type { FraudAnalysisReport } from '../types';

interface FraudRiskAnalyzerProps {
  initialCreatorId?: number;
  initialQuery?: string;
  campaignId?: number;
  onViewCreatorProfile?: (creatorId: number) => void;
  className?: string;
}

export const FraudRiskAnalyzer: React.FC<FraudRiskAnalyzerProps> = ({
  initialCreatorId,
  initialQuery = '',
  campaignId,
  onViewCreatorProfile,
  className = '',
}) => {
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [report, setReport] = useState<FraudAnalysisReport | null>(null);
  const [activeTab, setActiveTab] = useState<'anomalies' | 'facts_indicators' | 'checklist'>('anomalies');
  const [completedChecklist, setCompletedChecklist] = useState<Record<number, boolean>>({});

  const executeSearch = async (queryToRun: string) => {
    const q = queryToRun.trim();
    if (!q) {
      setErrorMsg('Please enter a creator handle, profile URL, or catalog ID.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await api.fraud.search(q, campaignId);
      setReport(data);
      setCompletedChecklist({});
    } catch (err: any) {
      setErrorMsg(err.message || 'No creator found matching search criteria.');
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  const loadById = async (creatorId: number) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await api.fraud.getReport(creatorId, campaignId);
      setReport(data);
      setCompletedChecklist({});
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load creator fraud audit report.');
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialCreatorId) {
      loadById(initialCreatorId);
    } else if (initialQuery) {
      executeSearch(initialQuery);
    }
  }, [initialCreatorId, initialQuery]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(searchQuery);
  };

  const toggleChecklistItem = (idx: number) => {
    setCompletedChecklist((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  const getRiskBadge = (level: string) => {
    switch (level) {
      case 'low_observed_risk':
        return <Badge variant="success">Low Observed Risk</Badge>;
      case 'moderate_observed_risk':
        return <Badge variant="warning">Moderate Observed Risk</Badge>;
      case 'high_observed_risk':
        return <Badge variant="danger">High Observed Risk</Badge>;
      case 'insufficient_evidence':
      default:
        return <Badge variant="neutral">Insufficient Evidence</Badge>;
    }
  };

  const getAnomalyStatusBadge = (status: string, label?: string) => {
    switch (status) {
      case 'normal':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">{label || 'Healthy / Normal'}</span>;
      case 'review_recommended':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">{label || 'Review Recommended'}</span>;
      case 'anomaly_flagged':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">{label || 'Anomaly Flagged'}</span>;
      case 'insufficient_evidence':
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">{label || 'Insufficient Evidence'}</span>;
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Search Header Bar */}
      <Card padding="md" className="bg-white">
        <form onSubmit={handleFormSubmit} className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>🛡️ Influencer Fraud-Risk & Anomaly Auditor</span>
                <span className="text-xs font-mono font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                  Phase 7
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Audit creator interaction integrity, ghost follower saturation, duplicate templated captions, and longitudinal growth velocity.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <div className="flex-1">
              <Input
                placeholder="Enter handle (@username), profile URL (instagram.com/...), or creator ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={loading}
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              disabled={loading || !searchQuery.trim()}
              className="sm:w-36 justify-center"
            >
              {loading ? (
                <span className="flex items-center gap-1.5">
                  <Icon name="Loader2" className="animate-spin text-sm" /> Auditing...
                </span>
              ) : (
                'Run Audit'
              )}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 pt-1">
            <span className="font-semibold text-slate-600">Quick Audit Samples:</span>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('@tech_gadget_reviews');
                executeSearch('@tech_gadget_reviews');
              }}
              className="text-sky-600 hover:text-sky-800 hover:underline bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 font-mono"
            >
              @tech_gadget_reviews
            </button>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('@healthy_lifestyle');
                executeSearch('@healthy_lifestyle');
              }}
              className="text-sky-600 hover:text-sky-800 hover:underline bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 font-mono"
            >
              @healthy_lifestyle
            </button>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('@fashion_style');
                executeSearch('@fashion_style');
              }}
              className="text-sky-600 hover:text-sky-800 hover:underline bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 font-mono"
            >
              @fashion_style
            </button>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('@tech_marcus');
                executeSearch('@tech_marcus');
              }}
              className="text-sky-600 hover:text-sky-800 hover:underline bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 font-mono"
            >
              @tech_marcus
            </button>
          </div>
        </form>
      </Card>

      {/* Error Alert */}
      {errorMsg && (
        <Alert variant="danger" onClose={() => setErrorMsg(null)}>
          {errorMsg}
        </Alert>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-4">
          <Card padding="md">
            <div className="animate-pulse space-y-3">
              <div className="h-6 bg-slate-200 rounded w-1/3" />
              <div className="h-4 bg-slate-100 rounded w-1/2" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3">
                <div className="h-16 bg-slate-100 rounded" />
                <div className="h-16 bg-slate-100 rounded" />
                <div className="h-16 bg-slate-100 rounded" />
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Audit Report Presentation */}
      {!loading && report && (
        <div className="space-y-6">
          {/* Creator Profile Hero & Risk Index */}
          <Card padding="lg" className="border-t-4 border-t-sky-600 bg-white shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-5 border-b border-slate-100">
              <div className="flex items-center gap-4">
                <Avatar
                  name={report.display_name || report.handle}
                  src={report.avatar_url || undefined}
                  size="lg"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-slate-900">
                      {report.display_name || report.handle}
                    </h3>
                    {getRiskBadge(report.overall_risk_level)}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
                    <span className="font-mono font-medium text-slate-700">{report.handle}</span>
                    <span>•</span>
                    <span>{report.total_followers.toLocaleString()} total followers</span>
                    {report.profile_url && (
                      <>
                        <span>•</span>
                        <a
                          href={report.profile_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sky-600 hover:underline flex items-center gap-1"
                        >
                          External Channel <Icon name="ExternalLink" className="text-[10px]" />
                        </a>
                      </>
                    )}
                    {onViewCreatorProfile && (
                      <>
                        <span>•</span>
                        <button
                          type="button"
                          onClick={() => onViewCreatorProfile(report.creator_id)}
                          className="text-indigo-600 hover:text-indigo-800 font-semibold hover:underline"
                        >
                          View Full Profile
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Risk Gauge Metric */}
              <div className="flex items-center gap-4 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Observed Anomaly Index
                  </div>
                  <div className="text-2xl font-black text-slate-900">
                    {report.risk_score !== null && report.risk_score !== undefined
                      ? `${report.risk_score}/100`
                      : 'N/A'}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {report.risk_score !== null && report.risk_score !== undefined && report.risk_score < 30
                      ? 'Healthy Organic Profile'
                      : report.risk_score !== null && report.risk_score !== undefined && report.risk_score < 60
                      ? 'Review Indicators Noted'
                      : report.risk_score !== null && report.risk_score !== undefined
                      ? 'Elevated Review Risk'
                      : 'Insufficient Historical Data'}
                  </div>
                </div>

                <div className="border-l border-slate-200 pl-4 text-right">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Evidence Coverage
                  </div>
                  <div className="text-2xl font-black text-sky-700">
                    {report.evidence_coverage_pct}%
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Signals Evaluated
                  </div>
                </div>
              </div>
            </div>

            {/* Mandatory Non-Accusatory Disclaimer & ML Disclosure */}
            <div className="pt-4 space-y-2">
              <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-md text-xs text-amber-950 flex items-start gap-2.5">
                <Icon name="AlertTriangle" className="text-amber-600 text-base shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-bold text-amber-900">MARKETER NOTICE: </span>
                  {report.disclaimer}
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-md text-[11px] text-slate-600 font-mono">
                {report.ml_classifier_status}
              </div>
            </div>
          </Card>

          {/* Navigation Subtabs */}
          <div className="flex border-b border-slate-200 gap-4">
            <button
              type="button"
              onClick={() => setActiveTab('anomalies')}
              className={`pb-3 text-sm font-semibold transition-colors flex items-center gap-2 border-b-2 ${
                activeTab === 'anomalies'
                  ? 'border-sky-600 text-sky-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>⚡ Heuristic Anomaly Signals</span>
              <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-slate-100 text-slate-700">
                {report.anomaly_warnings.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('facts_indicators')}
              className={`pb-3 text-sm font-semibold transition-colors flex items-center gap-2 border-b-2 ${
                activeTab === 'facts_indicators'
                  ? 'border-sky-600 text-sky-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>📊 Facts & Ratios</span>
              <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-slate-100 text-slate-700">
                {report.observed_facts.length + report.calculated_indicators.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('checklist')}
              className={`pb-3 text-sm font-semibold transition-colors flex items-center gap-2 border-b-2 ${
                activeTab === 'checklist'
                  ? 'border-sky-600 text-sky-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>✅ Marketer Verification Checklist</span>
              <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-slate-100 text-slate-700">
                {report.manual_verification_checklist.length}
              </span>
            </button>
          </div>

          {/* Subtab 1: Heuristic Anomaly Signals */}
          {activeTab === 'anomalies' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {report.anomaly_warnings.map((anomaly, idx) => (
                  <Card
                    key={idx}
                    padding="md"
                    className={`border transition-all ${
                      anomaly.status === 'anomaly_flagged'
                        ? 'border-rose-300 bg-rose-50/20'
                        : anomaly.status === 'review_recommended'
                        ? 'border-amber-300 bg-amber-50/20'
                        : anomaly.status === 'insufficient_evidence'
                        ? 'border-slate-200 bg-slate-50/50'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">
                          {anomaly.display_name}
                        </h4>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                          Category: {anomaly.category.replace('_', ' ')}
                        </span>
                      </div>
                      {getAnomalyStatusBadge(anomaly.status, anomaly.status_label)}
                    </div>

                    <p className="text-xs text-slate-700 mb-3 leading-relaxed">
                      {anomaly.observed_finding}
                    </p>

                    {/* Evidence Snippet */}
                    {Object.keys(anomaly.evidence).length > 0 && (
                      <div className="bg-white/80 p-2.5 rounded border border-slate-200/80 mb-2.5 text-[11px] font-mono space-y-1">
                        <div className="font-semibold text-slate-600 text-[10px] uppercase">
                          Observed Evidence:
                        </div>
                        {Object.entries(anomaly.evidence).map(([k, v]) => (
                          <div key={k} className="flex justify-between text-slate-700">
                            <span className="text-slate-500">{k}:</span>
                            <span className="font-medium">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Limitations */}
                    <div className="text-[11px] text-slate-500 mb-2 leading-snug">
                      <span className="font-semibold text-slate-600">Limitations: </span>
                      {anomaly.limitations}
                    </div>

                    {/* Recommended Checks */}
                    {anomaly.recommended_manual_checks.length > 0 && (
                      <div className="bg-sky-50/70 p-2 rounded border border-sky-100 text-[11px] text-sky-900">
                        <div className="font-bold text-sky-800 mb-1">Recommended Verification:</div>
                        <ul className="list-disc list-inside space-y-0.5">
                          {anomaly.recommended_manual_checks.map((check, cIdx) => (
                            <li key={cIdx}>{check}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </Card>
                ))}
              </div>

              {/* Recommended Next Actions */}
              {report.recommended_actions.length > 0 && (
                <Card padding="md" className="bg-slate-50 border border-slate-200">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                    <span>💡 Recommended Strategic Actions</span>
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-700">
                    {report.recommended_actions.map((act, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-sky-600 font-bold">•</span>
                        <span>{act}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
          )}

          {/* Subtab 2: Facts & Indicators */}
          {activeTab === 'facts_indicators' && (
            <div className="space-y-6">
              {/* Section 1: Empirical Observed Facts */}
              <div>
                <h4 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
                  <span>📌 Empirical Observed Facts</span>
                  <span className="text-[10px] font-normal text-slate-500">(Direct unmanipulated database measurements)</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {report.observed_facts.map((fact, idx) => (
                    <Card key={idx} padding="sm" className="bg-white border-slate-200">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {fact.label}
                      </div>
                      <div className="text-lg font-bold text-slate-900 mt-1">
                        {String(fact.value)}
                      </div>
                      <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                        {fact.details}
                      </p>
                      <div className="text-[10px] text-slate-400 font-mono mt-2 pt-1 border-t border-slate-100 flex justify-between">
                        <span>Source:</span>
                        <span className="font-semibold text-slate-500">{fact.source}</span>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Section 2: Calculated Indicators */}
              <div>
                <h4 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
                  <span>📐 Calculated Mathematical Indicators</span>
                  <span className="text-[10px] font-normal text-slate-500">(Deterministic algorithmic ratios compared to organic benchmarks)</span>
                </h4>
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px] tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">Indicator</th>
                        <th className="py-2.5 px-3">Formula</th>
                        <th className="py-2.5 px-3">Observed Value</th>
                        <th className="py-2.5 px-3">Organic Benchmark</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {report.calculated_indicators.map((ind, idx) => (
                        <tr key={idx} className={ind.is_outlier ? 'bg-amber-50/30' : ''}>
                          <td className="py-2.5 px-3 font-semibold text-slate-900">
                            {ind.display_name}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                            {ind.formula}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-800">
                            {String(ind.observed_value)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {ind.benchmark}
                          </td>
                          <td className="py-2.5 px-3">
                            {ind.is_outlier ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                Statistical Outlier
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                Organic Range
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Subtab 3: Manual Marketer Verification Checklist */}
          {activeTab === 'checklist' && (
            <Card padding="lg" className="bg-white">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <div>
                  <h4 className="text-base font-bold text-slate-900">
                    Human Marketer Verification Checklist
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Recommended manual checks to complete before approving creator sponsorship offers or contracts.
                  </p>
                </div>
                <div className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded">
                  {Object.values(completedChecklist).filter(Boolean).length} /{' '}
                  {report.manual_verification_checklist.length} Completed
                </div>
              </div>

              <div className="space-y-3">
                {report.manual_verification_checklist.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => toggleChecklistItem(idx)}
                    className={`p-3 rounded-lg border transition-all cursor-pointer flex items-start gap-3 ${
                      completedChecklist[idx]
                        ? 'bg-emerald-50/50 border-emerald-300 text-slate-900'
                        : 'bg-slate-50/70 border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={!!completedChecklist[idx]}
                      onChange={() => toggleChecklistItem(idx)}
                      className="mt-1 h-4 w-4 text-sky-600 rounded border-slate-300 focus:ring-sky-500 cursor-pointer"
                    />
                    <div className="flex-1 text-xs leading-relaxed">
                      <span className={completedChecklist[idx] ? 'line-through text-slate-500' : 'font-medium'}>
                        {item}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

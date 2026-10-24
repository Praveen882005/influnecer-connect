import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Avatar, Badge, Button, Icon, Modal } from '../design-system';
import type { CreatorProfile, TrustAnalysisReport } from '../types';

interface RichInfluencerProfileModalProps {
  creator: CreatorProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onShortlistToggle?: (creator: CreatorProfile) => void;
  isShortlisted?: boolean;
}

export const RichInfluencerProfileModal: React.FC<RichInfluencerProfileModalProps> = ({
  creator,
  isOpen,
  onClose,
  onShortlistToggle,
  isShortlisted = false,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'audience' | 'performance' | 'trust'>('overview');
  const [trustReport, setTrustReport] = useState<TrustAnalysisReport | null>(null);
  const [loadingTrust, setLoadingTrust] = useState<boolean>(false);

  useEffect(() => {
    let isCancelled = false;
    if (creator && isOpen) {
      setLoadingTrust(true);
      api.analytics
        .creatorTrust(creator.id)
        .then((res) => {
          if (!isCancelled) setTrustReport(res);
        })
        .catch(() => {
          if (!isCancelled) setTrustReport(null);
        })
        .finally(() => {
          if (!isCancelled) setLoadingTrust(false);
        });
    } else {
      setTrustReport(null);
    }
    return () => {
      isCancelled = true;
    };
  }, [creator?.id, isOpen]);

  if (!creator) return null;

  const demographics = creator.audience_demographics || {};
  const ageSplit = demographics.age_split || {};
  const genderSplit = demographics.gender_split || {};
  const topCountries = demographics.top_countries || [];
  const platforms = creator.platforms || {};
  const brandSuitability = creator.brand_suitability || {};
  const contentCategories = creator.content_categories || [];
  const deliveryHistory = creator.delivery_history || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Influencer Intelligence & Verified Profile"
      size="lg"
    >
      <div className="space-y-5 text-left font-sans">
        {/* Header Hero Banner */}
        <div className="p-4 rounded-lg bg-gradient-to-r from-slate-900 to-slate-800 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <Avatar
              name={creator.display_name || creator.handle}
              size="lg"
              className="ring-2 ring-white/20"
            />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-base text-white">
                  {creator.display_name || creator.handle}
                </h3>
                {creator.is_verified && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/20 text-sky-300 border border-sky-400/30 flex items-center gap-1">
                    <Icon name="CheckCircle2" size={12} />
                    Verified Creator
                  </span>
                )}
                {creator.is_platform_verified && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                    Platform Synced
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-300 mt-0.5">
                <span className="font-mono">{creator.handle}</span>
                <span>•</span>
                <span className="capitalize">{creator.primary_niche}</span>
                <span>•</span>
                <span>{creator.language || 'English'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {creator.profile_url && (
              <a
                href={creator.profile_url}
                target="_blank"
                rel="noreferrer noopener"
                className="px-3 py-1.5 rounded text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center gap-1.5"
              >
                <span>View Portfolio</span>
                <Icon name="ExternalLink" size={12} />
              </a>
            )}
            {onShortlistToggle && (
              <Button
                variant={isShortlisted ? 'secondary' : 'primary'}
                size="sm"
                onClick={() => onShortlistToggle(creator)}
                className="text-xs"
              >
                {isShortlisted ? '★ Shortlisted' : '☆ Add to Shortlist'}
              </Button>
            )}
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 border-b border-slate-200 text-xs font-semibold">
          {[
            { id: 'overview', label: 'Overview & Niche', icon: 'User' },
            { id: 'audience', label: 'Audience Insights', icon: 'Users' },
            { id: 'performance', label: 'Performance Matrix', icon: 'BarChart3' },
            { id: 'trust', label: 'Trust & Verification', icon: 'ShieldCheck' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-2 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isActive
                    ? 'border-sky-600 text-sky-700 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon name={tab.icon as any} size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: OVERVIEW & NICHE */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Biography & Editorial Focus
              </h4>
              <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                {creator.bio || (
                  <span className="italic text-slate-400">No public biography provided by creator.</span>
                )}
              </p>
            </div>

            {/* Content Categories & Relevance */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Content Categories &amp; Thematic Relevance
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {contentCategories.length > 0 ? (
                  contentCategories.map((cat, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-md text-xs font-medium bg-sky-50 text-sky-900 border border-sky-100"
                    >
                      {cat}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-400 italic">
                    General category: {creator.primary_niche}
                  </span>
                )}
              </div>
            </div>

            {/* Brand Suitability & Safety */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Brand Suitability &amp; Commercial Integrity
              </h4>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block text-[11px]">Safety Rating</span>
                  <span className="font-semibold text-emerald-700 flex items-center gap-1 mt-0.5">
                    <Icon name="Shield" size={13} />
                    {brandSuitability.safety_level
                      ? String(brandSuitability.safety_level).replace('_', ' ').toUpperCase()
                      : 'BRAND SAFE (Standard)'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Sponsored Content Ratio</span>
                  <span className="font-semibold text-slate-800 mt-0.5 block font-mono">
                    {brandSuitability.sponsored_content_ratio != null
                      ? `${(Number(brandSuitability.sponsored_content_ratio) * 100).toFixed(0)}% Sponsored`
                      : 'Unmonitored / Organic'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Family Friendly</span>
                  <span className="font-semibold text-slate-800 mt-0.5 block">
                    {brandSuitability.family_friendly !== false ? 'Yes (Verified)' : 'Mature Audience'}
                  </span>
                </div>
              </div>
              {brandSuitability.notes && (
                <p className="text-[11px] text-slate-500 mt-1.5 italic">
                  Note: {String(brandSuitability.notes)}
                </p>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: AUDIENCE INSIGHTS */}
        {activeTab === 'audience' && (
          <div className="space-y-4">
            {/* Audience Description */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Audience Persona &amp; Characteristics
              </h4>
              <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100 leading-relaxed">
                {creator.audience_description || (
                  <span className="italic text-slate-400">
                    Detailed qualitative audience persona has not been submitted for this account.
                  </span>
                )}
              </p>
            </div>

            {/* Geographic Distribution */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Top Audience Geographies
              </h4>
              {topCountries.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {topCountries.map((c, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 rounded bg-slate-100 border border-slate-200 text-xs font-mono font-semibold text-slate-800 flex items-center gap-1.5"
                    >
                      <Icon name="Globe" size={13} className="text-sky-600" />
                      {String(c)}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-400 italic p-2 bg-slate-50 rounded">
                  Geographic country breakdown unavailable for this data source.
                </div>
              )}
            </div>

            {/* Age Distribution Breakdown */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Age Demographic Distribution
              </h4>
              {Object.keys(ageSplit).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(ageSplit).map(([bracket, pct]) => {
                    const numPct = typeof pct === 'number' ? pct : parseFloat(String(pct)) || 0;
                    return (
                      <div key={bracket} className="text-xs">
                        <div className="flex justify-between text-slate-600 mb-1">
                          <span className="font-medium">{bracket} years</span>
                          <span className="font-mono font-bold text-slate-900">{numPct.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-sky-600 h-2 rounded-full transition-all"
                            style={{ width: `${Math.min(numPct, 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-xs text-slate-400 italic p-2 bg-slate-50 rounded">
                  Age distribution data is not provided or marked private by creator.
                </div>
              )}
            </div>

            {/* Gender Split */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Gender Demographic Breakdown
              </h4>
              {Object.keys(genderSplit).length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(genderSplit).map(([gender, pct]) => (
                    <div key={gender} className="p-2.5 bg-slate-50 rounded border border-slate-200 text-center">
                      <span className="text-[11px] text-slate-500 capitalize block">{gender}</span>
                      <span className="text-sm font-bold text-slate-900 font-mono">
                        {typeof pct === 'number' ? `${pct.toFixed(1)}%` : String(pct)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-400 italic p-2.5 bg-slate-50 rounded border border-slate-100 flex items-center gap-2">
                  <Icon name="Info" size={14} className="text-slate-400" />
                  <span>Gender metrics unavailable (private platform setting or unmonitored).</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: PERFORMANCE MATRIX */}
        {activeTab === 'performance' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Total Reach</span>
                <span className="text-base font-extrabold text-slate-950 font-mono">
                  {(creator.total_followers ?? 0).toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Audience Followers</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Engagement Rate</span>
                <span className="text-base font-extrabold text-sky-700 font-mono">
                  {creator.avg_engagement_rate != null ? `${creator.avg_engagement_rate.toFixed(1)}%` : '—'}
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Interaction Ratio</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Average Likes</span>
                <span className="text-base font-extrabold text-slate-900 font-mono">
                  {creator.avg_likes != null ? creator.avg_likes.toLocaleString() : (
                    <span className="text-xs font-normal text-slate-400 italic">Unmonitored</span>
                  )}
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Per Publication</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Average Views</span>
                <span className="text-base font-extrabold text-slate-900 font-mono">
                  {creator.avg_views != null ? creator.avg_views.toLocaleString() : (
                    <span className="text-xs font-normal text-slate-400 italic">Unmonitored</span>
                  )}
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Video / Stream</span>
              </div>
            </div>

            {/* Multi-Platform Statistics */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Supported Social Media Channels
              </h4>
              {Object.keys(platforms).length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {Object.entries(platforms).map(([platformName, stats]) => (
                    <div key={platformName} className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-sky-500" />
                        <span className="font-bold text-xs uppercase text-slate-800">{platformName}</span>
                      </div>
                      <div className="text-right text-xs font-mono">
                        <span className="font-bold text-slate-900">
                          {stats.followers ? stats.followers.toLocaleString() : 'Active Channel'}
                        </span>
                        {stats.avg_views && (
                          <span className="text-slate-500 block text-[10px]">
                            ~{stats.avg_views.toLocaleString()} avg views
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-400 italic p-2 bg-slate-50 rounded">
                  Individual platform breakdowns not synced.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: TRUST & VERIFICATION (PHASE 6) */}
        {activeTab === 'trust' && (
          <div className="space-y-4">
            {/* Top Score & Confidence Banner */}
            <div className="p-4 bg-gradient-to-r from-slate-50 to-sky-50 rounded-xl border border-sky-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Influencer Trustworthiness Assessment
                    </span>
                    {trustReport ? (
                      <Badge
                        variant={
                          trustReport.overall_trust_level === 'high_confidence'
                            ? 'success'
                            : trustReport.overall_trust_level === 'moderate_confidence'
                            ? 'brand'
                            : trustReport.overall_trust_level === 'insufficient_evidence'
                            ? 'neutral'
                            : 'warning'
                        }
                        size="sm"
                      >
                        {trustReport.overall_trust_level === 'high_confidence'
                          ? 'High Confidence Reliability'
                          : trustReport.overall_trust_level === 'moderate_confidence'
                          ? 'Moderate Confidence'
                          : trustReport.overall_trust_level === 'insufficient_evidence'
                          ? 'Insufficient Evidence (No Demerit)'
                          : 'Limited Evidence'}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    Traceable evaluation of engagement stability, follower-tier alignment, delivery track record, and data freshness.
                  </p>
                </div>

                <div className="text-left sm:text-right shrink-0">
                  <span className="text-2xl font-black text-slate-900 font-mono block">
                    {trustReport?.trust_score != null
                      ? `${trustReport.trust_score.toFixed(1)}/100`
                      : 'N/A'}
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    {trustReport?.evidence_coverage_pct != null
                      ? `${trustReport.evidence_coverage_pct}% Evidence Coverage`
                      : 'Calculating coverage...'}
                  </span>
                </div>
              </div>

              {/* Distinction Banner (Mandatory Task 3) */}
              <div className="p-2.5 bg-white/90 border border-sky-100 rounded-lg text-xs text-slate-600 flex items-start gap-2">
                <Icon name="Info" size="xs" className="text-sky-600 shrink-0 mt-0.5" />
                <span className="text-[11px] leading-relaxed">
                  <strong>Domain Separation Notice:</strong> Trustworthiness evaluates professional reliability, past delivery history, data currency, and engagement consistency. It is strictly separate from Campaign Suitability (which depends on creative audience brief fit) and Fraud Risk (which monitors bot interactions).
                </span>
              </div>
            </div>

            {/* Quick KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-white rounded-lg border border-slate-200 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Authenticity Heuristic</span>
                <span className="text-lg font-black text-emerald-700 font-mono">
                  {creator.authenticity_score != null ? `${creator.authenticity_score.toFixed(1)}/100` : '—'}
                </span>
                <span className="text-[10px] text-emerald-600 block mt-0.5">Organic Interaction Check</span>
              </div>

              <div className="p-3 bg-white rounded-lg border border-slate-200 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Verified Campaigns</span>
                <span className="text-lg font-black text-slate-900 font-mono">
                  {creator.past_campaigns_count ?? 0}
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Completed Collaborations</span>
              </div>

              <div className="p-3 bg-white rounded-lg border border-slate-200 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">On-Time Delivery</span>
                <span className="text-lg font-black text-slate-900 font-mono">
                  {creator.on_time_delivery_rate != null ? `${creator.on_time_delivery_rate.toFixed(1)}%` : (
                    <span className="text-xs font-normal text-slate-400 italic">No Prior Milestone Data</span>
                  )}
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Deliverable Punctuality</span>
              </div>
            </div>

            {/* 5 Evidence-Based Indicators List */}
            {loadingTrust ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                <Icon name="RotateCw" size="sm" className="animate-spin text-sky-600 mx-auto mb-1" />
                Auditing trust indicators...
              </div>
            ) : trustReport && trustReport.indicators ? (
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                  <span>Traceable Trust Indicators ({trustReport.indicators.length})</span>
                  <span className="text-[10px] font-normal text-slate-400 font-mono">
                    Documented Evidence &amp; Guidance
                  </span>
                </h4>

                <div className="space-y-2.5">
                  {trustReport.indicators.map((ind) => (
                    <div
                      key={ind.indicator_key}
                      className="p-3 bg-slate-50/70 rounded-lg border border-slate-200 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-xs">
                            {ind.display_name}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              ind.status === 'consistent' || ind.status === 'healthy_alignment' || ind.status === 'verified_track_record'
                                ? 'bg-emerald-100 text-emerald-800'
                                : ind.status === 'no_prior_history' || ind.status === 'insufficient_evidence'
                                ? 'bg-slate-200 text-slate-700'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {ind.status_label}
                          </span>
                        </div>

                        <span className="text-[10px] text-slate-400 font-mono">
                          {ind.is_sufficient_evidence ? 'Evidence Verified' : 'Insufficient Evidence (No Demerit)'}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-500 leading-snug">
                        <strong>Definition:</strong> {ind.definition}
                      </p>

                      <p className="text-slate-700 text-xs leading-relaxed">
                        {ind.explanation}
                      </p>

                      {ind.context_and_guidance && (
                        <div className="text-[11px] text-sky-900 bg-sky-50/50 p-1.5 rounded border border-sky-100/60">
                          <span className="font-semibold text-sky-800">Review Guidance:</span> {ind.context_and_guidance}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Delivery History Log if present */}
            {deliveryHistory.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Verified Delivery History ({deliveryHistory.length} records)
                </h4>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {deliveryHistory.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-slate-50 rounded border border-slate-200 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-semibold text-slate-800">{item.campaign_title}</span>
                        {item.brand_name && (
                          <span className="text-slate-500 text-[11px] ml-2">via {item.brand_name}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {item.on_time && (
                          <span className="text-emerald-700 text-[10px] font-semibold bg-emerald-100/60 px-2 py-0.5 rounded">
                            On-Time Delivery
                          </span>
                        )}
                        <span className="font-mono text-[10px] text-slate-400">{item.completed_at || 'Completed'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Data Source & Freshness Disclosures */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1 text-slate-600">
              <div className="flex justify-between">
                <span className="text-slate-500">Data Source:</span>
                <span className="font-mono font-semibold text-slate-800">{creator.data_source || 'Catalog Seed'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Freshness Status:</span>
                <span className="font-mono font-semibold text-slate-800 capitalize">{creator.freshness_status || 'Manual Sync'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Profile Completeness:</span>
                <span className="font-mono font-semibold text-sky-700">
                  {creator.completeness_score != null ? `${creator.completeness_score}% Complete` : 'Verified'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer Controls */}
        <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>Brand Bridge Verified Creator Intelligence</span>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};

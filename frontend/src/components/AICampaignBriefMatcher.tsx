import React, { useState, useRef } from 'react';
import { api } from '../api';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  Input,
  Select,
  Skeleton,
} from '../design-system';
import type {
  CreatorProfile,
  NaturalLanguageMatchRequest,
  RecommendationResponse,
} from '../types';

interface AICampaignBriefMatcherProps {
  onViewProfile: (creator: CreatorProfile) => void;
  onToggleShortlist: (creator: CreatorProfile) => void;
  isCreatorShortlisted: (creatorId: number) => boolean;
}

const SAMPLE_BRIEFS = [
  {
    label: 'Clean Skincare Launch',
    brief: 'Launching an organic hyaluronic acid hydration serum for sensitive skin with 24-hour moisture barrier restoration.',
    product: 'Pure Glow Hydration Serum',
    audience: 'Women aged 18-34 in US and Canada who value clean beauty, vegan ingredients, and dermatological safety.',
    niche: 'beauty',
    objective: 'Product Launch & Authentic Reviews',
    platform: 'instagram',
  },
  {
    label: 'Developer AI Platform',
    brief: 'Promoting a developer productivity tool featuring automated code reviews, latency profiling, and AI agents for enterprise engineering teams.',
    product: 'Nexus AI DevOps Suite',
    audience: 'Software engineers, tech leads, and computer science students aged 20-40 in US, UK, and Europe.',
    niche: 'technology',
    objective: 'Developer Awareness & Conversions',
    platform: 'youtube',
  },
  {
    label: 'Artisan Culinary Kitchen',
    brief: 'Introducing high-protein sourdough bread mixes and cold-pressed extra virgin olive oil for health-conscious home chefs.',
    product: 'Artisan Heritage Pantry Kit',
    audience: 'Home cooks and foodies aged 25-45 looking for wholesome gourmet ingredients and family dinner recipes.',
    niche: 'food',
    objective: 'Brand Awareness & Recipe Integration',
    platform: 'instagram',
  },
];

export const AICampaignBriefMatcher: React.FC<AICampaignBriefMatcherProps> = ({
  onViewProfile,
  onToggleShortlist,
  isCreatorShortlisted,
}) => {
  // Input Form State
  const [briefText, setBriefText] = useState('');
  const [productOrService, setProductOrService] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [industryNiche, setIndustryNiche] = useState('auto');
  const [campaignObjective, setCampaignObjective] = useState('Brand Awareness');
  const [preferredPlatform, setPreferredPlatform] = useState('any');
  const [preferredLanguage, setPreferredLanguage] = useState('English');
  const [budget, setBudget] = useState<number | undefined>(undefined);

  // Hard eligibility constraints
  const [minFollowers, setMinFollowers] = useState<number | undefined>(undefined);
  const [minEngagementRate, setMinEngagementRate] = useState<number | undefined>(undefined);
  const [minAuthenticity, setMinAuthenticity] = useState<number | undefined>(undefined);
  const [strictNicheMatch, setStrictNicheMatch] = useState(false);

  // Scoring Weights Configuration
  const [showWeightConfig, setShowWeightConfig] = useState(false);
  const [weightSemantic, setWeightSemantic] = useState(0.35);
  const [weightEngagement, setWeightEngagement] = useState(0.25);
  const [weightAuth, setWeightAuth] = useState(0.20);
  const [weightAudience, setWeightAudience] = useState(0.20);

  // Results State
  const [isLoading, setIsLoading] = useState(false);
  const [matchResult, setMatchResult] = useState<RecommendationResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const applySample = (sample: (typeof SAMPLE_BRIEFS)[0]) => {
    setBriefText(sample.brief);
    setProductOrService(sample.product);
    setTargetAudience(sample.audience);
    setIndustryNiche(sample.niche);
    setCampaignObjective(sample.objective);
    setPreferredPlatform(sample.platform);
  };

  const handleMatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!briefText.trim() || briefText.trim().length < 5) {
      setErrorMsg('Please enter a natural-language campaign brief (at least 5 characters).');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    const weightsTotal = weightSemantic + weightEngagement + weightAuth + weightAudience;
    const normalizedWeights = {
      weight_semantic_content: Number((weightSemantic / weightsTotal).toFixed(2)),
      weight_engagement_quality: Number((weightEngagement / weightsTotal).toFixed(2)),
      weight_authenticity: Number((weightAuth / weightsTotal).toFixed(2)),
      weight_audience_fit: Number((1.0 - (weightSemantic / weightsTotal + weightEngagement / weightsTotal + weightAuth / weightsTotal)).toFixed(2)),
    };

    const payload: NaturalLanguageMatchRequest = {
      brief_text: briefText.trim(),
      product_or_service: productOrService.trim() || undefined,
      target_audience: targetAudience.trim() || undefined,
      industry_or_niche: industryNiche !== 'auto' ? industryNiche : undefined,
      campaign_objective: campaignObjective || undefined,
      preferred_platform: preferredPlatform !== 'any' ? preferredPlatform : undefined,
      preferred_language: preferredLanguage || 'English',
      budget: budget || undefined,
      min_followers: minFollowers,
      min_engagement_rate: minEngagementRate,
      min_authenticity: minAuthenticity,
      strict_niche_match: strictNicheMatch,
      limit: 10,
      weights: normalizedWeights,
    };

    try {
      const res = await api.recommendations.matchBrief(payload);
      setMatchResult(res);
      setTimeout(() => {
        resultsRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      }, 50);
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'AI matching execution failed.';
      setErrorMsg(msg);
      setMatchResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <div className="bg-gradient-to-r from-sky-900 via-slate-900 to-indigo-950 p-6 rounded-xl text-white shadow-sm border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-500/20 text-sky-300 border border-sky-400/30">
                Phase 3 Engine
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Sentence-Transformers · all-MiniLM-L6-v2 (384d)
              </span>
            </div>
            <h2 className="text-xl font-bold tracking-tight">AI Campaign Brief Influencer Matching</h2>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Describe your campaign, product concept, and target audience in natural language. Our hybrid AI pipeline transforms your brief into dense latent vectors, enforces hard eligibility gates, and calculates multi-signal alignment without fabricated scores.
            </p>
          </div>

          <div className="flex flex-col items-start md:items-end gap-1.5 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Live Embedding Inference
            </span>
            <span>No Fake or Random Fallbacks</span>
          </div>
        </div>

        {/* Quick Sample Briefs */}
        <div className="mt-4 pt-4 border-t border-slate-800 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-400">Quick Templates:</span>
          {SAMPLE_BRIEFS.map((s, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => applySample(s)}
              className="text-xs bg-slate-800/80 hover:bg-slate-750 text-slate-200 hover:text-white px-3 py-1 rounded-md border border-slate-700/60 transition-colors"
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {errorMsg && (
        <Alert variant="danger" onClose={() => setErrorMsg(null)}>
          <div className="font-semibold text-sm mb-1">AI Matching Notification</div>
          <div className="text-xs">{errorMsg}</div>
        </Alert>
      )}

      {/* Input Brief Formulation Card */}
      <Card padding="lg">
        <form onSubmit={handleMatchSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-800 uppercase tracking-wider mb-1.5">
              Natural-Language Campaign Brief <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-colors"
              placeholder="e.g. We are searching for creators to review our plant-based peptide moisturizer. The product targets clean skincare lovers and young professionals seeking radiant daily skin hydration without heavy oils..."
              value={briefText}
              onChange={(e) => setBriefText(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Product or Service
              </label>
              <Input
                placeholder="e.g. Pure Glow Peptide Moisturizer"
                value={productOrService}
                onChange={(e) => setProductOrService(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Target Audience &amp; Geography
              </label>
              <Input
                placeholder="e.g. Gen Z women in US and Canada interested in clean beauty"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Industry / Niche</label>
              <Select
                value={industryNiche}
                onChange={(e) => setIndustryNiche(e.target.value)}
                options={[
                  { value: 'auto', label: 'Auto-detect from Brief' },
                  { value: 'technology', label: 'Technology & Dev' },
                  { value: 'beauty', label: 'Beauty & Skincare' },
                  { value: 'food', label: 'Food & Culinary' },
                  { value: 'fitness', label: 'Fitness & Health' },
                  { value: 'fashion', label: 'Fashion & Style' },
                  { value: 'home', label: 'Home & Decor' },
                  { value: 'parenting', label: 'Parenting & Family' },
                  { value: 'wellness', label: 'Wellness & Lifestyle' },
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Campaign Objective</label>
              <Select
                value={campaignObjective}
                onChange={(e) => setCampaignObjective(e.target.value)}
                options={[
                  { value: 'Brand Awareness', label: 'Brand Awareness' },
                  { value: 'Product Launch', label: 'Product Launch' },
                  { value: 'Conversions', label: 'Direct Conversions' },
                  { value: 'Content Creation', label: 'Authentic UGC' },
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Preferred Platform</label>
              <Select
                value={preferredPlatform}
                onChange={(e) => setPreferredPlatform(e.target.value)}
                options={[
                  { value: 'any', label: 'Any Platform' },
                  { value: 'instagram', label: 'Instagram' },
                  { value: 'youtube', label: 'YouTube' },
                  { value: 'tiktok', label: 'TikTok' },
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Language</label>
              <Select
                value={preferredLanguage}
                onChange={(e) => setPreferredLanguage(e.target.value)}
                options={[
                  { value: 'English', label: 'English' },
                  { value: 'Spanish', label: 'Spanish' },
                  { value: 'French', label: 'French' },
                  { value: 'German', label: 'German' },
                  { value: 'Any', label: 'Any Language' },
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Est. Budget ($)</label>
              <Input
                type="number"
                placeholder="e.g. 5000"
                value={budget !== undefined ? String(budget) : ''}
                onChange={(e) => setBudget(e.target.value ? Number(e.target.value) : undefined)}
              />
            </div>
          </div>

          {/* Hard Eligibility Gates Bar */}
          <div className="pt-3 border-t border-slate-200">
            <span className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Hard Eligibility Filters (Pre-Ranking Gates)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Minimum Followers</label>
                <Select
                  value={minFollowers === undefined ? 'any' : String(minFollowers)}
                  onChange={(e) => setMinFollowers(e.target.value === 'any' ? undefined : Number(e.target.value))}
                  options={[
                    { value: 'any', label: 'Any Audience Size' },
                    { value: '5000', label: '5,000+ Followers' },
                    { value: '10000', label: '10,000+ Followers' },
                    { value: '25000', label: '25,000+ Followers' },
                    { value: '50000', label: '50,000+ Followers' },
                    { value: '100000', label: '100,000+ Followers' },
                  ]}
                />
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">Min. Engagement Rate</label>
                <Select
                  value={minEngagementRate === undefined ? 'any' : String(minEngagementRate)}
                  onChange={(e) => setMinEngagementRate(e.target.value === 'any' ? undefined : Number(e.target.value))}
                  options={[
                    { value: 'any', label: 'Any Engagement Rate' },
                    { value: '1.5', label: '1.5%+ Engagement' },
                    { value: '2.5', label: '2.5%+ Engagement' },
                    { value: '3.5', label: '3.5%+ Engagement' },
                  ]}
                />
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">Min. Authenticity Score</label>
                <Select
                  value={minAuthenticity === undefined ? 'any' : String(minAuthenticity)}
                  onChange={(e) => setMinAuthenticity(e.target.value === 'any' ? undefined : Number(e.target.value))}
                  options={[
                    { value: 'any', label: 'Any Authenticity Index' },
                    { value: '80', label: '80/100+ Authentic' },
                    { value: '85', label: '85/100+ Authentic' },
                    { value: '90', label: '90/100+ Highly Organic' },
                  ]}
                />
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
              <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={strictNicheMatch}
                  onChange={(e) => setStrictNicheMatch(e.target.checked)}
                  className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                <span>Strict vertical matching (disqualify creators without primary or content niche match)</span>
              </label>

              <button
                type="button"
                onClick={() => setShowWeightConfig(!showWeightConfig)}
                className="text-xs text-sky-700 hover:text-sky-900 font-medium underline flex items-center gap-1"
              >
                {showWeightConfig ? 'Hide Weight Sliders' : 'Customize Scoring Weights (Sum = 100%)'}
              </button>
            </div>
          </div>

          {/* Expandable Weights Configuration */}
          {showWeightConfig && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800">
                  Signal Weights Configuration
                </span>
                <Badge variant="neutral" size="sm">
                  Total: {Math.round((weightSemantic + weightEngagement + weightAuth + weightAudience) * 100)}%
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <div className="flex justify-between text-xs text-slate-700 mb-1">
                    <span>Semantic Content Fit</span>
                    <span className="font-bold">{Math.round(weightSemantic * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="0.7"
                    step="0.05"
                    value={weightSemantic}
                    onChange={(e) => setWeightSemantic(Number(e.target.value))}
                    className="w-full accent-sky-600"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-700 mb-1">
                    <span>Engagement Quality</span>
                    <span className="font-bold">{Math.round(weightEngagement * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="0.5"
                    step="0.05"
                    value={weightEngagement}
                    onChange={(e) => setWeightEngagement(Number(e.target.value))}
                    className="w-full accent-sky-600"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-700 mb-1">
                    <span>Authenticity Heuristics</span>
                    <span className="font-bold">{Math.round(weightAuth * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="0.4"
                    step="0.05"
                    value={weightAuth}
                    onChange={(e) => setWeightAuth(Number(e.target.value))}
                    className="w-full accent-sky-600"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-700 mb-1">
                    <span>Audience Fit</span>
                    <span className="font-bold">{Math.round(weightAudience * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="0.4"
                    step="0.05"
                    value={weightAudience}
                    onChange={(e) => setWeightAudience(Number(e.target.value))}
                    className="w-full accent-sky-600"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Form Action */}
          <div className="flex items-center justify-end pt-2">
            <Button
              variant="primary"
              type="submit"
              size="md"
              disabled={isLoading || !briefText.trim()}
              leftIcon={<Icon name="Search" size="sm" />}
            >
              {isLoading ? 'Vectorizing Brief & Computing Latent Match...' : 'Match Influencers with AI'}
            </Button>
          </div>
        </form>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <Card padding="lg" className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Running Sentence-Transformers Neural Inference...
              </p>
              <p className="text-xs text-slate-500">
                Generating 384-dimensional unit normalized embeddings, filtering hard constraints, and scoring tier-normalized engagement.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            {[1, 2].map((i) => (
              <div key={i} className="border border-slate-100 rounded-lg p-4 space-y-3">
                <Skeleton variant="text" height={20} width="60%" />
                <Skeleton variant="rect" height={60} />
                <Skeleton variant="text" height={16} width="40%" />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Match Results Display */}
      {matchResult && !isLoading && (
        <div ref={resultsRef} className="space-y-4">
          {/* Provenance Strip */}
          <div className="bg-slate-100 border border-slate-200 rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="brand" size="sm">
                {matchResult.recommendations.length} Matches Ranked
              </Badge>
              <span className="text-slate-600">
                Analyzed <strong>{matchResult.total_analyzed}</strong> creators
                {matchResult.disqualified_count !== undefined && (
                  <> (<strong>{matchResult.disqualified_count}</strong> disqualified by hard gates)</>
                )}
              </span>
              {matchResult.latency_ms && (
                <span className="text-slate-500 font-mono">
                  Latency: {matchResult.latency_ms}ms
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-500">Engine:</span>
              <code className="bg-white px-2 py-0.5 rounded border border-slate-200 text-sky-800 font-mono text-[11px]">
                {matchResult.ai_model_used || 'Sentence-Transformers / all-MiniLM-L6-v2'}
              </code>
            </div>
          </div>

          {matchResult.recommendations.length === 0 ? (
            <Card padding="lg">
              <EmptyState
                title="No Influencers Satisfied All Hard Eligibility Filters"
                description="Try lowering follower thresholds, minimum engagement rates, or relaxing strict niche constraints."
                icon="Users"
              />
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {matchResult.recommendations.map((rec) => {
                const c = rec.creator;
                const shortlisted = isCreatorShortlisted(c.id);
                const sig = rec.signal_breakdown;
                const exp = rec.explanation;

                return (
                  <Card key={c.id} padding="lg" className="border-l-4 border-l-sky-500 space-y-4">
                    {/* Top Row: Rank, Identity, Overall Score */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-sky-100 text-sky-900 font-bold text-xs shrink-0">
                          #{rec.rank}
                        </div>
                        <Avatar name={c.display_name || c.handle} size="md" />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-slate-900 text-sm">
                              {c.display_name || c.handle}
                            </h3>
                            <span className="text-xs text-slate-500 font-mono">{c.handle}</span>
                            {c.is_verified && (
                              <Badge variant="brand" size="sm">Verified</Badge>
                            )}
                            <Badge variant="neutral" size="sm" className="capitalize">
                              {c.primary_niche}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                            {c.bio || 'Verified content creator on Brand Bridge.'}
                          </p>
                        </div>
                      </div>

                      {/* Overall Fit Score Badge */}
                      <div className="bg-sky-50 border border-sky-100 rounded-lg p-2.5 text-center min-w-[110px] shrink-0">
                        <span className="text-[10px] uppercase font-bold text-sky-800 tracking-wider block">
                          AI Fit Match
                        </span>
                        <div className="text-xl font-extrabold text-sky-900">
                          {rec.overall_match_score.toFixed(1)}%
                        </div>
                      </div>
                    </div>

                    {/* Signal Breakdown Matrix */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-100 font-mono text-center">
                      <div>
                        <span className="text-[10px] font-sans text-slate-500 uppercase block">Semantic Fit</span>
                        <span className="text-xs font-bold text-sky-800">
                          {sig.content_relevance_score.toFixed(1)}%
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-sans text-slate-500 uppercase block">Engagement Quality</span>
                        <span className="text-xs font-bold text-indigo-800">
                          {sig.engagement_quality_score.toFixed(1)}%
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-sans text-slate-500 uppercase block">Authenticity Index</span>
                        <span className="text-xs font-bold text-emerald-800">
                          {sig.authenticity_heuristic_score.toFixed(1)}%
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-sans text-slate-500 uppercase block">Audience Fit</span>
                        <span className="text-xs font-bold text-slate-800">
                          {sig.audience_affinity_score > 0
                            ? `${sig.audience_affinity_score.toFixed(1)}%`
                            : <span className="text-[11px] font-sans text-slate-400 font-normal">Unmonitored</span>}
                        </span>
                      </div>
                    </div>

                    {/* Explainability Section */}
                    <div className="bg-white border border-slate-200 rounded-lg p-3 text-xs space-y-2">
                      <p className="text-slate-800 font-medium leading-relaxed">
                        {exp.summary}
                      </p>

                      {exp.strengths && exp.strengths.length > 0 && (
                        <div className="space-y-1">
                          <span className="font-semibold text-emerald-800 flex items-center gap-1">
                            ✓ Key Match Factors:
                          </span>
                          <ul className="list-disc list-inside space-y-0.5 text-slate-600 pl-1">
                            {exp.strengths.map((str, idx) => (
                              <li key={idx}>{str}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {exp.cautions && exp.cautions.length > 0 && (
                        <div className="space-y-1 pt-1 border-t border-slate-100">
                          <span className="font-semibold text-amber-800 flex items-center gap-1">
                            ⚠ Observed Signals &amp; Cautions:
                          </span>
                          <ul className="list-disc list-inside space-y-0.5 text-slate-600 pl-1">
                            {exp.cautions.map((caut, idx) => (
                              <li key={idx}>{caut}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {exp.unavailable_fields && exp.unavailable_fields.length > 0 && (
                        <div className="pt-1 text-[11px] text-slate-400">
                          <span className="font-medium text-slate-500">Unmonitored Data: </span>
                          {exp.unavailable_fields.join(', ')} (no default scores fabricated).
                        </div>
                      )}
                    </div>

                    {/* Actions Row */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 flex-wrap gap-2">
                      <div className="text-[11px] text-slate-400">
                        Followers: {(c.total_followers ?? 0).toLocaleString()} · Platforms:{' '}
                        {c.supported_platforms?.join(', ') || 'General'}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => onViewProfile(c)}
                          leftIcon={<Icon name="Eye" size="sm" />}
                        >
                          View Profile
                        </Button>
                        <Button
                          variant={shortlisted ? 'secondary' : 'primary'}
                          size="sm"
                          onClick={() => onToggleShortlist(c)}
                          leftIcon={<Icon name={shortlisted ? 'Check' : 'Plus'} size="sm" />}
                        >
                          {shortlisted ? 'Shortlisted' : 'Add to Shortlist'}
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

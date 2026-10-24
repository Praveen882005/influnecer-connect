import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RichInfluencerProfileModal } from '../components/RichInfluencerProfileModal';
import { api } from '../api';
import type { CreatorProfile, TrustAnalysisReport } from '../types';

vi.mock('../api', () => ({
  api: {
    analytics: {
      creatorTrust: vi.fn(),
    },
  },
}));

const mockCreator: CreatorProfile = {
  id: 1,
  user_id: 10,
  handle: '@tech_marcus',
  display_name: 'Marcus Chen',
  bio: 'Engineering and developer tools reviewer.',
  primary_niche: 'Tech & AI',
  total_followers: 490000,
  avg_engagement_rate: 3.8,
  authenticity_score: 94.5,
  is_verified: true,
  profile_url: 'https://youtube.com/@tech_marcus',
  past_campaigns_count: 5,
  on_time_delivery_rate: 100.0,
  created_at: '2026-10-22T00:00:00Z',
  updated_at: '2026-10-24T00:00:00Z',
};

const mockTrustReport: TrustAnalysisReport = {
  creator_id: 1,
  handle: '@tech_marcus',
  display_name: 'Marcus Chen',
  overall_trust_level: 'high_confidence',
  trust_score: 92.5,
  evidence_coverage_pct: 100.0,
  indicators: [
    {
      indicator_key: 'engagement_consistency',
      display_name: 'Engagement Consistency',
      definition: 'Measures engagement variability (likes + comments) across recent post history.',
      status: 'consistent',
      status_label: 'Highly Consistent Engagement',
      is_sufficient_evidence: true,
      observed_evidence: { coefficient_of_variation: 0.32 },
      explanation: 'Steady interaction across 8 posts with low coefficient of variation (0.32).',
      context_and_guidance: 'Strong indicator of a loyal, regularly active community.',
    },
    {
      indicator_key: 'peer_relative_engagement',
      display_name: 'Peer-Relative Engagement',
      definition: 'Compares creator engagement rate against peer tier medians.',
      status: 'healthy_alignment',
      status_label: 'Healthy Peer Alignment',
      is_sufficient_evidence: true,
      observed_evidence: { peer_tier: 'Mid-Tier Creator', peer_median_er: 1.8 },
      explanation: 'Engagement rate of 3.8% aligns organically with Mid-Tier Creator medians.',
      context_and_guidance: 'Audience responsiveness matches expectations for account scale.',
    },
    {
      indicator_key: 'content_relevance',
      display_name: 'Thematic Content Focus',
      definition: 'Evaluates thematic coherence between stated niche, bio, and content tags.',
      status: 'healthy_alignment',
      status_label: 'Verified Niche Coherence',
      is_sufficient_evidence: true,
      observed_evidence: { primary_niche: 'Tech & AI' },
      explanation: 'Consistent thematic focus in Tech & AI supported by category tags and detailed bio.',
      context_and_guidance: 'Creator maintains a clearly defined editorial category.',
    },
    {
      indicator_key: 'campaign_completion_history',
      display_name: 'Campaign Delivery Track Record',
      definition: 'Tracks verified past brand collaborations completed on-time.',
      status: 'verified_track_record',
      status_label: 'Verified Punctual Track Record',
      is_sufficient_evidence: true,
      observed_evidence: { completed_campaigns_count: 5, on_time_delivery_rate: 100.0 },
      explanation: 'Verified track record of 5 completed campaigns with 100.0% on-time delivery punctuality.',
      context_and_guidance: 'Proven history of meeting agreed campaign deadlines.',
    },
    {
      indicator_key: 'data_freshness_and_completeness',
      display_name: 'Data Freshness & Completeness',
      definition: 'Verifies whether profile data attributes are comprehensive and synced within 30 days.',
      status: 'healthy_alignment',
      status_label: 'Verified & Fresh Data',
      is_sufficient_evidence: true,
      observed_evidence: { completeness_score_pct: 88.9, days_since_metrics_sync: 2 },
      explanation: 'Comprehensive profile coverage (88.9%) with fresh metrics synced 2 day(s) ago.',
      context_and_guidance: 'Profile information is current and reliable.',
    },
  ],
  strengths: [
    'Engagement Consistency: Highly Consistent Engagement',
    'Campaign Delivery Track Record: Verified Punctual Track Record',
  ],
  cautions: [],
  missing_data_notes: [],
  distinction_notice: 'Trustworthiness Analysis strictly evaluates professional reliability, past delivery history, data currency, and engagement consistency. It does NOT evaluate Campaign Suitability or Fraud Risk.',
  methodology_and_limitations: 'Indicators are evidence-based review heuristics traceable to live application events and post history.',
  calculated_at: '2026-10-24T12:00:00Z',
};

describe('Influencer Trustworthiness Analysis Component (Phase 6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.analytics.creatorTrust as any).mockResolvedValue(mockTrustReport);
  });

  it('fetches trust analysis and displays overall score and confidence badge', async () => {
    render(
      <RichInfluencerProfileModal
        creator={mockCreator}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    // Switch to Trust & Verification tab
    const trustTab = screen.getByRole('button', { name: /Trust & Verification/i });
    fireEvent.click(trustTab);

    await waitFor(() => {
      expect(screen.getByText(/Influencer Trustworthiness Assessment/i)).toBeInTheDocument();
      expect(screen.getByText(/High Confidence Reliability/i)).toBeInTheDocument();
      expect(screen.getByText('92.5/100')).toBeInTheDocument();
      expect(screen.getByText(/100% Evidence Coverage/i)).toBeInTheDocument();
    });
  });

  it('renders the mandatory domain separation notice', async () => {
    render(
      <RichInfluencerProfileModal
        creator={mockCreator}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const trustTab = screen.getByRole('button', { name: /Trust & Verification/i });
    fireEvent.click(trustTab);

    await waitFor(() => {
      expect(screen.getByText(/Domain Separation Notice:/i)).toBeInTheDocument();
      expect(screen.getByText(/strictly separate from Campaign Suitability/i)).toBeInTheDocument();
    });
  });

  it('renders all 5 evidence-based trust indicators with definitions and guidance', async () => {
    render(
      <RichInfluencerProfileModal
        creator={mockCreator}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const trustTab = screen.getByRole('button', { name: /Trust & Verification/i });
    fireEvent.click(trustTab);

    await waitFor(() => {
      expect(screen.getByText('Engagement Consistency')).toBeInTheDocument();
      expect(screen.getByText('Peer-Relative Engagement')).toBeInTheDocument();
      expect(screen.getByText('Thematic Content Focus')).toBeInTheDocument();
      expect(screen.getByText('Campaign Delivery Track Record')).toBeInTheDocument();
      expect(screen.getByText('Data Freshness & Completeness')).toBeInTheDocument();
    });

    // Check definitions and labels
    expect(screen.getByText('Highly Consistent Engagement')).toBeInTheDocument();
    expect(screen.getByText('Verified Punctual Track Record')).toBeInTheDocument();
    expect(screen.getByText(/Measures engagement variability \(likes \+ comments\)/i)).toBeInTheDocument();
  });

  it('handles insufficient evidence state without applying an unfair penalty', async () => {
    const insufficientReport: TrustAnalysisReport = {
      ...mockTrustReport,
      overall_trust_level: 'insufficient_evidence',
      trust_score: null,
      evidence_coverage_pct: 20.0,
      indicators: [
        {
          indicator_key: 'engagement_consistency',
          display_name: 'Engagement Consistency',
          definition: 'Measures engagement variability.',
          status: 'insufficient_evidence',
          status_label: 'Insufficient Post Samples',
          is_sufficient_evidence: false,
          observed_evidence: {},
          explanation: 'Creator has 1 post(s) in catalog. Minimum 3 posts required. Not penalized.',
          context_and_guidance: 'No penalty is applied for sparse catalog data.',
        },
      ],
      cautions: ['Insufficient observed empirical data.'],
      missing_data_notes: ['Sparse post samples.'],
    };

    (api.analytics.creatorTrust as any).mockResolvedValue(insufficientReport);

    render(
      <RichInfluencerProfileModal
        creator={mockCreator}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const trustTab = screen.getByRole('button', { name: /Trust & Verification/i });
    fireEvent.click(trustTab);

    await waitFor(() => {
      expect(screen.getAllByText(/Insufficient Evidence \(No Demerit\)/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('N/A')).toBeInTheDocument();
      expect(screen.getByText('20% Evidence Coverage')).toBeInTheDocument();
      expect(screen.getByText('Insufficient Post Samples')).toBeInTheDocument();
    });
  });
});

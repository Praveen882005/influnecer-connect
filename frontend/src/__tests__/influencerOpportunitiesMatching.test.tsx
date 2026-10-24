import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InfluencerOpportunitiesPage } from '../pages/influencer/InfluencerOpportunitiesPage';
import { api } from '../api';
import type { CampaignOpportunity } from '../types';

vi.mock('../api', () => ({
  api: {
    opportunities: {
      list: vi.fn(),
      interact: vi.fn(),
    },
    campaigns: {
      submitProposal: vi.fn(),
    },
  },
}));

vi.mock('../api/client', () => ({
  api: {
    opportunities: {
      list: vi.fn(),
      interact: vi.fn(),
    },
    campaigns: {
      submitProposal: vi.fn(),
    },
  },
}));

const mockOpportunities: CampaignOpportunity[] = [
  {
    id: 1,
    brand_id: 10,
    brand_name: 'EcoLuxe Skincare',
    title: 'Hydrating Botanical Lip Oil',
    niche: 'beauty',
    objective: 'Product Launch',
    description: 'Seeking beauty creators to test and review our organic hydration lip oil.',
    budget: 3500,
    currency: 'USD',
    target_location: 'Global',
    deliverables: ['1 Dedicated Reel', '2 Story Slides'],
    min_followers: 10000,
    min_engagement_rate: 2.0,
    status: 'published',
    created_at: '2026-10-24T00:00:00Z',
    is_saved: false,
    is_dismissed: false,
    has_invitation: false,
    fit_score: 89.2,
    fit_summary: 'Exceptional Brand Match: High semantic affinity and qualified audience metrics.',
    match_strengths: [
      "Niche Alignment: Matched 'beauty' content domain",
      'Semantic Brief Affinity: 86.4% thematic overlap with campaign deliverables',
      'Engagement Quality: 4.20% meets/exceeds tier benchmark',
    ],
    match_cautions: [],
    hard_constraints_satisfied: ['Followers threshold met (85,000 >= 10,000)'],
    is_eligible: true,
    disqualified_reasons: [],
    signal_breakdown: {
      content_relevance_score: 86.4,
      engagement_quality_score: 91.0,
      authenticity_heuristic_score: 94.0,
      audience_affinity_score: 75.0,
    },
    ai_model_used: 'sentence-transformers/all-MiniLM-L6-v2 (384d)',
  },
  {
    id: 2,
    brand_id: 11,
    brand_name: 'CloudScale DevOps',
    title: 'Kubernetes Cluster Monitor Launch',
    niche: 'technology',
    objective: 'Conversions',
    description: 'Enterprise container orchestration latency profiling tool.',
    budget: 5000,
    currency: 'USD',
    target_location: 'North America',
    deliverables: ['1 Dedicated YouTube Video'],
    min_followers: 100000,
    min_engagement_rate: 3.0,
    status: 'published',
    created_at: '2026-10-24T00:00:00Z',
    is_saved: false,
    is_dismissed: false,
    has_invitation: false,
    fit_score: 42.1,
    fit_summary: 'Moderate Fit: Core audience criteria partially match campaign brief.',
    match_strengths: ["Audience Reach: Follower count satisfies requirements"],
    match_cautions: ['Eligibility Warning: Followers count (85,000) is below required minimum (100,000)'],
    hard_constraints_satisfied: [],
    is_eligible: false,
    disqualified_reasons: ['Followers count (85,000) is below required minimum (100,000)'],
    signal_breakdown: {
      content_relevance_score: 35.0,
      engagement_quality_score: 60.0,
      authenticity_heuristic_score: 90.0,
      audience_affinity_score: 0.0,
    },
    ai_model_used: 'sentence-transformers/all-MiniLM-L6-v2 (384d)',
  },
];

describe('InfluencerOpportunitiesPage Component (Phase 4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders opportunity feed with AI fit score, 4-signal pills, and eligibility status', async () => {
    (api.opportunities.list as any).mockResolvedValue(mockOpportunities);

    render(<InfluencerOpportunitiesPage />);

    await waitFor(() => {
      expect(screen.getByText('Hydrating Botanical Lip Oil')).toBeInTheDocument();
      expect(screen.getByText('Kubernetes Cluster Monitor Launch')).toBeInTheDocument();
    });

    // Check fit score and badges
    expect(screen.getByText('89.2% Fit')).toBeInTheDocument();
    expect(screen.getByText('42.1% Fit')).toBeInTheDocument();

    // Check ineligibility warning badge for CloudScale DevOps
    expect(screen.getByText('✕ Unmet Criteria')).toBeInTheDocument();

    // Check 4-signal breakdown pills
    expect(screen.getByText('86%')).toBeInTheDocument(); // Content
    expect(screen.getByText('91%')).toBeInTheDocument(); // Engagement
    expect(screen.getByText('94%')).toBeInTheDocument(); // Authenticity
  });

  it('filters by minimum budget and qualified eligibility', async () => {
    (api.opportunities.list as any).mockResolvedValue(mockOpportunities);

    render(<InfluencerOpportunitiesPage />);

    await waitFor(() => {
      expect(api.opportunities.list).toHaveBeenCalledTimes(1);
    });

    // Toggle Only Qualified Opportunities
    const qualifiedCheckbox = screen.getByLabelText(/Only Qualified Opportunities/i);
    fireEvent.click(qualifiedCheckbox);

    await waitFor(() => {
      expect(api.opportunities.list).toHaveBeenCalledWith(
        expect.objectContaining({
          only_eligible: true,
        })
      );
    });
  });

  it('opens AI match explanation modal with 4 progress bars and model provenance', async () => {
    (api.opportunities.list as any).mockResolvedValue(mockOpportunities);

    render(<InfluencerOpportunitiesPage />);

    await waitFor(() => {
      expect(screen.getByText('Hydrating Botanical Lip Oil')).toBeInTheDocument();
    });

    // Click on Fit badge to open modal
    const fitBadge = screen.getByRole('button', { name: /View match compatibility explanation for Hydrating Botanical Lip Oil/i });
    fireEvent.click(fitBadge);

    await waitFor(() => {
      expect(screen.getByText(/AI Match Fit: Hydrating Botanical Lip Oil/i)).toBeInTheDocument();
      expect(screen.getByText('Multi-Signal Alignment Breakdown')).toBeInTheDocument();
      expect(screen.getByText('Semantic Content Fit:')).toBeInTheDocument();
      expect(screen.getByText('Follower-Tier Normalized Engagement:')).toBeInTheDocument();
      expect(screen.getByText('all-MiniLM-L6-v2 (384d)')).toBeInTheDocument();
      expect(screen.getByText(/Satisfied Hard Constraints/i)).toBeInTheDocument();
    });
  });

  it('submits proposal to campaign opportunity', async () => {
    (api.opportunities.list as any).mockResolvedValue(mockOpportunities);
    (api.campaigns.submitProposal as any).mockResolvedValue({ id: 100, status: 'pending' });

    render(<InfluencerOpportunitiesPage />);

    await waitFor(() => {
      expect(screen.getByText('Hydrating Botanical Lip Oil')).toBeInTheDocument();
    });

    // Click Submit Proposal
    const submitProposalBtns = screen.getAllByRole('button', { name: /Submit Proposal/i });
    fireEvent.click(submitProposalBtns[0]);

    await waitFor(() => {
      expect(screen.getByText(/Submit Proposal to EcoLuxe Skincare/i)).toBeInTheDocument();
    });

    const modalSubmitBtn = screen.getByRole('button', { name: /Submit Official Proposal/i });
    fireEvent.click(modalSubmitBtn);

    await waitFor(() => {
      expect(api.campaigns.submitProposal).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          proposed_rate: 3500,
        })
      );
    });
  });
});

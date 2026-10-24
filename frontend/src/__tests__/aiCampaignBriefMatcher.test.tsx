import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AICampaignBriefMatcher } from '../components/AICampaignBriefMatcher';
import { api } from '../api';
import type { CreatorProfile, RecommendationResponse } from '../types';

vi.mock('../api', () => ({
  api: {
    recommendations: {
      matchBrief: vi.fn(),
    },
  },
}));

const mockCreator: CreatorProfile = {
  id: 1,
  user_id: 101,
  handle: '@glow_claire',
  display_name: 'Claire Wellness',
  bio: 'Clean beauty routines and hydration serums for daily glow.',
  primary_niche: 'beauty',
  total_followers: 145000,
  avg_engagement_rate: 4.8,
  authenticity_score: 96.0,
  supported_platforms: ['instagram'],
  is_verified: true,
  created_at: '2026-10-24T00:00:00Z',
  updated_at: '2026-10-24T00:00:00Z',
};

const mockMatchResponse: RecommendationResponse = {
  total_analyzed: 5,
  eligible_count: 3,
  disqualified_count: 2,
  latency_ms: 124.5,
  ai_model_used: 'sentence-transformers/all-MiniLM-L6-v2 (384-dim dense vectors)',
  parsed_criteria: {
    brief_text: 'Launching an organic hydration serum for sensitive skin.',
    product_or_service: 'Pure Glow Serum',
    industry_or_niche: 'beauty',
    strict_niche_match: false,
  },
  recommendations: [
    {
      creator: mockCreator,
      overall_match_score: 88.6,
      rank: 1,
      signal_breakdown: {
        content_relevance_score: 85.2,
        engagement_quality_score: 90.0,
        authenticity_heuristic_score: 96.0,
        audience_affinity_score: 78.5,
        signals_used: ['Dense embedding similarity: 0.742'],
        missing_metrics: [],
      },
      explanation: {
        summary: 'Rank #1 match with 88.6% composite fit score for clean beauty campaign.',
        strengths: ['High semantic affinity with skincare brief', 'Above-tier benchmark engagement (4.8%)'],
        cautions: [],
        authenticity_disclaimer: 'Algorithmic heuristic evaluation',
      },
    },
  ],
};

describe('AICampaignBriefMatcher Component (Phase 3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders brief input form, template buttons, and hard eligibility filters', () => {
    render(
      <AICampaignBriefMatcher
        onViewProfile={vi.fn()}
        onToggleShortlist={vi.fn()}
        isCreatorShortlisted={() => false}
      />
    );

    expect(screen.getByText('AI Campaign Brief Influencer Matching')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/We are searching for creators to review/i)).toBeInTheDocument();
    expect(screen.getByText('Clean Skincare Launch')).toBeInTheDocument();
    expect(screen.getByText('Developer AI Platform')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Match Influencers with AI/i })).toBeInTheDocument();
  });

  it('applies sample template brief when clicked', () => {
    render(
      <AICampaignBriefMatcher
        onViewProfile={vi.fn()}
        onToggleShortlist={vi.fn()}
        isCreatorShortlisted={() => false}
      />
    );

    const templateBtn = screen.getByText('Clean Skincare Launch');
    fireEvent.click(templateBtn);

    const textarea = screen.getByPlaceholderText(/We are searching for creators to review/i) as HTMLTextAreaElement;
    expect(textarea.value).toContain('Launching an organic hyaluronic acid hydration serum');

    const productInput = screen.getByPlaceholderText(/e\.g\. Pure Glow Peptide Moisturizer/i) as HTMLInputElement;
    expect(productInput.value).toBe('Pure Glow Hydration Serum');
  });

  it('executes AI brief matching and displays ranked creators with signal breakdown', async () => {
    (api.recommendations.matchBrief as any).mockResolvedValue(mockMatchResponse);

    render(
      <AICampaignBriefMatcher
        onViewProfile={vi.fn()}
        onToggleShortlist={vi.fn()}
        isCreatorShortlisted={() => false}
      />
    );

    // Apply template
    fireEvent.click(screen.getByText('Clean Skincare Launch'));

    // Click Match
    const submitBtn = screen.getByRole('button', { name: /Match Influencers with AI/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.recommendations.matchBrief).toHaveBeenCalledTimes(1);
    });

    // Check ranked result
    await waitFor(() => {
      expect(screen.getByText('Claire Wellness')).toBeInTheDocument();
      expect(screen.getByText('88.6%')).toBeInTheDocument();
      expect(screen.getByText('85.2%')).toBeInTheDocument(); // Semantic Fit
      expect(screen.getByText('96.0%')).toBeInTheDocument(); // Authenticity
      expect(screen.getByText(/High semantic affinity with skincare brief/i)).toBeInTheDocument();
    });

    // Check model provenance
    expect(screen.getByText(/sentence-transformers\/all-MiniLM-L6-v2/i)).toBeInTheDocument();
  });

  it('triggers view profile callback when button is clicked', async () => {
    (api.recommendations.matchBrief as any).mockResolvedValue(mockMatchResponse);
    const mockOnViewProfile = vi.fn();

    render(
      <AICampaignBriefMatcher
        onViewProfile={mockOnViewProfile}
        onToggleShortlist={vi.fn()}
        isCreatorShortlisted={() => false}
      />
    );

    fireEvent.click(screen.getByText('Clean Skincare Launch'));
    fireEvent.click(screen.getByRole('button', { name: /Match Influencers with AI/i }));

    await waitFor(() => {
      expect(screen.getByText('Claire Wellness')).toBeInTheDocument();
    });

    const viewProfileBtn = screen.getByRole('button', { name: /View Profile/i });
    fireEvent.click(viewProfileBtn);

    expect(mockOnViewProfile).toHaveBeenCalledWith(mockCreator);
  });

  it('displays clear error alert without fake data when AI service fails', async () => {
    (api.recommendations.matchBrief as any).mockRejectedValue(
      new Error('Sentence-Transformers embedding model is unavailable.')
    );

    render(
      <AICampaignBriefMatcher
        onViewProfile={vi.fn()}
        onToggleShortlist={vi.fn()}
        isCreatorShortlisted={() => false}
      />
    );

    fireEvent.click(screen.getByText('Clean Skincare Launch'));
    fireEvent.click(screen.getByRole('button', { name: /Match Influencers with AI/i }));

    await waitFor(() => {
      expect(screen.getByText(/Sentence-Transformers embedding model is unavailable/i)).toBeInTheDocument();
    });

    // Ensure no fake recommendations are rendered
    expect(screen.queryByText('Claire Wellness')).not.toBeInTheDocument();
  });
});

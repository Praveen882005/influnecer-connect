import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RichInfluencerProfileModal } from '../components/RichInfluencerProfileModal';
import type { CreatorProfile } from '../types';

const mockCompleteCreator: CreatorProfile = {
  id: 1,
  user_id: 10,
  handle: '@tech_marcus',
  display_name: 'Marcus Chen',
  bio: 'Engineering and developer tools reviewer.',
  primary_niche: 'Tech & AI',
  secondary_niches: ['Smartphones', 'AI'],
  platforms: {
    youtube: { followers: 490000, avg_views: 145000 },
  },
  total_followers: 490000,
  avg_engagement_rate: 3.8,
  authenticity_score: 94.5,
  sample_content_keywords: ['tech', 'ai'],
  is_verified: true,
  is_platform_verified: true,
  profile_url: 'https://youtube.com/@tech_marcus',
  audience_description: 'Software engineers and AI practitioners',
  avg_likes: 18500,
  avg_comments: 1240,
  avg_views: 145000,
  brand_suitability: {
    safety_level: 'brand_safe',
    sponsored_content_ratio: 0.18,
    family_friendly: true,
    notes: 'Strict editorial standards',
  },
  content_categories: ['Consumer Electronics', 'Developer Tools'],
  past_campaigns_count: 14,
  on_time_delivery_rate: 96.5,
  delivery_history: [
    { campaign_title: 'AI Dev Launch', brand_name: 'DevCorp', status: 'COMPLETED', on_time: true, completed_at: '2026-09-15' },
  ],
  audience_demographics: {
    top_countries: ['US', 'CA', 'UK'],
    age_split: { '18-24': 45.0, '25-34': 35.0 },
    gender_split: { male: 68.0, female: 32.0 },
  },
  created_at: '2026-10-22T00:00:00Z',
  updated_at: '2026-10-24T00:00:00Z',
};

const mockSparseCreator: CreatorProfile = {
  id: 2,
  user_id: 11,
  handle: '@sparse_sora',
  display_name: 'Sora Minimal',
  bio: 'Minimalist designer.',
  primary_niche: 'Fashion',
  secondary_niches: [],
  platforms: {},
  total_followers: 12000,
  avg_engagement_rate: 2.1,
  authenticity_score: 91.0,
  sample_content_keywords: [],
  is_verified: false,
  profile_url: null,
  audience_description: null,
  avg_likes: null,
  avg_comments: null,
  avg_views: null,
  on_time_delivery_rate: null,
  past_campaigns_count: 0,
  delivery_history: [],
  audience_demographics: {},
  created_at: '2026-10-22T00:00:00Z',
  updated_at: '2026-10-24T00:00:00Z',
};

describe('RichInfluencerProfileModal Component', () => {
  it('renders complete creator info and overview tabs', () => {
    render(
      <RichInfluencerProfileModal
        creator={mockCompleteCreator}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Marcus Chen')).toBeInTheDocument();
    expect(screen.getByText('@tech_marcus')).toBeInTheDocument();
    expect(screen.getByText('Verified Creator')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View Portfolio/i })).toHaveAttribute('href', 'https://youtube.com/@tech_marcus');
    expect(screen.getByText('Consumer Electronics')).toBeInTheDocument();
    expect(screen.getByText('Developer Tools')).toBeInTheDocument();
  });

  it('navigates to Audience Insights and renders demographics and description', () => {
    render(
      <RichInfluencerProfileModal
        creator={mockCompleteCreator}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Audience Insights/i }));

    expect(screen.getByText('Software engineers and AI practitioners')).toBeInTheDocument();
    expect(screen.getByText('US')).toBeInTheDocument();
    expect(screen.getByText('45.0%')).toBeInTheDocument();
    expect(screen.getByText('68.0%')).toBeInTheDocument();
  });

  it('navigates to Performance Matrix and renders verified metrics', () => {
    render(
      <RichInfluencerProfileModal
        creator={mockCompleteCreator}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Performance Matrix/i }));

    expect(screen.getByText(/Audience Followers/i)).toBeInTheDocument();
    expect(screen.getByText('3.8%')).toBeInTheDocument();
    expect(screen.getByText(/Average Likes/i)).toBeInTheDocument();
    expect(screen.getByText(/Average Views/i)).toBeInTheDocument();
    expect(screen.getAllByText(/1.*45.*000/).length).toBeGreaterThanOrEqual(1);
  });

  it('displays Unmonitored / Unavailable for missing metrics instead of fake values', () => {
    render(
      <RichInfluencerProfileModal
        creator={mockSparseCreator}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Performance Matrix/i }));

    const unmonitoredItems = screen.getAllByText('Unmonitored');
    expect(unmonitoredItems.length).toBeGreaterThanOrEqual(2);

    fireEvent.click(screen.getByRole('button', { name: /Audience Insights/i }));
    expect(screen.getByText(/Detailed qualitative audience persona has not been submitted/i)).toBeInTheDocument();
  });

  it('navigates to Trust & Verification and renders authenticity score and delivery rate', () => {
    render(
      <RichInfluencerProfileModal
        creator={mockCompleteCreator}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Trust & Verification/i }));

    expect(screen.getByText('94.5/100')).toBeInTheDocument();
    expect(screen.getByText('14')).toBeInTheDocument();
    expect(screen.getByText('96.5%')).toBeInTheDocument();
    expect(screen.getByText('AI Dev Launch')).toBeInTheDocument();
    expect(screen.getAllByText('On-Time Delivery').length).toBeGreaterThanOrEqual(1);
  });
});

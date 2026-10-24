import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FraudRiskAnalyzer } from '../components/FraudRiskAnalyzer';
import { api } from '../api';
import type { FraudAnalysisReport } from '../types';

vi.mock('../api', () => ({
  api: {
    fraud: {
      search: vi.fn(),
      getReport: vi.fn(),
    },
  },
}));

const mockReport: FraudAnalysisReport = {
  creator_id: 101,
  handle: '@tech_gadget_reviews',
  display_name: 'Tech Reviews Official',
  profile_url: 'https://youtube.com/@tech_gadget_reviews',
  total_followers: 95000,
  avatar_url: null,
  overall_risk_level: 'low_observed_risk',
  risk_score: 12.0,
  evidence_coverage_pct: 100.0,
  observed_facts: [
    {
      fact_key: 'follower_count',
      label: 'Total Follower Count',
      value: '95,000',
      details: 'Recorded audience scale in verified platform catalog.',
      source: 'YouTube Data API',
    },
    {
      fact_key: 'following_count',
      label: 'Following Account Count',
      value: '520',
      details: 'Creator follows 520 other profiles.',
      source: 'YouTube Data API',
    },
    {
      fact_key: 'sample_post_history',
      label: 'Sample Post Catalog',
      value: '12 posts',
      details: 'Sample contains 12 ingested posts for metric verification.',
      source: 'Ingestion Pipeline',
    },
  ],
  calculated_indicators: [
    {
      indicator_key: 'like_to_comment_ratio',
      display_name: 'Like-to-Comment Interaction Ratio',
      formula: 'likes / max(1, comments)',
      observed_value: '24.5 : 1',
      benchmark: '10:1 to 45:1',
      is_outlier: false,
    },
    {
      indicator_key: 'follower_following_ratio',
      display_name: 'Follower-to-Following Scale Ratio',
      formula: 'followers / max(1, following)',
      observed_value: '182.7 : 1',
      benchmark: '>= 5:1',
      is_outlier: false,
    },
  ],
  anomaly_warnings: [
    {
      anomaly_key: 'like_comment_asymmetry',
      category: 'engagement_anomaly',
      display_name: 'Like-to-Comment Balance',
      status: 'normal',
      status_label: 'Balanced Organic Ratio',
      observed_finding: 'Interaction balance between likes and comments is within healthy organic boundaries (24.5:1).',
      evidence: { ratio: 24.5, comments: 85, likes: 2100 },
      limitations: 'Video content typically yields lower comment ratios than text discussions.',
      recommended_manual_checks: [
        'Inspect comments on top-performing videos for contextual relevancy.',
      ],
    },
    {
      anomaly_key: 'growth_velocity',
      category: 'growth_velocity',
      display_name: 'Follower Growth Velocity',
      status: 'normal',
      status_label: 'Organic Growth Trajectory',
      observed_finding: 'Follower growth exhibits steady linear momentum across historical snapshots.',
      evidence: { snapshots: 4 },
      limitations: 'Viral videos can produce genuine sudden follower spikes.',
      recommended_manual_checks: [],
    },
  ],
  recommended_actions: [
    'Account exhibits healthy organic performance characteristics.',
    'Proceed with standard campaign invitation and deliverable contracting.',
  ],
  manual_verification_checklist: [
    'Inspect the last 10 post comment threads for meaningful conversational context vs 1-word generic spam.',
    'Request a 30-day screenshot from the creator native platform dashboard.',
    'Verify active Story view reach (healthy organic accounts typically average 3% to 8%).',
  ],
  disclaimer: 'RISK INDICATOR NOTICE: Signals represent review heuristics to assist human marketers, NOT definitive proof of fraud.',
  ml_classifier_status: 'SUPERVISED_CLASSIFIER_STATUS: Withheld pending audited ground-truth dataset.',
  data_freshness_status: 'fresh',
  analyzed_at: '2026-10-24T12:00:00Z',
};

describe('FraudRiskAnalyzer Component (Phase 7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders search input and quick audit samples', () => {
    render(<FraudRiskAnalyzer />);
    expect(screen.getByPlaceholderText(/Enter handle/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Run Audit/i })).toBeInTheDocument();
    expect(screen.getByText(/@tech_gadget_reviews/i)).toBeInTheDocument();
  });

  it('executes search by handle and renders risk index hero card', async () => {
    (api.fraud.search as any).mockResolvedValue(mockReport);

    render(<FraudRiskAnalyzer />);

    const input = screen.getByPlaceholderText(/Enter handle/i);
    fireEvent.change(input, { target: { value: '@tech_gadget_reviews' } });

    const submitBtn = screen.getByRole('button', { name: /Run Audit/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.fraud.search).toHaveBeenCalledWith('@tech_gadget_reviews', undefined);
    });

    expect(await screen.findByText('Tech Reviews Official')).toBeInTheDocument();
    expect(screen.getByText('Low Observed Risk')).toBeInTheDocument();
    expect(screen.getByText('12/100')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText(/RISK INDICATOR NOTICE/i)).toBeInTheDocument();
    expect(screen.getByText(/SUPERVISED_CLASSIFIER_STATUS: Withheld/i)).toBeInTheDocument();
  });

  it('navigates subtabs and displays facts, indicators and anomalies', async () => {
    (api.fraud.getReport as any).mockResolvedValue(mockReport);

    render(<FraudRiskAnalyzer initialCreatorId={101} />);

    expect(await screen.findByText('Tech Reviews Official')).toBeInTheDocument();

    // Default tab: Anomaly signals
    expect(screen.getByText('Like-to-Comment Balance')).toBeInTheDocument();
    expect(screen.getByText(/Balanced Organic Ratio/i)).toBeInTheDocument();

    // Switch to Facts & Indicators tab
    const factsTab = screen.getByRole('button', { name: /Facts & Ratios/i });
    fireEvent.click(factsTab);

    expect(screen.getByText(/Empirical Observed Facts/i)).toBeInTheDocument();
    expect(screen.getByText('Total Follower Count')).toBeInTheDocument();
    expect(screen.getByText('Like-to-Comment Interaction Ratio')).toBeInTheDocument();
    expect(screen.getByText('24.5 : 1')).toBeInTheDocument();

    // Switch to Checklist tab
    const checklistTab = screen.getByRole('button', { name: /Marketer Verification Checklist/i });
    fireEvent.click(checklistTab);

    expect(screen.getByText(/Human Marketer Verification Checklist/i)).toBeInTheDocument();
    const checkItem = screen.getByText(/Inspect the last 10 post comment threads/i);
    expect(checkItem).toBeInTheDocument();

    // Toggle checklist checkbox
    fireEvent.click(checkItem);
    expect(screen.getByText(/1 \/ 3 Completed/i)).toBeInTheDocument();
  });

  it('handles insufficient evidence state without penalizing creator', async () => {
    const insufficientReport: FraudAnalysisReport = {
      ...mockReport,
      overall_risk_level: 'insufficient_evidence',
      risk_score: null,
      evidence_coverage_pct: 20.0,
      anomaly_warnings: [
        {
          anomaly_key: 'growth_velocity',
          category: 'growth_velocity',
          display_name: 'Follower Growth Velocity',
          status: 'insufficient_evidence',
          status_label: 'Insufficient Historical Snapshots',
          observed_finding: 'Account has fewer than 2 timestamped historical growth snapshots in database.',
          evidence: {},
          limitations: 'New creators require time to accumulate longitudinal telemetry.',
          recommended_manual_checks: ['Verify live profile metrics via native sync.'],
        },
      ],
    };

    (api.fraud.getReport as any).mockResolvedValue(insufficientReport);

    render(<FraudRiskAnalyzer initialCreatorId={202} />);

    expect((await screen.findAllByText(/Insufficient Evidence/i)).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('N/A')).toBeInTheDocument();
    expect(screen.getByText(/Insufficient Historical Data/i)).toBeInTheDocument();
    expect(screen.getByText(/fewer than 2 timestamped historical growth snapshots/i)).toBeInTheDocument();
  });
});

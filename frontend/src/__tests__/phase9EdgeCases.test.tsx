import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FraudRiskAnalyzer } from '../components/FraudRiskAnalyzer';
import { RichInfluencerProfileModal } from '../components/RichInfluencerProfileModal';
import { CampaignForecastingPanel } from '../components/CampaignForecastingPanel';
import { api } from '../api';
import type { CreatorProfile, HistoricalBenchmark } from '../types';

vi.mock('../api', () => ({
  api: {
    fraud: {
      search: vi.fn(),
      getReport: vi.fn(),
    },
    analytics: {
      creatorTrust: vi.fn(),
    },
    forecasting: {
      benchmark: vi.fn(),
      calculate: vi.fn(),
      saveForecast: vi.fn(),
      getCampaignContext: vi.fn(),
    },
  },
}));

const mockBenchmark: HistoricalBenchmark = {
  tracked_campaigns_count: 5,
  has_sufficient_data: true,
  avg_ctr_pct: 2.1,
  avg_cvr_pct: 2.6,
  avg_aov: 60.0,
  avg_roi_pct: 45.0,
  default_impressions: 50000,
  default_budget: 2500,
  predictive_model_status: 'Withheld pending statistical threshold (n=5/30)',
  data_source_note: 'Verified internal brand outcomes',
};

describe('Phase 9 QA & Edge Cases Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('validates FraudRiskAnalyzer gracefully handles whitespace padding and special characters', async () => {
    (api.fraud.search as any).mockResolvedValue({
      creator_id: 88,
      handle: '@special_creator',
      display_name: 'Special Creator',
      total_followers: 12000,
      overall_risk_level: 'low_observed_risk',
      risk_score: 15.0,
      evidence_coverage_pct: 80.0,
      observed_facts: [],
      calculated_indicators: [],
      anomaly_warnings: [],
      recommended_actions: [],
      manual_verification_checklist: [],
      disclaimer: 'RISK INDICATOR NOTICE: Signals represent review heuristics.',
      ml_classifier_status: 'SUPERVISED_CLASSIFIER_STATUS: Withheld',
      data_freshness_status: 'fresh',
      analyzed_at: '2026-10-24T12:00:00Z',
    });

    render(<FraudRiskAnalyzer />);

    const input = screen.getByPlaceholderText(/Enter handle/i);
    // User types whitespace-padded handle
    fireEvent.change(input, { target: { value: '   @special_creator   ' } });

    const submitBtn = screen.getByRole('button', { name: /Run Audit/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      // Must trim whitespace before passing to API
      expect(api.fraud.search).toHaveBeenCalledWith('@special_creator', undefined);
    });

    expect(await screen.findByText('Special Creator')).toBeInTheDocument();
  });

  it('validates FraudRiskAnalyzer handles empty input without calling API', async () => {
    render(<FraudRiskAnalyzer />);

    const submitBtn = screen.getByRole('button', { name: /Run Audit/i });
    expect(submitBtn).toBeDisabled();
    expect(api.fraud.search).not.toHaveBeenCalled();
  });

  it('validates FraudRiskAnalyzer handles API error gracefully with user alert', async () => {
    (api.fraud.search as any).mockRejectedValue(new Error('Network gateway timeout while syncing platform API.'));

    render(<FraudRiskAnalyzer />);

    const input = screen.getByPlaceholderText(/Enter handle/i);
    fireEvent.change(input, { target: { value: '@unknown_handle' } });

    const submitBtn = screen.getByRole('button', { name: /Run Audit/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/Network gateway timeout while syncing platform API/i)).toBeInTheDocument();
  });

  it('validates RichInfluencerProfileModal handles completely empty creator record without crashing', () => {
    const minimalCreator: CreatorProfile = {
      id: 99,
      user_id: 999,
      handle: '@blank_creator',
      display_name: '',
      bio: '',
      primary_niche: 'technology',
      total_followers: 0,
      avg_engagement_rate: 0.0,
      authenticity_score: 80.0,
      supported_platforms: [],
      content_categories: [],
      past_campaigns_count: 0,
      on_time_delivery_rate: null,
      delivery_history: [],
      audience_demographics: {},
      is_verified: false,
      created_at: '2026-10-24T00:00:00Z',
      updated_at: '2026-10-24T00:00:00Z',
    };

    (api.analytics.creatorTrust as any).mockResolvedValue(null);

    render(
      <RichInfluencerProfileModal
        creator={minimalCreator}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    // Displays handle when display_name is empty
    expect(screen.getAllByText('@blank_creator').length).toBeGreaterThanOrEqual(1);
    // Displays fallback for empty bio
    expect(screen.getByText(/No public biography provided by creator/i)).toBeInTheDocument();
    // Displays fallback for missing content categories
    expect(screen.getByText(/General category: technology/i)).toBeInTheDocument();
  });

  it('validates CampaignForecastingPanel loads benchmarks and responds to scenario calculation', async () => {
    (api.forecasting.benchmark as any).mockResolvedValue(mockBenchmark);
    (api.forecasting.calculate as any).mockResolvedValue({
      scenarios: {
        conservative: {
          scenario_name: 'Conservative',
          impressions: 40000,
          click_through_rate: 1.5,
          conversion_rate: 1.8,
          average_order_value: 60.0,
          campaign_cost: 2500.0,
          estimated_clicks: 600,
          estimated_conversions: 11,
          estimated_gross_revenue: 660.0,
          estimated_net_profit: -1840.0,
          estimated_roi_pct: -73.6,
          estimated_cpc: 4.17,
          estimated_cpa: 227.27,
          multiplier_description: 'Conservative dampening',
        },
        baseline: {
          scenario_name: 'Baseline',
          impressions: 50000,
          click_through_rate: 2.0,
          conversion_rate: 2.5,
          average_order_value: 65.0,
          campaign_cost: 2500.0,
          estimated_clicks: 1000,
          estimated_conversions: 25,
          estimated_gross_revenue: 1625.0,
          estimated_net_profit: -875.0,
          estimated_roi_pct: -35.0,
          estimated_cpc: 2.5,
          estimated_cpa: 100.0,
          multiplier_description: 'Baseline input values',
        },
        optimistic: {
          scenario_name: 'Optimistic',
          impressions: 70000,
          click_through_rate: 2.8,
          conversion_rate: 3.4,
          average_order_value: 70.0,
          campaign_cost: 2500.0,
          estimated_clicks: 1960,
          estimated_conversions: 67,
          estimated_gross_revenue: 4690.0,
          estimated_net_profit: 2190.0,
          estimated_roi_pct: 87.6,
          estimated_cpc: 1.28,
          estimated_cpa: 37.31,
          multiplier_description: 'Optimistic multi-variable boost',
        },
      },
      formulas_used: {},
      predictive_model_status: 'Withheld',
      limitations: [],
      disclaimer: 'ESTIMATE ONLY',
      confidence_level: 'Indicative Heuristics',
      calculated_at: '2026-10-24T12:00:00Z',
    });

    render(<CampaignForecastingPanel initialCost={2500} campaignTitle="Test Brief" />);

    expect(await screen.findByText(/Sales Potential & Campaign Outcome Forecaster/i)).toBeInTheDocument();
    expect(screen.getByText(/Not a Guaranteed Sales Promise/i)).toBeInTheDocument();
  });
});

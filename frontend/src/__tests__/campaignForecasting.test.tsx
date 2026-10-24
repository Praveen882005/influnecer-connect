import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CampaignForecastingPanel } from '../components/CampaignForecastingPanel';
import { api } from '../api';
import type {
  CampaignActualOutcome,
  CampaignForecast,
  CampaignForecastingBundle,
  ForecastCalculationResponse,
} from '../types';

vi.mock('../api', () => ({
  api: {
    forecasting: {
      calculate: vi.fn(),
      benchmark: vi.fn(),
      getCampaignContext: vi.fn(),
      saveForecast: vi.fn(),
      recordActualOutcome: vi.fn(),
      listForecasts: vi.fn(),
    },
  },
}));

vi.mock('../api/client', () => ({
  api: {
    forecasting: {
      calculate: vi.fn(),
      benchmark: vi.fn(),
      getCampaignContext: vi.fn(),
      saveForecast: vi.fn(),
      recordActualOutcome: vi.fn(),
      listForecasts: vi.fn(),
    },
  },
}));

const mockCalculationResponse: ForecastCalculationResponse = {
  campaign_id: 10,
  campaign_title: 'Eco Hydration Launch',
  source_data_origin: 'user_assumptions',
  confidence_level: 'Indicative Scenario Model (Transparent Heuristics)',
  disclaimer: 'ESTIMATE / ALGORITHMIC PROJECTION ONLY — NOT A GUARANTEED SALES PROMISE.',
  limitations: [
    'Organic algorithm distribution changes',
    'Audience creative resonance',
    'Conversion funnel friction',
  ],
  formulas_used: {
    'Estimated Clicks': 'impressions × (click_through_rate / 100)',
    'Estimated Conversions': 'clicks × (conversion_rate / 100)',
    'Estimated Gross Revenue': 'conversions × average_order_value',
    'Estimated ROI (%)': '((gross revenue − campaign cost) / campaign cost) × 100',
  },
  predictive_model_status: 'INSUFFICIENT_HISTORICAL_DATA: n=2 (minimum n=30 required).',
  assumptions: {
    impressions: 50000,
    click_through_rate: 2.0,
    conversion_rate: 2.5,
    average_order_value: 65.0,
    campaign_cost: 2500.0,
  },
  scenarios: {
    conservative: {
      scenario_name: 'Conservative',
      multiplier_description: 'Conservative stress-test: -25% reach, -30% CTR, -30% CVR, -10% AOV',
      impressions: 37500,
      click_through_rate: 1.4,
      conversion_rate: 1.75,
      average_order_value: 58.5,
      campaign_cost: 2500.0,
      estimated_clicks: 525,
      estimated_conversions: 9,
      estimated_gross_revenue: 526.5,
      estimated_net_profit: -1973.5,
      estimated_roi_pct: -78.94,
      estimated_cpc: 4.76,
      estimated_cpa: 277.78,
    },
    baseline: {
      scenario_name: 'Baseline',
      multiplier_description: 'Baseline scenario: 1.0× baseline assumptions',
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
    },
    optimistic: {
      scenario_name: 'Optimistic',
      multiplier_description: 'Optimistic high-resonance: +25% reach, +30% CTR, +30% CVR, +10% AOV',
      impressions: 62500,
      click_through_rate: 2.6,
      conversion_rate: 3.25,
      average_order_value: 71.5,
      campaign_cost: 2500.0,
      estimated_clicks: 1625,
      estimated_conversions: 53,
      estimated_gross_revenue: 3789.5,
      estimated_net_profit: 1289.5,
      estimated_roi_pct: 51.58,
      estimated_cpc: 1.54,
      estimated_cpa: 47.17,
    },
  },
  calculated_at: '2026-10-24T12:00:00Z',
};

const mockBundle: CampaignForecastingBundle = {
  campaign_id: 10,
  campaign_title: 'Eco Hydration Launch',
  campaign_budget: 2500.0,
  currency: 'USD',
  suggested_assumptions: {
    impressions: 50000,
    click_through_rate: 2.0,
    conversion_rate: 2.5,
    average_order_value: 65.0,
    campaign_cost: 2500.0,
  },
  forecasts: [],
  actual_outcome: null,
  variance_analysis: null,
  historical_benchmark: {
    tracked_campaigns_count: 2,
    has_sufficient_data: false,
    avg_ctr_pct: 2.1,
    avg_cvr_pct: 2.4,
    avg_aov: 68.0,
    avg_roi_pct: 32.0,
    default_impressions: 50000,
    default_budget: 2500.0,
    predictive_model_status: 'INSUFFICIENT_HISTORICAL_DATA: n=2 < 30',
    data_source_note: 'Brand historical actuals',
  },
};

describe('CampaignForecastingPanel Component (Phase 5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.forecasting.getCampaignContext as any).mockResolvedValue(mockBundle);
    (api.forecasting.calculate as any).mockResolvedValue(mockCalculationResponse);
    (api.forecasting.saveForecast as any).mockResolvedValue({
      id: 1,
      campaign_id: 10,
      brand_id: 1,
      forecast_name: 'Launch Pre-Flight Forecast',
      source_data_origin: 'user_assumptions',
      impressions: 50000,
      click_through_rate: 2.0,
      conversion_rate: 2.5,
      average_order_value: 65.0,
      campaign_cost: 2500.0,
      conservative_projection: mockCalculationResponse.scenarios.conservative,
      baseline_projection: mockCalculationResponse.scenarios.baseline,
      optimistic_projection: mockCalculationResponse.scenarios.optimistic,
      created_at: '2026-10-24T12:00:00Z',
      updated_at: '2026-10-24T12:00:00Z',
    } as CampaignForecast);
  });

  it('renders forecasting title, disclaimer notice, and benchmark presets', async () => {
    render(<CampaignForecastingPanel campaignId={10} initialCost={2500} campaignTitle="Eco Hydration Launch" />);

    await waitFor(() => {
      expect(
        screen.getByText(/Sales Potential & Campaign Outcome Forecaster/i)
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Heuristic Projection Notice — Not a Guaranteed Sales Promise/i)
    ).toBeInTheDocument();

    expect(screen.getByText(/E-Commerce Baseline/i)).toBeInTheDocument();
    expect(screen.getByText(/High-AOV Luxury \/ Tech/i)).toBeInTheDocument();
  });

  it('displays the three scenario projections (Conservative, Baseline, Optimistic)', async () => {
    render(<CampaignForecastingPanel campaignId={10} initialCost={2500} campaignTitle="Eco Hydration Launch" />);

    await waitFor(() => {
      expect(screen.getByText('Conservative')).toBeInTheDocument();
      expect(screen.getByText('Baseline')).toBeInTheDocument();
      expect(screen.getByText('Optimistic')).toBeInTheDocument();
    });

    // Check baseline numbers rendered
    expect(screen.getByText(/1,000 clicks/i)).toBeInTheDocument();
    expect(screen.getByText(/25 orders/i)).toBeInTheDocument();
    expect(screen.getByText('$1,625.00')).toBeInTheDocument();
  });

  it('reveals transparent calculation methodology when accordion is toggled', async () => {
    render(<CampaignForecastingPanel campaignId={10} initialCost={2500} campaignTitle="Eco Hydration Launch" />);

    await waitFor(() => {
      expect(screen.getByText(/Transparent Calculation Methodology/i)).toBeInTheDocument();
    });

    const methodToggle = screen.getByText(/Transparent Calculation Methodology/i);
    fireEvent.click(methodToggle);

    expect(screen.getByText(/Clicks = Impressions × \(CTR \/ 100\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Conversions = Clicks × \(Conversion Rate \/ 100\)/i)).toBeInTheDocument();
  });

  it('saves forecast snapshot when button is clicked', async () => {
    const handleSaved = vi.fn();
    render(
      <CampaignForecastingPanel
        campaignId={10}
        initialCost={2500}
        campaignTitle="Eco Hydration Launch"
        onForecastSaved={handleSaved}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Save Forecast Snapshot to Campaign/i })).toBeInTheDocument();
    });

    const saveButton = screen.getByRole('button', { name: /Save Forecast Snapshot to Campaign/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(api.forecasting.saveForecast).toHaveBeenCalledWith(
        10,
        expect.objectContaining({
          impressions: 50000,
          campaign_cost: 2500,
        })
      );
    });
  });

  it('switches to Verified Actuals tab and allows recording post-campaign outcome', async () => {
    render(<CampaignForecastingPanel campaignId={10} initialCost={2500} campaignTitle="Eco Hydration Launch" />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Verified Actuals & Variance Audit/i })).toBeInTheDocument();
    });

    const actualsTab = screen.getByRole('button', { name: /Verified Actuals & Variance Audit/i });
    fireEvent.click(actualsTab);

    expect(screen.getByText(/Verified Post-Campaign Actual Results/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Google Analytics 4 \/ Shopify Pixel/i)).toBeInTheDocument();
  });
});

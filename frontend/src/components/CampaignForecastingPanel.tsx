import React, { useEffect, useState } from 'react';
import { api } from '../api';
import {
  Alert,
  Badge,
  Button,
  Card,
  Icon,
} from '../design-system';
import type {
  CampaignActualOutcome,
  CampaignForecast,
  CampaignForecastingBundle,
  ForecastAssumptionsInput,
  ForecastCalculationResponse,
  HistoricalBenchmark,
  ScenarioProjection,
} from '../types';

interface CampaignForecastingPanelProps {
  campaignId?: number;
  initialCost?: number;
  campaignTitle?: string;
  onForecastSaved?: (forecast: CampaignForecast) => void;
  className?: string;
}

const PRESET_TEMPLATES = [
  {
    name: 'E-Commerce Baseline',
    desc: 'Moderate mass-market consumer goods',
    assumptions: {
      impressions: 60000,
      click_through_rate: 2.0,
      conversion_rate: 2.5,
      average_order_value: 55.0,
      costMultiplier: 1.0,
    },
  },
  {
    name: 'High-AOV Luxury / Tech',
    desc: 'Premium price point, selective buyers',
    assumptions: {
      impressions: 35000,
      click_through_rate: 1.2,
      conversion_rate: 1.4,
      average_order_value: 185.0,
      costMultiplier: 1.2,
    },
  },
  {
    name: 'Viral Impulse / Fast-Fashion',
    desc: 'High viral engagement, quick impulse conversion',
    assumptions: {
      impressions: 110000,
      click_through_rate: 3.2,
      conversion_rate: 3.5,
      average_order_value: 32.0,
      costMultiplier: 0.9,
    },
  },
];

export const CampaignForecastingPanel: React.FC<CampaignForecastingPanelProps> = ({
  campaignId,
  initialCost = 2500,
  campaignTitle = 'Product Campaign',
  onForecastSaved,
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState<'simulator' | 'actuals'>('simulator');

  // Input Assumptions State
  const [impressions, setImpressions] = useState<number>(50000);
  const [ctr, setCtr] = useState<number>(2.0);
  const [cvr, setCvr] = useState<number>(2.5);
  const [aov, setAov] = useState<number>(65.0);
  const [cost, setCost] = useState<number>(initialCost);
  const [forecastName, setForecastName] = useState<string>(`Forecast - ${campaignTitle}`);
  const [notes, setNotes] = useState<string>('');

  // Bundle, Benchmark, & Results State
  const [loadingContext, setLoadingContext] = useState<boolean>(false);
  const [calculating, setCalculating] = useState<boolean>(false);
  const [forecastResult, setForecastResult] = useState<ForecastCalculationResponse | null>(null);
  const [contextBundle, setContextBundle] = useState<CampaignForecastingBundle | null>(null);
  const [benchmark, setBenchmark] = useState<HistoricalBenchmark | null>(null);
  const [dataSource, setDataSource] = useState<string>('user_assumptions');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [isSavingForecast, setIsSavingForecast] = useState<boolean>(false);

  // Accordion Toggles
  const [showFormulas, setShowFormulas] = useState<boolean>(false);
  const [showLimitations, setShowLimitations] = useState<boolean>(false);

  // Actual Outcome Logging State
  const [actualImpressions, setActualImpressions] = useState<string>('');
  const [actualClicks, setActualClicks] = useState<string>('');
  const [actualConversions, setActualConversions] = useState<string>('');
  const [actualGrossRevenue, setActualGrossRevenue] = useState<string>('');
  const [actualSpend, setActualSpend] = useState<string>(String(initialCost));
  const [attributionProvider, setAttributionProvider] = useState<string>('Google Analytics 4 & UTMs');
  const [actualNotes, setActualNotes] = useState<string>('');
  const [isSavingActual, setIsSavingActual] = useState<boolean>(false);
  const [actualOutcome, setActualOutcome] = useState<CampaignActualOutcome | null>(null);

  // Load context from backend if campaignId provided
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      setLoadingContext(true);
      setErrorMessage(null);
      try {
        if (campaignId) {
          const bundle = await api.forecasting.getCampaignContext(campaignId);
          if (!isMounted) return;
          setContextBundle(bundle);
          setBenchmark(bundle.historical_benchmark);

          // Preload suggested assumptions
          if (bundle.suggested_assumptions) {
            setImpressions(bundle.suggested_assumptions.impressions);
            setCtr(bundle.suggested_assumptions.click_through_rate);
            setCvr(bundle.suggested_assumptions.conversion_rate);
            setAov(bundle.suggested_assumptions.average_order_value);
            setCost(bundle.suggested_assumptions.campaign_cost);
            setDataSource(bundle.historical_benchmark.tracked_campaigns_count > 0 ? 'brand_historical' : 'platform_benchmark');
          }

          if (bundle.actual_outcome) {
            setActualOutcome(bundle.actual_outcome);
            setActualImpressions(bundle.actual_outcome.actual_impressions ? String(bundle.actual_outcome.actual_impressions) : '');
            setActualClicks(bundle.actual_outcome.actual_clicks ? String(bundle.actual_outcome.actual_clicks) : '');
            setActualConversions(bundle.actual_outcome.actual_conversions ? String(bundle.actual_outcome.actual_conversions) : '');
            setActualGrossRevenue(bundle.actual_outcome.actual_gross_revenue ? String(bundle.actual_outcome.actual_gross_revenue) : '');
            setActualSpend(bundle.actual_outcome.actual_spend ? String(bundle.actual_outcome.actual_spend) : String(bundle.campaign_budget));
            setAttributionProvider(bundle.actual_outcome.attribution_provider || 'Google Analytics 4 & UTMs');
            setActualNotes(bundle.actual_outcome.notes || '');
          }
        } else {
          // Fetch benchmark only for standalone simulator
          const bm = await api.forecasting.benchmark().catch(() => null);
          if (isMounted && bm) {
            setBenchmark(bm);
            if (bm.avg_ctr_pct) setCtr(bm.avg_ctr_pct);
            if (bm.avg_cvr_pct) setCvr(bm.avg_cvr_pct);
            if (bm.avg_aov) setAov(bm.avg_aov);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorMessage(err.message || 'Failed to initialize forecasting context.');
        }
      } finally {
        if (isMounted) setLoadingContext(false);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [campaignId]);

  // Recalculate projections on assumption changes (debounced)
  useEffect(() => {
    let isCancelled = false;

    const runCalculation = async () => {
      if (impressions <= 0 || cost <= 0 || aov <= 0) return;
      setCalculating(true);
      try {
        const payload: ForecastAssumptionsInput = {
          impressions: Number(impressions),
          click_through_rate: Number(ctr),
          conversion_rate: Number(cvr),
          average_order_value: Number(aov),
          campaign_cost: Number(cost),
          forecast_name: forecastName,
          notes,
        };

        const res = await api.forecasting.calculate(payload, campaignId);
        if (!isCancelled) {
          setForecastResult(res);
        }
      } catch (err: any) {
        if (!isCancelled) {
          setErrorMessage(err.message || 'Failed to calculate scenario projections.');
        }
      } finally {
        if (!isCancelled) setCalculating(false);
      }
    };

    const timer = setTimeout(runCalculation, 250);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [impressions, ctr, cvr, aov, cost, campaignId]);

  // Handle Preset selection
  const handleApplyPreset = (preset: typeof PRESET_TEMPLATES[0]) => {
    setImpressions(preset.assumptions.impressions);
    setCtr(preset.assumptions.click_through_rate);
    setCvr(preset.assumptions.conversion_rate);
    setAov(preset.assumptions.average_order_value);
    setCost(Math.round(initialCost * preset.assumptions.costMultiplier));
    setDataSource('user_assumptions');
  };

  // Handle Apply Brand Historical Benchmark
  const handleApplyHistorical = () => {
    if (!benchmark) return;
    if (benchmark.avg_ctr_pct) setCtr(benchmark.avg_ctr_pct);
    if (benchmark.avg_cvr_pct) setCvr(benchmark.avg_cvr_pct);
    if (benchmark.avg_aov) setAov(benchmark.avg_aov);
    setCost(initialCost);
    setDataSource('brand_historical');
  };

  // Handle Save Forecast
  const handleSaveForecast = async () => {
    if (!campaignId) return;
    setIsSavingForecast(true);
    setSaveSuccessMessage(null);
    setErrorMessage(null);
    try {
      const payload: ForecastAssumptionsInput = {
        impressions: Number(impressions),
        click_through_rate: Number(ctr),
        conversion_rate: Number(cvr),
        average_order_value: Number(aov),
        campaign_cost: Number(cost),
        forecast_name: forecastName,
        notes,
      };

      const saved = await api.forecasting.saveForecast(campaignId, payload);
      setSaveSuccessMessage(`Forecast "${saved.forecast_name}" successfully recorded with conservative, baseline, and optimistic projections.`);
      if (onForecastSaved) onForecastSaved(saved);

      // Refresh bundle
      const refreshed = await api.forecasting.getCampaignContext(campaignId);
      setContextBundle(refreshed);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save forecast snapshot.');
    } finally {
      setIsSavingForecast(false);
    }
  };

  // Handle Save Actual Outcome
  const handleSaveActualOutcome = async () => {
    if (!campaignId) return;
    setIsSavingActual(true);
    setErrorMessage(null);
    try {
      const actualPayload = {
        actual_impressions: actualImpressions ? Number(actualImpressions) : undefined,
        actual_clicks: actualClicks ? Number(actualClicks) : undefined,
        actual_conversions: actualConversions ? Number(actualConversions) : undefined,
        actual_gross_revenue: actualGrossRevenue ? Number(actualGrossRevenue) : undefined,
        actual_spend: actualSpend ? Number(actualSpend) : Number(cost),
        attribution_provider: attributionProvider,
        notes: actualNotes,
      };

      const savedActual = await api.forecasting.recordActualOutcome(campaignId, actualPayload);
      setActualOutcome(savedActual);
      setSaveSuccessMessage('Verified campaign outcome recorded. Variance vs projected baseline evaluated.');

      // Refresh bundle to see updated variance analysis
      const refreshed = await api.forecasting.getCampaignContext(campaignId);
      setContextBundle(refreshed);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to record actual outcome.');
    } finally {
      setIsSavingActual(false);
    }
  };

  const renderScenarioCard = (
    projection: ScenarioProjection,
    tier: 'conservative' | 'baseline' | 'optimistic'
  ) => {
    const isBaseline = tier === 'baseline';
    const isConservative = tier === 'conservative';

    const bgStyles = isBaseline
      ? 'border-2 border-sky-500 bg-sky-50/30 ring-1 ring-sky-500/20'
      : isConservative
      ? 'border border-slate-200 bg-slate-50/50'
      : 'border border-emerald-200 bg-emerald-50/30';

    const roiColor =
      projection.estimated_roi_pct >= 0
        ? 'text-emerald-700 bg-emerald-100'
        : 'text-rose-700 bg-rose-100';

    return (
      <div key={tier} className={`rounded-xl p-4 flex flex-col justify-between transition-all ${bgStyles}`}>
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-900 text-sm">
                {projection.scenario_name}
              </span>
              {isBaseline && (
                <Badge variant="brand" size="sm">
                  Primary Baseline
                </Badge>
              )}
            </div>
            <span className={`px-2 py-0.5 rounded text-xs font-bold ${roiColor}`}>
              {projection.estimated_roi_pct > 0 ? '+' : ''}
              {projection.estimated_roi_pct}% ROI
            </span>
          </div>

          <p className="text-[11px] text-slate-500 mb-3 leading-snug">
            {projection.multiplier_description}
          </p>

          <div className="space-y-2 text-xs divide-y divide-slate-100">
            <div className="flex items-center justify-between pt-1">
              <span className="text-slate-500">Gross Sales Revenue:</span>
              <span className="font-bold text-slate-900 text-sm">
                ${projection.estimated_gross_revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex items-center justify-between pt-1.5">
              <span className="text-slate-500">Estimated Net Return:</span>
              <span
                className={`font-semibold ${
                  projection.estimated_net_profit >= 0 ? 'text-emerald-700' : 'text-rose-600'
                }`}
              >
                {projection.estimated_net_profit >= 0 ? '+' : ''}$
                {projection.estimated_net_profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex items-center justify-between pt-1.5">
              <span className="text-slate-500">Conversions:</span>
              <span className="font-semibold text-slate-800">
                {projection.estimated_conversions.toLocaleString()} orders
              </span>
            </div>

            <div className="flex items-center justify-between pt-1.5">
              <span className="text-slate-500">Link Clicks (Traffic):</span>
              <span className="font-semibold text-slate-800">
                {projection.estimated_clicks.toLocaleString()} clicks
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] text-slate-500">
              <div className="bg-white/80 p-1.5 rounded border border-slate-100">
                <span className="block text-[10px] text-slate-400">Est. CPC</span>
                <span className="font-mono font-medium text-slate-700">
                  {projection.estimated_cpc ? `$${projection.estimated_cpc}` : 'N/A'}
                </span>
              </div>
              <div className="bg-white/80 p-1.5 rounded border border-slate-100">
                <span className="block text-[10px] text-slate-400">Est. CPA</span>
                <span className="font-mono font-medium text-slate-700">
                  {projection.estimated_cpa ? `$${projection.estimated_cpa}` : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
          <span>Target Reach: {projection.impressions.toLocaleString()}</span>
          <span>CVR: {projection.conversion_rate}%</span>
        </div>
      </div>
    );
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Top Banner & Mode Switcher */}
      <Card orientation="vertical" padding="md" className="bg-white shadow-sm border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-sky-100 text-sky-700 rounded-lg">
                <Icon name="TrendingUp" size="sm" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">
                Sales Potential & Campaign Outcome Forecaster
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Transparent, deterministic scenario projections computed directly from campaign reach and conversion assumptions.
            </p>
          </div>

          {/* Sub-tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setActiveTab('simulator')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeTab === 'simulator'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Interactive Scenario Model
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('actuals')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeTab === 'actuals'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Verified Actuals & Variance Audit
            </button>
          </div>
        </div>

        {/* Global Mandatory Disclaimer Notice */}
        <div className="mt-3 p-2.5 bg-amber-50/70 border border-amber-200 rounded-lg flex items-start gap-2.5 text-xs text-amber-900">
          <Icon name="AlertTriangle" size="sm" className="text-amber-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-bold uppercase tracking-wider text-[11px] block text-amber-950">
              Heuristic Projection Notice — Not a Guaranteed Sales Promise
            </span>
            Estimates are algorithmic mathematical projections calculated from explicit assumptions.
            Creative resonance, landing page speed, mobile UX, and ad-blockers are independent variables outside platform guarantees.
          </div>
        </div>

        {/* Data Source & Predictive Model Status Badges */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-500">Data Source:</span>
            {dataSource === 'brand_historical' ? (
              <Badge variant="success" size="sm" className="flex items-center gap-1">
                <Icon name="CheckCircle" size="xs" />
                Verified Brand Historical Averages ({benchmark?.tracked_campaigns_count || 0} campaigns)
              </Badge>
            ) : dataSource === 'platform_benchmark' ? (
              <Badge variant="neutral" size="sm">
                Platform Industry Defaults
              </Badge>
            ) : (
              <Badge variant="brand" size="sm">
                Custom User Assumptions
              </Badge>
            )}
          </div>

          <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
            <span>
              Predictive ML Status: {benchmark?.has_sufficient_data ? 'Supervised Regression Enabled' : 'Supervised ML Withheld (n < 30)'}
            </span>
          </div>
        </div>
      </Card>

      {/* Error or Success alerts */}
      {errorMessage && (
        <Alert variant="danger" onClose={() => setErrorMessage(null)}>
          {errorMessage}
        </Alert>
      )}

      {saveSuccessMessage && (
        <Alert variant="success" onClose={() => setSaveSuccessMessage(null)}>
          {saveSuccessMessage}
        </Alert>
      )}

      {activeTab === 'simulator' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Controls Column (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <Card orientation="vertical" padding="md" className="bg-white border border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <Icon name="Sliders" size="xs" className="text-sky-600" />
                  Scenario Assumption Inputs
                </h4>
                {calculating && (
                  <span className="text-xs text-sky-600 flex items-center gap-1">
                    <Icon name="RotateCw" size="xs" className="animate-spin" />
                    Updating...
                  </span>
                )}
              </div>

              {/* Quick Preset Selector */}
              <div className="mb-4">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Quick Benchmark Presets
                </label>
                <div className="grid grid-cols-1 gap-1.5">
                  {PRESET_TEMPLATES.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => handleApplyPreset(preset)}
                      className="text-left p-2 rounded-lg border border-slate-200 hover:border-sky-400 hover:bg-sky-50/50 transition-all text-xs group"
                    >
                      <div className="font-semibold text-slate-800 group-hover:text-sky-700">
                        {preset.name}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {preset.desc} · {preset.assumptions.impressions.toLocaleString()} reach @ {preset.assumptions.click_through_rate}% CTR
                      </div>
                    </button>
                  ))}

                  {benchmark && benchmark.tracked_campaigns_count > 0 && (
                    <button
                      type="button"
                      onClick={handleApplyHistorical}
                      className="text-left p-2 rounded-lg border border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50 transition-all text-xs group"
                    >
                      <div className="font-semibold text-emerald-900 flex items-center gap-1">
                        <Icon name="CheckCircle" size="xs" className="text-emerald-600" />
                        Apply Brand Historical Averages ({benchmark.tracked_campaigns_count} campaigns)
                      </div>
                      <div className="text-[10px] text-emerald-700 mt-0.5">
                        Avg CTR: {benchmark.avg_ctr_pct}% · Avg CVR: {benchmark.avg_cvr_pct}% · Avg AOV: ${benchmark.avg_aov}
                      </div>
                    </button>
                  )}
                </div>
              </div>

              {/* Granular Sliders and Number Inputs */}
              <div className="space-y-3.5 text-xs">
                {/* Impressions / Reach */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-medium text-slate-700">
                      Expected Reach / Impressions:
                    </label>
                    <span className="font-bold text-slate-900 font-mono">
                      {Number(impressions).toLocaleString()}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1000"
                    max="500000"
                    step="5000"
                    value={impressions}
                    onChange={(e) => {
                      setImpressions(Number(e.target.value));
                      setDataSource('user_assumptions');
                    }}
                    className="w-full accent-sky-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>1,000</span>
                    <span>250,000</span>
                    <span>500,000+</span>
                  </div>
                </div>

                {/* Click-Through Rate (CTR) */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-medium text-slate-700">
                      Click-Through Rate (CTR %):
                    </label>
                    <span className="font-bold text-slate-900 font-mono">{ctr}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="10.0"
                    step="0.1"
                    value={ctr}
                    onChange={(e) => {
                      setCtr(Number(e.target.value));
                      setDataSource('user_assumptions');
                    }}
                    className="w-full accent-sky-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>0.1% (Low)</span>
                    <span>2.0% (Average)</span>
                    <span>10.0% (Viral)</span>
                  </div>
                </div>

                {/* Conversion Rate (CVR) */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-medium text-slate-700">
                      Conversion Rate (CVR %):
                    </label>
                    <span className="font-bold text-slate-900 font-mono">{cvr}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="10.0"
                    step="0.1"
                    value={cvr}
                    onChange={(e) => {
                      setCvr(Number(e.target.value));
                      setDataSource('user_assumptions');
                    }}
                    className="w-full accent-sky-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>0.1%</span>
                    <span>2.5% (Industry avg)</span>
                    <span>10.0%</span>
                  </div>
                </div>

                {/* Average Order Value (AOV) & Campaign Cost */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="font-medium text-slate-700 block mb-1">
                      Avg Order Value ($):
                    </label>
                    <div className="relative rounded-md shadow-sm">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400 font-bold">
                        $
                      </div>
                      <input
                        type="number"
                        min="1"
                        max="10000"
                        step="1"
                        value={aov}
                        onChange={(e) => {
                          setAov(Number(e.target.value));
                          setDataSource('user_assumptions');
                        }}
                        className="block w-full rounded-md border border-slate-300 pl-7 pr-2 py-1.5 text-xs text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-medium text-slate-700 block mb-1">
                      Campaign Cost ($):
                    </label>
                    <div className="relative rounded-md shadow-sm">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400 font-bold">
                        $
                      </div>
                      <input
                        type="number"
                        min="50"
                        max="1000000"
                        step="100"
                        value={cost}
                        onChange={(e) => {
                          setCost(Number(e.target.value));
                          setDataSource('user_assumptions');
                        }}
                        className="block w-full rounded-md border border-slate-300 pl-7 pr-2 py-1.5 text-xs text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Save snapshot controls if campaignId provided */}
                {campaignId && (
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <div>
                      <label className="font-medium text-slate-700 block mb-1">
                        Snapshot Label:
                      </label>
                      <input
                        type="text"
                        value={forecastName}
                        onChange={(e) => setForecastName(e.target.value)}
                        placeholder="e.g. Q4 Baseline Model"
                        className="block w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="font-medium text-slate-700 block mb-1">
                        Forecasting Notes:
                      </label>
                      <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="e.g. Target reach based on 4 confirmed influencers"
                        className="block w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
                      />
                    </div>

                    <Button
                      variant="primary"
                      size="sm"
                      className="w-full justify-center"
                      isLoading={isSavingForecast}
                      onClick={handleSaveForecast}
                    >
                      Save Forecast Snapshot to Campaign
                    </Button>
                  </div>
                )}
              </div>
            </Card>

            {/* Formula & Methodology Accordion */}
            <Card orientation="vertical" padding="sm" className="bg-white border border-slate-200">
              <button
                type="button"
                onClick={() => setShowFormulas(!showFormulas)}
                className="w-full flex items-center justify-between text-left text-xs font-semibold text-slate-700 hover:text-sky-700"
              >
                <span className="flex items-center gap-1.5">
                  <Icon name="BookOpen" size="xs" className="text-sky-600" />
                  Transparent Calculation Methodology
                </span>
                <Icon name={showFormulas ? 'ChevronUp' : 'ChevronDown'} size="xs" />
              </button>

              {showFormulas && (
                <div className="mt-3 pt-3 border-t border-slate-100 space-y-2 text-xs font-mono text-slate-600">
                  <div className="p-2 bg-slate-50 rounded border border-slate-100">
                    <span className="text-slate-400 block text-[10px]">TRAFFIC CLICKS</span>
                    Clicks = Impressions × (CTR / 100)
                  </div>
                  <div className="p-2 bg-slate-50 rounded border border-slate-100">
                    <span className="text-slate-400 block text-[10px]">CONVERSIONS</span>
                    Conversions = Clicks × (Conversion Rate / 100)
                  </div>
                  <div className="p-2 bg-slate-50 rounded border border-slate-100">
                    <span className="text-slate-400 block text-[10px]">GROSS SALES REVENUE</span>
                    Gross Revenue = Conversions × Average Order Value (AOV)
                  </div>
                  <div className="p-2 bg-slate-50 rounded border border-slate-100">
                    <span className="text-slate-400 block text-[10px]">ESTIMATED ROI (%)</span>
                    ROI = ((Gross Revenue − Campaign Cost) / Campaign Cost) × 100
                  </div>
                </div>
              )}
            </Card>

            {/* Limitations Accordion */}
            <Card orientation="vertical" padding="sm" className="bg-white border border-slate-200">
              <button
                type="button"
                onClick={() => setShowLimitations(!showLimitations)}
                className="w-full flex items-center justify-between text-left text-xs font-semibold text-slate-700 hover:text-amber-700"
              >
                <span className="flex items-center gap-1.5">
                  <Icon name="ShieldAlert" size="xs" className="text-amber-600" />
                  Documented Model Limitations (5 factors)
                </span>
                <Icon name={showLimitations ? 'ChevronUp' : 'ChevronDown'} size="xs" />
              </button>

              {showLimitations && (
                <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                  <div className="p-1.5 bg-amber-50/50 rounded text-[11px] leading-relaxed">
                    1. <strong>Organic Feed Changes:</strong> Social network algorithms fluctuate continuously.
                  </div>
                  <div className="p-1.5 bg-amber-50/50 rounded text-[11px] leading-relaxed">
                    2. <strong>Creator Authenticity:</strong> Sincere recommendations generate higher conversion than script reads.
                  </div>
                  <div className="p-1.5 bg-amber-50/50 rounded text-[11px] leading-relaxed">
                    3. <strong>Landing Page UX:</strong> Page load latency over 2s reduces mobile conversion by up to 20%.
                  </div>
                  <div className="p-1.5 bg-amber-50/50 rounded text-[11px] leading-relaxed">
                    4. <strong>Attribution Leakage:</strong> Ad-blockers, Safari ITP, and cross-device buying delay attribution.
                  </div>
                  <div className="p-1.5 bg-amber-50/50 rounded text-[11px] leading-relaxed">
                    5. <strong>Market Competition:</strong> Competing promotions and seasonality affect consumer purchasing timing.
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* Results Column: 3 Scenario Cards (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <Icon name="Layers" size="xs" className="text-sky-600" />
                Three-Scenario Outcome Projections
              </h4>
              <span className="text-xs text-slate-400">
                Fixed Budget: ${cost.toLocaleString()}
              </span>
            </div>

            {loadingContext || !forecastResult ? (
              <div className="py-16 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <Icon name="RotateCw" size="md" className="animate-spin text-sky-600 mx-auto mb-2" />
                Calculating deterministic sales projections...
              </div>
            ) : (
              <div className="space-y-3.5">
                {/* Baseline Scenario (Top or Highlighted) */}
                {renderScenarioCard(forecastResult.scenarios.baseline, 'baseline')}

                {/* Conservative & Optimistic side-by-side or stacked */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {renderScenarioCard(forecastResult.scenarios.conservative, 'conservative')}
                  {renderScenarioCard(forecastResult.scenarios.optimistic, 'optimistic')}
                </div>
              </div>
            )}

            {/* Saved Snapshots History (if loaded) */}
            {contextBundle && contextBundle.forecasts && contextBundle.forecasts.length > 0 && (
              <Card orientation="vertical" padding="md" className="bg-white border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                    Persisted Forecast Snapshots ({contextBundle.forecasts.length})
                  </h4>
                  <span className="text-[11px] text-slate-400 font-mono">Audit Log</span>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {contextBundle.forecasts.map((fc) => (
                    <div
                      key={fc.id}
                      className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-semibold text-slate-800 block">{fc.forecast_name}</span>
                        <span className="text-[10px] text-slate-500">
                          {new Date(fc.created_at).toLocaleString()} · {fc.impressions.toLocaleString()} reach @ {fc.click_through_rate}% CTR
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-slate-900 block">
                          ${Number(fc.baseline_projection.estimated_gross_revenue || 0).toLocaleString()} est. rev
                        </span>
                        <span
                          className={`text-[10px] font-semibold ${
                            Number(fc.baseline_projection.estimated_roi_pct || 0) >= 0 ? 'text-emerald-700' : 'text-rose-600'
                          }`}
                        >
                          {Number(fc.baseline_projection.estimated_roi_pct || 0)}% ROI
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      ) : (
        /* Actual Results & Variance Tab */
        <div className="space-y-4">
          <Card orientation="vertical" padding="md" className="bg-white border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <Icon name="CheckCircle" size="sm" className="text-emerald-600" />
                  Verified Post-Campaign Actual Results
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Record actual tracked conversions and revenue to evaluate forecast accuracy and train historical benchmarks.
                </p>
              </div>
              {actualOutcome && (
                <Badge variant="success" size="sm">
                  Outcome Logged
                </Badge>
              )}
            </div>

            {/* Variance Analysis Callout if available */}
            {contextBundle?.variance_analysis && (
              <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-sky-200 text-sky-900">
                      {contextBundle.variance_analysis.scenario_achievement}
                    </span>
                    <span className="text-xs text-slate-600">
                      Evaluated against Baseline Forecast
                    </span>
                  </div>
                  <span className="text-xs font-bold text-slate-900">
                    Variance: {contextBundle.variance_analysis.revenue_variance_pct > 0 ? '+' : ''}
                    {contextBundle.variance_analysis.revenue_variance_pct}% Revenue
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-white p-2.5 rounded-lg border border-sky-100 shadow-2xs">
                    <span className="text-[10px] text-slate-400 block">Baseline Projected</span>
                    <span className="font-bold text-slate-900 font-mono">
                      ${contextBundle.variance_analysis.projected_revenue.toLocaleString()}
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-sky-100 shadow-2xs">
                    <span className="text-[10px] text-slate-400 block">Actual Attributed</span>
                    <span className="font-bold text-emerald-700 font-mono">
                      ${contextBundle.variance_analysis.actual_revenue.toLocaleString()}
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-sky-100 shadow-2xs">
                    <span className="text-[10px] text-slate-400 block">Revenue Delta</span>
                    <span
                      className={`font-bold font-mono ${
                        contextBundle.variance_analysis.revenue_variance_dollars >= 0
                          ? 'text-emerald-700'
                          : 'text-rose-600'
                      }`}
                    >
                      {contextBundle.variance_analysis.revenue_variance_dollars >= 0 ? '+' : ''}$
                      {contextBundle.variance_analysis.revenue_variance_dollars.toLocaleString()}
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-sky-100 shadow-2xs">
                    <span className="text-[10px] text-slate-400 block">Actual ROI</span>
                    <span
                      className={`font-bold font-mono ${
                        contextBundle.variance_analysis.actual_roi_pct >= 0 ? 'text-emerald-700' : 'text-rose-600'
                      }`}
                    >
                      {contextBundle.variance_analysis.actual_roi_pct}%
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Actual Form Inputs */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Observed Impressions:
                </label>
                <input
                  type="number"
                  placeholder="e.g. 75000"
                  value={actualImpressions}
                  onChange={(e) => setActualImpressions(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Verified Link Clicks:
                </label>
                <input
                  type="number"
                  placeholder="e.g. 1850"
                  value={actualClicks}
                  onChange={(e) => setActualClicks(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Attributed Conversions (Orders):
                </label>
                <input
                  type="number"
                  placeholder="e.g. 62"
                  value={actualConversions}
                  onChange={(e) => setActualConversions(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Actual Gross Revenue ($):
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 3850.00"
                  value={actualGrossRevenue}
                  onChange={(e) => setActualGrossRevenue(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Actual Total Spend ($):
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 2500.00"
                  value={actualSpend}
                  onChange={(e) => setActualSpend(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Attribution Provider:
                </label>
                <input
                  type="text"
                  placeholder="Google Analytics 4 / Shopify Pixel"
                  value={attributionProvider}
                  onChange={(e) => setAttributionProvider(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 focus:border-sky-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="font-semibold text-slate-700 block mb-1 text-xs">
                Tracking Notes & Provenance:
              </label>
              <textarea
                rows={2}
                placeholder="Include campaign UTM campaign tag, coupon code redemptions, or audit notes."
                value={actualNotes}
                onChange={(e) => setActualNotes(e.target.value)}
                className="w-full rounded-md border border-slate-300 p-2 text-xs focus:border-sky-500 focus:outline-none"
              />
            </div>

            <div className="mt-4 flex justify-end">
              <Button
                variant="primary"
                size="sm"
                isLoading={isSavingActual}
                onClick={handleSaveActualOutcome}
                disabled={!campaignId}
              >
                {campaignId ? 'Record & Re-evaluate Actual Outcome' : 'Select a Campaign to Log Actuals'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

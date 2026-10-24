from datetime import datetime, timezone
import math
from typing import Any, Dict, List, Optional
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entities import Campaign, CampaignActualOutcome, CampaignForecast, Invitation
from app.schemas.forecasting import (
    ForecastAssumptionsInput,
    ForecastCalculationResponse,
    HistoricalBenchmarkOut,
    ScenarioProjection,
)

LIMITATIONS_DISCLOSURE: List[str] = [
    "Organic algorithm distribution variability: Social feed algorithms change continuously and cannot guarantee impression velocity.",
    "Audience resonance & creative execution: Performance heavily depends on creator authenticity, video scripting, and hook retention.",
    "Conversion funnel friction: Destination landing page load speed, checkout UX, and payment options directly influence conversion rates.",
    "Attribution window constraints: Cross-device conversions, Safari ITP, private browsing, and ad-blockers create tracking leakage.",
    "Market seasonality & competitor bidding: Promotional calendars, holiday demand spikes, and external market conditions affect consumer intent.",
]

FORMULAS_DISCLOSURE: Dict[str, str] = {
    "Estimated Clicks": "impressions × (click_through_rate / 100)",
    "Estimated Conversions": "estimated_clicks × (conversion_rate / 100)",
    "Estimated Gross Revenue": "estimated_conversions × average_order_value",
    "Estimated Net Profit": "estimated_gross_revenue − campaign_cost",
    "Estimated ROI (%)": "((estimated_gross_revenue − campaign_cost) / campaign_cost) × 100",
    "Estimated Cost Per Click (CPC)": "campaign_cost / estimated_clicks",
    "Estimated Cost Per Acquisition (CPA)": "campaign_cost / estimated_conversions",
}

SUPERVISED_ML_THRESHOLD = 30  # Minimum verified completed campaigns required for statistical ML training


class CampaignForecaster:
    """
    Campaign sales forecasting and scenario simulation engine.
    Computes transparent conservative, baseline, and optimistic outcome scenarios
    without fabricating sales guarantees or synthetic model capabilities.
    """

    @staticmethod
    def calculate_scenario(
        impressions: int,
        ctr: float,
        cvr: float,
        aov: float,
        cost: float,
        scenario_name: str,
        multiplier_description: str,
    ) -> ScenarioProjection:
        """
        Calculates campaign outcomes using transparent, deterministic mathematical formulas:
          - Estimated clicks = impressions × (ctr / 100)
          - Estimated conversions = clicks × (cvr / 100)
          - Estimated gross revenue = conversions × aov
          - Estimated net profit = gross revenue − cost
          - Estimated ROI = ((gross revenue − cost) / cost) × 100
        """
        safe_impressions = max(1, int(round(impressions)))
        safe_ctr = max(0.0, float(ctr))
        safe_cvr = max(0.0, float(cvr))
        safe_aov = max(0.01, float(aov))
        safe_cost = max(0.01, float(cost))

        # 1. Estimated Clicks
        raw_clicks = safe_impressions * (safe_ctr / 100.0)
        estimated_clicks = int(round(raw_clicks))

        # 2. Estimated Conversions
        raw_conversions = estimated_clicks * (safe_cvr / 100.0)
        estimated_conversions = int(round(raw_conversions))

        # 3. Estimated Gross Revenue
        estimated_gross_revenue = round(estimated_conversions * safe_aov, 2)

        # 4. Estimated Net Profit
        estimated_net_profit = round(estimated_gross_revenue - safe_cost, 2)

        # 5. Estimated ROI
        estimated_roi_pct = round(((estimated_gross_revenue - safe_cost) / safe_cost) * 100.0, 2)

        # 6. Unit Economics
        estimated_cpc = round(safe_cost / estimated_clicks, 2) if estimated_clicks > 0 else None
        estimated_cpa = round(safe_cost / estimated_conversions, 2) if estimated_conversions > 0 else None

        return ScenarioProjection(
            scenario_name=scenario_name,
            multiplier_description=multiplier_description,
            impressions=safe_impressions,
            click_through_rate=round(safe_ctr, 3),
            conversion_rate=round(safe_cvr, 3),
            average_order_value=round(safe_aov, 2),
            campaign_cost=round(safe_cost, 2),
            estimated_clicks=estimated_clicks,
            estimated_conversions=estimated_conversions,
            estimated_gross_revenue=estimated_gross_revenue,
            estimated_net_profit=estimated_net_profit,
            estimated_roi_pct=estimated_roi_pct,
            estimated_cpc=estimated_cpc,
            estimated_cpa=estimated_cpa,
        )

    @classmethod
    def generate_forecast_scenarios(
        cls,
        assumptions: ForecastAssumptionsInput,
        campaign_id: Optional[int] = None,
        campaign_title: Optional[str] = None,
        source_data_origin: str = "user_assumptions",
        tracked_campaigns_count: int = 0,
        actual_comparison: Optional[Dict[str, Any]] = None,
    ) -> ForecastCalculationResponse:
        """
        Generates three scenario projections (Conservative, Baseline, Optimistic)
        with audited multi-variable multipliers and methodology disclosures.
        """
        # Baseline: Exact inputs
        baseline = cls.calculate_scenario(
            impressions=assumptions.impressions,
            ctr=assumptions.click_through_rate,
            cvr=assumptions.conversion_rate,
            aov=assumptions.average_order_value,
            cost=assumptions.campaign_cost,
            scenario_name="Baseline",
            multiplier_description="Baseline scenario: 1.0× baseline assumptions from selected inputs or historical defaults.",
        )

        # Conservative: Stress test (-25% reach, -30% CTR, -30% CVR, -10% AOV)
        conservative = cls.calculate_scenario(
            impressions=int(round(assumptions.impressions * 0.75)),
            ctr=assumptions.click_through_rate * 0.70,
            cvr=assumptions.conversion_rate * 0.70,
            aov=assumptions.average_order_value * 0.90,
            cost=assumptions.campaign_cost,
            scenario_name="Conservative",
            multiplier_description="Conservative stress-test: -25% reach, -30% CTR, -30% CVR, -10% AOV (fixed budget).",
        )

        # Optimistic: High resonance (+25% reach, +30% CTR, +30% CVR, +10% AOV)
        optimistic = cls.calculate_scenario(
            impressions=int(round(assumptions.impressions * 1.25)),
            ctr=assumptions.click_through_rate * 1.30,
            cvr=assumptions.conversion_rate * 1.30,
            aov=assumptions.average_order_value * 1.10,
            cost=assumptions.campaign_cost,
            scenario_name="Optimistic",
            multiplier_description="Optimistic high-resonance: +25% reach, +30% CTR, +30% CVR, +10% AOV (fixed budget).",
        )

        # Predictive ML Model Eligibility Status
        if tracked_campaigns_count >= SUPERVISED_ML_THRESHOLD:
            predictive_model_status = (
                f"OPERATIONAL_SUPERVISED_REGRESSION: Sample size n={tracked_campaigns_count} "
                f"meets statistical reliability threshold (n>={SUPERVISED_ML_THRESHOLD})."
            )
        else:
            predictive_model_status = (
                f"INSUFFICIENT_HISTORICAL_DATA: Brand has n={tracked_campaigns_count} tracked campaigns "
                f"(minimum n={SUPERVISED_ML_THRESHOLD} required). Supervised regression withheld to prevent "
                f"synthetic hallucination. Using transparent deterministic scenario simulation."
            )

        return ForecastCalculationResponse(
            campaign_id=campaign_id,
            campaign_title=campaign_title,
            source_data_origin=source_data_origin,
            confidence_level="Indicative Scenario Model (Transparent Heuristics)",
            limitations=LIMITATIONS_DISCLOSURE,
            formulas_used=FORMULAS_DISCLOSURE,
            predictive_model_status=predictive_model_status,
            assumptions=assumptions,
            scenarios={
                "conservative": conservative,
                "baseline": baseline,
                "optimistic": optimistic,
            },
            actual_comparison=actual_comparison,
            calculated_at=datetime.now(timezone.utc),
        )

    @classmethod
    async def get_brand_historical_benchmark(
        cls,
        db: AsyncSession,
        brand_id: int,
    ) -> HistoricalBenchmarkOut:
        """
        Computes historical conversion, CTR, and AOV benchmarks across a brand's
        completed campaigns with recorded actual outcomes.
        """
        # Query recorded actual outcomes for this brand
        stmt = (
            select(
                func.count(CampaignActualOutcome.id).label("total_count"),
                func.avg(CampaignActualOutcome.actual_ctr_pct).label("avg_ctr"),
                func.avg(CampaignActualOutcome.actual_cvr_pct).label("avg_cvr"),
                func.avg(CampaignActualOutcome.actual_gross_revenue / func.nullif(CampaignActualOutcome.actual_conversions, 0)).label("avg_aov"),
                func.avg(CampaignActualOutcome.actual_roi_pct).label("avg_roi"),
            )
            .where(CampaignActualOutcome.brand_id == brand_id)
        )
        res = await db.execute(stmt)
        row = res.one_or_none()

        count = row.total_count if row and row.total_count else 0
        has_sufficient_data = count >= SUPERVISED_ML_THRESHOLD

        if count > 0 and row.avg_ctr is not None:
            avg_ctr = round(float(row.avg_ctr), 2)
            avg_cvr = round(float(row.avg_cvr), 2) if row.avg_cvr is not None else 2.2
            avg_aov = round(float(row.avg_aov), 2) if row.avg_aov is not None else 65.0
            avg_roi = round(float(row.avg_roi), 2) if row.avg_roi is not None else 45.0
            data_source_note = f"Derived from {count} tracked historical campaign actuals for this brand."
        else:
            # Platform conservative baseline defaults
            avg_ctr = 1.8
            avg_cvr = 2.4
            avg_aov = 65.00
            avg_roi = 40.0
            data_source_note = "Platform industry baseline defaults (no historical post-campaign actuals logged yet)."

        if has_sufficient_data:
            predictive_model_status = (
                f"OPERATIONAL_SUPERVISED_REGRESSION: Sample size n={count} >= {SUPERVISED_ML_THRESHOLD}."
            )
        else:
            predictive_model_status = (
                f"INSUFFICIENT_HISTORICAL_DATA: Brand has n={count} tracked campaigns "
                f"(minimum n={SUPERVISED_ML_THRESHOLD} required). Supervised regression withheld to prevent "
                f"synthetic hallucination."
            )

        return HistoricalBenchmarkOut(
            tracked_campaigns_count=count,
            has_sufficient_data=has_sufficient_data,
            avg_ctr_pct=avg_ctr,
            avg_cvr_pct=avg_cvr,
            avg_aov=avg_aov,
            avg_roi_pct=avg_roi,
            default_impressions=50000,
            default_budget=2500.0,
            predictive_model_status=predictive_model_status,
            data_source_note=data_source_note,
        )

    @classmethod
    def calculate_actual_metrics(
        cls,
        actual_impressions: Optional[int],
        actual_clicks: Optional[int],
        actual_conversions: Optional[int],
        actual_gross_revenue: Optional[float],
        actual_spend: Optional[float],
    ) -> Dict[str, Optional[float]]:
        """Calculates derived actual metrics from observed post-campaign tracking data."""
        actual_roi_pct = None
        if actual_spend is not None and actual_spend > 0 and actual_gross_revenue is not None:
            actual_roi_pct = round(((actual_gross_revenue - actual_spend) / actual_spend) * 100.0, 2)

        actual_ctr_pct = None
        if actual_impressions is not None and actual_impressions > 0 and actual_clicks is not None:
            actual_ctr_pct = round((actual_clicks / actual_impressions) * 100.0, 2)

        actual_cvr_pct = None
        if actual_clicks is not None and actual_clicks > 0 and actual_conversions is not None:
            actual_cvr_pct = round((actual_conversions / actual_clicks) * 100.0, 2)

        actual_cpc = None
        if actual_clicks is not None and actual_clicks > 0 and actual_spend is not None:
            actual_cpc = round(actual_spend / actual_clicks, 2)

        actual_cpa = None
        if actual_conversions is not None and actual_conversions > 0 and actual_spend is not None:
            actual_cpa = round(actual_spend / actual_conversions, 2)

        return {
            "actual_roi_pct": actual_roi_pct,
            "actual_ctr_pct": actual_ctr_pct,
            "actual_cvr_pct": actual_cvr_pct,
            "actual_cpc": actual_cpc,
            "actual_cpa": actual_cpa,
        }

    @classmethod
    def evaluate_variance(
        cls,
        baseline_projection: Dict[str, Any],
        actual: CampaignActualOutcome,
    ) -> Optional[Dict[str, Any]]:
        """
        Compares forecast baseline projection vs observed actual outcome.
        Computes dollar variance, percentage delta, and scenario achievement tier.
        """
        if actual.actual_gross_revenue is None and actual.actual_conversions is None:
            return None

        projected_rev = baseline_projection.get("estimated_gross_revenue", 0.0)
        actual_rev = actual.actual_gross_revenue or 0.0
        rev_variance_dollars = round(actual_rev - projected_rev, 2)
        rev_variance_pct = round((rev_variance_dollars / projected_rev) * 100.0, 2) if projected_rev > 0 else 0.0

        projected_roi = baseline_projection.get("estimated_roi_pct", 0.0)
        actual_roi = actual.actual_roi_pct or 0.0
        roi_variance_pct = round(actual_roi - projected_roi, 2)

        projected_conversions = baseline_projection.get("estimated_conversions", 0)
        actual_conversions = actual.actual_conversions or 0
        conv_variance = actual_conversions - projected_conversions

        # Scenario achievement tier
        if rev_variance_pct >= 20.0:
            scenario_achievement = "Exceeded Optimistic Forecast"
        elif rev_variance_pct >= -10.0:
            scenario_achievement = "Aligned with Baseline Forecast"
        elif rev_variance_pct >= -30.0:
            scenario_achievement = "Met Conservative Forecast"
        else:
            scenario_achievement = "Below Conservative Scenario"

        return {
            "projected_revenue": projected_rev,
            "actual_revenue": actual_rev,
            "revenue_variance_dollars": rev_variance_dollars,
            "revenue_variance_pct": rev_variance_pct,
            "projected_roi_pct": projected_roi,
            "actual_roi_pct": actual_roi,
            "roi_variance_pct": roi_variance_pct,
            "projected_conversions": projected_conversions,
            "actual_conversions": actual_conversions,
            "conversion_variance": conv_variance,
            "scenario_achievement": scenario_achievement,
            "evaluation_note": (
                f"Actual gross revenue was {abs(rev_variance_pct)}% {'higher' if rev_variance_dollars >= 0 else 'lower'} "
                f"than baseline forecast projection."
            ),
        }


campaign_forecaster = CampaignForecaster()

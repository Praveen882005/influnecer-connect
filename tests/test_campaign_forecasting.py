"""
Tests for Phase 5: Sales Potential and Campaign Forecasting.

Validates:
1. Pure deterministic calculation formulas for clicks, conversions, gross revenue, net profit, ROI, CPC, CPA.
2. Conservative, baseline, and optimistic scenario projections using explicit multipliers and constraints.
3. Stateless calculation API endpoint (/api/v1/forecasting/calculate).
4. Persisting campaign forecasts separately from actual outcomes (/api/v1/forecasting/campaign/{id}).
5. Recording verified post-campaign actual outcomes and calculating derived actual metrics.
6. Evaluating variance between forecast baseline projections and observed actual results.
7. Transparent disclosure of assumptions, formulas, limitations, and supervised ML eligibility (threshold n >= 30).
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token
from app.models.entities import BrandProfile, Campaign, CampaignActualOutcome, CampaignForecast, User, UserRole
from app.schemas.forecasting import ForecastAssumptionsInput
from app.services.forecasting.campaign_forecaster import CampaignForecaster, campaign_forecaster


def test_forecaster_mathematical_formulas_deterministic():
    """
    Validates explicit, audited mathematical formulas specified in Phase 5 roadmap:
      - Estimated clicks = impressions × (click-through rate / 100)
      - Estimated conversions = clicks × (conversion rate / 100)
      - Estimated gross revenue = conversions × average order value
      - Estimated net profit = gross revenue − campaign cost
      - Estimated ROI = ((gross revenue − campaign cost) / campaign cost) × 100
      - Estimated CPC = campaign cost / clicks
      - Estimated CPA = campaign cost / conversions
    """
    impressions = 100_000
    ctr = 2.0     # 2.0% -> 2,000 clicks
    cvr = 2.5     # 2.5% -> 50 conversions
    aov = 65.0    # $65.00 -> $3,250.00 gross revenue
    cost = 2_500.0  # $2,500 cost -> $750.00 net profit, ROI = (750 / 2500) * 100 = 30.0%

    res = CampaignForecaster.calculate_scenario(
        impressions=impressions,
        ctr=ctr,
        cvr=cvr,
        aov=aov,
        cost=cost,
        scenario_name="Baseline",
        multiplier_description="Standard baseline",
    )

    assert res.scenario_name == "Baseline"
    assert res.impressions == 100_000
    assert res.estimated_clicks == 2_000
    assert res.estimated_conversions == 50
    assert res.estimated_gross_revenue == 3_250.0
    assert res.estimated_net_profit == 750.0
    assert res.estimated_roi_pct == 30.0
    assert res.estimated_cpc == 1.25   # 2500 / 2000
    assert res.estimated_cpa == 50.0   # 2500 / 50


def test_forecaster_generates_three_scenarios_with_explicit_multipliers():
    """
    Validates generation of conservative stress-test, baseline, and optimistic projections.
    Ensures conservative estimates are strictly lower than baseline, and optimistic strictly higher.
    """
    assumptions = ForecastAssumptionsInput(
        impressions=80_000,
        click_through_rate=2.0,
        conversion_rate=3.0,
        average_order_value=50.0,
        campaign_cost=2_000.0,
        forecast_name="Product Launch",
    )

    resp = campaign_forecaster.generate_forecast_scenarios(assumptions, tracked_campaigns_count=5)

    assert "conservative" in resp.scenarios
    assert "baseline" in resp.scenarios
    assert "optimistic" in resp.scenarios

    cons = resp.scenarios["conservative"]
    base = resp.scenarios["baseline"]
    opt = resp.scenarios["optimistic"]

    # Verify order of metrics: Conservative < Baseline < Optimistic
    assert cons.estimated_clicks < base.estimated_clicks < opt.estimated_clicks
    assert cons.estimated_conversions < base.estimated_conversions < opt.estimated_conversions
    assert cons.estimated_gross_revenue < base.estimated_gross_revenue < opt.estimated_gross_revenue
    assert cons.estimated_roi_pct < base.estimated_roi_pct < opt.estimated_roi_pct

    # Campaign cost remains constant across scenarios
    assert cons.campaign_cost == base.campaign_cost == opt.campaign_cost == 2_000.0

    # Verify formula disclosure and limitations
    assert "Estimated Clicks" in resp.formulas_used
    assert "Estimated ROI (%)" in resp.formulas_used
    assert len(resp.limitations) >= 3

    # Verify predictive model status withholding notice (n=5 < 30)
    assert "INSUFFICIENT_HISTORICAL_DATA" in resp.predictive_model_status
    assert "minimum n=30 required" in resp.predictive_model_status


def test_forecaster_variance_evaluation():
    """
    Validates comparison between baseline forecast projection and observed actual outcome.
    """
    baseline_proj = {
        "estimated_gross_revenue": 5000.0,
        "estimated_roi_pct": 25.0,
        "estimated_conversions": 100,
    }

    actual = CampaignActualOutcome(
        id=1,
        campaign_id=10,
        brand_id=1,
        actual_impressions=120_000,
        actual_clicks=2400,
        actual_conversions=120,
        actual_gross_revenue=6000.0,
        actual_spend=4000.0,
        actual_roi_pct=50.0,
    )

    variance = CampaignForecaster.evaluate_variance(baseline_proj, actual)
    assert variance is not None
    assert variance["projected_revenue"] == 5000.0
    assert variance["actual_revenue"] == 6000.0
    assert variance["revenue_variance_dollars"] == 1000.0
    assert variance["revenue_variance_pct"] == 20.0  # +20%
    assert variance["conversion_variance"] == 20     # 120 - 100
    assert variance["scenario_achievement"] == "Exceeded Optimistic Forecast"


@pytest.mark.asyncio
async def test_stateless_calculate_forecast_api(client: AsyncClient, db_session: AsyncSession):
    """Tests POST /api/v1/forecasting/calculate endpoint."""
    user = User(
        email="brand_forecast@example.com",
        full_name="Brand Forecaster",
        hashed_password="hash",
        role=UserRole.BRAND,
        is_active=True,
    )
    db_session.add(user)
    await db_session.flush()

    token = create_access_token({"sub": str(user.id), "role": user.role.value})
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "impressions": 50000,
        "click_through_rate": 2.2,
        "conversion_rate": 2.0,
        "average_order_value": 75.0,
        "campaign_cost": 1500.0,
        "forecast_name": "Summer Apparel Test",
    }

    res = await client.post("/api/v1/forecasting/calculate", json=payload, headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert "scenarios" in data
    assert "conservative" in data["scenarios"]
    assert "baseline" in data["scenarios"]
    assert "optimistic" in data["scenarios"]

    base = data["scenarios"]["baseline"]
    assert base["impressions"] == 50000
    assert base["click_through_rate"] == 2.2
    assert base["estimated_clicks"] == 1100  # 50,000 * 0.022
    assert base["estimated_conversions"] == 22  # 1100 * 0.02
    assert base["estimated_gross_revenue"] == 1650.0  # 22 * 75
    assert base["estimated_roi_pct"] == 10.0  # ((1650 - 1500) / 1500) * 100

    assert "disclaimer" in data
    assert "ESTIMATE / ALGORITHMIC PROJECTION ONLY" in data["disclaimer"]


@pytest.mark.asyncio
async def test_campaign_forecasting_save_and_actual_outcome_workflow(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """
    Tests complete Phase 5 workflow:
      1. Create brand and campaign.
      2. Retrieve forecasting bundle with suggested assumptions.
      3. Save a forecast snapshot for the campaign.
      4. Record verified post-campaign actual outcome.
      5. Re-query forecasting bundle and verify variance analysis.
    """
    user = User(
        email="brand_workflow@example.com",
        full_name="Brand Workflow Manager",
        hashed_password="hash",
        role=UserRole.BRAND,
        is_active=True,
    )
    db_session.add(user)
    await db_session.flush()

    brand = BrandProfile(
        user_id=user.id,
        company_name="Lumina Cosmetics",
        industry="beauty",
    )
    db_session.add(brand)
    await db_session.flush()

    campaign = Campaign(
        brand_id=brand.id,
        title="Lumina Glow Lip Oil Launch",
        description="Launch campaign for organic lip oils.",
        niche="beauty",
        budget=3000.0,
        currency="USD",
    )
    db_session.add(campaign)
    await db_session.commit()

    token = create_access_token({"sub": str(user.id), "role": user.role.value})
    headers = {"Authorization": f"Bearer {token}"}

    # Step 1: Retrieve forecasting context bundle
    get_res = await client.get(f"/api/v1/forecasting/campaign/{campaign.id}", headers=headers)
    assert get_res.status_code == 200
    bundle = get_res.json()

    assert bundle["campaign_id"] == campaign.id
    assert bundle["campaign_budget"] == 3000.0
    assert bundle["suggested_assumptions"]["campaign_cost"] == 3000.0
    assert len(bundle["forecasts"]) == 0
    assert bundle["actual_outcome"] is None

    # Step 2: Save a forecast scenario
    save_payload = {
        "impressions": 60000,
        "click_through_rate": 2.5,
        "conversion_rate": 3.0,
        "average_order_value": 45.0,
        "campaign_cost": 3000.0,
        "forecast_name": "Launch Pre-Flight Forecast",
        "notes": "Based on 3 invited creators and lip gloss pricing",
    }
    save_res = await client.post(
        f"/api/v1/forecasting/campaign/{campaign.id}",
        json=save_payload,
        headers=headers,
    )
    assert save_res.status_code == 201
    saved_forecast = save_res.json()
    assert saved_forecast["campaign_id"] == campaign.id
    assert saved_forecast["impressions"] == 60000
    assert saved_forecast["baseline_projection"]["estimated_clicks"] == 1500  # 60,000 * 0.025
    assert saved_forecast["baseline_projection"]["estimated_conversions"] == 45  # 1500 * 0.03
    assert saved_forecast["baseline_projection"]["estimated_gross_revenue"] == 2025.0  # 45 * 45

    # Step 3: Record post-campaign actual outcome
    actual_payload = {
        "actual_impressions": 70000,
        "actual_clicks": 1800,
        "actual_conversions": 60,
        "actual_gross_revenue": 2700.0,
        "actual_spend": 3000.0,
        "attribution_provider": "Google Analytics 4 & Shopify",
        "notes": "Verified by UTM tracking and Shopify discount code redemptions",
    }
    actual_res = await client.post(
        f"/api/v1/forecasting/campaign/{campaign.id}/actual",
        json=actual_payload,
        headers=headers,
    )
    assert actual_res.status_code == 200
    recorded_actual = actual_res.json()
    assert recorded_actual["actual_conversions"] == 60
    assert recorded_actual["actual_gross_revenue"] == 2700.0
    assert recorded_actual["actual_roi_pct"] == -10.0  # ((2700 - 3000) / 3000) * 100
    assert recorded_actual["actual_ctr_pct"] == 2.57  # (1800 / 70000) * 100
    assert recorded_actual["actual_cvr_pct"] == 3.33  # (60 / 1800) * 100
    assert recorded_actual["actual_cpc"] == 1.67      # 3000 / 1800
    assert recorded_actual["actual_cpa"] == 50.0      # 3000 / 60

    # Step 4: Re-query forecasting bundle and verify variance analysis
    updated_bundle_res = await client.get(f"/api/v1/forecasting/campaign/{campaign.id}", headers=headers)
    assert updated_bundle_res.status_code == 200
    updated_bundle = updated_bundle_res.json()

    assert len(updated_bundle["forecasts"]) == 1
    assert updated_bundle["actual_outcome"] is not None
    assert updated_bundle["variance_analysis"] is not None

    variance = updated_bundle["variance_analysis"]
    assert variance["projected_revenue"] == 2025.0
    assert variance["actual_revenue"] == 2700.0
    assert variance["revenue_variance_dollars"] == 675.0
    assert variance["revenue_variance_pct"] == 33.33  # ((2700 - 2025) / 2025) * 100
    assert variance["conversion_variance"] == 15      # 60 - 45

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import (
    get_current_brand_profile,
    get_current_user,
    require_roles,
)
from app.core.database import get_db
from app.models.entities import (
    BrandProfile,
    Campaign,
    CampaignActualOutcome,
    CampaignForecast,
    CreatorProfile,
    Invitation,
    InvitationStatus,
    User,
    UserRole,
)
from app.schemas.forecasting import (
    CampaignActualOutcomeCreate,
    CampaignActualOutcomeOut,
    CampaignActualOutcomeUpdate,
    CampaignForecastOut,
    CampaignForecastSaveRequest,
    CampaignForecastingBundleOut,
    ForecastAssumptionsInput,
    ForecastCalculationResponse,
    HistoricalBenchmarkOut,
)
from app.services.forecasting.campaign_forecaster import campaign_forecaster

router = APIRouter()


@router.post(
    "/calculate",
    response_model=ForecastCalculationResponse,
    summary="Calculate Campaign Sales Scenarios (Stateless Simulation)",
)
async def calculate_forecast(
    assumptions: ForecastAssumptionsInput,
    campaign_id: Optional[int] = Query(None, description="Optional campaign ID context"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ForecastCalculationResponse:
    """
    Computes conservative, baseline, and optimistic sales potential projections
    using deterministic formulas:
      - Estimated clicks = impressions × (click-through rate / 100)
      - Estimated conversions = clicks × (conversion rate / 100)
      - Estimated gross revenue = conversions × average order value
      - Estimated ROI = ((gross revenue − campaign cost) / campaign cost) × 100

    Discloses assumptions, formulas, limitations, and transparent supervised ML model status.
    """
    campaign_title = None
    actual_comparison = None
    tracked_count = 0

    if campaign_id:
        camp_res = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
        campaign = camp_res.scalar_one_or_none()
        if campaign:
            campaign_title = campaign.title

            # Check if actual outcome exists to provide variance comparison
            outcome_res = await db.execute(
                select(CampaignActualOutcome).where(CampaignActualOutcome.campaign_id == campaign_id)
            )
            actual = outcome_res.scalar_one_or_none()
            if actual and (actual.actual_gross_revenue is not None or actual.actual_conversions is not None):
                # Temporary baseline for comparison
                temp_baseline = campaign_forecaster.calculate_scenario(
                    impressions=assumptions.impressions,
                    ctr=assumptions.click_through_rate,
                    cvr=assumptions.conversion_rate,
                    aov=assumptions.average_order_value,
                    cost=assumptions.campaign_cost,
                    scenario_name="Baseline",
                    multiplier_description="",
                )
                actual_comparison = campaign_forecaster.evaluate_variance(
                    temp_baseline.model_dump(),
                    actual,
                )

    if current_user.role == UserRole.BRAND:
        brand_res = await db.execute(select(BrandProfile).where(BrandProfile.user_id == current_user.id))
        brand = brand_res.scalar_one_or_none()
        if brand:
            count_res = await db.execute(
                select(func.count(CampaignActualOutcome.id)).where(CampaignActualOutcome.brand_id == brand.id)
            )
            tracked_count = count_res.scalar() or 0

    return campaign_forecaster.generate_forecast_scenarios(
        assumptions=assumptions,
        campaign_id=campaign_id,
        campaign_title=campaign_title,
        source_data_origin="user_assumptions",
        tracked_campaigns_count=tracked_count,
        actual_comparison=actual_comparison,
    )


@router.get(
    "/benchmark",
    response_model=HistoricalBenchmarkOut,
    summary="Retrieve Brand Historical Conversion Benchmarks",
)
async def get_brand_benchmark(
    current_brand: BrandProfile = Depends(get_current_brand_profile),
    db: AsyncSession = Depends(get_db),
) -> HistoricalBenchmarkOut:
    """
    Retrieves the brand's verified historical campaign performance averages (CTR, CVR, AOV, ROI)
    derived from logged actual outcomes. Documents predictive model eligibility (threshold n>=30).
    """
    return await campaign_forecaster.get_brand_historical_benchmark(db, current_brand.id)


@router.get(
    "/campaign/{campaign_id}",
    response_model=CampaignForecastingBundleOut,
    summary="Get Campaign Forecasting Context and Historical Benchmarks",
)
async def get_campaign_forecasting_context(
    campaign_id: int,
    current_user: User = Depends(require_roles([UserRole.BRAND, UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
) -> CampaignForecastingBundleOut:
    """
    Retrieves complete forecasting bundle for a specific campaign:
      - Campaign brief metadata and budget
      - Suggested default assumptions (budget-aligned, incorporating confirmed creator reach if available)
      - Saved forecast scenarios
      - Persisted actual outcomes (if logged)
      - Variance analysis comparing baseline forecast vs actual results
      - Brand historical benchmarks
    """
    camp_res = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = camp_res.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

    # Authorize brand ownership
    if current_user.role == UserRole.BRAND:
        brand_res = await db.execute(select(BrandProfile).where(BrandProfile.user_id == current_user.id))
        brand = brand_res.scalar_one_or_none()
        if not brand or campaign.brand_id != brand.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access forecasting data for this campaign",
            )
    else:
        brand_res = await db.execute(select(BrandProfile).where(BrandProfile.id == campaign.brand_id))
        brand = brand_res.scalar_one_or_none()

    # Brand historical benchmark
    historical_benchmark = await campaign_forecaster.get_brand_historical_benchmark(db, campaign.brand_id)

    # Check confirmed creator outreach to provide smarter reach assumptions
    confirmed_invites_res = await db.execute(
        select(Invitation)
        .options(selectinload(Invitation.creator))
        .where(
            Invitation.campaign_id == campaign_id,
            Invitation.status == InvitationStatus.ACCEPTED,
        )
    )
    confirmed_invites = confirmed_invites_res.scalars().all()

    total_confirmed_followers = sum(
        (inv.creator.total_followers or 0) for inv in confirmed_invites if inv.creator
    )
    # Estimate reach as 30% of creator follower counts if confirmed creators exist, otherwise fallback
    suggested_impressions = (
        max(1000, int(total_confirmed_followers * 0.30))
        if total_confirmed_followers > 0
        else int(campaign.budget * 20)  # ~20 impressions per $ spend fallback
    )
    if suggested_impressions < 1000:
        suggested_impressions = 25000

    suggested_assumptions = ForecastAssumptionsInput(
        impressions=suggested_impressions,
        click_through_rate=historical_benchmark.avg_ctr_pct or 1.8,
        conversion_rate=historical_benchmark.avg_cvr_pct or 2.4,
        average_order_value=historical_benchmark.avg_aov or 65.0,
        campaign_cost=campaign.budget,
        forecast_name=f"Forecast for {campaign.title}",
        notes=f"Auto-generated baseline from campaign budget (${campaign.budget:,.2f})",
    )

    # Saved forecasts
    forecasts_res = await db.execute(
        select(CampaignForecast)
        .where(CampaignForecast.campaign_id == campaign_id)
        .order_by(CampaignForecast.created_at.desc())
    )
    forecasts = forecasts_res.scalars().all()

    # Actual outcome
    actual_res = await db.execute(
        select(CampaignActualOutcome).where(CampaignActualOutcome.campaign_id == campaign_id)
    )
    actual = actual_res.scalar_one_or_none()

    # Variance analysis if both saved forecast and actual exist
    variance_analysis = None
    if actual and forecasts:
        latest_forecast = forecasts[0]
        if latest_forecast.baseline_projection:
            variance_analysis = campaign_forecaster.evaluate_variance(
                latest_forecast.baseline_projection,
                actual,
            )

    return CampaignForecastingBundleOut(
        campaign_id=campaign.id,
        campaign_title=campaign.title,
        campaign_budget=campaign.budget,
        currency=campaign.currency,
        suggested_assumptions=suggested_assumptions,
        forecasts=[CampaignForecastOut.model_validate(f) for f in forecasts],
        actual_outcome=CampaignActualOutcomeOut.model_validate(actual) if actual else None,
        variance_analysis=variance_analysis,
        historical_benchmark=historical_benchmark,
    )


@router.post(
    "/campaign/{campaign_id}",
    response_model=CampaignForecastOut,
    status_code=status.HTTP_201_CREATED,
    summary="Save Campaign Forecast Scenario",
)
async def save_campaign_forecast(
    campaign_id: int,
    request: CampaignForecastSaveRequest,
    current_brand: BrandProfile = Depends(get_current_brand_profile),
    db: AsyncSession = Depends(get_db),
) -> CampaignForecastOut:
    """
    Persists a modeled forecast scenario for a campaign.
    Calculates conservative, baseline, and optimistic projections and stores them with audit timestamps.
    """
    camp_res = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = camp_res.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

    if campaign.brand_id != current_brand.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot save forecasts for campaigns owned by another brand",
        )

    # Generate full projections
    projections = campaign_forecaster.generate_forecast_scenarios(
        assumptions=request,
        campaign_id=campaign.id,
        campaign_title=campaign.title,
        source_data_origin=request.source_data_origin,
    )

    new_forecast = CampaignForecast(
        campaign_id=campaign.id,
        brand_id=current_brand.id,
        forecast_name=request.forecast_name or "Campaign Sales Forecast",
        source_data_origin=request.source_data_origin,
        impressions=request.impressions,
        click_through_rate=request.click_through_rate,
        conversion_rate=request.conversion_rate,
        average_order_value=request.average_order_value,
        campaign_cost=request.campaign_cost,
        conservative_projection=projections.scenarios["conservative"].model_dump(),
        baseline_projection=projections.scenarios["baseline"].model_dump(),
        optimistic_projection=projections.scenarios["optimistic"].model_dump(),
        notes=request.notes,
    )

    db.add(new_forecast)
    await db.commit()
    await db.refresh(new_forecast)

    return CampaignForecastOut.model_validate(new_forecast)


@router.get(
    "/campaign/{campaign_id}/forecasts",
    response_model=List[CampaignForecastOut],
    summary="List Saved Forecasts for a Campaign",
)
async def list_campaign_forecasts(
    campaign_id: int,
    current_brand: BrandProfile = Depends(get_current_brand_profile),
    db: AsyncSession = Depends(get_db),
) -> List[CampaignForecastOut]:
    """Retrieves all saved forecast snapshots for a campaign."""
    camp_res = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = camp_res.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

    if campaign.brand_id != current_brand.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    res = await db.execute(
        select(CampaignForecast)
        .where(CampaignForecast.campaign_id == campaign_id)
        .order_by(CampaignForecast.created_at.desc())
    )
    records = res.scalars().all()
    return [CampaignForecastOut.model_validate(r) for r in records]


@router.post(
    "/campaign/{campaign_id}/actual",
    response_model=CampaignActualOutcomeOut,
    summary="Log or Update Actual Post-Campaign Outcome",
)
async def record_campaign_actual_outcome(
    campaign_id: int,
    payload: CampaignActualOutcomeCreate,
    current_brand: BrandProfile = Depends(get_current_brand_profile),
    db: AsyncSession = Depends(get_db),
) -> CampaignActualOutcomeOut:
    """
    Records or updates verified post-campaign outcome metrics.
    Automatically computes:
      - Actual ROI (%) = ((gross revenue − actual spend) / actual spend) × 100
      - Actual CTR (%) = (clicks / impressions) × 100
      - Actual CVR (%) = (conversions / clicks) × 100
      - Actual CPC = spend / clicks
      - Actual CPA = spend / conversions
    Stored separately from forecasts to evaluate historical model accuracy.
    """
    camp_res = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = camp_res.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

    if campaign.brand_id != current_brand.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    # Calculate derived metrics
    derived = campaign_forecaster.calculate_actual_metrics(
        actual_impressions=payload.actual_impressions,
        actual_clicks=payload.actual_clicks,
        actual_conversions=payload.actual_conversions,
        actual_gross_revenue=payload.actual_gross_revenue,
        actual_spend=payload.actual_spend if payload.actual_spend is not None else campaign.budget,
    )

    actual_spend = payload.actual_spend if payload.actual_spend is not None else campaign.budget

    # Find existing or create new
    existing_res = await db.execute(
        select(CampaignActualOutcome).where(CampaignActualOutcome.campaign_id == campaign_id)
    )
    actual_record = existing_res.scalar_one_or_none()

    if actual_record:
        actual_record.actual_impressions = payload.actual_impressions
        actual_record.actual_clicks = payload.actual_clicks
        actual_record.actual_conversions = payload.actual_conversions
        actual_record.actual_gross_revenue = payload.actual_gross_revenue
        actual_record.actual_spend = actual_spend
        actual_record.actual_roi_pct = derived["actual_roi_pct"]
        actual_record.actual_ctr_pct = derived["actual_ctr_pct"]
        actual_record.actual_cvr_pct = derived["actual_cvr_pct"]
        actual_record.actual_cpc = derived["actual_cpc"]
        actual_record.actual_cpa = derived["actual_cpa"]
        actual_record.attribution_provider = payload.attribution_provider or "Manual Tracking"
        actual_record.tracked_period_start = payload.tracked_period_start
        actual_record.tracked_period_end = payload.tracked_period_end
        actual_record.notes = payload.notes
        actual_record.updated_at = datetime.now(timezone.utc)
    else:
        actual_record = CampaignActualOutcome(
            campaign_id=campaign_id,
            brand_id=current_brand.id,
            actual_impressions=payload.actual_impressions,
            actual_clicks=payload.actual_clicks,
            actual_conversions=payload.actual_conversions,
            actual_gross_revenue=payload.actual_gross_revenue,
            actual_spend=actual_spend,
            actual_roi_pct=derived["actual_roi_pct"],
            actual_ctr_pct=derived["actual_ctr_pct"],
            actual_cvr_pct=derived["actual_cvr_pct"],
            actual_cpc=derived["actual_cpc"],
            actual_cpa=derived["actual_cpa"],
            attribution_provider=payload.attribution_provider or "Manual Tracking",
            tracked_period_start=payload.tracked_period_start,
            tracked_period_end=payload.tracked_period_end,
            notes=payload.notes,
        )
        db.add(actual_record)

    await db.commit()
    await db.refresh(actual_record)

    return CampaignActualOutcomeOut.model_validate(actual_record)


@router.get(
    "/campaign/{campaign_id}/actual",
    response_model=Optional[CampaignActualOutcomeOut],
    summary="Get Actual Post-Campaign Outcome",
)
async def get_campaign_actual_outcome(
    campaign_id: int,
    current_brand: BrandProfile = Depends(get_current_brand_profile),
    db: AsyncSession = Depends(get_db),
) -> Optional[CampaignActualOutcomeOut]:
    """Retrieves verified post-campaign outcome if recorded."""
    camp_res = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = camp_res.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

    if campaign.brand_id != current_brand.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    res = await db.execute(
        select(CampaignActualOutcome).where(CampaignActualOutcome.campaign_id == campaign_id)
    )
    record = res.scalar_one_or_none()
    return CampaignActualOutcomeOut.model_validate(record) if record else None

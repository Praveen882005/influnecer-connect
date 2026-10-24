from datetime import date, datetime, timezone
import csv
import io
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import (
    get_current_brand_profile,
    get_current_creator_profile,
    get_current_user,
)
from app.core.database import get_db
from app.models.entities import (
    BrandProfile,
    Campaign,
    CreatorOpportunityInteraction,
    CreatorProfile,
    InfluencerPost,
    Invitation,
    Proposal,
    ProposalStatus,
    Shortlist,
    User,
    UserRole,
)
from app.schemas.analytics import (
    AuthenticityReportOut,
    BrandAnalyticsOut,
    BrandCampaignSummaryOut,
    BrandDailyActivityOut,
    BrandParticipationFunnelOut,
    CreatorAnalyticsOut,
    CreatorDataFreshnessOut,
    CreatorInvitationsAnalyticsOut,
    CreatorOpportunitiesAnalyticsOut,
    CreatorRecentActivityOut,
    EngagementMetricsOut,
    FullAnalyticsReportOut,
    ModelMetadataOut,
)
from app.services.analytics import (
    AuthenticitySignalEvaluator,
    DeterministicHeuristicAuthenticityModel,
    EngagementCalculator,
    SupervisedAuthenticityClassifierStub,
    DETERMINISTIC_HEURISTICS_CATALOG,
    UNIMPLEMENTED_FEATURES_CATALOG,
)

router = APIRouter()


@router.get("/overview", summary="Platform Aggregated Analytics Overview")
async def get_analytics_overview(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Retrieves high-level platform health metrics, reach, and user role context."""
    total_campaigns = (await db.execute(select(func.count(Campaign.id)))).scalar() or 0
    total_creators = (await db.execute(select(func.count(CreatorProfile.id)))).scalar() or 0
    total_brands = (await db.execute(select(func.count(BrandProfile.id)))).scalar() or 0
    total_proposals = (await db.execute(select(func.count(Proposal.id)))).scalar() or 0
    accepted_proposals = (
        await db.execute(
            select(func.count(Proposal.id)).where(Proposal.status == ProposalStatus.ACCEPTED)
        )
    ).scalar() or 0

    total_reach = (await db.execute(select(func.sum(CreatorProfile.total_followers)))).scalar() or 0
    avg_engagement = (await db.execute(select(func.avg(CreatorProfile.avg_engagement_rate)))).scalar() or 0.0
    avg_authenticity = (await db.execute(select(func.avg(CreatorProfile.authenticity_score)))).scalar() or 0.0

    user_specific = {}
    if current_user.role == UserRole.BRAND:
        brand_res = await db.execute(select(BrandProfile).where(BrandProfile.user_id == current_user.id))
        brand = brand_res.scalar_one_or_none()
        if brand:
            brand_campaigns = (
                await db.execute(select(func.count(Campaign.id)).where(Campaign.brand_id == brand.id))
            ).scalar() or 0
            user_specific = {"brand_campaign_count": brand_campaigns}
    elif current_user.role == UserRole.CREATOR:
        creator_res = await db.execute(select(CreatorProfile).where(CreatorProfile.user_id == current_user.id))
        creator = creator_res.scalar_one_or_none()
        if creator:
            creator_proposals = (
                await db.execute(select(func.count(Proposal.id)).where(Proposal.creator_id == creator.id))
            ).scalar() or 0
            user_specific = {"creator_proposal_count": creator_proposals}

    acceptance_rate = round((accepted_proposals / total_proposals * 100), 1) if total_proposals > 0 else 0.0

    return {
        "total_campaigns": total_campaigns,
        "total_creators": total_creators,
        "total_brands": total_brands,
        "total_proposals": total_proposals,
        "accepted_proposals": accepted_proposals,
        "proposal_acceptance_rate": acceptance_rate,
        "cumulative_audience_reach": total_reach,
        "platform_avg_engagement_rate": round(float(avg_engagement), 2),
        "platform_avg_authenticity_heuristic": round(float(avg_authenticity), 1),
        "user_context": user_specific,
        "data_provenance": "Aggregated from active Brand Bridge repository state.",
    }


@router.get(
    "/creator/{creator_id}/engagement",
    response_model=EngagementMetricsOut,
    summary="Creator Engagement Metrics Calculation",
)
async def get_creator_engagement_metrics(
    creator_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Computes engagement rate using the canonical formula:
    ((average likes + average comments) / follower count) * 100.
    Identifies sample size, date range, metric availability, and staleness.
    """
    c_res = await db.execute(select(CreatorProfile).where(CreatorProfile.id == creator_id))
    creator = c_res.scalar_one_or_none()
    if not creator:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Creator profile with ID {creator_id} not found.",
        )

    p_res = await db.execute(
        select(InfluencerPost)
        .where(InfluencerPost.influencer_id == creator.id)
        .order_by(desc(InfluencerPost.posted_at))
    )
    posts = list(p_res.scalars().all())

    return EngagementCalculator.calculate_from_posts(creator=creator, posts=posts)


@router.get(
    "/creator/{creator_id}/authenticity",
    response_model=AuthenticityReportOut,
    summary="Creator Authenticity Signals & Review Evidence",
)
async def get_creator_authenticity_report(
    creator_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Evaluates transparent, evidence-based review signals:
    - Follower/following ratio
    - Posting frequency & dormancy
    - Follower-tier normalized engagement anomalies
    - Repetitive caption patterns
    - Longitudinal growth velocity (only when multiple timestamped observations exist)
    
    Signals are presented as evidence for human marketers, never automated proof of fraud.
    """
    c_res = await db.execute(select(CreatorProfile).where(CreatorProfile.id == creator_id))
    creator = c_res.scalar_one_or_none()
    if not creator:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Creator profile with ID {creator_id} not found.",
        )

    p_res = await db.execute(
        select(InfluencerPost)
        .where(InfluencerPost.influencer_id == creator.id)
        .order_by(desc(InfluencerPost.posted_at))
    )
    posts = list(p_res.scalars().all())

    engagement = EngagementCalculator.calculate_from_posts(creator=creator, posts=posts)

    # Extract any historical growth observations stored on creator profile
    collab = creator.collaboration_preferences or {}
    historical_snaps = collab.get("historical_growth_snapshots") or []

    evaluator = AuthenticitySignalEvaluator()
    return evaluator.evaluate_creator(
        creator=creator,
        posts=posts,
        engagement=engagement,
        historical_observations=historical_snaps,
    )


@router.get(
    "/creator/{creator_id}/full-report",
    response_model=FullAnalyticsReportOut,
    summary="Complete Creator Analytics Report",
)
async def get_creator_full_analytics_report(
    creator_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Unified endpoint returning both engagement metrics and authenticity review signals."""
    c_res = await db.execute(select(CreatorProfile).where(CreatorProfile.id == creator_id))
    creator = c_res.scalar_one_or_none()
    if not creator:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Creator profile with ID {creator_id} not found.",
        )

    p_res = await db.execute(
        select(InfluencerPost)
        .where(InfluencerPost.influencer_id == creator.id)
        .order_by(desc(InfluencerPost.posted_at))
    )
    posts = list(p_res.scalars().all())

    engagement = EngagementCalculator.calculate_from_posts(creator=creator, posts=posts)

    collab = creator.collaboration_preferences or {}
    historical_snaps = collab.get("historical_growth_snapshots") or []

    evaluator = AuthenticitySignalEvaluator()
    authenticity = evaluator.evaluate_creator(
        creator=creator,
        posts=posts,
        engagement=engagement,
        historical_observations=historical_snaps,
    )

    return FullAnalyticsReportOut(
        creator_id=creator.id,
        handle=creator.handle,
        engagement=engagement,
        authenticity=authenticity,
        generated_at=datetime.now(timezone.utc),
    )


@router.get(
    "/model-metadata",
    response_model=ModelMetadataOut,
    summary="Authenticity Architecture Documentation & Feature Catalogs",
)
async def get_authenticity_model_metadata():
    """
    Documents active deterministic heuristics versus planned/unimplemented supervised models.
    Fulfills architectural transparency requirements.
    """
    baseline_model = DeterministicHeuristicAuthenticityModel()
    supervised_stub = SupervisedAuthenticityClassifierStub()

    return ModelMetadataOut(
        active_baseline_model=baseline_model.get_model_info(),
        supervised_future_model=supervised_stub.get_model_info(),
        deterministic_heuristics_catalog=DETERMINISTIC_HEURISTICS_CATALOG,
        unimplemented_features_catalog=UNIMPLEMENTED_FEATURES_CATALOG,
    )


def _sanitize_csv_cell(val: Any) -> str:
    """Sanitize cell value to prevent CSV formula injection (RFC 4180 compliance)."""
    if val is None:
        return ""
    s = str(val).strip()
    if s and s[0] in ("=", "+", "-", "@", "\t", "\r"):
        return f"'{s}"
    return s


# ============================================================================
# PHASE 17: BRAND CAMPAIGN ANALYTICS & EXPORT
# ============================================================================

@router.get("/brand", response_model=BrandAnalyticsOut, summary="Brand Campaign Activity & Funnel Analytics")
async def get_brand_analytics(
    campaign_id: Optional[int] = Query(None, description="Filter metrics by specific campaign"),
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    brand: BrandProfile = Depends(get_current_brand_profile),
    db: AsyncSession = Depends(get_db),
):
    """
    Computes real brand analytics from live persisted events:
    - Active, draft, and completed campaigns
    - Shortlist pipeline counts and status breakdowns
    - Invitation response rates and commitments
    - 5-stage participation funnel with stage-to-stage conversion rates
    - Daily activity timeline
    - Per-campaign summary breakdown
    """
    # 1. Fetch campaigns for this brand
    camp_query = select(Campaign).where(Campaign.brand_id == brand.id)
    if campaign_id is not None:
        camp_query = camp_query.where(Campaign.id == campaign_id)
    if start_date:
        camp_query = camp_query.where(Campaign.created_at >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        camp_query = camp_query.where(Campaign.created_at <= datetime.combine(end_date, datetime.max.time()))

    camp_res = await db.execute(camp_query)
    campaigns = camp_res.scalars().all()
    campaign_ids = [c.id for c in campaigns]

    # If a specific campaign_id was requested but not found under this brand
    if campaign_id is not None and not campaigns:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Campaign {campaign_id} not found or not owned by your brand",
        )

    # 2. Campaign counts & budget
    total_campaigns = len(campaigns)
    active_campaigns = sum(1 for c in campaigns if c.status in ["active", "published"])
    draft_campaigns = sum(1 for c in campaigns if c.status == "draft")
    completed_campaigns = sum(1 for c in campaigns if c.status == "completed")
    total_budget = sum(float(c.budget or 0.0) for c in campaigns)

    # 3. Shortlist metrics
    sl_query = select(Shortlist).where(Shortlist.brand_id == brand.id)
    if campaign_id is not None:
        sl_query = sl_query.where(Shortlist.campaign_id == campaign_id)
    elif campaign_ids:
        # Include shortlists tied to brand's filtered campaigns or general brand shortlists
        sl_query = sl_query.where(
            (Shortlist.campaign_id.in_(campaign_ids)) | (Shortlist.campaign_id == None)
        )
    if start_date:
        sl_query = sl_query.where(Shortlist.created_at >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        sl_query = sl_query.where(Shortlist.created_at <= datetime.combine(end_date, datetime.max.time()))

    sl_res = await db.execute(sl_query.options(selectinload(Shortlist.creator)))
    shortlists = sl_res.scalars().all()

    total_shortlisted = len(shortlists)
    shortlist_by_status: Dict[str, int] = {}
    for sl in shortlists:
        st = sl.status.lower()
        shortlist_by_status[st] = shortlist_by_status.get(st, 0) + 1

    # 4. Invitation metrics
    inv_query = select(Invitation).join(Campaign, Campaign.id == Invitation.campaign_id).where(Campaign.brand_id == brand.id)
    if campaign_id is not None:
        inv_query = inv_query.where(Invitation.campaign_id == campaign_id)
    elif campaign_ids:
        inv_query = inv_query.where(Invitation.campaign_id.in_(campaign_ids))
    if start_date:
        inv_query = inv_query.where(Invitation.created_at >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        inv_query = inv_query.where(Invitation.created_at <= datetime.combine(end_date, datetime.max.time()))

    inv_res = await db.execute(
        inv_query.options(
            selectinload(Invitation.campaign),
            selectinload(Invitation.creator),
        )
    )
    invitations = inv_res.scalars().all()

    total_invitations_sent = len(invitations)
    invitations_accepted = sum(1 for i in invitations if i.status == "accepted")
    invitations_declined = sum(1 for i in invitations if i.status == "declined")
    invitations_pending = sum(1 for i in invitations if i.status in ["sent", "viewed", "pending"])
    invitations_expired = sum(1 for i in invitations if i.status == "expired")
    invitations_canceled = sum(1 for i in invitations if i.status == "canceled")

    response_rate_pct = (
        round(((invitations_accepted + invitations_declined) / total_invitations_sent) * 100, 1)
        if total_invitations_sent > 0
        else 0.0
    )
    acceptance_rate_pct = (
        round((invitations_accepted / total_invitations_sent) * 100, 1)
        if total_invitations_sent > 0
        else 0.0
    )

    # Response time in hours
    response_times = [
        (i.responded_at - i.created_at).total_seconds() / 3600.0
        for i in invitations
        if i.responded_at and i.created_at
    ]
    avg_response_time_hours = round(sum(response_times) / len(response_times), 1) if response_times else None

    total_committed_compensation = sum(
        float(i.compensation_offered or 0.0)
        for i in invitations
        if i.status == "accepted"
    )

    # 5. Participation Funnel Calculation
    unique_shortlisted_creators = len(set(sl.creator_id for sl in shortlists))
    unique_invited_creators = len(set(i.creator_id for i in invitations))
    unique_viewed_creators = len(set(i.creator_id for i in invitations if i.status in ["viewed", "accepted", "declined"]))
    unique_responded_creators = len(set(i.creator_id for i in invitations if i.status in ["accepted", "declined"]))
    unique_confirmed_creators = len(set(i.creator_id for i in invitations if i.status == "accepted"))

    funnel = BrandParticipationFunnelOut(
        stage_1_shortlisted=unique_shortlisted_creators,
        stage_2_invited=unique_invited_creators,
        stage_3_viewed=unique_viewed_creators,
        stage_4_responded=unique_responded_creators,
        stage_5_confirmed=unique_confirmed_creators,
        shortlist_to_invite_pct=round((unique_invited_creators / unique_shortlisted_creators * 100), 1) if unique_shortlisted_creators > 0 else 0.0,
        invite_to_view_pct=round((unique_viewed_creators / unique_invited_creators * 100), 1) if unique_invited_creators > 0 else 0.0,
        view_to_response_pct=round((unique_responded_creators / unique_viewed_creators * 100), 1) if unique_viewed_creators > 0 else 0.0,
        response_to_confirm_pct=round((unique_confirmed_creators / unique_responded_creators * 100), 1) if unique_responded_creators > 0 else 0.0,
    )

    # 6. Daily Activity Timeline
    activity_by_day: Dict[str, Dict[str, int]] = {}
    for sl in shortlists:
        d_str = sl.created_at.strftime("%Y-%m-%d")
        if d_str not in activity_by_day:
            activity_by_day[d_str] = {"shortlists_added": 0, "invitations_sent": 0, "invitations_accepted": 0}
        activity_by_day[d_str]["shortlists_added"] += 1

    for inv in invitations:
        d_sent = inv.created_at.strftime("%Y-%m-%d")
        if d_sent not in activity_by_day:
            activity_by_day[d_sent] = {"shortlists_added": 0, "invitations_sent": 0, "invitations_accepted": 0}
        activity_by_day[d_sent]["invitations_sent"] += 1

        if inv.status == "accepted" and inv.responded_at:
            d_acc = inv.responded_at.strftime("%Y-%m-%d")
            if d_acc not in activity_by_day:
                activity_by_day[d_acc] = {"shortlists_added": 0, "invitations_sent": 0, "invitations_accepted": 0}
            activity_by_day[d_acc]["invitations_accepted"] += 1

    sorted_days = sorted(activity_by_day.keys())
    daily_activity = [
        BrandDailyActivityOut(
            date=d,
            shortlists_added=activity_by_day[d]["shortlists_added"],
            invitations_sent=activity_by_day[d]["invitations_sent"],
            invitations_accepted=activity_by_day[d]["invitations_accepted"],
        )
        for d in sorted_days
    ]

    # 7. Campaigns Summary Table
    campaigns_summary: List[BrandCampaignSummaryOut] = []
    for c in campaigns:
        c_shortlists = sum(1 for sl in shortlists if sl.campaign_id == c.id)
        c_invs = [i for i in invitations if i.campaign_id == c.id]
        c_sent = len(c_invs)
        c_accepted = sum(1 for i in c_invs if i.status == "accepted")
        c_declined = sum(1 for i in c_invs if i.status == "declined")
        c_acc_rate = round((c_accepted / c_sent * 100), 1) if c_sent > 0 else 0.0

        campaigns_summary.append(
            BrandCampaignSummaryOut(
                campaign_id=c.id,
                title=c.title,
                status=c.status,
                budget=float(c.budget or 0.0),
                shortlist_count=c_shortlists,
                invitations_sent=c_sent,
                invitations_accepted=c_accepted,
                invitations_declined=c_declined,
                acceptance_rate_pct=c_acc_rate,
            )
        )

    return BrandAnalyticsOut(
        brand_id=brand.id,
        company_name=brand.company_name or "Brand",
        total_campaigns=total_campaigns,
        active_campaigns=active_campaigns,
        draft_campaigns=draft_campaigns,
        completed_campaigns=completed_campaigns,
        total_budget=total_budget,
        total_shortlisted=total_shortlisted,
        shortlist_by_status=shortlist_by_status,
        total_invitations_sent=total_invitations_sent,
        invitations_accepted=invitations_accepted,
        invitations_declined=invitations_declined,
        invitations_pending=invitations_pending,
        invitations_expired=invitations_expired,
        invitations_canceled=invitations_canceled,
        response_rate_pct=response_rate_pct,
        acceptance_rate_pct=acceptance_rate_pct,
        avg_response_time_hours=avg_response_time_hours,
        total_committed_compensation=total_committed_compensation,
        funnel=funnel,
        daily_activity=daily_activity,
        campaigns_summary=campaigns_summary,
    )


@router.get("/brand/export", summary="Authorized CSV Export for Brand Analytics")
async def export_brand_analytics_csv(
    campaign_id: Optional[int] = Query(None, description="Filter export by campaign"),
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    brand: BrandProfile = Depends(get_current_brand_profile),
    db: AsyncSession = Depends(get_db),
):
    """
    Exports brand campaign collaboration and invitation records as an RFC 4180 CSV file.
    Applies strict formula injection mitigation and server-side filtering.
    """
    inv_query = (
        select(Invitation)
        .join(Campaign, Campaign.id == Invitation.campaign_id)
        .where(Campaign.brand_id == brand.id)
        .options(
            selectinload(Invitation.campaign),
            selectinload(Invitation.creator),
        )
        .order_by(Invitation.created_at.desc())
    )
    if campaign_id is not None:
        inv_query = inv_query.where(Invitation.campaign_id == campaign_id)
    if start_date:
        inv_query = inv_query.where(Invitation.created_at >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        inv_query = inv_query.where(Invitation.created_at <= datetime.combine(end_date, datetime.max.time()))

    res = await db.execute(inv_query)
    invitations = res.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)

    # CSV Headers
    headers = [
        "Invitation ID",
        "Campaign ID",
        "Campaign Title",
        "Campaign Status",
        "Creator Handle",
        "Creator Name",
        "Invitation Status",
        "Offered Fee ($)",
        "Deliverables Scope",
        "Sent At",
        "Responded At",
        "Decline Reason",
    ]
    writer.writerow([_sanitize_csv_cell(h) for h in headers])

    for inv in invitations:
        creator_handle = inv.creator.handle if inv.creator else ""
        creator_name = inv.creator.display_name if inv.creator else ""
        scope_str = ", ".join(inv.deliverables_requested) if inv.deliverables_requested else ""
        sent_str = inv.created_at.strftime("%Y-%m-%d %H:%M:%S") if inv.created_at else ""
        resp_str = inv.responded_at.strftime("%Y-%m-%d %H:%M:%S") if inv.responded_at else ""

        row = [
            inv.id,
            inv.campaign_id,
            inv.campaign.title if inv.campaign else "",
            inv.campaign.status if inv.campaign else "",
            creator_handle,
            creator_name,
            inv.status,
            inv.compensation_offered or 0.0,
            scope_str,
            sent_str,
            resp_str,
            inv.decline_reason or "",
        ]
        writer.writerow([_sanitize_csv_cell(val) for val in row])

    csv_data = output.getvalue()
    timestamp_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"brand_analytics_export_{timestamp_str}.csv"

    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ============================================================================
# PHASE 17: CREATOR / INFLUENCER ANALYTICS & EXPORT
# ============================================================================

@router.get("/creator", response_model=CreatorAnalyticsOut, summary="Creator Campaign & Response Analytics")
async def get_creator_analytics(
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    creator: CreatorProfile = Depends(get_current_creator_profile),
    db: AsyncSession = Depends(get_db),
):
    """
    Computes real creator analytics from live application events:
    - Opportunity interactions (saved, dismissed, eligible count)
    - Invitation response rates and earned compensation
    - Profile data freshness and completeness
    - Active partnerships and recent activity timeline
    """
    # 1. Opportunities & Interactions
    opp_query = select(Campaign).where(Campaign.status.in_(["published", "active"]))
    all_active_camps = (await db.execute(opp_query)).scalars().all()
    total_eligible_opportunities = len(all_active_camps)

    inter_res = await db.execute(
        select(CreatorOpportunityInteraction).where(
            CreatorOpportunityInteraction.creator_id == creator.id
        )
    )
    interactions = inter_res.scalars().all()
    saved_opportunities = sum(1 for it in interactions if it.status == "saved")
    dismissed_opportunities = sum(1 for it in interactions if it.status == "dismissed")

    opportunities_out = CreatorOpportunitiesAnalyticsOut(
        total_eligible_opportunities=total_eligible_opportunities,
        saved_opportunities=saved_opportunities,
        dismissed_opportunities=dismissed_opportunities,
    )

    # 2. Invitations & Response History
    inv_query = (
        select(Invitation)
        .where(Invitation.creator_id == creator.id)
        .options(
            selectinload(Invitation.campaign).selectinload(Campaign.brand)
        )
        .order_by(Invitation.created_at.desc())
    )
    if start_date:
        inv_query = inv_query.where(Invitation.created_at >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        inv_query = inv_query.where(Invitation.created_at <= datetime.combine(end_date, datetime.max.time()))

    res = await db.execute(inv_query)
    invitations = res.scalars().all()

    total_received = len(invitations)
    accepted = sum(1 for i in invitations if i.status == "accepted")
    declined = sum(1 for i in invitations if i.status == "declined")
    pending = sum(1 for i in invitations if i.status in ["sent", "viewed", "pending"])
    expired = sum(1 for i in invitations if i.status == "expired")
    canceled = sum(1 for i in invitations if i.status == "canceled")

    response_rate_pct = (
        round(((accepted + declined) / total_received) * 100, 1) if total_received > 0 else 0.0
    )
    acceptance_rate_pct = (
        round((accepted / total_received) * 100, 1) if total_received > 0 else 0.0
    )

    total_earned_compensation = sum(
        float(i.compensation_offered or 0.0)
        for i in invitations
        if i.status == "accepted"
    )
    offer_values = [float(i.compensation_offered or 0.0) for i in invitations if i.compensation_offered]
    avg_offer_value = round(sum(offer_values) / len(offer_values), 2) if offer_values else 0.0

    invitations_out = CreatorInvitationsAnalyticsOut(
        total_received=total_received,
        accepted=accepted,
        declined=declined,
        pending=pending,
        expired=expired,
        canceled=canceled,
        response_rate_pct=response_rate_pct,
        acceptance_rate_pct=acceptance_rate_pct,
        total_earned_compensation=total_earned_compensation,
        avg_offer_value=avg_offer_value,
    )

    # 3. Profile Data Freshness
    completeness = creator.calculate_completeness()
    freshness_out = CreatorDataFreshnessOut(
        data_source=creator.data_source or "user_manual",
        freshness_status=creator.freshness_status or "manual",
        last_fetched_at=creator.last_fetched_at,
        profile_completeness_pct=completeness["score"],
        is_verified=creator.is_verified,
        is_platform_verified=creator.is_platform_verified,
    )

    # 4. Recent Activity
    recent_activity = [
        CreatorRecentActivityOut(
            invitation_id=i.id,
            campaign_title=i.campaign.title if i.campaign else "Campaign",
            brand_name=i.campaign.brand.company_name if (i.campaign and i.campaign.brand) else "Brand",
            status=i.status,
            compensation_offered=i.compensation_offered,
            created_at=i.created_at,
            responded_at=i.responded_at,
        )
        for i in invitations[:10]
    ]

    return CreatorAnalyticsOut(
        creator_id=creator.id,
        handle=creator.handle,
        display_name=creator.display_name,
        opportunities=opportunities_out,
        invitations=invitations_out,
        freshness=freshness_out,
        recent_activity=recent_activity,
        active_partnerships_count=accepted,
    )


@router.get("/creator/export", summary="Authorized CSV Export for Influencer Analytics")
async def export_creator_analytics_csv(
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    creator: CreatorProfile = Depends(get_current_creator_profile),
    db: AsyncSession = Depends(get_db),
):
    """
    Exports creator partnership outreach and response records as an RFC 4180 CSV file.
    Applies formula injection mitigation and date filtering.
    """
    inv_query = (
        select(Invitation)
        .where(Invitation.creator_id == creator.id)
        .options(
            selectinload(Invitation.campaign).selectinload(Campaign.brand)
        )
        .order_by(Invitation.created_at.desc())
    )
    if start_date:
        inv_query = inv_query.where(Invitation.created_at >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        inv_query = inv_query.where(Invitation.created_at <= datetime.combine(end_date, datetime.max.time()))

    res = await db.execute(inv_query)
    invitations = res.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)

    headers = [
        "Invitation ID",
        "Brand Partner",
        "Campaign Title",
        "Status",
        "Offered Fee ($)",
        "Deliverables Requested",
        "Date Received",
        "Date Responded",
        "Decline Reason",
    ]
    writer.writerow([_sanitize_csv_cell(h) for h in headers])

    for inv in invitations:
        brand_name = inv.campaign.brand.company_name if (inv.campaign and inv.campaign.brand) else "Brand"
        camp_title = inv.campaign.title if inv.campaign else "Campaign"
        scope_str = ", ".join(inv.deliverables_requested) if inv.deliverables_requested else ""
        sent_str = inv.created_at.strftime("%Y-%m-%d %H:%M:%S") if inv.created_at else ""
        resp_str = inv.responded_at.strftime("%Y-%m-%d %H:%M:%S") if inv.responded_at else ""

        row = [
            inv.id,
            brand_name,
            camp_title,
            inv.status,
            inv.compensation_offered or 0.0,
            scope_str,
            sent_str,
            resp_str,
            inv.decline_reason or "",
        ]
        writer.writerow([_sanitize_csv_cell(val) for val in row])

    csv_data = output.getvalue()
    timestamp_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"creator_analytics_export_{timestamp_str}.csv"

    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


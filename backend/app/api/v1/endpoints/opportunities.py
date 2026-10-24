from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_creator_profile
from app.core.database import get_db
from app.models.entities import (
    Campaign,
    CreatorOpportunityInteraction,
    CreatorProfile,
    Invitation,
)
from app.schemas.workflow import (
    CampaignOpportunityOut,
    OpportunityInteractionRequest,
)

router = APIRouter()


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _calculate_opportunity_fit(campaign: Campaign, creator: CreatorProfile):
    """
    Deterministic explainable fit score calculation between an open campaign and creator.
    Evaluates niche alignment, follower capacity, engagement rate, and geographic affinity.
    """
    score = 0.0
    strengths: List[str] = []

    # 1. Niche Alignment (up to 40 pts)
    creator_niches = [
        n.lower().strip()
        for n in (creator.content_niches or ([creator.primary_niche] if creator.primary_niche else []))
    ]
    camp_niche = campaign.niche.lower().strip() if campaign.niche else ""
    if camp_niche in creator_niches:
        score += 40.0
        strengths.append(f"Direct Niche Alignment: Matched '{campaign.niche}' content domain")
    elif any(n in camp_niche or camp_niche in n for n in creator_niches):
        score += 25.0
        strengths.append(f"Related Content Niche: High topical relevance to '{campaign.niche}'")
    else:
        score += 5.0

    # 2. Audience Scale (up to 25 pts)
    creator_followers = creator.total_followers or 0
    min_followers = campaign.min_followers or 0
    if creator_followers >= min_followers:
        score += 25.0
        strengths.append(
            f"Audience Reach: Follower count ({creator_followers:,}) satisfies minimum requirement ({min_followers:,}+)"
        )
    elif min_followers > 0:
        ratio = min(1.0, creator_followers / min_followers)
        score += 25.0 * ratio
    else:
        score += 25.0

    # 3. Engagement Rate (up to 25 pts)
    creator_er = creator.avg_engagement_rate or 0.0
    min_er = campaign.min_engagement_rate or 0.0
    if creator_er >= min_er:
        score += 25.0
        strengths.append(
            f"Engagement Quality: Creator engagement ({creator_er:.1f}%) meets threshold ({min_er:.1f}%)"
        )
    elif min_er > 0:
        ratio = min(1.0, creator_er / min_er)
        score += 25.0 * ratio
    else:
        score += 25.0

    # 4. Location Affinity (up to 10 pts)
    camp_loc = (campaign.target_location or "").lower()
    creator_loc = (getattr(creator, "country", None) or getattr(creator, "location", None) or "").lower()
    if (
        not camp_loc
        or "global" in camp_loc
        or "worldwide" in camp_loc
        or camp_loc in creator_loc
        or creator_loc in camp_loc
    ):
        score += 10.0
        strengths.append("Geographic Fit: Primary creator region matches brand target market")
    else:
        score += 3.0

    total_score = round(min(100.0, score), 1)

    if total_score >= 80.0:
        summary = "Exceptional Brand Match: Strong niche overlap and qualified audience metrics."
    elif total_score >= 60.0:
        summary = "Favorable Match: Meets key engagement thresholds and audience targets."
    else:
        summary = "Moderate Fit: Core audience criteria partially match campaign parameters."

    return total_score, summary, strengths


@router.get("/", response_model=List[CampaignOpportunityOut])
async def list_campaign_opportunities(
    search: Optional[str] = None,
    niche: Optional[str] = None,
    include_dismissed: bool = Query(False, description="Whether to include dismissed briefs"),
    creator: CreatorProfile = Depends(get_current_creator_profile),
    db: AsyncSession = Depends(get_db),
):
    """
    List open campaign opportunities for creators with deterministic match explanations,
    saved/dismissed filtering, and direct invitation status.
    """
    # Fetch active/published campaigns
    query = (
        select(Campaign)
        .where(Campaign.status.in_(["published", "active"]))
        .options(selectinload(Campaign.brand))
        .order_by(Campaign.created_at.desc())
    )

    if search:
        search_term = f"%{search.strip()}%"
        query = query.where(
            or_(
                Campaign.title.ilike(search_term),
                Campaign.description.ilike(search_term),
                Campaign.product_description.ilike(search_term),
            )
        )

    if niche and niche.lower() != "all":
        query = query.where(Campaign.niche.ilike(f"%{niche.strip()}%"))

    campaigns_res = await db.execute(query)
    campaigns = campaigns_res.scalars().all()

    if not campaigns:
        return []

    campaign_ids = [c.id for c in campaigns]

    # Fetch creator interactions
    interact_res = await db.execute(
        select(CreatorOpportunityInteraction).where(
            CreatorOpportunityInteraction.creator_id == creator.id,
            CreatorOpportunityInteraction.campaign_id.in_(campaign_ids),
        )
    )
    interactions_map = {
        inter.campaign_id: inter for inter in interact_res.scalars().all()
    }

    # Fetch any invitations sent to this creator for these campaigns
    invites_res = await db.execute(
        select(Invitation).where(
            Invitation.creator_id == creator.id,
            Invitation.campaign_id.in_(campaign_ids),
        )
    )
    invites_map = {inv.campaign_id: inv for inv in invites_res.scalars().all()}

    results: List[CampaignOpportunityOut] = []
    for camp in campaigns:
        interaction = interactions_map.get(camp.id)
        is_saved = (interaction.status == "saved") if interaction else False
        is_dismissed = (interaction.status == "dismissed") if interaction else False

        # Skip dismissed campaigns unless explicitly requested
        if is_dismissed and not include_dismissed:
            continue

        invitation = invites_map.get(camp.id)
        has_invitation = invitation is not None
        invitation_id = invitation.id if invitation else None
        invitation_status = (
            invitation.status.value
            if (invitation and hasattr(invitation.status, "value"))
            else str(invitation.status)
            if invitation
            else None
        )

        fit_score, fit_summary, match_strengths = _calculate_opportunity_fit(camp, creator)

        brand_name = camp.brand.company_name if camp.brand else "Verified Brand"

        results.append(
            CampaignOpportunityOut(
                id=camp.id,
                brand_id=camp.brand_id,
                brand_name=brand_name,
                title=camp.title,
                niche=camp.niche or "General",
                objective=camp.objective or "Brand Awareness",
                description=camp.description or "",
                product_description=camp.product_description or "",
                budget=float(camp.budget or 0.0),
                currency=camp.currency or "USD",
                target_location=camp.target_location or "Global",
                deliverables=camp.deliverables or [],
                min_followers=camp.min_followers or 0,
                min_engagement_rate=float(camp.min_engagement_rate or 0.0),
                status=camp.status,
                created_at=camp.created_at,
                is_saved=is_saved,
                is_dismissed=is_dismissed,
                has_invitation=has_invitation,
                invitation_id=invitation_id,
                invitation_status=invitation_status,
                fit_score=fit_score,
                fit_summary=fit_summary,
                match_strengths=match_strengths,
            )
        )

    # Sort opportunities: prioritized by fit_score descending
    results.sort(key=lambda x: (x.has_invitation, x.fit_score or 0.0), reverse=True)
    return results


@router.post("/{campaign_id}/interact")
async def interact_with_opportunity(
    campaign_id: int,
    payload: OpportunityInteractionRequest,
    creator: CreatorProfile = Depends(get_current_creator_profile),
    db: AsyncSession = Depends(get_db),
):
    """
    Save, unsave, dismiss, or undismiss a campaign opportunity in the creator feed.
    """
    # Verify campaign exists
    camp_res = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    camp = camp_res.scalar_one_or_none()
    if not camp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Campaign {campaign_id} not found",
        )

    action = payload.action.lower()
    if action not in ["save", "unsave", "dismiss", "undismiss"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid action '{payload.action}'. Must be 'save', 'unsave', 'dismiss', or 'undismiss'",
        )

    res = await db.execute(
        select(CreatorOpportunityInteraction).where(
            CreatorOpportunityInteraction.creator_id == creator.id,
            CreatorOpportunityInteraction.campaign_id == campaign_id,
        )
    )
    interaction = res.scalar_one_or_none()

    now = _utcnow()
    target_status = "saved" if action == "save" else "dismissed" if action == "dismiss" else "none"

    if not interaction:
        interaction = CreatorOpportunityInteraction(
            creator_id=creator.id,
            campaign_id=campaign_id,
            status=target_status,
            created_at=now,
            updated_at=now,
        )
        db.add(interaction)
    else:
        interaction.status = target_status
        interaction.updated_at = now

    await db.commit()

    return {
        "success": True,
        "campaign_id": campaign_id,
        "action": action,
        "is_saved": (interaction.status == "saved"),
        "is_dismissed": (interaction.status == "dismissed"),
    }

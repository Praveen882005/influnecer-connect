from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.api.deps import get_current_brand_profile, get_current_creator_profile, get_current_user
from app.core.database import get_db
from app.models.entities import (
    BrandProfile,
    Campaign,
    CampaignStatus,
    CreatorProfile,
    Proposal,
    ProposalStatus,
    User,
    UserRole,
)
from app.schemas.campaign import (
    ALLOWED_STATUS_TRANSITIONS,
    CampaignCreate,
    CampaignOut,
    CampaignStatusUpdate,
    CampaignUpdate,
    PaginatedCampaigns,
)
from app.schemas.proposal import ProposalCreate, ProposalOut

router = APIRouter()


def _format_campaign_out(c: Campaign, p_count: int = 0) -> CampaignOut:
    return CampaignOut(
        id=c.id,
        brand_id=c.brand_id,
        title=c.title,
        description=c.description,
        product_description=c.product_description or "",
        niche=c.niche,
        objective=c.objective or "Brand Awareness",
        target_audience=c.target_audience or {},
        target_location=c.target_location or "Global",
        budget=c.budget,
        budget_min=c.budget_min,
        budget_max=c.budget_max,
        currency=c.currency or "USD",
        required_criteria=c.required_criteria or {},
        preferred_criteria=c.preferred_criteria or {},
        deliverables=c.deliverables or [],
        min_followers=c.min_followers,
        min_engagement_rate=c.min_engagement_rate,
        status=c.status,
        start_date=c.start_date,
        end_date=c.end_date,
        deadline=c.deadline,
        created_at=c.created_at,
        updated_at=c.updated_at,
        brand_name=c.brand.company_name if c.brand else None,
        proposal_count=p_count,
    )


@router.get("/", response_model=List[CampaignOut], summary="List campaigns with search and filtering")
async def list_campaigns(
    response: Response,
    status_filter: Optional[CampaignStatus] = Query(None, alias="status", description="Filter by status"),
    niche: Optional[str] = Query(None, description="Filter by category niche"),
    min_budget: Optional[float] = Query(None, ge=0, description="Minimum campaign budget"),
    max_budget: Optional[float] = Query(None, ge=0, description="Maximum campaign budget"),
    currency: Optional[str] = Query(None, description="Currency code (e.g. USD, EUR)"),
    q: Optional[str] = Query(None, description="Search keyword in title, description or niche"),
    location: Optional[str] = Query(None, description="Filter by target location"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """
    Search and filter public campaigns.
    By default, lists active or published campaigns visible to creators and brands.
    """
    query = select(Campaign).options(selectinload(Campaign.brand))

    if status_filter:
        query = query.where(Campaign.status == status_filter)
    else:
        # Default view for marketplace: Active or Published campaigns
        query = query.where(
            Campaign.status.in_([CampaignStatus.ACTIVE, CampaignStatus.PUBLISHED])
        )

    if niche:
        query = query.where(Campaign.niche.ilike(f"%{niche}%"))
    if min_budget is not None:
        query = query.where(Campaign.budget >= min_budget)
    if max_budget is not None:
        query = query.where(Campaign.budget <= max_budget)
    if currency:
        query = query.where(Campaign.currency.ilike(currency.strip()))
    if location:
        query = query.where(Campaign.target_location.ilike(f"%{location}%"))
    if q:
        search_filter = or_(
            Campaign.title.ilike(f"%{q}%"),
            Campaign.description.ilike(f"%{q}%"),
            Campaign.product_description.ilike(f"%{q}%"),
            Campaign.niche.ilike(f"%{q}%"),
        )
        query = query.where(search_filter)

    # Get total matching count for pagination
    count_subq = query.with_only_columns(func.count(Campaign.id)).order_by(None)
    total_res = await db.execute(count_subq)
    total_count = total_res.scalar() or 0
    response.headers["X-Total-Count"] = str(total_count)

    query = query.order_by(Campaign.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    campaigns = result.scalars().all()

    out_list = []
    for c in campaigns:
        p_count_res = await db.execute(
            select(func.count(Proposal.id)).where(Proposal.campaign_id == c.id)
        )
        p_count = p_count_res.scalar() or 0
        out_list.append(_format_campaign_out(c, p_count))
    return out_list


@router.post("/", response_model=CampaignOut, status_code=status.HTTP_201_CREATED, summary="Create a new campaign")
async def create_campaign(
    campaign_in: CampaignCreate,
    brand: BrandProfile = Depends(get_current_brand_profile),
    db: AsyncSession = Depends(get_db),
):
    """
    Creates a new campaign owned by the authenticated brand.
    Enforces budget boundaries, date validation, and required fields.
    """
    # Prevent duplicate identical campaign creation within short window
    duplicate_res = await db.execute(
        select(Campaign).where(
            Campaign.brand_id == brand.id,
            Campaign.title == campaign_in.title,
            Campaign.status != CampaignStatus.ARCHIVED,
        )
    )
    if duplicate_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"An active or draft campaign with the title '{campaign_in.title}' already exists for your brand.",
        )

    campaign = Campaign(
        brand_id=brand.id,
        title=campaign_in.title,
        description=campaign_in.description,
        product_description=campaign_in.product_description or "",
        niche=campaign_in.niche,
        objective=campaign_in.objective,
        target_audience=campaign_in.target_audience or {},
        target_location=campaign_in.target_location or "Global",
        budget=campaign_in.budget,
        budget_min=campaign_in.budget_min,
        budget_max=campaign_in.budget_max,
        currency=campaign_in.currency or "USD",
        required_criteria=campaign_in.required_criteria or {},
        preferred_criteria=campaign_in.preferred_criteria or {},
        deliverables=campaign_in.deliverables or [],
        min_followers=campaign_in.min_followers,
        min_engagement_rate=campaign_in.min_engagement_rate,
        status=campaign_in.status,
        start_date=campaign_in.start_date,
        end_date=campaign_in.end_date,
        deadline=campaign_in.deadline,
    )
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)

    return _format_campaign_out(campaign, p_count=0)


@router.get("/my", response_model=List[CampaignOut], summary="List campaigns owned by authenticated brand")
@router.get("/mine", response_model=List[CampaignOut], summary="Alias for /my")
@router.get("/me", response_model=List[CampaignOut], summary="Alias for /my")
async def get_my_brand_campaigns(
    response: Response,
    status_filter: Optional[CampaignStatus] = Query(None, alias="status"),
    niche: Optional[str] = Query(None, description="Filter by category niche"),
    q: Optional[str] = Query(None, description="Search keyword"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    brand: BrandProfile = Depends(get_current_brand_profile),
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieves all campaigns created by the current brand across all statuses (draft, published, paused, etc.).
    """
    query = select(Campaign).where(Campaign.brand_id == brand.id)

    if status_filter:
        query = query.where(Campaign.status == status_filter)
    if niche and niche.lower() != "all":
        clean_niche = niche.strip().lower()
        if clean_niche == "technology":
            query = query.where(or_(Campaign.niche.ilike("%tech%"), Campaign.niche.ilike("%technology%")))
        else:
            query = query.where(Campaign.niche.ilike(f"%{clean_niche}%"))
    if q:
        query = query.where(
            or_(
                Campaign.title.ilike(f"%{q}%"),
                Campaign.description.ilike(f"%{q}%"),
                Campaign.niche.ilike(f"%{q}%"),
            )
        )

    count_res = await db.execute(query.with_only_columns(func.count(Campaign.id)).order_by(None))
    total_count = count_res.scalar() or 0
    response.headers["X-Total-Count"] = str(total_count)

    query = query.order_by(Campaign.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    campaigns = result.scalars().all()

    out_list = []
    for c in campaigns:
        p_count_res = await db.execute(
            select(func.count(Proposal.id)).where(Proposal.campaign_id == c.id)
        )
        p_count = p_count_res.scalar() or 0
        out_list.append(_format_campaign_out(c, p_count))
    return out_list


@router.get("/{campaign_id}", response_model=CampaignOut, summary="Retrieve campaign details by ID")
async def get_campaign_by_id(campaign_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Campaign).options(selectinload(Campaign.brand)).where(Campaign.id == campaign_id)
    )
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Campaign with ID {campaign_id} was not found.",
        )

    p_count_res = await db.execute(
        select(func.count(Proposal.id)).where(Proposal.campaign_id == c.id)
    )
    p_count = p_count_res.scalar() or 0

    return _format_campaign_out(c, p_count)


@router.get("/{campaign_id}/proposals", response_model=List[ProposalOut], summary="List proposals for a campaign")
async def get_campaign_proposals(
    campaign_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    c_res = await db.execute(
        select(Campaign).options(selectinload(Campaign.brand)).where(Campaign.id == campaign_id)
    )
    campaign = c_res.scalar_one_or_none()
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Campaign {campaign_id} not found",
        )
    if current_user.role == UserRole.BRAND and campaign.brand and campaign.brand.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view proposals for another brand's campaign",
        )

    result = await db.execute(
        select(Proposal)
        .options(selectinload(Proposal.creator))
        .where(Proposal.campaign_id == campaign_id)
        .order_by(Proposal.created_at.desc())
    )
    proposals = result.scalars().all()
    return [
        ProposalOut(
            id=p.id,
            campaign_id=p.campaign_id,
            creator_id=p.creator_id,
            pitch=p.pitch,
            proposed_rate=p.proposed_rate,
            estimated_delivery_days=p.estimated_delivery_days,
            status=p.status,
            deliverable_links=p.deliverable_links or [],
            feedback=p.feedback or "",
            created_at=p.created_at,
            updated_at=p.updated_at,
            creator_name=p.creator.display_name if p.creator else None,
            creator_handle=p.creator.handle if p.creator else None,
            campaign_title=campaign.title,
            brand_name=campaign.brand.company_name if campaign.brand else None,
        )
        for p in proposals
    ]


@router.post("/{campaign_id}/proposals", response_model=ProposalOut, status_code=status.HTTP_201_CREATED, summary="Submit proposal to campaign")
async def submit_campaign_proposal(
    campaign_id: int,
    proposal_in: ProposalCreate,
    creator: CreatorProfile = Depends(get_current_creator_profile),
    db: AsyncSession = Depends(get_db),
):
    c_res = await db.execute(
        select(Campaign).options(selectinload(Campaign.brand)).where(Campaign.id == campaign_id)
    )
    campaign = c_res.scalar_one_or_none()
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Campaign {campaign_id} not found",
        )

    existing = await db.execute(
        select(Proposal).where(
            Proposal.campaign_id == campaign_id,
            Proposal.creator_id == creator.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already submitted a proposal for this campaign",
        )

    proposal = Proposal(
        campaign_id=campaign_id,
        creator_id=creator.id,
        pitch=proposal_in.pitch,
        proposed_rate=proposal_in.proposed_rate,
        estimated_delivery_days=proposal_in.estimated_delivery_days,
        status=ProposalStatus.PENDING,
        deliverable_links=[],
        feedback="",
    )
    db.add(proposal)
    await db.commit()
    await db.refresh(proposal)

    return ProposalOut(
        id=proposal.id,
        campaign_id=proposal.campaign_id,
        creator_id=proposal.creator_id,
        pitch=proposal.pitch,
        proposed_rate=proposal.proposed_rate,
        estimated_delivery_days=proposal.estimated_delivery_days,
        status=proposal.status,
        deliverable_links=proposal.deliverable_links or [],
        feedback=proposal.feedback or "",
        created_at=proposal.created_at,
        updated_at=proposal.updated_at,
        creator_name=creator.display_name,
        creator_handle=creator.handle,
        campaign_title=campaign.title,
        brand_name=campaign.brand.company_name if campaign.brand else None,
    )


@router.put("/{campaign_id}", response_model=CampaignOut, summary="Update campaign fields and brief")
async def update_campaign(
    campaign_id: int,
    campaign_in: CampaignUpdate,
    brand: BrandProfile = Depends(get_current_brand_profile),
    db: AsyncSession = Depends(get_db),
):
    """
    Updates campaign details.
    Enforces ownership (Brand A cannot edit Brand B's campaign),
    forbids modifying archived campaigns, and validates status transitions.
    """
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Campaign with ID {campaign_id} was not found.",
        )

    # Ownership enforcement
    if c.brand_id != brand.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to modify this campaign. Ownership check failed.",
        )

    # Terminal state check
    if c.status == CampaignStatus.ARCHIVED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Archived campaigns are permanently sealed and cannot be modified.",
        )

    # Status transition validation
    if campaign_in.status is not None and campaign_in.status != c.status:
        allowed = ALLOWED_STATUS_TRANSITIONS.get(c.status, set())
        if campaign_in.status not in allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid campaign status transition from '{c.status.value}' to '{campaign_in.status.value}'.",
            )
        c.status = campaign_in.status

    update_data = campaign_in.model_dump(exclude_unset=True)
    update_data.pop("status", None)
    update_data.pop("name", None)

    for field, value in update_data.items():
        if hasattr(c, field):
            setattr(c, field, value)

    await db.commit()
    await db.refresh(c)

    p_count_res = await db.execute(
        select(func.count(Proposal.id)).where(Proposal.campaign_id == c.id)
    )
    p_count = p_count_res.scalar() or 0

    return _format_campaign_out(c, p_count)


@router.patch("/{campaign_id}/status", response_model=CampaignOut, summary="Transition campaign status")
async def transition_campaign_status(
    campaign_id: int,
    status_in: CampaignStatusUpdate,
    brand: BrandProfile = Depends(get_current_brand_profile),
    db: AsyncSession = Depends(get_db),
):
    """
    Transitions campaign lifecycle status (e.g. publish draft, pause active, complete, archive).
    Validates allowed status transition graph.
    """
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Campaign with ID {campaign_id} was not found.",
        )

    if c.brand_id != brand.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to change the status of this campaign.",
        )

    if c.status == CampaignStatus.ARCHIVED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Archived campaigns cannot transition to another state.",
        )

    if status_in.status != c.status:
        allowed = ALLOWED_STATUS_TRANSITIONS.get(c.status, set())
        if status_in.status not in allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid campaign status transition from '{c.status.value}' to '{status_in.status.value}'.",
            )
        c.status = status_in.status

    await db.commit()
    await db.refresh(c)

    p_count_res = await db.execute(
        select(func.count(Proposal.id)).where(Proposal.campaign_id == c.id)
    )
    p_count = p_count_res.scalar() or 0

    return _format_campaign_out(c, p_count)


@router.delete("/{campaign_id}", status_code=status.HTTP_200_OK, summary="Archive or delete campaign")
async def delete_campaign(
    campaign_id: int,
    brand: BrandProfile = Depends(get_current_brand_profile),
    db: AsyncSession = Depends(get_db),
):
    """
    Deletes or archives a campaign owned by the brand.
    Draft campaigns are permanently deleted; published/completed campaigns are transitioned to archived.
    """
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Campaign with ID {campaign_id} was not found.",
        )

    if c.brand_id != brand.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this campaign.",
        )

    if c.status == CampaignStatus.DRAFT:
        await db.delete(c)
        await db.commit()
        return {"message": f"Draft campaign '{c.title}' was permanently deleted.", "archived": False}
    else:
        c.status = CampaignStatus.ARCHIVED
        await db.commit()
        return {"message": f"Campaign '{c.title}' was archived.", "archived": True}

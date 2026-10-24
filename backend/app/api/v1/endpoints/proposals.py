from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
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
    CreatorProfile,
    Proposal,
    ProposalStatus,
    User,
    UserRole,
)
from app.schemas.proposal import ProposalCreate, ProposalOut, ProposalUpdate

router = APIRouter()


@router.post("/", response_model=ProposalOut, status_code=status.HTTP_201_CREATED)
async def submit_proposal(
    proposal_in: ProposalCreate,
    creator: CreatorProfile = Depends(get_current_creator_profile),
    db: AsyncSession = Depends(get_db),
):
    # Verify campaign exists
    c_res = await db.execute(select(Campaign).options(selectinload(Campaign.brand)).where(Campaign.id == proposal_in.campaign_id))
    campaign = c_res.scalar_one_or_none()
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Campaign {proposal_in.campaign_id} not found",
        )

    # Check for existing proposal from this creator
    existing = await db.execute(
        select(Proposal).where(
            Proposal.campaign_id == proposal_in.campaign_id,
            Proposal.creator_id == creator.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already submitted a proposal for this campaign",
        )

    proposal = Proposal(
        campaign_id=proposal_in.campaign_id,
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


@router.get("/my", response_model=List[ProposalOut])
@router.get("/me", response_model=List[ProposalOut], summary="Alias for /my")
@router.get("/mine", response_model=List[ProposalOut], summary="Alias for /my")
async def get_my_creator_proposals(
    creator: CreatorProfile = Depends(get_current_creator_profile),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Proposal)
        .options(selectinload(Proposal.campaign).selectinload(Campaign.brand))
        .where(Proposal.creator_id == creator.id)
        .order_by(Proposal.created_at.desc())
    )
    proposals = result.scalars().all()

    out_list = []
    for p in proposals:
        out_list.append(
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
                creator_name=creator.display_name,
                creator_handle=creator.handle,
                campaign_title=p.campaign.title if p.campaign else None,
                brand_name=p.campaign.brand.company_name if p.campaign and p.campaign.brand else None,
            )
        )
    return out_list


@router.get("/campaign/{campaign_id}", response_model=List[ProposalOut])
@router.get("/by-campaign/{campaign_id}", response_model=List[ProposalOut], summary="Alias for /campaign/{id}")
async def get_proposals_for_campaign(
    campaign_id: int,
    brand: BrandProfile = Depends(get_current_brand_profile),
    db: AsyncSession = Depends(get_db),
):
    # Verify campaign exists and enforce brand ownership
    c_res = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = c_res.scalar_one_or_none()
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Campaign {campaign_id} not found",
        )
    if campaign.brand_id != brand.id:
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

    out_list = []
    for p in proposals:
        out_list.append(
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
                brand_name=brand.company_name,
            )
        )
    return out_list


@router.put("/{proposal_id}/status", response_model=ProposalOut)
@router.patch("/{proposal_id}/status", response_model=ProposalOut, summary="Patch proposal status or deliverables")
async def update_proposal_status(
    proposal_id: int,
    proposal_in: ProposalUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Proposal)
        .options(
            selectinload(Proposal.campaign).selectinload(Campaign.brand),
            selectinload(Proposal.creator),
        )
        .where(Proposal.id == proposal_id)
    )
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Proposal {proposal_id} not found",
        )

    # Authorization logic:
    # Brand owner of the campaign can accept/reject or add feedback
    # Creator owner of the proposal can withdraw or update deliverable links
    is_brand_owner = (
        current_user.role == UserRole.BRAND
        and p.campaign.brand.user_id == current_user.id
    )
    is_creator_owner = (
        current_user.role == UserRole.CREATOR
        and p.creator.user_id == current_user.id
    )
    is_admin = current_user.role == UserRole.ADMIN

    if not (is_brand_owner or is_creator_owner or is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to modify this proposal",
        )

    # Creators cannot accept or reject their own proposal
    if is_creator_owner and not (is_brand_owner or is_admin):
        if proposal_in.status and proposal_in.status in (ProposalStatus.ACCEPTED, ProposalStatus.REJECTED):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Creators cannot accept or reject their own proposal. Only the campaign brand owner can accept/reject.",
            )

    update_data = proposal_in.model_dump(exclude_unset=True)
    # Brand cannot mutate proposed rate or pitch
    if is_brand_owner and not is_admin:
        update_data.pop("proposed_rate", None)
        update_data.pop("pitch", None)
        update_data.pop("estimated_delivery_days", None)

    for field, value in update_data.items():
        setattr(p, field, value)

    await db.commit()
    await db.refresh(p)

    return ProposalOut(
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
        campaign_title=p.campaign.title if p.campaign else None,
        brand_name=p.campaign.brand.company_name if p.campaign and p.campaign.brand else None,
    )

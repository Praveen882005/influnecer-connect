from datetime import datetime, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
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
    Invitation,
    InvitationStatus,
    Notification,
    Shortlist,
    User,
    UserRole,
)
from app.schemas.workflow import (
    InvitationCreate,
    InvitationOut,
    InvitationStatusUpdate,
)

router = APIRouter()

TERMINAL_STATUSES = {
    InvitationStatus.ACCEPTED.value,
    InvitationStatus.DECLINED.value,
    InvitationStatus.CANCELED.value,
    InvitationStatus.EXPIRED.value,
}


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _to_invitation_out(item: Invitation) -> InvitationOut:
    campaign_title = item.campaign.title if item.campaign else "Unknown Campaign"
    brand_id = item.campaign.brand_id if item.campaign else 0
    brand_name = (
        item.campaign.brand.company_name
        if (item.campaign and item.campaign.brand)
        else "Unknown Brand"
    )
    creator_name = item.creator.display_name if item.creator else None
    creator_handle = item.creator.handle if item.creator else None
    return InvitationOut(
        id=item.id,
        campaign_id=item.campaign_id,
        campaign_title=campaign_title,
        brand_id=brand_id,
        brand_name=brand_name,
        creator_id=item.creator_id,
        creator_name=creator_name,
        creator_handle=creator_handle,
        message=item.message or "",
        status=item.status.value if hasattr(item.status, "value") else str(item.status),
        compensation_offered=item.compensation_offered,
        deliverables_requested=item.deliverables_requested or [],
        expires_at=item.expires_at,
        responded_at=item.responded_at,
        decline_reason=item.decline_reason,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


@router.post("/", response_model=InvitationOut, status_code=status.HTTP_201_CREATED)
async def create_invitation(
    payload: InvitationCreate,
    brand: BrandProfile = Depends(get_current_brand_profile),
    db: AsyncSession = Depends(get_db),
):
    """
    Brand invites an eligible creator to participate in a campaign.
    Enforces campaign ownership, duplicate protection, updates shortlist,
    and sends a persistent in-app notification.
    """
    # Verify campaign ownership
    camp_res = await db.execute(
        select(Campaign).where(
            Campaign.id == payload.campaign_id,
            Campaign.brand_id == brand.id,
        )
    )
    campaign = camp_res.scalar_one_or_none()
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Campaign {payload.campaign_id} not found or not owned by your brand",
        )

    if campaign.status in ["archived", "completed"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot invite creators to a {campaign.status} campaign",
        )

    # Verify creator exists
    cr_res = await db.execute(
        select(CreatorProfile)
        .where(CreatorProfile.id == payload.creator_id)
        .options(selectinload(CreatorProfile.user))
    )
    creator = cr_res.scalar_one_or_none()
    if not creator:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Creator {payload.creator_id} not found",
        )

    # Duplicate check: check if an active non-terminal invitation already exists
    active_inv_res = await db.execute(
        select(Invitation).where(
            Invitation.campaign_id == payload.campaign_id,
            Invitation.creator_id == payload.creator_id,
            Invitation.status.in_([
                InvitationStatus.PENDING,
                InvitationStatus.SENT,
                InvitationStatus.VIEWED,
            ]),
        )
    )
    existing_inv = active_inv_res.scalar_one_or_none()
    if existing_inv:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An active invitation for this creator and campaign is already pending",
        )

    now = _utcnow()
    expires_at = now + timedelta(days=payload.expires_in_days or 14)

    # Create invitation
    invitation = Invitation(
        campaign_id=payload.campaign_id,
        creator_id=payload.creator_id,
        message=payload.message or "",
        status=InvitationStatus.SENT,
        compensation_offered=payload.compensation_offered,
        deliverables_requested=payload.deliverables_requested or [],
        expires_at=expires_at,
        created_at=now,
        updated_at=now,
    )
    db.add(invitation)

    # Transactional update to shortlist: set status to 'invited'
    sl_res = await db.execute(
        select(Shortlist).where(
            Shortlist.brand_id == brand.id,
            Shortlist.creator_id == payload.creator_id,
            Shortlist.campaign_id == payload.campaign_id,
        )
    )
    shortlist_item = sl_res.scalar_one_or_none()
    if shortlist_item:
        shortlist_item.status = "invited"
        shortlist_item.updated_at = now
    else:
        new_sl = Shortlist(
            brand_id=brand.id,
            creator_id=payload.creator_id,
            campaign_id=payload.campaign_id,
            status="invited",
            notes=f"Invited on {now.strftime('%Y-%m-%d')}",
            created_at=now,
            updated_at=now,
        )
        db.add(new_sl)

    # Create persistent in-app notification for the creator
    notification = Notification(
        user_id=creator.user_id,
        title=f"Campaign Invitation: {campaign.title}",
        message=f"{brand.company_name} invited you to join '{campaign.title}'. Compensation: ${payload.compensation_offered or 0:.0f}.",
        notification_type="invitation_received",
        is_read=False,
        link_url="/influencer/invitations",
        data={
            "campaign_id": campaign.id,
            "brand_id": brand.id,
            "campaign_title": campaign.title,
            "compensation": payload.compensation_offered,
        },
        created_at=now,
    )
    db.add(notification)

    await db.commit()

    # Reload invitation with eager joins
    loaded_res = await db.execute(
        select(Invitation)
        .where(Invitation.id == invitation.id)
        .options(
            selectinload(Invitation.campaign).selectinload(Campaign.brand),
            selectinload(Invitation.creator),
        )
    )
    loaded = loaded_res.scalar_one()
    return _to_invitation_out(loaded)


@router.get("/brand", response_model=List[InvitationOut])
async def list_brand_invitations(
    campaign_id: Optional[int] = None,
    status_val: Optional[str] = Query(None, alias="status"),
    brand: BrandProfile = Depends(get_current_brand_profile),
    db: AsyncSession = Depends(get_db),
):
    """List all invitations sent by the authenticated brand."""
    query = (
        select(Invitation)
        .join(Campaign, Campaign.id == Invitation.campaign_id)
        .where(Campaign.brand_id == brand.id)
        .options(
            selectinload(Invitation.campaign).selectinload(Campaign.brand),
            selectinload(Invitation.creator),
        )
        .order_by(Invitation.created_at.desc())
    )
    if campaign_id is not None:
        query = query.where(Invitation.campaign_id == campaign_id)
    if status_val is not None:
        query = query.where(Invitation.status == status_val)

    res = await db.execute(query)
    invitations = res.scalars().all()
    return [_to_invitation_out(i) for i in invitations]


@router.get("/creator", response_model=List[InvitationOut])
async def list_creator_invitations(
    status_val: Optional[str] = Query(None, alias="status"),
    creator: CreatorProfile = Depends(get_current_creator_profile),
    db: AsyncSession = Depends(get_db),
):
    """List all invitations received by the authenticated creator."""
    query = (
        select(Invitation)
        .where(Invitation.creator_id == creator.id)
        .options(
            selectinload(Invitation.campaign).selectinload(Campaign.brand),
            selectinload(Invitation.creator),
        )
        .order_by(Invitation.created_at.desc())
    )
    if status_val is not None:
        query = query.where(Invitation.status == status_val)

    res = await db.execute(query)
    invitations = res.scalars().all()

    # Automatically check for expired invitations and update state
    now = _utcnow()
    has_changes = False
    for inv in invitations:
        if (
            inv.status in [InvitationStatus.PENDING, InvitationStatus.SENT, InvitationStatus.VIEWED]
            and inv.expires_at
            and inv.expires_at < now
        ):
            inv.status = InvitationStatus.EXPIRED
            inv.updated_at = now
            has_changes = True

    if has_changes:
        await db.commit()

    return [_to_invitation_out(i) for i in invitations]


@router.get("/{invitation_id}", response_model=InvitationOut)
async def get_invitation_detail(
    invitation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get single invitation detail with permission enforcement."""
    res = await db.execute(
        select(Invitation)
        .where(Invitation.id == invitation_id)
        .options(
            selectinload(Invitation.campaign).selectinload(Campaign.brand),
            selectinload(Invitation.creator),
        )
    )
    invitation = res.scalar_one_or_none()
    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Invitation {invitation_id} not found",
        )

    # Permission check: User must own the brand of the campaign OR be the creator
    is_brand_owner = (
        invitation.campaign
        and invitation.campaign.brand
        and invitation.campaign.brand.user_id == current_user.id
    )
    is_creator_recipient = (
        invitation.creator and invitation.creator.user_id == current_user.id
    )
    is_admin = current_user.role == UserRole.ADMIN

    if not (is_brand_owner or is_creator_recipient or is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view this invitation",
        )

    # If creator views a 'sent' invitation for the first time, transition to 'viewed'
    if is_creator_recipient and invitation.status == InvitationStatus.SENT:
        invitation.status = InvitationStatus.VIEWED
        invitation.updated_at = _utcnow()
        await db.commit()

    return _to_invitation_out(invitation)


@router.patch("/{invitation_id}/status", response_model=InvitationOut)
@router.put("/{invitation_id}/status", response_model=InvitationOut, summary="Alias for PATCH")
async def update_invitation_status(
    invitation_id: int,
    payload: InvitationStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Accept, decline, or cancel an invitation according to the documented state machine.
    - Creator can: 'accepted', 'declined'
    - Brand can: 'canceled'
    - Terminal states cannot be changed.
    """
    res = await db.execute(
        select(Invitation)
        .where(Invitation.id == invitation_id)
        .options(
            selectinload(Invitation.campaign).selectinload(Campaign.brand),
            selectinload(Invitation.creator),
        )
    )
    invitation = res.scalar_one_or_none()
    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Invitation {invitation_id} not found",
        )

    curr_status = (
        invitation.status.value
        if hasattr(invitation.status, "value")
        else str(invitation.status)
    )
    target_status = payload.status.lower()

    # Check terminal state
    if curr_status in TERMINAL_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot change status of a finalized invitation (currently '{curr_status}')",
        )

    now = _utcnow()

    # Check expiration
    if invitation.expires_at and invitation.expires_at < now:
        invitation.status = InvitationStatus.EXPIRED
        invitation.updated_at = now
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This invitation has expired and can no longer be accepted or declined",
        )

    is_brand_owner = (
        invitation.campaign
        and invitation.campaign.brand
        and invitation.campaign.brand.user_id == current_user.id
    )
    is_creator_recipient = (
        invitation.creator and invitation.creator.user_id == current_user.id
    )
    is_admin = current_user.role == UserRole.ADMIN

    # Creator Actions: accepted or declined
    if target_status in ["accepted", "declined"]:
        if not (is_creator_recipient or is_admin):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the invited creator can accept or decline this invitation",
            )

        new_status = (
            InvitationStatus.ACCEPTED
            if target_status == "accepted"
            else InvitationStatus.DECLINED
        )
        invitation.status = new_status
        invitation.responded_at = now
        invitation.updated_at = now

        if target_status == "declined" and payload.decline_reason:
            invitation.decline_reason = payload.decline_reason

        # Synchronize shortlist status
        if invitation.campaign:
            sl_res = await db.execute(
                select(Shortlist).where(
                    Shortlist.brand_id == invitation.campaign.brand_id,
                    Shortlist.creator_id == invitation.creator_id,
                    Shortlist.campaign_id == invitation.campaign_id,
                )
            )
            shortlist_item = sl_res.scalar_one_or_none()
            if shortlist_item:
                shortlist_item.status = "confirmed" if target_status == "accepted" else "declined"
                shortlist_item.updated_at = now

        # Persistent notification to the brand owner
        if invitation.campaign and invitation.campaign.brand:
            brand_notif = Notification(
                user_id=invitation.campaign.brand.user_id,
                title=f"Invitation {target_status.capitalize()}: {invitation.creator.display_name if invitation.creator else 'Creator'}",
                message=(
                    f"{invitation.creator.display_name if invitation.creator else 'Creator'} has {target_status} your "
                    f"invitation for '{invitation.campaign.title if invitation.campaign else 'campaign'}'."
                    + (f" Reason: {payload.decline_reason}" if payload.decline_reason else "")
                ),
                notification_type=f"invitation_{target_status}",
                is_read=False,
                link_url="/brand/invitations",
                data={
                    "invitation_id": invitation.id,
                    "campaign_id": invitation.campaign_id,
                    "creator_id": invitation.creator_id,
                    "status": target_status,
                },
                created_at=now,
            )
            db.add(brand_notif)

    # Brand Action: canceled
    elif target_status == "canceled":
        if not (is_brand_owner or is_admin):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the brand that issued this invitation can cancel it",
            )

        invitation.status = InvitationStatus.CANCELED
        invitation.updated_at = now

        # Update shortlist status back to archived
        if invitation.campaign:
            sl_res = await db.execute(
                select(Shortlist).where(
                    Shortlist.brand_id == invitation.campaign.brand_id,
                    Shortlist.creator_id == invitation.creator_id,
                    Shortlist.campaign_id == invitation.campaign_id,
                )
            )
            shortlist_item = sl_res.scalar_one_or_none()
            if shortlist_item:
                shortlist_item.status = "archived"
                shortlist_item.updated_at = now

        # Persistent notification to creator
        if invitation.creator:
            creator_notif = Notification(
                user_id=invitation.creator.user_id,
                title=f"Invitation Canceled: {invitation.campaign.title if invitation.campaign else 'Campaign'}",
                message=f"{invitation.campaign.brand.company_name if (invitation.campaign and invitation.campaign.brand) else 'The brand'} has canceled the invitation.",
                notification_type="invitation_canceled",
                is_read=False,
                link_url="/influencer/invitations",
                data={"invitation_id": invitation.id, "campaign_id": invitation.campaign_id},
                created_at=now,
            )
            db.add(creator_notif)

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid target status '{target_status}'. Must be 'accepted', 'declined', or 'canceled'",
        )

    await db.commit()
    await db.refresh(invitation)
    return _to_invitation_out(invitation)

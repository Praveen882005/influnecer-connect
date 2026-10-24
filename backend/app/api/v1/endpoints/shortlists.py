from datetime import datetime, timezone
from typing import Any, List, Optional, Union
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_brand_profile
from app.core.database import get_db
from app.models.entities import BrandProfile, Campaign, CreatorProfile, Shortlist
from app.schemas.creator import CreatorProfileOut
from app.schemas.workflow import (
    SHORTLIST_STATUSES,
    ShortlistCreate,
    ShortlistOut,
    ShortlistUpdate,
)

router = APIRouter()


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _to_shortlist_out(item: Shortlist) -> ShortlistOut:
    campaign_title = item.campaign.title if item.campaign else None
    creator_out = CreatorProfileOut.model_validate(item.creator) if item.creator else None
    return ShortlistOut(
        id=item.id,
        brand_id=item.brand_id,
        creator_id=item.creator_id,
        campaign_id=item.campaign_id,
        campaign_title=campaign_title,
        status=item.status,
        notes=item.notes or "",
        creator=creator_out,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


@router.post("/", response_model=ShortlistOut, status_code=status.HTTP_201_CREATED)
async def add_to_shortlist_json(
    payload: ShortlistCreate,
    brand: BrandProfile = Depends(get_current_brand_profile),
    db: AsyncSession = Depends(get_db),
):
    """Add creator to a campaign shortlist with structured status and notes."""
    # Validate creator
    c_res = await db.execute(select(CreatorProfile).where(CreatorProfile.id == payload.creator_id))
    creator = c_res.scalar_one_or_none()
    if not creator:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Creator with ID {payload.creator_id} not found",
        )

    # Validate campaign ownership if provided
    if payload.campaign_id:
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
                detail=f"Campaign with ID {payload.campaign_id} not found or not owned by your brand",
            )

    target_status = payload.status or "considering"
    if target_status not in SHORTLIST_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status '{target_status}'. Must be one of: {', '.join(SHORTLIST_STATUSES)}",
        )

    # Check existing item
    query = select(Shortlist).where(
        Shortlist.brand_id == brand.id,
        Shortlist.creator_id == payload.creator_id,
        Shortlist.campaign_id == payload.campaign_id,
    ).options(selectinload(Shortlist.creator), selectinload(Shortlist.campaign))
    existing_res = await db.execute(query)
    existing = existing_res.scalar_one_or_none()

    if existing:
        if payload.notes is not None:
            existing.notes = payload.notes
        existing.status = target_status
        existing.updated_at = _utcnow()
        await db.commit()
        await db.refresh(existing)
        return _to_shortlist_out(existing)

    item = Shortlist(
        brand_id=brand.id,
        creator_id=payload.creator_id,
        campaign_id=payload.campaign_id,
        notes=payload.notes or "",
        status=target_status,
        created_at=_utcnow(),
        updated_at=_utcnow(),
    )
    db.add(item)
    await db.commit()

    # Reload with relations
    res = await db.execute(
        select(Shortlist)
        .where(Shortlist.id == item.id)
        .options(selectinload(Shortlist.creator), selectinload(Shortlist.campaign))
    )
    loaded = res.scalar_one()
    return _to_shortlist_out(loaded)


@router.post("/{creator_id}", status_code=status.HTTP_201_CREATED)
async def add_to_shortlist_legacy(
    creator_id: int,
    notes: str = "",
    status_val: str = "considering",
    campaign_id: Optional[int] = None,
    brand: BrandProfile = Depends(get_current_brand_profile),
    db: AsyncSession = Depends(get_db),
):
    """Legacy backward-compatible creator bookmarking endpoint."""
    c_res = await db.execute(select(CreatorProfile).where(CreatorProfile.id == creator_id))
    creator = c_res.scalar_one_or_none()
    if not creator:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Creator {creator_id} not found",
        )

    existing = await db.execute(
        select(Shortlist).where(
            Shortlist.brand_id == brand.id,
            Shortlist.creator_id == creator_id,
            Shortlist.campaign_id == campaign_id,
        )
    )
    item = existing.scalar_one_or_none()
    if item:
        return {"message": "Creator is already shortlisted", "shortlisted": True, "id": creator_id}

    item = Shortlist(
        brand_id=brand.id,
        creator_id=creator_id,
        campaign_id=campaign_id,
        notes=notes,
        status=status_val if status_val in SHORTLIST_STATUSES else "considering",
        created_at=_utcnow(),
        updated_at=_utcnow(),
    )
    db.add(item)
    await db.commit()
    return {"message": "Creator added to shortlist", "shortlisted": True, "id": creator_id}


@router.get("/")
async def get_my_shortlist(
    campaign_id: Optional[int] = None,
    status_val: Optional[str] = Query(None, alias="status"),
    detailed: bool = Query(False, description="Return detailed ShortlistOut models with workflow states"),
    brand: BrandProfile = Depends(get_current_brand_profile),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    List brand shortlisted creators.
    If detailed=False and no campaign/status filter is provided, returns List[CreatorProfileOut] for compatibility.
    Otherwise returns List[ShortlistOut].
    """
    if not detailed and campaign_id is None and status_val is None:
        result = await db.execute(
            select(CreatorProfile)
            .join(Shortlist, Shortlist.creator_id == CreatorProfile.id)
            .where(Shortlist.brand_id == brand.id)
            .order_by(Shortlist.created_at.desc())
        )
        creators = result.scalars().all()
        return [CreatorProfileOut.model_validate(c) for c in creators]

    query = (
        select(Shortlist)
        .where(Shortlist.brand_id == brand.id)
        .options(selectinload(Shortlist.creator), selectinload(Shortlist.campaign))
        .order_by(Shortlist.updated_at.desc())
    )
    if campaign_id is not None:
        query = query.where(Shortlist.campaign_id == campaign_id)
    if status_val is not None:
        query = query.where(Shortlist.status == status_val)

    result = await db.execute(query)
    items = result.scalars().all()
    return [_to_shortlist_out(item) for item in items]


@router.get("/items", response_model=List[ShortlistOut])
async def get_my_shortlist_items(
    campaign_id: Optional[int] = None,
    status_val: Optional[str] = Query(None, alias="status"),
    brand: BrandProfile = Depends(get_current_brand_profile),
    db: AsyncSession = Depends(get_db),
):
    """Explicit endpoint returning rich shortlist workflow entities."""
    query = (
        select(Shortlist)
        .where(Shortlist.brand_id == brand.id)
        .options(selectinload(Shortlist.creator), selectinload(Shortlist.campaign))
        .order_by(Shortlist.updated_at.desc())
    )
    if campaign_id is not None:
        query = query.where(Shortlist.campaign_id == campaign_id)
    if status_val is not None:
        query = query.where(Shortlist.status == status_val)

    result = await db.execute(query)
    items = result.scalars().all()
    return [_to_shortlist_out(item) for item in items]


@router.patch("/{shortlist_id}", response_model=ShortlistOut)
async def update_shortlist_item(
    shortlist_id: int,
    payload: ShortlistUpdate,
    brand: BrandProfile = Depends(get_current_brand_profile),
    db: AsyncSession = Depends(get_db),
):
    """Update notes and status for a shortlisted creator."""
    query = (
        select(Shortlist)
        .where(Shortlist.id == shortlist_id)
        .options(selectinload(Shortlist.creator), selectinload(Shortlist.campaign))
    )
    res = await db.execute(query)
    item = res.scalar_one_or_none()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Shortlist entry {shortlist_id} not found",
        )

    # Ownership check
    if item.brand_id != brand.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to modify this shortlist entry",
        )

    if payload.status is not None:
        if payload.status not in SHORTLIST_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status '{payload.status}'. Must be one of: {', '.join(SHORTLIST_STATUSES)}",
            )
        item.status = payload.status

    if payload.notes is not None:
        item.notes = payload.notes

    item.updated_at = _utcnow()
    await db.commit()
    await db.refresh(item)
    return _to_shortlist_out(item)


@router.delete("/{id_or_creator_id}")
async def remove_from_shortlist(
    id_or_creator_id: int,
    brand: BrandProfile = Depends(get_current_brand_profile),
    db: AsyncSession = Depends(get_db),
):
    """Remove a creator from shortlist either by shortlist row ID or by creator ID."""
    # First search by shortlist primary key
    res = await db.execute(
        select(Shortlist).where(Shortlist.id == id_or_creator_id, Shortlist.brand_id == brand.id)
    )
    item = res.scalar_one_or_none()

    # If not found, search by creator_id
    if not item:
        res = await db.execute(
            select(Shortlist).where(Shortlist.creator_id == id_or_creator_id, Shortlist.brand_id == brand.id)
        )
        item = res.scalar_one_or_none()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Creator or shortlist entry not in your shortlist",
        )

    await db.delete(item)
    await db.commit()
    return {"message": "Creator removed from shortlist", "shortlisted": False}

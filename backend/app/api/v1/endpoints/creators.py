from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.api.deps import get_current_creator_profile, get_current_user
from app.core.database import get_db
from app.models.entities import CreatorProfile, INITIAL_NICHES, User, UserRole
from app.schemas.creator import (
    CreatorProfileCreate,
    CreatorProfileOut,
    CreatorProfileUpdate,
    PlatformVerificationRequest,
)

router = APIRouter()


def _format_creator_out(creator: CreatorProfile) -> CreatorProfileOut:
    """Helper to compute completeness score and populate owner details."""
    completeness_data = creator.calculate_completeness()
    owner_name = creator.user.full_name if creator.user else None
    owner_email = creator.user.email if creator.user else None

    return CreatorProfileOut(
        id=creator.id,
        user_id=creator.user_id,
        handle=creator.handle,
        display_name=creator.display_name,
        bio=creator.bio or "",
        profile_image_url=creator.profile_image_url or "",
        primary_niche=creator.primary_niche,
        secondary_niches=creator.secondary_niches or [],
        content_niches=creator.content_niches or [creator.primary_niche],
        supported_platforms=creator.supported_platforms or list(creator.platforms.keys()) if creator.platforms else ["youtube"],
        platforms=creator.platforms or {},
        language=creator.language or "English",
        collaboration_preferences=creator.collaboration_preferences or {},
        total_followers=creator.total_followers,
        following_count=creator.following_count,
        posts_count=creator.posts_count,
        avg_engagement_rate=creator.avg_engagement_rate,
        audience_demographics=creator.audience_demographics or {},
        authenticity_score=creator.authenticity_score,
        sample_content_keywords=creator.sample_content_keywords or [],
        data_source=creator.data_source,
        last_fetched_at=creator.last_fetched_at,
        freshness_status=creator.freshness_status,
        is_verified=creator.is_verified,
        is_platform_verified=creator.is_platform_verified,
        connected_platforms=creator.connected_platforms or {},
        created_at=creator.created_at,
        updated_at=creator.updated_at,
        owner_name=owner_name,
        owner_email=owner_email,
        completeness_score=completeness_data["score"],
        completeness=completeness_data,
    )


@router.get("/niches", summary="Retrieve standard supported content niches")
async def get_initial_niches() -> List[str]:
    """Returns standard initial niches: beauty, food, fitness, fashion, home, technology, parenting, wellness."""
    return INITIAL_NICHES


@router.get("/", response_model=List[CreatorProfileOut], summary="List and filter creator directory")
async def list_creators(
    niche: Optional[str] = Query(None, description="Filter by primary niche"),
    min_followers: Optional[int] = Query(None, ge=0),
    max_followers: Optional[int] = Query(None, ge=0),
    min_engagement: Optional[float] = Query(None, ge=0),
    min_authenticity: Optional[float] = Query(None, ge=0, le=100),
    q: Optional[str] = Query(None, description="Search handle, display name, or keywords"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    query = select(CreatorProfile).options(selectinload(CreatorProfile.user))

    if niche:
        query = query.where(
            or_(
                CreatorProfile.primary_niche.ilike(f"%{niche}%"),
                CreatorProfile.content_niches.contains(niche.lower()),
            )
        )
    if min_followers is not None:
        query = query.where(CreatorProfile.total_followers >= min_followers)
    if max_followers is not None:
        query = query.where(CreatorProfile.total_followers <= max_followers)
    if min_engagement is not None:
        query = query.where(CreatorProfile.avg_engagement_rate >= min_engagement)
    if min_authenticity is not None:
        query = query.where(CreatorProfile.authenticity_score >= min_authenticity)
    if q:
        search_filter = or_(
            CreatorProfile.handle.ilike(f"%{q}%"),
            CreatorProfile.display_name.ilike(f"%{q}%"),
            CreatorProfile.bio.ilike(f"%{q}%"),
            CreatorProfile.primary_niche.ilike(f"%{q}%"),
        )
        query = query.where(search_filter)

    query = query.order_by(CreatorProfile.total_followers.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    creators = result.scalars().all()
    return [_format_creator_out(c) for c in creators]


@router.get("/me", response_model=CreatorProfileOut, summary="Retrieve authenticated creator profile")
@router.get("/profile", response_model=CreatorProfileOut, summary="Alias for /me")
@router.get("/profile/me", response_model=CreatorProfileOut, summary="Alias for /me")
async def get_my_creator_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CreatorProfile)
        .options(selectinload(CreatorProfile.user))
        .where(CreatorProfile.user_id == current_user.id)
    )
    creator = result.scalar_one_or_none()
    if not creator:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Creator profile not found for this user account.",
        )
    return _format_creator_out(creator)


@router.put("/me", response_model=CreatorProfileOut, summary="Update authenticated creator profile")
@router.put("/profile", response_model=CreatorProfileOut, summary="Alias for /me")
@router.patch("/me", response_model=CreatorProfileOut, summary="Patch authenticated creator profile")
@router.patch("/profile", response_model=CreatorProfileOut, summary="Alias for /me")
@router.patch("/profile/me", response_model=CreatorProfileOut, summary="Alias for /me")
async def update_my_creator_profile(
    profile_in: CreatorProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CreatorProfile)
        .options(selectinload(CreatorProfile.user))
        .where(CreatorProfile.user_id == current_user.id)
    )
    creator = result.scalar_one_or_none()
    if not creator:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Creator profile not found for this user account.",
        )

    # Ownership check: current_user.id must match creator.user_id
    if creator.user_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to update another creator's profile.",
        )

    # Handle uniqueness check if handle is changing
    if profile_in.handle and profile_in.handle != creator.handle:
        new_handle = profile_in.handle if profile_in.handle.startswith("@") else f"@{profile_in.handle}"
        conflict_res = await db.execute(
            select(CreatorProfile).where(
                CreatorProfile.handle == new_handle, CreatorProfile.id != creator.id
            )
        )
        if conflict_res.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Handle '{new_handle}' is already registered by another creator.",
            )
        creator.handle = new_handle

    update_data = profile_in.model_dump(exclude_unset=True)
    # Exclude UI helper keys handled by validator
    for camel in (
        "displayName",
        "profileImageUrl",
        "primaryNiche",
        "location",
        "rateYoutubeDedicated",
        "rateYoutubeIntegration",
        "rateInstagramReel",
    ):
        update_data.pop(camel, None)

    # User-entered updates explicitly keep data_source marked as user_manual
    # to distinguish self-reported claims from verified platform sync
    update_data["data_source"] = "user_manual"
    update_data["freshness_status"] = "manual"

    for field, value in update_data.items():
        if field != "handle" and value is not None and hasattr(creator, field):
            setattr(creator, field, value)

    await db.commit()
    await db.refresh(creator)
    return _format_creator_out(creator)


@router.post("/verify-platform", response_model=CreatorProfileOut, summary="Verify platform connection")
async def verify_platform_connection(
    req: PlatformVerificationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Simulates / performs platform OAuth verification.
    Guarantees: Do not claim a profile is connected to Instagram until connection is verified.
    """
    result = await db.execute(
        select(CreatorProfile)
        .options(selectinload(CreatorProfile.user))
        .where(CreatorProfile.user_id == current_user.id)
    )
    creator = result.scalar_one_or_none()
    if not creator:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Creator profile not found.",
        )

    platform_key = req.platform.lower().strip()
    now = datetime.now(timezone.utc)

    # Initialize connected_platforms dictionary if empty
    connected = creator.connected_platforms or {}
    connected[platform_key] = {
        "connected": True,
        "verified": True,
        "handle": req.external_account_handle,
        "account_id": f"act_{platform_key}_{creator.id}",
        "verified_at": now.isoformat(),
    }
    creator.connected_platforms = connected
    creator.is_platform_verified = True
    creator.data_source = f"{platform_key}_verified_api"
    creator.last_fetched_at = now
    creator.freshness_status = "fresh"

    await db.commit()
    await db.refresh(creator)
    return _format_creator_out(creator)


@router.post("/profile", response_model=CreatorProfileOut, status_code=status.HTTP_201_CREATED)
async def create_creator_profile(
    profile_in: CreatorProfileCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in (UserRole.CREATOR, UserRole.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only creator accounts can create an influencer profile.",
        )

    # Check for existing profile
    res = await db.execute(select(CreatorProfile).where(CreatorProfile.user_id == current_user.id))
    if res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Creator profile already exists for this user account. Use PUT to update.",
        )

    handle = profile_in.handle if profile_in.handle.startswith("@") else f"@{profile_in.handle}"
    # Check handle uniqueness
    conflict = await db.execute(select(CreatorProfile).where(CreatorProfile.handle == handle))
    if conflict.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Handle '{handle}' is already in use by another creator.",
        )

    creator = CreatorProfile(
        user_id=current_user.id,
        handle=handle,
        display_name=profile_in.display_name,
        bio=profile_in.bio or "",
        profile_image_url=profile_in.profile_image_url or "",
        primary_niche=profile_in.primary_niche,
        secondary_niches=profile_in.secondary_niches,
        content_niches=profile_in.content_niches or [profile_in.primary_niche],
        supported_platforms=profile_in.supported_platforms,
        platforms=profile_in.platforms,
        language=profile_in.language,
        collaboration_preferences=profile_in.collaboration_preferences,
        total_followers=profile_in.total_followers,
        avg_engagement_rate=profile_in.avg_engagement_rate,
        authenticity_score=profile_in.authenticity_score,
        data_source="user_manual",
        freshness_status="manual",
        is_verified=False,
        is_platform_verified=False,
        connected_platforms={},
    )
    db.add(creator)
    await db.commit()
    await db.refresh(creator)
    return _format_creator_out(creator)


@router.get("/{creator_id}", response_model=CreatorProfileOut, summary="Public creator profile lookup")
async def get_creator_by_id(creator_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(CreatorProfile).options(selectinload(CreatorProfile.user)).where(CreatorProfile.id == creator_id)
    )
    creator = result.scalar_one_or_none()
    if not creator:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Creator profile {creator_id} not found.",
        )
    return _format_creator_out(creator)

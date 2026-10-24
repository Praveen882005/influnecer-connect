from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.api.deps import get_current_brand_profile, get_current_user
from app.core.database import get_db
from app.models.entities import BrandProfile, User, UserRole
from app.schemas.brand import BrandProfileCreate, BrandProfileOut, BrandProfileUpdate

router = APIRouter()


def _format_brand_out(brand: BrandProfile) -> BrandProfileOut:
    """Helper to compute completeness and populate owner metadata."""
    completeness_data = brand.calculate_completeness()
    owner_name = brand.user.full_name if brand.user else None
    owner_email = brand.user.email if brand.user else None

    return BrandProfileOut(
        id=brand.id,
        user_id=brand.user_id,
        company_name=brand.company_name,
        industry=brand.industry,
        website=brand.website or "",
        description=brand.description or "",
        logo_url=brand.logo_url or "",
        location=brand.location or "",
        brand_values=brand.brand_values or [],
        target_demographics=brand.target_demographics or {},
        created_at=brand.created_at,
        updated_at=brand.updated_at,
        owner_name=owner_name,
        owner_email=owner_email,
        completeness_score=completeness_data["score"],
        completeness=completeness_data,
    )


@router.get("/me", response_model=BrandProfileOut, summary="Retrieve authenticated brand profile")
@router.get("/profile", response_model=BrandProfileOut, summary="Alias for /me")
@router.get("/profile/me", response_model=BrandProfileOut, summary="Alias for /me")
async def get_my_brand_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BrandProfile)
        .options(selectinload(BrandProfile.user))
        .where(BrandProfile.user_id == current_user.id)
    )
    brand = result.scalar_one_or_none()
    if not brand:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Brand profile not found for this user account.",
        )
    return _format_brand_out(brand)


@router.put("/me", response_model=BrandProfileOut, summary="Update authenticated brand profile")
@router.put("/profile", response_model=BrandProfileOut, summary="Alias for /me")
@router.patch("/me", response_model=BrandProfileOut, summary="Patch authenticated brand profile")
@router.patch("/profile", response_model=BrandProfileOut, summary="Alias for /me")
@router.patch("/profile/me", response_model=BrandProfileOut, summary="Alias for /me")
async def update_my_brand_profile(
    profile_in: BrandProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BrandProfile)
        .options(selectinload(BrandProfile.user))
        .where(BrandProfile.user_id == current_user.id)
    )
    brand = result.scalar_one_or_none()
    if not brand:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Brand profile not found for this user account.",
        )

    # Ownership check: current_user.id must match brand.user_id
    if brand.user_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to update another company's profile.",
        )

    update_data = profile_in.model_dump(exclude_unset=True)
    # Ignore camelCase helper fields already mapped by validator
    for camel in ("companyName", "logoUrl", "targetRegion", "minEngagement", "minAuthenticity"):
        update_data.pop(camel, None)

    for field, value in update_data.items():
        if value is not None and hasattr(brand, field):
            setattr(brand, field, value)

    await db.commit()
    await db.refresh(brand)
    return _format_brand_out(brand)


@router.post("/profile", response_model=BrandProfileOut, status_code=status.HTTP_201_CREATED)
async def create_brand_profile(
    profile_in: BrandProfileCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in (UserRole.BRAND, UserRole.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only brand accounts can create a brand profile.",
        )

    # Check for existing profile
    res = await db.execute(select(BrandProfile).where(BrandProfile.user_id == current_user.id))
    existing = res.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Brand profile already exists for this user. Use PUT to update.",
        )

    brand = BrandProfile(
        user_id=current_user.id,
        company_name=profile_in.company_name,
        industry=profile_in.industry,
        website=profile_in.website or "",
        description=profile_in.description or "",
        logo_url=profile_in.logo_url or "",
        location=profile_in.location or "",
        brand_values=profile_in.brand_values,
        target_demographics=profile_in.target_demographics,
    )
    db.add(brand)
    await db.commit()
    await db.refresh(brand)
    return _format_brand_out(brand)


@router.get("/{brand_id}", response_model=BrandProfileOut, summary="Public brand profile lookup")
async def get_brand_by_id(brand_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(BrandProfile).options(selectinload(BrandProfile.user)).where(BrandProfile.id == brand_id)
    )
    brand = result.scalar_one_or_none()
    if not brand:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Brand profile {brand_id} not found.",
        )
    return _format_brand_out(brand)

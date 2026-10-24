from typing import List, Optional
from fastapi import Depends, HTTPException, Query, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.entities import BrandProfile, CreatorProfile, User, UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


async def get_current_user(
    header_token: Optional[str] = Depends(oauth2_scheme),
    query_token: Optional[str] = Query(None, alias="token", description="Optional query token for direct download links"),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = header_token or query_token
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception

    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    user_id_str = payload.get("sub")
    if user_id_str is None:
        raise credentials_exception

    try:
        user_id = int(user_id_str)
    except ValueError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user account",
        )
    return user


def require_roles(allowed_roles: List[UserRole]):
    """Enforce role-based access control (RBAC)."""
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation not permitted. Required role: {[r.value for r in allowed_roles]}",
            )
        return current_user
    return role_checker


async def get_current_brand_profile(
    current_user: User = Depends(require_roles([UserRole.BRAND, UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
) -> BrandProfile:
    result = await db.execute(select(BrandProfile).where(BrandProfile.user_id == current_user.id))
    brand = result.scalar_one_or_none()
    if not brand:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Brand profile not found for this user account",
        )
    return brand


async def get_current_creator_profile(
    current_user: User = Depends(require_roles([UserRole.CREATOR, UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
) -> CreatorProfile:
    result = await db.execute(select(CreatorProfile).where(CreatorProfile.user_id == current_user.id))
    creator = result.scalar_one_or_none()
    if not creator:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Creator profile not found for this user account",
        )
    return creator

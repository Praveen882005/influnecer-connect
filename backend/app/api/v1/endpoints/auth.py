from datetime import timedelta
from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.core.logging import logger
from app.core.rate_limiter import rate_limit_login, rate_limit_refresh, rate_limit_register
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    hash_password,
    revoke_token,
    verify_password,
)
from app.models.entities import AuditEvent, BrandProfile, CreatorProfile, User, UserRole
from app.schemas.user import (
    AdminBootstrapRequest,
    LogoutRequest,
    RefreshTokenRequest,
    Token,
    UserCreate,
    UserLogin,
    UserOut,
)

router = APIRouter()


async def _resolve_profile_ids(user: User, db: AsyncSession) -> tuple[Optional[int], Optional[int]]:
    """Helper to retrieve associated brand or creator profile ID."""
    brand_id = None
    creator_id = None
    if user.role == UserRole.BRAND:
        b_res = await db.execute(select(BrandProfile).where(BrandProfile.user_id == user.id))
        b = b_res.scalar_one_or_none()
        brand_id = b.id if b else None
    elif user.role == UserRole.CREATOR:
        c_res = await db.execute(select(CreatorProfile).where(CreatorProfile.user_id == user.id))
        c = c_res.scalar_one_or_none()
        creator_id = c.id if c else None
    return brand_id, creator_id


@router.post(
    "/register",
    response_model=Token,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit_register)],
    summary="Register a new Brand or Influencer account",
)
async def register(
    user_in: UserCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    # Security Rule: Public registration cannot create administrator accounts
    if user_in.role == UserRole.ADMIN:
        logger.warning(
            f"Blocked unauthorized attempt to publicly register an administrator account with email: {user_in.email}"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator accounts cannot be registered publicly. Contact system administration.",
        )

    # Check for duplicate email
    existing = await db.execute(select(User).where(User.email == user_in.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists. Please sign in or use a different email.",
        )

    # Create User entity with bcrypt-hashed credentials
    user = User(
        email=user_in.email,
        hashed_password=hash_password(user_in.password),
        full_name=user_in.full_name or user_in.name,
        role=user_in.role,
        is_active=True,
    )
    db.add(user)
    await db.flush()

    brand_id = None
    creator_id = None

    # Provision role-specific workspace profile
    if user.role == UserRole.BRAND:
        brand = BrandProfile(
            user_id=user.id,
            company_name=user_in.company_name or user.full_name,
            industry=user_in.industry or "General Brand",
            description="Brand profile created during onboarding.",
            brand_values=["Innovation", "Authenticity"],
            target_demographics={"age_groups": ["18-24", "25-34"], "countries": ["US", "UK"]},
        )
        db.add(brand)
        await db.flush()
        brand_id = brand.id

    elif user.role == UserRole.CREATOR:
        handle = user_in.handle or f"@{user.full_name.lower().replace(' ', '_')}_{user.id}"
        # Ensure handle starts with @
        if not handle.startswith("@"):
            handle = f"@{handle}"

        # Handle collision prevention
        existing_handle = await db.execute(select(CreatorProfile).where(CreatorProfile.handle == handle))
        if existing_handle.scalar_one_or_none():
            handle = f"{handle}_{user.id}"

        creator = CreatorProfile(
            user_id=user.id,
            handle=handle,
            display_name=user.full_name,
            primary_niche=user_in.primary_niche or "Lifestyle & Tech",
            bio="Creator profile initialized on Brand Bridge.",
            total_followers=10000,
            avg_engagement_rate=3.2,
            authenticity_score=92.0,
            audience_demographics={"age_split": {"18-24": 45.0, "25-34": 35.0}, "top_countries": ["US", "CA"]},
            sample_content_keywords=["tech", "lifestyle", "gadgets", "innovation"],
        )
        db.add(creator)
        await db.flush()
        creator_id = creator.id

    # Record registration audit trail
    client_ip = request.client.host if request.client else None
    audit = AuditEvent(
        user_id=user.id,
        action="USER_REGISTER",
        resource_type="user",
        resource_id=str(user.id),
        ip_address=client_ip,
        status="success",
        details={"role": user.role.value, "email": user.email},
    )
    db.add(audit)
    await db.commit()
    await db.refresh(user)

    # Issue access and refresh tokens
    token_claims = {"sub": str(user.id), "role": user.role.value}
    access_token = create_access_token(data=token_claims)
    refresh_token = create_refresh_token(data=token_claims)

    user_out = UserOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
        brand_profile_id=brand_id,
        creator_profile_id=creator_id,
    )
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=user_out,
    )


@router.post(
    "/demo-login",
    response_model=Token,
    summary="Demo quick login by role without credentials",
)
async def demo_login(
    role: str = Query("brand", description="Target demo role: brand, creator, or admin"),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
):
    demo_emails = {
        "brand": "demo.brand@acmecorp.com",
        "creator": "tech_marcus@creatorhub.test",
        "admin": "admin@brandbridge.io",
    }
    target_email = demo_emails.get(role.lower().strip(), "demo.brand@acmecorp.com")
    result = await db.execute(select(User).where(User.email == target_email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Demo user for role '{role}' not found.",
        )

    brand_id, creator_id = await _resolve_profile_ids(user, db)

    token_claims = {"sub": str(user.id), "role": user.role.value}
    access_token = create_access_token(data=token_claims)
    refresh_token = create_refresh_token(data=token_claims)

    user_out = UserOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
        brand_profile_id=brand_id,
        creator_profile_id=creator_id,
    )
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=user_out,
    )


@router.post(
    "/login",
    response_model=Token,
    dependencies=[Depends(rate_limit_login)],
    summary="Authenticate using email/username and password",
)
async def login(
    login_in: UserLogin,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    identifier = login_in.email or login_in.username
    result = await db.execute(select(User).where(User.email == identifier))
    user = result.scalar_one_or_none()

    # Generic constant-time check to prevent account enumeration
    if not user or not verify_password(login_in.password, user.hashed_password):
        logger.warning(f"Failed authentication attempt for identifier: {identifier}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account has been deactivated. Please contact support.",
        )

    brand_id, creator_id = await _resolve_profile_ids(user, db)

    # Record login audit event
    client_ip = request.client.host if request.client else None
    audit = AuditEvent(
        user_id=user.id,
        action="USER_LOGIN",
        resource_type="session",
        resource_id=str(user.id),
        ip_address=client_ip,
        status="success",
        details={"role": user.role.value},
    )
    db.add(audit)
    await db.commit()

    token_claims = {"sub": str(user.id), "role": user.role.value}
    access_token = create_access_token(data=token_claims)
    refresh_token = create_refresh_token(data=token_claims)

    user_out = UserOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
        brand_profile_id=brand_id,
        creator_profile_id=creator_id,
    )
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=user_out,
    )


@router.post(
    "/token",
    response_model=Token,
    dependencies=[Depends(rate_limit_login)],
    summary="OAuth2-compatible token endpoint (alias for login)",
)
async def oauth2_token(
    login_in: UserLogin,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Alias for /login accommodating OAuth2-compliant clients."""
    return await login(login_in=login_in, request=request, db=db)


@router.post(
    "/refresh",
    response_model=Token,
    dependencies=[Depends(rate_limit_refresh)],
    summary="Exchange valid refresh token for a new access token and rotated refresh token",
)
async def refresh_tokens(
    req: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db),
):
    payload = decode_refresh_token(req.refresh_token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid, expired, or revoked refresh token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token claims are invalid.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_id = int(user_id_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user identifier in token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found or deactivated.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Token rotation: revoke the consumed refresh token
    revoke_token(req.refresh_token)

    brand_id, creator_id = await _resolve_profile_ids(user, db)

    token_claims = {"sub": str(user.id), "role": user.role.value}
    new_access_token = create_access_token(data=token_claims)
    new_refresh_token = create_refresh_token(data=token_claims)

    user_out = UserOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
        brand_profile_id=brand_id,
        creator_profile_id=creator_id,
    )
    return Token(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=user_out,
    )


@router.post(
    "/logout",
    summary="Revoke active access and refresh tokens and clear session",
)
async def logout(
    logout_in: Optional[LogoutRequest] = None,
    authorization: Optional[str] = Header(None),
):
    revoked_count = 0
    # Revoke access token from Authorization header if present
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
        if revoke_token(token):
            revoked_count += 1

    # Revoke refresh token if provided in payload
    if logout_in and logout_in.refresh_token:
        if revoke_token(logout_in.refresh_token):
            revoked_count += 1

    return {
        "message": "Successfully logged out. Tokens have been revoked.",
        "logged_out": True,
        "tokens_revoked": revoked_count,
    }


@router.get(
    "/me",
    response_model=UserOut,
    summary="Retrieve profile and role information for currently authenticated user",
)
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    brand_id, creator_id = await _resolve_profile_ids(current_user, db)
    return UserOut(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
        is_active=current_user.is_active,
        created_at=current_user.created_at,
        brand_profile_id=brand_id,
        creator_profile_id=creator_id,
    )


@router.post(
    "/bootstrap-admin",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    summary="Development-only administrator bootstrapping (forbidden in production)",
)
async def bootstrap_admin(
    req: AdminBootstrapRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    # Strict Environment Guard: Never allow bootstrap in production
    if settings.ENVIRONMENT not in ("development", "staging", "testing"):
        logger.error(
            f"Blocked attempted admin bootstrap in protected environment '{settings.ENVIRONMENT}'"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin bootstrap is strictly forbidden in production mode.",
        )

    # Master Secret Key Verification
    if req.secret_key != settings.SECRET_KEY:
        logger.warning("Admin bootstrap failed: invalid master secret key provided.")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid master secret key for administrator provisioning.",
        )

    # Check if admin already exists
    res = await db.execute(select(User).where(User.email == req.email))
    existing_user = res.scalar_one_or_none()

    if existing_user:
        if existing_user.role != UserRole.ADMIN:
            existing_user.role = UserRole.ADMIN
        existing_user.hashed_password = hash_password(req.password)
        existing_user.full_name = req.full_name
        existing_user.is_active = True
        await db.commit()
        await db.refresh(existing_user)
        logger.info(f"Updated existing user {existing_user.email} to Administrator via bootstrap.")
        return existing_user

    # Create new administrator
    admin_user = User(
        email=req.email,
        hashed_password=hash_password(req.password),
        full_name=req.full_name,
        role=UserRole.ADMIN,
        is_active=True,
    )
    db.add(admin_user)
    await db.flush()

    client_ip = request.client.host if request.client else None
    audit = AuditEvent(
        user_id=admin_user.id,
        action="ADMIN_BOOTSTRAP",
        resource_type="user",
        resource_id=str(admin_user.id),
        ip_address=client_ip,
        status="success",
        details={"email": admin_user.email, "environment": settings.ENVIRONMENT},
    )
    db.add(audit)
    await db.commit()
    await db.refresh(admin_user)

    logger.info(f"Bootstrap provisioned new Administrator account: {admin_user.email}")
    return admin_user

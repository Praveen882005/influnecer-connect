from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator
from app.models.entities import UserRole


class UserCreate(BaseModel):
    """Schema for public account registration."""
    email: EmailStr
    password: str = Field(..., min_length=8, description="Password must be at least 8 characters")
    full_name: Optional[str] = Field(None, min_length=2)
    name: Optional[str] = Field(None, min_length=2, description="Alias for full_name")
    role: UserRole = UserRole.CREATOR

    # Profile Onboarding Metadata
    company_name: Optional[str] = None
    industry: Optional[str] = None
    handle: Optional[str] = None
    primary_niche: Optional[str] = None

    @model_validator(mode="after")
    def validate_name(self) -> "UserCreate":
        effective_name = self.full_name or self.name
        if not effective_name or len(effective_name.strip()) < 2:
            raise ValueError("Full name is required and must be at least 2 characters")
        self.full_name = effective_name.strip()
        return self


class UserLogin(BaseModel):
    """Schema for user credentials authentication (accepts both email and OAuth2 username)."""
    email: Optional[str] = None
    username: Optional[str] = None
    password: str = Field(..., min_length=1)

    @model_validator(mode="after")
    def validate_identifier(self) -> "UserLogin":
        identifier = self.email or self.username
        if not identifier:
            raise ValueError("Either email or username must be provided for login")
        if not self.email and self.username:
            self.email = self.username
        return self


class UserOut(BaseModel):
    """Public user representation returned to authenticated clients."""
    id: int
    email: str
    full_name: str
    role: UserRole
    is_active: bool
    created_at: datetime
    brand_profile_id: Optional[int] = None
    creator_profile_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    """Authentication token response envelope."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = Field(default=1800, description="Access token expiration in seconds")
    user: UserOut


class RefreshTokenRequest(BaseModel):
    """Payload for rotating access and refresh tokens."""
    refresh_token: str = Field(..., min_length=10)


class LogoutRequest(BaseModel):
    """Payload for voluntary session termination."""
    refresh_token: Optional[str] = None


class AdminBootstrapRequest(BaseModel):
    """Payload for development-only admin provisioning."""
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: str = Field(..., min_length=2)
    secret_key: str = Field(..., min_length=16, description="System master secret key")


class TokenPayload(BaseModel):
    """Decoded JWT payload structure."""
    sub: Optional[str] = None
    role: Optional[str] = None
    token_type: Optional[str] = None
    jti: Optional[str] = None
    exp: Optional[int] = None

import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Set
import bcrypt
import jwt
from app.core.config import settings
from app.core.logging import logger


class TokenBlacklist:
    """
    Thread-safe in-memory blacklist for revoked JWT access and refresh tokens.
    Stores token jti (JWT ID) alongside expiration timestamps for automatic garbage collection.
    """

    def __init__(self):
        # Maps jti -> expiration timestamp (epoch seconds)
        self._revoked_jtis: Dict[str, float] = {}

    def revoke(self, jti: str, exp: float) -> None:
        """Add a token JTI to the revoked blacklist with its expiration epoch."""
        self._cleanup()
        self._revoked_jtis[jti] = exp

    def is_revoked(self, jti: str) -> bool:
        """Check if a token JTI is currently revoked."""
        self._cleanup()
        return jti in self._revoked_jtis

    def _cleanup(self) -> None:
        """Prune expired token identifiers to prevent memory growth."""
        now = time.time()
        expired_keys = [jti for jti, exp in self._revoked_jtis.items() if exp < now]
        for key in expired_keys:
            self._revoked_jtis.pop(key, None)

    def clear(self) -> None:
        """Clear all revoked tokens (used primarily for test isolation)."""
        self._revoked_jtis.clear()


# Global in-memory blacklist singleton
token_blacklist = TokenBlacklist()


def hash_password(password: str) -> str:
    """Hash a plaintext password using bcrypt with 12 salt rounds."""
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against the stored bcrypt hash in constant time."""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8")
        )
    except Exception:
        return False


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Generate a signed JWT access token with unique JTI and expiration."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    jti = uuid.uuid4().hex
    to_encode.update({
        "exp": expire,
        "iat": now,
        "jti": jti,
        "token_type": "access",
    })
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Generate a signed JWT refresh token with extended lifetime and unique JTI."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    jti = uuid.uuid4().hex
    to_encode.update({
        "exp": expire,
        "iat": now,
        "jti": jti,
        "token_type": "refresh",
    })
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str, expected_type: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Decode and validate a JWT token:
    - Verifies cryptographic signature and algorithm.
    - Verifies expiration timestamp.
    - Checks JTI against token revocation blacklist.
    - Validates expected token_type ('access' vs 'refresh') to prevent token substitution attacks.
    """
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )

        # Check revocation blacklist
        jti = payload.get("jti")
        if jti and token_blacklist.is_revoked(jti):
            logger.warning(f"Rejected attempt to use revoked token with JTI: {jti[:8]}***")
            return None

        # Verify token type if specified
        if expected_type is not None:
            actual_type = payload.get("token_type")
            if actual_type != expected_type:
                logger.warning(
                    f"Token type mismatch: expected '{expected_type}', got '{actual_type}'"
                )
                return None

        return payload
    except (jwt.PyJWTError, Exception):
        return None


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and validate an access token."""
    return decode_token(token, expected_type="access")


def decode_refresh_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and validate a refresh token."""
    return decode_token(token, expected_type="refresh")


def revoke_token(token: str) -> bool:
    """
    Extracts JTI and expiry from token and registers it with the revocation blacklist.
    Returns True if successfully revoked, False if token is unparseable.
    """
    try:
        # Decode without verification to extract JTI and exp even if nearing expiration
        unverified = jwt.decode(token, options={"verify_signature": False})
        jti = unverified.get("jti")
        exp = unverified.get("exp", time.time() + 86400)
        if jti:
            token_blacklist.revoke(jti, float(exp))
            return True
        return False
    except Exception as e:
        logger.warning(f"Failed to revoke token: {e}")
        return False

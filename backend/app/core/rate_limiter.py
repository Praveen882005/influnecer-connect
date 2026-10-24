import time
from collections import defaultdict
from typing import Callable, Dict, List
from fastapi import HTTPException, Request, status
from app.core.logging import logger


class SlidingWindowRateLimiter:
    """
    In-memory sliding window rate limiter designed for sensitive authentication endpoints.
    Protects against brute-force password guessing, credential stuffing, and registration spam.
    """

    def __init__(self):
        # Maps key -> list of request timestamps (epoch floats)
        self._history: Dict[str, List[float]] = defaultdict(list)
        self._enabled: bool = True

    def check(self, key: str, max_requests: int, window_seconds: int) -> None:
        """
        Records an attempt and raises HTTP 429 Too Many Requests if the threshold is exceeded.
        """
        if not self._enabled:
            return

        now = time.time()
        cutoff = now - window_seconds

        # Clean historical entries outside the sliding window
        valid_timestamps = [ts for ts in self._history[key] if ts > cutoff]
        self._history[key] = valid_timestamps

        if len(valid_timestamps) >= max_requests:
            oldest_in_window = valid_timestamps[0]
            retry_after = max(1, int(oldest_in_window + window_seconds - now))
            logger.warning(
                f"Rate limit exceeded for client key '{key}': {len(valid_timestamps)}/{max_requests} "
                f"attempts in {window_seconds}s. Retry after {retry_after}s."
            )
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many requests. Please wait {retry_after} seconds before trying again.",
                headers={"Retry-After": str(retry_after)},
            )

        self._history[key].append(now)

    def reset(self) -> None:
        """Clears all tracking history (used primarily for test isolation)."""
        self._history.clear()

    def set_enabled(self, enabled: bool) -> None:
        """Enables or disables rate limiting globally."""
        self._enabled = enabled


# Singleton rate limiter instance
auth_rate_limiter = SlidingWindowRateLimiter()


def create_rate_limit_dependency(max_requests: int = 10, window_seconds: int = 60) -> Callable:
    """
    FastAPI dependency factory enforcing rate limits based on client IP.
    """
    async def rate_limiter_dependency(request: Request) -> None:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            client_ip = forwarded.split(",")[0].strip()
        else:
            client_ip = request.client.host if request.client else "127.0.0.1"
        endpoint = request.url.path
        key = f"{client_ip}:{endpoint}"
        auth_rate_limiter.check(key, max_requests=max_requests, window_seconds=window_seconds)

    return rate_limiter_dependency


# Preconfigured dependencies for common authentication workflows
rate_limit_login = create_rate_limit_dependency(max_requests=10, window_seconds=60)
rate_limit_register = create_rate_limit_dependency(max_requests=10, window_seconds=60)
rate_limit_refresh = create_rate_limit_dependency(max_requests=20, window_seconds=60)

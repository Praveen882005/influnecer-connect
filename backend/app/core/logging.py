import logging
import re
from typing import Any

# Patterns matching sensitive parameters, headers, and tokens
SENSITIVE_PATTERNS = [
    (
        re.compile(
            r"(password|passwd|secret|token|api_key|cookie|access_token|refresh_token)\s*[:=]\s*['\"]?([^'\"\s,;]+)['\"]?",
            re.IGNORECASE,
        ),
        r"\1=***REDACTED***",
    ),
    (
        re.compile(r"(Bearer\s+)[A-Za-z0-9\-._~+/]+=*", re.IGNORECASE),
        r"\1***REDACTED***",
    ),
    (
        re.compile(r"(Authorization:\s*)[^\s\r\n]+", re.IGNORECASE),
        r"\1***REDACTED***",
    ),
]


class SensitiveDataFilter(logging.Filter):
    """
    Log filter that masks sensitive values (passwords, tokens, API keys)
    from log records to ensure privacy and compliance.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            record.msg = self.sanitize_string(record.msg)

        if record.args:
            if isinstance(record.args, dict):
                record.args = {k: self.sanitize_val(k, v) for k, v in record.args.items()}
            elif isinstance(record.args, tuple):
                record.args = tuple(self.sanitize_val("", arg) for arg in record.args)

        return True

    @classmethod
    def sanitize_string(cls, text: str) -> str:
        sanitized = text
        for pattern, replacement in SENSITIVE_PATTERNS:
            sanitized = pattern.sub(replacement, sanitized)
        return sanitized

    @classmethod
    def sanitize_val(cls, key: str, value: Any) -> Any:
        sensitive_keys = {
            "password",
            "passwd",
            "secret",
            "token",
            "api_key",
            "authorization",
            "access_token",
            "refresh_token",
            "cookie",
        }
        if any(sk in key.lower() for sk in sensitive_keys):
            return "***REDACTED***"

        if isinstance(value, str):
            return cls.sanitize_string(value)

        return value


def setup_logging(level: int = logging.INFO) -> logging.Logger:
    """Configures structured, sanitized application logging."""
    logger = logging.getLogger("brand_bridge")
    logger.setLevel(level)

    # Avoid duplicate handlers if already configured
    if not logger.handlers:
        handler = logging.StreamHandler()
        formatter = logging.Formatter(
            fmt="%(asctime)s | %(levelname)-7s | %(name)s:%(funcName)s:%(lineno)d - %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        handler.setFormatter(formatter)
        handler.addFilter(SensitiveDataFilter())
        logger.addHandler(handler)

    return logger


logger = setup_logging()

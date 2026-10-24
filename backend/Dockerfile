# ==============================================================================
# Brand Bridge Backend - Multi-Stage Production Dockerfile
# ==============================================================================
# Base Image: Python 3.12 Slim (Debian Bookworm)
# Security: Runs as non-root user (appuser, UID 10001)
# Optimization: Pre-installs CPU-optimized PyTorch wheels for fast image builds
# ==============================================================================

FROM python:3.12-slim AS builder

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /install

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Install dependencies with CPU-optimized PyTorch wheel index
RUN pip install --prefix=/install --no-cache-dir \
    --extra-index-url https://download.pytorch.org/whl/cpu \
    -r requirements.txt


# ------------------------------------------------------------------------------
# Final Runtime Stage
# ------------------------------------------------------------------------------
FROM python:3.12-slim AS runner

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app \
    PORT=8000 \
    ENVIRONMENT=production \
    HF_HOME=/home/appuser/.cache/huggingface \
    TORCH_HOME=/home/appuser/.cache/torch

WORKDIR /app

# Install minimal runtime utilities (curl for container healthchecks)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Copy installed Python packages from builder stage
COPY --from=builder /install /usr/local

# Create non-root system user and secure data/cache directories
RUN groupadd -g 10001 appgroup && \
    useradd -u 10001 -g appgroup -s /bin/bash -m appuser && \
    mkdir -p /app/data/samples /home/appuser/.cache/huggingface /home/appuser/.cache/torch && \
    chown -R appuser:appgroup /app /home/appuser/.cache

# Copy application source, migrations, and scripts
COPY --chown=appuser:appgroup alembic.ini .
COPY --chown=appuser:appgroup alembic ./alembic
COPY --chown=appuser:appgroup app ./app
COPY --chown=appuser:appgroup scripts ./scripts

# Ensure scripts are executable
RUN chmod +x ./scripts/*.sh 2>/dev/null || true

# Switch to non-privileged user for container security
USER appuser

# Expose backend service port
EXPOSE 8000

# Container liveness healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -f http://127.0.0.1:${PORT:-8000}/health || exit 1

# Production startup entrypoint: run entrypoint script
CMD ["./scripts/start-prod.sh"]

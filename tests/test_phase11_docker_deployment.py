"""
==============================================================================
Phase 11 - Docker Containerization & Production Deployment Test Suite
==============================================================================
Validates container definitions, orchestration manifests, environment templates,
startup entrypoint scripts, and database readiness checks for production release.
==============================================================================
"""

import os
import re
import pytest
import yaml
from pathlib import Path

from app.core.config import Settings


BASE_DIR = Path(__file__).resolve().parent.parent


def test_docker_compose_files_valid_yaml():
    """Validates that both development and production docker-compose files are syntactically valid YAML with correct services."""
    compose_dev_path = BASE_DIR / "docker-compose.yml"
    compose_prod_path = BASE_DIR / "docker-compose.prod.yml"

    assert compose_dev_path.exists(), "docker-compose.yml must exist in repository root"
    assert compose_prod_path.exists(), "docker-compose.prod.yml must exist in repository root"

    with open(compose_dev_path, "r", encoding="utf-8") as f:
        dev_cfg = yaml.safe_load(f)

    with open(compose_prod_path, "r", encoding="utf-8") as f:
        prod_cfg = yaml.safe_load(f)

    for cfg_name, cfg in [("development", dev_cfg), ("production", prod_cfg)]:
        assert "services" in cfg, f"{cfg_name} compose must declare services"
        services = cfg["services"]

        # Mandatory services for Brand Bridge architecture
        assert "postgres" in services, f"{cfg_name} compose must include 'postgres' service"
        assert "backend" in services, f"{cfg_name} compose must include 'backend' service"
        assert "frontend" in services, f"{cfg_name} compose must include 'frontend' service"

        # Healthcheck verifications
        assert "healthcheck" in services["postgres"], f"{cfg_name} postgres must have healthcheck"
        assert "healthcheck" in services["backend"], f"{cfg_name} backend must have healthcheck"
        assert "healthcheck" in services["frontend"], f"{cfg_name} frontend must have healthcheck"

        # Network and volume definitions
        assert "networks" in cfg, f"{cfg_name} compose must declare networks"
        assert "volumes" in cfg, f"{cfg_name} compose must declare persistent volumes"


def test_backend_dockerfile_security_and_optimizations():
    """Validates backend Dockerfile includes security hardening, non-root user, and CPU-optimized torch wheels."""
    dockerfile_path = BASE_DIR / "backend" / "Dockerfile"
    assert dockerfile_path.exists(), "backend/Dockerfile must exist"

    content = dockerfile_path.read_text(encoding="utf-8")

    # Multi-stage build check
    assert "FROM python:3.12-slim AS builder" in content
    assert "FROM python:3.12-slim AS runner" in content

    # Security check: Non-root execution
    assert "useradd -u 10001" in content
    assert "USER appuser" in content

    # PyTorch CPU optimization check (avoids 2GB+ CUDA bloat)
    assert "--extra-index-url https://download.pytorch.org/whl/cpu" in content

    # Cache directory configuration for SentenceTransformers / HuggingFace
    assert "HF_HOME=/home/appuser/.cache/huggingface" in content
    assert "TORCH_HOME=/home/appuser/.cache/torch" in content

    # Healthcheck instruction
    assert "HEALTHCHECK" in content
    assert "/health" in content


def test_frontend_dockerfile_and_nginx_spa_routing():
    """Validates frontend Dockerfile and Nginx configuration for SPA routing, security headers, and health probes."""
    dockerfile_path = BASE_DIR / "frontend" / "Dockerfile"
    nginx_conf_path = BASE_DIR / "frontend" / "nginx.conf"

    assert dockerfile_path.exists(), "frontend/Dockerfile must exist"
    assert nginx_conf_path.exists(), "frontend/nginx.conf must exist"

    df_content = dockerfile_path.read_text(encoding="utf-8")
    assert "FROM node:22-alpine AS builder" in df_content
    assert "FROM nginx:1.27-alpine AS runner" in df_content
    assert "HEALTHCHECK" in df_content

    nginx_content = nginx_conf_path.read_text(encoding="utf-8")
    # SPA route fallback
    assert "try_files $uri $uri/ /index.html;" in nginx_content
    # API reverse proxy
    assert "location /api/ {" in nginx_content
    # Dedicated lightweight /health probe
    assert "location = /health {" in nginx_content
    # Security headers
    assert "X-Frame-Options" in nginx_content
    assert "X-Content-Type-Options" in nginx_content


@pytest.mark.asyncio
async def test_wait_for_db_utility():
    """Validates that the database wait utility correctly checks connectivity without crashing."""
    import importlib.util
    wait_script_path = BASE_DIR / "backend" / "scripts" / "wait_for_db.py"
    assert wait_script_path.exists(), "backend/scripts/wait_for_db.py must exist"

    spec = importlib.util.spec_from_file_location("wait_for_db", wait_script_path)
    wait_for_db = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(wait_for_db)

    # Test with standard SQLite configuration
    is_ready = await wait_for_db.check_db_connection(max_retries=2, delay=0.1)
    assert is_ready is True


def test_production_settings_validation_and_safety():
    """Validates Settings configuration validation, environment guards, and secret redaction."""
    # Valid environment configuration
    s = Settings(ENVIRONMENT="production", BACKEND_PORT=8000, CORS_ALLOWED_ORIGINS="https://app.com, https://admin.com/")
    assert s.ENVIRONMENT == "production"
    assert s.BACKEND_PORT == 8000
    assert s.cors_origins_list == ["https://app.com", "https://admin.com"]

    # Redaction test
    masked = s.safe_dict()
    assert masked["SECRET_KEY"].startswith("***REDACTED")
    assert masked["OPENAI_API_KEY"] == "***NOT_CONFIGURED***"

    # Environment validator rejection
    with pytest.raises(ValueError, match="ENVIRONMENT must be one of"):
        Settings(ENVIRONMENT="invalid_stage_name")

    # Port validator rejection
    with pytest.raises(ValueError, match="BACKEND_PORT must be between 1 and 65535"):
        Settings(BACKEND_PORT=999999)


def test_environment_configuration_templates():
    """Validates that template configuration files provide comprehensive environment variable declarations."""
    templates = [
        BASE_DIR / ".env.example",
        BASE_DIR / ".env.staging.example",
        BASE_DIR / ".env.production.example",
    ]

    required_keys = ["ENVIRONMENT", "DATABASE_URL", "SECRET_KEY", "CORS_ALLOWED_ORIGINS"]

    for tpl in templates:
        assert tpl.exists(), f"Configuration template {tpl.name} must exist"
        content = tpl.read_text(encoding="utf-8")
        for key in required_keys:
            assert f"{key}=" in content, f"{tpl.name} must declare key '{key}'"

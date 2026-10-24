from contextlib import asynccontextmanager
from typing import Any, Dict, List
from fastapi import FastAPI, HTTPException, Request, Response, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from app.api.v1.api import api_router
from app.api.v1.endpoints.data_import import seed_initial_data
from app.core.config import settings
from app.core.database import AsyncSessionLocal, Base, engine
from app.core.logging import logger
from app.schemas.health import HealthResponse, ReadinessResponse
from app.services.health_service import HealthService


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ensure database schema is created in development/testing if enabled
    if settings.AUTO_CREATE_TABLES and settings.ENVIRONMENT in ("development", "testing"):
        logger.info(
            f"Initializing {settings.APP_NAME} persistence schema in {settings.ENVIRONMENT} mode (AUTO_CREATE_TABLES=True)..."
        )
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database schema initialized successfully.")

        # Auto-seed initial demo accounts and fixtures if empty in development/testing
        async with AsyncSessionLocal() as session:
            try:
                seed_res = await seed_initial_data(session)
                logger.info(f"Database seed check: {seed_res['message']}")
            except Exception as e:
                logger.warning(f"Database auto-seed check skipped: {e}")
    else:
        logger.info(
            f"Production/managed mode ({settings.ENVIRONMENT}): Skipping automatic table creation on startup. "
            f"Database schema migrations must be applied using Alembic ('alembic upgrade head')."
        )

    yield

    # Shutdown: Dispose engine connection pool
    logger.info("Shutting down database engine connection pool...")
    await engine.dispose()
    logger.info("Database connections terminated.")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Intelligent Creator and Brand Collaboration Platform API",
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
    docs_url=f"{settings.API_V1_PREFIX}/docs",
    redoc_url=f"{settings.API_V1_PREFIX}/redoc",
    lifespan=lifespan,
)

# Explicit CORS Allowlist Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


# Consistent Error Handlers
@app.exception_handler(StarletteHTTPException)
async def starlette_http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Formats all Starlette and routing HTTP exceptions (including 404s) into consistent structures."""
    return JSONResponse(
        status_code=exc.status_code,
        headers=exc.headers,
        content={
            "error": {
                "code": exc.status_code,
                "message": str(exc.detail),
                "error_type": "http_exception",
            },
            "detail": exc.detail,
        },
    )


@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request: Request, exc: HTTPException):
    """Formats FastAPI HTTP exceptions into consistent, standardized error structures."""
    return JSONResponse(
        status_code=exc.status_code,
        headers=exc.headers,
        content={
            "error": {
                "code": exc.status_code,
                "message": str(exc.detail),
                "error_type": "http_exception",
            },
            "detail": exc.detail,
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Formats Pydantic request validation errors into actionable, sanitized structures."""
    formatted_errors = []
    for err in exc.errors():
        formatted_errors.append(
            {
                "loc": [str(loc_item) for loc_item in err.get("loc", [])],
                "msg": err.get("msg", "Validation error"),
                "type": err.get("type", "value_error"),
            }
        )

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        content={
            "error": {
                "code": status.HTTP_422_UNPROCESSABLE_CONTENT,
                "message": "Input validation failed for one or more fields.",
                "error_type": "validation_error",
                "details": formatted_errors,
            },
            "detail": formatted_errors,
        },
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    """Prevents internal credential or trace leakage while logging the sanitized error."""
    logger.error(f"Unhandled server error on {request.method} {request.url.path}: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "code": status.HTTP_500_INTERNAL_SERVER_ERROR,
                "message": "An internal server error occurred. Please contact system support.",
                "error_type": "internal_error",
            },
            "detail": "Internal server error",
        },
    )


# Root Convenience Probes (matching Kubernetes and load balancer conventions)
@app.get("/", tags=["Root"], summary="API Root & Service Directory")
async def root_index():
    """
    Root entrypoint for the Brand Bridge Backend API service.
    Directs users and clients to the frontend web application, Swagger docs, and health checks.
    """
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "online",
        "description": "Brand Bridge Intelligent Influencer Discovery & Campaign Management API",
        "frontend_application": "http://127.0.0.1:3000 (Open in browser for Web UI)",
        "endpoints": {
            "api_docs_swagger": f"{settings.API_V1_PREFIX}/docs",
            "api_docs_redoc": f"{settings.API_V1_PREFIX}/redoc",
            "openapi_spec": f"{settings.API_V1_PREFIX}/openapi.json",
            "liveness_probe": "/health",
            "readiness_probe": "/ready",
            "creators_niches": f"{settings.API_V1_PREFIX}/creators/niches",
            "auth_register": f"{settings.API_V1_PREFIX}/auth/register",
            "auth_login": f"{settings.API_V1_PREFIX}/auth/login",
            "brand_profile": f"{settings.API_V1_PREFIX}/brands/profile",
            "creator_profile": f"{settings.API_V1_PREFIX}/creators/profile",
        },
    }


@app.get("/docs", include_in_schema=False)
async def redirect_docs():
    return RedirectResponse(url=f"{settings.API_V1_PREFIX}/docs")


@app.get("/health", response_model=HealthResponse, tags=["Health"], summary="Root Liveness Probe")
async def root_liveness() -> HealthResponse:
    return HealthService.get_liveness(status_str="ok", include_subsystems=False)


@app.get("/ready", response_model=ReadinessResponse, tags=["Health"], summary="Root Readiness Probe")
async def root_readiness(response: Response) -> ReadinessResponse:
    readiness_data, is_ready = await HealthService.get_readiness()
    if not is_ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    else:
        response.status_code = status.HTTP_200_OK
    return readiness_data


# Mount API v1 router and /api alias
app.include_router(api_router, prefix=settings.API_V1_PREFIX)
if settings.API_V1_PREFIX != "/api":
    app.include_router(api_router, prefix="/api")

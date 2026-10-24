from fastapi import APIRouter, Response, status
from app.schemas.health import HealthResponse, ReadinessResponse
from app.services.health_service import HealthService

router = APIRouter()


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Liveness Probe",
    description="Returns the immediate liveness state of the API process.",
    status_code=status.HTTP_200_OK,
)
async def check_liveness() -> HealthResponse:
    """Liveness probe indicating the process is running and accepting HTTP requests."""
    return HealthService.get_liveness(status_str="healthy", include_subsystems=True)


@router.get(
    "/ready",
    response_model=ReadinessResponse,
    summary="Readiness Probe",
    description="Returns readiness state of the platform, verifying persistence and subsystems.",
    responses={
        200: {"description": "All required subsystems are operational and accepting traffic."},
        503: {"description": "One or more critical subsystems (e.g. database) are not ready."},
    },
)
async def check_readiness(response: Response) -> ReadinessResponse:
    """Readiness probe verifying operational state across subsystems."""
    readiness_data, is_ready = await HealthService.get_readiness()
    if not is_ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    else:
        response.status_code = status.HTTP_200_OK
    return readiness_data

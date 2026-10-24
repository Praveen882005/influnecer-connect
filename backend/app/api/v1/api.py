from fastapi import APIRouter
from app.api.v1.endpoints import (
    admin,
    analytics,
    auth,
    brands,
    campaigns,
    creators,
    data_import,
    health,
    proposals,
    recommendations,
    semantic,
    shortlists,
    invitations,
    opportunities,
    notifications,
)

api_router = APIRouter()

# Health & Readiness Foundation Endpoints
api_router.include_router(health.router, tags=["Health & Readiness"])

# Domain & Business Services
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(brands.router, prefix="/brands", tags=["Brands"])
api_router.include_router(creators.router, prefix="/creators", tags=["Creators"])
api_router.include_router(campaigns.router, prefix="/campaigns", tags=["Campaigns"])
api_router.include_router(semantic.router, prefix="/semantic", tags=["Semantic Content Understanding"])
api_router.include_router(proposals.router, prefix="/proposals", tags=["Proposals & Deliverables"])
api_router.include_router(recommendations.router, prefix="/recommendations", tags=["AI Brand Fit Recommendations"])
api_router.include_router(shortlists.router, prefix="/shortlists", tags=["Brand Shortlists"])
api_router.include_router(invitations.router, prefix="/invitations", tags=["Two-Sided Invitations"])
api_router.include_router(opportunities.router, prefix="/opportunities", tags=["Creator Opportunities"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["In-App Notifications"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["Platform Analytics"])
api_router.include_router(data_import.router, prefix="/data", tags=["Data Import & Fixtures"])
api_router.include_router(data_import.router, prefix="/import", tags=["Data Ingestion & Imports"])
api_router.include_router(admin.router, prefix="/admin", tags=["Admin & Operations"])

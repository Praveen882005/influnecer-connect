import csv
import io
import json
import os
from typing import Any, Dict, List, Optional

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from pydantic import BaseModel, Field
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.core.security import hash_password
from app.models.entities import (
    BrandProfile,
    Campaign,
    CampaignStatus,
    CreatorProfile,
    ImportJob,
    User,
    UserRole,
)
from app.schemas.ingestion import (
    ImportJobOut,
    ImportUploadResponse,
    ProviderAdapterStatus,
)
from app.services.ingestion.importer import IngestionEngine
from app.services.ingestion.provider_adapter import PROVIDER_ADAPTERS

router = APIRouter()


class RawIngestionPayload(BaseModel):
    """Schema for direct programmatic ingestion without multipart file upload."""
    entity_type: str = Field(..., description="'profiles' or 'posts'")
    records: List[Dict[str, Any]] = Field(..., description="List of raw record dicts")
    source_provenance: Optional[str] = Field("api_direct_ingestion", description="Provenance tracking label")


async def seed_initial_data(db: AsyncSession) -> Dict[str, Any]:
    """Helper to seed initial demo accounts and sample datasets."""
    # 1. Seed Demo Admin User
    admin_res = await db.execute(select(User).where(User.email == "admin@brandbridge.io"))
    if not admin_res.scalar_one_or_none():
        admin = User(
            email="admin@brandbridge.io",
            hashed_password=hash_password("admin12345"),
            full_name="Platform Administrator",
            role=UserRole.ADMIN,
            is_active=True,
        )
        db.add(admin)

    # 2. Seed Demo Brand User & Profile
    brand_user_res = await db.execute(select(User).where(User.email == "demo.brand@acmecorp.com"))
    brand_user = brand_user_res.scalar_one_or_none()
    if not brand_user:
        brand_user = User(
            email="demo.brand@acmecorp.com",
            hashed_password=hash_password("brand12345"),
            full_name="Acme Tech Innovations",
            role=UserRole.BRAND,
            is_active=True,
        )
        db.add(brand_user)
        await db.flush()

        brand_profile = BrandProfile(
            user_id=brand_user.id,
            company_name="Acme Tech Innovations",
            industry="Tech & AI",
            website="https://acmetech.example.com",
            description="Leading AI hardware and autonomous productivity software studio.",
            brand_values=["Cutting-Edge Innovation", "High Developer Utility", "Simplicity"],
            target_demographics={"age_groups": ["18-24", "25-34"], "countries": ["US", "CA", "UK", "DE"]},
        )
        db.add(brand_profile)
        await db.flush()

        # Seed sample campaigns for this brand
        samples_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../../../data/samples"))
        campaigns_file = os.path.join(samples_dir, "campaigns.json")
        if os.path.exists(campaigns_file):
            with open(campaigns_file, "r", encoding="utf-8") as f:
                c_data = json.load(f)
                for item in c_data:
                    camp = Campaign(
                        brand_id=brand_profile.id,
                        title=item["title"],
                        description=item["description"],
                        budget=item["budget"],
                        deliverables=item.get("deliverables", []),
                        niche=item["niche"],
                        target_audience=item.get("target_audience", {}),
                        min_followers=item.get("min_followers", 0),
                        min_engagement_rate=item.get("min_engagement_rate", 0.0),
                        status=CampaignStatus.ACTIVE,
                    )
                    db.add(camp)

    # 3. Seed Sample Creators
    samples_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../../../data/samples"))
    creators_file = os.path.join(samples_dir, "creators.json")
    created_creators_count = 0

    if os.path.exists(creators_file):
        with open(creators_file, "r", encoding="utf-8") as f:
            creators_data = json.load(f)
            for c_item in creators_data:
                existing = await db.execute(
                    select(CreatorProfile).where(CreatorProfile.handle == c_item["handle"])
                )
                if not existing.scalar_one_or_none():
                    c_user = User(
                        email=f"{c_item['handle'].replace('@', '')}@creatorhub.test",
                        hashed_password=hash_password("creator12345"),
                        full_name=c_item["display_name"],
                        role=UserRole.CREATOR,
                        is_active=True,
                    )
                    db.add(c_user)
                    await db.flush()

                    creator_prof = CreatorProfile(
                        user_id=c_user.id,
                        handle=c_item["handle"],
                        display_name=c_item["display_name"],
                        bio=c_item.get("bio", ""),
                        primary_niche=c_item["primary_niche"],
                        secondary_niches=c_item.get("secondary_niches", []),
                        platforms=c_item.get("platforms", {}),
                        total_followers=c_item.get("total_followers", 0),
                        avg_engagement_rate=c_item.get("avg_engagement_rate", 0.0),
                        authenticity_score=c_item.get("authenticity_score", 90.0),
                        audience_demographics=c_item.get("audience_demographics", {}),
                        sample_content_keywords=c_item.get("sample_content_keywords", []),
                        is_verified=c_item.get("is_verified", False),
                    )
                    db.add(creator_prof)
                    created_creators_count += 1

    await db.commit()
    return {
        "status": "success",
        "message": "Sample benchmark fixtures seeded cleanly.",
        "creators_added": created_creators_count,
        "sample_flag": "SYNTHETIC_DEVELOPMENT_FIXTURES",
    }


# ==============================================================================
# Admin Ingestion Endpoints (RBAC Enforced)
# ==============================================================================

@router.get("/jobs", response_model=List[ImportJobOut], summary="List ingestion jobs (Admin)")
async def list_import_jobs(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_admin: User = Depends(require_roles([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
):
    """Admin-only: Retrieve paginated history of ingestion jobs and audit summaries."""
    stmt = select(ImportJob).order_by(desc(ImportJob.created_at)).offset(offset).limit(limit)
    res = await db.execute(stmt)
    return res.scalars().all()


@router.get("/jobs/{job_id}", response_model=ImportJobOut, summary="Get import job detail (Admin)")
async def get_import_job(
    job_id: int,
    current_admin: User = Depends(require_roles([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
):
    """Admin-only: Retrieve specific import job details including error breakdown."""
    res = await db.execute(select(ImportJob).where(ImportJob.id == job_id))
    job = res.scalar_one_or_none()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Import job {job_id} not found.",
        )
    return job


@router.post("/upload", response_model=ImportUploadResponse, summary="Upload CSV or JSON dataset (Admin)")
async def upload_import_file(
    file: UploadFile = File(..., description="CSV or JSON data file"),
    entity_type: str = Form("profiles", description="'profiles' or 'posts'"),
    source_provenance: Optional[str] = Form(None, description="Dataset origin or filename"),
    current_admin: User = Depends(require_roles([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
):
    """
    Admin-only: Upload and ingest structured influencer profiles or posts from CSV or JSON.
    Idempotent: updates existing records on matching handle/post_id rather than failing.
    Captures row-level errors without halting valid records.
    """
    filename = file.filename or "uploaded_dataset"
    provenance = source_provenance or f"file_upload:{filename}"

    content_bytes = await file.read()
    content_text = content_bytes.decode("utf-8", errors="replace")

    # Determine file format and parse
    records: List[Dict[str, Any]] = []
    if filename.lower().endswith(".json"):
        try:
            records = IngestionEngine.parse_json(content_text)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid JSON format in uploaded file: {str(e)}",
            )
    else:
        # Default to CSV parser (ignores comments starting with #)
        try:
            records = IngestionEngine.parse_csv(content_text)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid CSV structure in uploaded file: {str(e)}",
            )

    # Ingest based on entity type
    norm_entity = entity_type.lower().strip()
    if norm_entity in ("profiles", "creators", "influencers"):
        job = await IngestionEngine.import_profiles(
            records=records,
            source_provenance=provenance,
            db=db,
            admin_user_id=current_admin.id,
        )
    elif norm_entity in ("posts", "influencer_posts", "social_posts"):
        job = await IngestionEngine.import_posts(
            records=records,
            source_provenance=provenance,
            db=db,
            admin_user_id=current_admin.id,
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported entity_type: '{entity_type}'. Must be 'profiles' or 'posts'.",
        )

    msg = (
        f"Ingestion {job.status.value}: {job.processed_records} succeeded, "
        f"{job.failed_records} failed out of {job.total_records} records."
    )
    return ImportUploadResponse(
        job_id=job.id,
        status=job.status.value,
        job_type=job.job_type,
        total_records=job.total_records,
        processed_records=job.processed_records,
        failed_records=job.failed_records,
        message=msg,
        error_summary=job.error_summary or [],
        provenance=job.source_provenance,
    )


@router.post("/raw", response_model=ImportUploadResponse, summary="Ingest raw records directly (Admin)")
async def ingest_raw_records(
    payload: RawIngestionPayload,
    current_admin: User = Depends(require_roles([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
):
    """
    Admin-only: Ingest raw records programmatically via JSON body.
    """
    norm_entity = payload.entity_type.lower().strip()
    provenance = payload.source_provenance or "programmatic_ingestion"

    if norm_entity in ("profiles", "creators", "influencers"):
        job = await IngestionEngine.import_profiles(
            records=payload.records,
            source_provenance=provenance,
            db=db,
            admin_user_id=current_admin.id,
        )
    elif norm_entity in ("posts", "influencer_posts", "social_posts"):
        job = await IngestionEngine.import_posts(
            records=payload.records,
            source_provenance=provenance,
            db=db,
            admin_user_id=current_admin.id,
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported entity_type: '{payload.entity_type}'. Must be 'profiles' or 'posts'.",
        )

    msg = (
        f"Ingestion {job.status.value}: {job.processed_records} succeeded, "
        f"{job.failed_records} failed out of {job.total_records} records."
    )
    return ImportUploadResponse(
        job_id=job.id,
        status=job.status.value,
        job_type=job.job_type,
        total_records=job.total_records,
        processed_records=job.processed_records,
        failed_records=job.failed_records,
        message=msg,
        error_summary=job.error_summary or [],
        provenance=job.source_provenance,
    )


@router.post("/seed-synthetic", summary="Seed synthetic benchmark datasets (Admin)")
async def seed_synthetic_benchmark(
    current_admin: User = Depends(require_roles([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
):
    """
    Admin-only: Ingests the synthetic creator and post datasets from data/samples/.
    Clearly labelled as synthetic development benchmark data (non-live).
    """
    samples_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../../../data/samples"))
    creators_csv = os.path.join(samples_dir, "synthetic_creators.csv")
    posts_csv = os.path.join(samples_dir, "synthetic_posts.csv")

    results = {}

    # Ingest synthetic creators
    if os.path.exists(creators_csv):
        with open(creators_csv, "r", encoding="utf-8") as f:
            creators_text = f.read()
        creators_records = IngestionEngine.parse_csv(creators_text)
        c_job = await IngestionEngine.import_profiles(
            records=creators_records,
            source_provenance="data/samples/synthetic_creators.csv",
            db=db,
            admin_user_id=current_admin.id,
        )
        results["creators_job"] = ImportJobOut.model_validate(c_job)
    else:
        results["creators_job"] = None

    # Ingest synthetic posts
    if os.path.exists(posts_csv):
        with open(posts_csv, "r", encoding="utf-8") as f:
            posts_text = f.read()
        posts_records = IngestionEngine.parse_csv(posts_text)
        p_job = await IngestionEngine.import_posts(
            records=posts_records,
            source_provenance="data/samples/synthetic_posts.csv",
            db=db,
            admin_user_id=current_admin.id,
        )
        results["posts_job"] = ImportJobOut.model_validate(p_job)
    else:
        results["posts_job"] = None

    return {
        "status": "success",
        "message": "Synthetic benchmark datasets processed.",
        "disclaimer": "These datasets are clearly marked as synthetic development fixtures and NOT real social platform data.",
        **results,
    }


@router.get("/provider-adapters", response_model=List[ProviderAdapterStatus], summary="List provider adapters")
async def list_provider_adapters():
    """
    Returns the operational status, disclaimers, and permissions for all registered social provider adapters.
    Verifies that live Instagram and YouTube APIs remain disabled until platform review.
    """
    adapters = []
    for adapter in PROVIDER_ADAPTERS.values():
        summary = adapter.get_status_summary()
        adapters.append(
            ProviderAdapterStatus(
                provider_id=summary["provider_id"],
                display_name=summary["display_name"],
                status=summary["status"],
                is_enabled=summary["is_enabled"],
                reason=summary.get("reason"),
                disclaimer=summary.get("disclaimer"),
            )
        )
    return adapters


@router.get("/provider-adapters/{provider_id}", summary="Get detailed provider adapter metadata")
async def get_provider_adapter_detail(provider_id: str):
    """Returns detailed status, permissions, and scopes for a specific provider adapter."""
    adapter = PROVIDER_ADAPTERS.get(provider_id)
    if not adapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Provider adapter '{provider_id}' not found.",
        )
    return adapter.get_status_summary()


# ==============================================================================
# Backward Compatibility & Legacy Catalog Endpoints
# ==============================================================================

@router.post("/seed", status_code=status.HTTP_200_OK, summary="Legacy seed endpoint")
@router.post("/seed-sample-data", status_code=status.HTTP_200_OK, summary="Legacy seed endpoint")
async def seed_endpoint(db: AsyncSession = Depends(get_db)):
    return await seed_initial_data(db)


@router.get("/samples", summary="Sample catalog directory")
async def get_samples_catalog():
    samples_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../../../data/samples"))
    creators_file = os.path.join(samples_dir, "creators.json")
    campaigns_file = os.path.join(samples_dir, "campaigns.json")

    creators = []
    campaigns = []
    if os.path.exists(creators_file):
        with open(creators_file, "r", encoding="utf-8") as f:
            creators = json.load(f)
    if os.path.exists(campaigns_file):
        with open(campaigns_file, "r", encoding="utf-8") as f:
            campaigns = json.load(f)

    return {
        "disclaimer": "Sample benchmark fixtures intended for development and evaluation. Clearly marked as non-production data.",
        "total_sample_creators": len(creators),
        "total_sample_campaigns": len(campaigns),
        "creators": creators,
        "campaigns": campaigns,
    }

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.entities import CreatorProfile, InfluencerPost, User
from app.schemas.fraud import FraudAnalysisReportOut, FraudSearchRequest
from app.services.analytics.fraud_service import fraud_risk_analysis_service

router = APIRouter()


@router.post(
    "/search",
    response_model=FraudAnalysisReportOut,
    summary="Search & Audit Creator for Fraud Risk & Anomalies",
)
async def search_and_analyze_creator_fraud_risk(
    payload: FraudSearchRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FraudAnalysisReportOut:
    """
    Resolves a creator by username (e.g. '@tech_guru'), full profile URL, or catalog record ID,
    and conducts an evidence-based fraud risk audit:
      - Unusual engagement patterns and like-to-comment asymmetry.
      - Abnormal interaction patterns and duplicate caption templating.
      - Suspicious longitudinal growth curve velocity (minimum 2 snapshots required).
      - Profile and follower proportion consistency.

    Distinguishes observed facts, calculated indicators, and heuristic warnings.
    Does not label creators as 'fraudsters'; communicates review signals to guide human marketers.
    """
    creator = await fraud_risk_analysis_service.resolve_creator(payload.query, db)
    if not creator:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                f"Creator matching query '{payload.query}' was not found in the platform catalog. "
                "Fraud analysis requires an indexed creator record or ingested performance metrics."
            ),
        )

    # Ingested sample posts
    p_res = await db.execute(
        select(InfluencerPost)
        .where(InfluencerPost.influencer_id == creator.id)
        .order_by(desc(InfluencerPost.posted_at))
    )
    posts = list(p_res.scalars().all())

    return fraud_risk_analysis_service.analyze_creator_fraud_risk(
        creator=creator,
        posts=posts,
    )


@router.get(
    "/creator/{creator_id}",
    response_model=FraudAnalysisReportOut,
    summary="Retrieve Creator Fraud Risk Report by ID",
)
async def get_creator_fraud_risk_by_id(
    creator_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FraudAnalysisReportOut:
    """
    Directly retrieves fraud risk and anomaly review signals for an existing catalog creator ID.
    """
    c_res = await db.execute(select(CreatorProfile).where(CreatorProfile.id == creator_id))
    creator = c_res.scalar_one_or_none()
    if not creator:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Creator with ID {creator_id} not found.",
        )

    p_res = await db.execute(
        select(InfluencerPost)
        .where(InfluencerPost.influencer_id == creator.id)
        .order_by(desc(InfluencerPost.posted_at))
    )
    posts = list(p_res.scalars().all())

    return fraud_risk_analysis_service.analyze_creator_fraud_risk(
        creator=creator,
        posts=posts,
    )

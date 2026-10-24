import csv
import io
import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.security import hash_password
from app.models.entities import (
    AuditEvent,
    CreatorProfile,
    ImportJob,
    ImportJobStatus,
    InfluencerPost,
    User,
    UserRole,
)
from app.schemas.ingestion import (
    RawPostInput,
    RawProfileInput,
    parse_explicit_metric,
)


class IngestionEngine:
    """
    Provider-neutral ingestion engine supporting CSV and JSON imports
    for influencer profiles and posts.
    Enforces validation, duplicate detection, idempotent re-import,
    and explicit representation of unavailable metrics.
    """

    @staticmethod
    def parse_csv(csv_content: str) -> List[Dict[str, Any]]:
        """Parses CSV text into a list of dictionaries, ignoring comments and blank lines."""
        lines = [line for line in csv_content.splitlines() if line.strip() and not line.strip().startswith("#")]
        if not lines:
            return []
        reader = csv.DictReader(lines)
        return [dict(row) for row in reader]

    @staticmethod
    def parse_json(json_content: str) -> List[Dict[str, Any]]:
        """Parses JSON text representing a list of records or dictionary with records list."""
        data = json.loads(json_content)
        if isinstance(data, list):
            return data
        elif isinstance(data, dict):
            # Support wrapping formats e.g. {"creators": [...]} or {"items": [...]}
            for key in ("creators", "profiles", "posts", "items", "data"):
                if key in data and isinstance(data[key], list):
                    return data[key]
            return [data]
        return []

    @classmethod
    async def import_profiles(
        cls,
        records: List[Dict[str, Any]],
        source_provenance: str,
        db: AsyncSession,
        admin_user_id: Optional[int] = None,
    ) -> ImportJob:
        """
        Idempotently imports creator profiles from structured records.
        Handles duplicates by updating existing profiles with fresh metrics.
        Captures row-level errors without halting the entire batch.
        """
        now = datetime.now(timezone.utc)
        job = ImportJob(
            job_type="creator_profiles_import",
            source_provenance=source_provenance,
            status=ImportJobStatus.PROCESSING,
            total_records=len(records),
            processed_records=0,
            failed_records=0,
            error_summary=[],
            created_at=now,
        )
        db.add(job)
        await db.flush()

        if len(records) == 0:
            job.status = ImportJobStatus.COMPLETED
            job.completed_at = datetime.now(timezone.utc)
            await db.commit()
            await db.refresh(job)
            return job

        error_list: List[Dict[str, Any]] = []
        processed_count = 0
        failed_count = 0

        for idx, row in enumerate(records):
            row_num = idx + 1
            try:
                profile_in = RawProfileInput(**row)

                # Duplicate detection: match on CreatorProfile.handle
                existing_res = await db.execute(
                    select(CreatorProfile).where(CreatorProfile.handle == profile_in.handle)
                )
                creator = existing_res.scalar_one_or_none()

                if creator:
                    # Idempotent re-import: Update existing profile fields
                    creator.display_name = profile_in.display_name
                    if profile_in.bio:
                        creator.bio = profile_in.bio
                    if profile_in.profile_image_url:
                        creator.profile_image_url = profile_in.profile_image_url
                    creator.primary_niche = profile_in.primary_niche
                    if profile_in.total_followers > 0:
                        creator.total_followers = profile_in.total_followers
                    creator.avg_engagement_rate = profile_in.avg_engagement_rate
                    creator.authenticity_score = profile_in.authenticity_score
                    if profile_in.supported_platforms:
                        creator.supported_platforms = profile_in.supported_platforms
                    creator.language = profile_in.language or "English"
                    creator.data_source = source_provenance
                    creator.last_fetched_at = now
                    creator.freshness_status = "fresh"

                    # If location or rates provided, merge into collaboration_preferences
                    collab = creator.collaboration_preferences or {}
                    if profile_in.location:
                        collab["location"] = profile_in.location
                    creator.collaboration_preferences = collab

                else:
                    # Provision creator account user and new profile
                    user_email = f"{profile_in.handle.replace('@', '')}_{job.id}_{row_num}@creatorhub.test"
                    user = User(
                        email=user_email,
                        hashed_password=hash_password("CreatorSecure123!"),
                        full_name=profile_in.display_name,
                        role=UserRole.CREATOR,
                        is_active=True,
                    )
                    db.add(user)
                    await db.flush()

                    collab_prefs = {}
                    if profile_in.location:
                        collab_prefs["location"] = profile_in.location

                    new_creator = CreatorProfile(
                        user_id=user.id,
                        handle=profile_in.handle,
                        display_name=profile_in.display_name,
                        bio=profile_in.bio or "Imported via Brand Bridge Ingestion Pipeline.",
                        profile_image_url=profile_in.profile_image_url or "",
                        primary_niche=profile_in.primary_niche,
                        secondary_niches=profile_in.secondary_niches or [],
                        supported_platforms=profile_in.supported_platforms or ["youtube"],
                        platforms=profile_in.platforms or {"youtube": {"followers": profile_in.total_followers}},
                        language=profile_in.language or "English",
                        total_followers=profile_in.total_followers,
                        avg_engagement_rate=profile_in.avg_engagement_rate,
                        authenticity_score=profile_in.authenticity_score,
                        audience_demographics=profile_in.audience_demographics or {},
                        sample_content_keywords=[profile_in.primary_niche],
                        data_source=source_provenance,
                        last_fetched_at=now,
                        freshness_status="fresh",
                        is_verified=False,
                        is_platform_verified=False,
                        collaboration_preferences=collab_prefs,
                    )
                    db.add(new_creator)

                processed_count += 1

            except Exception as err:
                failed_count += 1
                error_list.append({
                    "row": row_num,
                    "record_identifier": row.get("handle") or row.get("username") or f"row_{row_num}",
                    "error": str(err),
                })

        job.processed_records = processed_count
        job.failed_records = failed_count
        job.error_summary = error_list
        job.status = ImportJobStatus.COMPLETED if processed_count > 0 else ImportJobStatus.FAILED
        job.completed_at = datetime.now(timezone.utc)

        # Record AuditEvent for ingestion
        audit = AuditEvent(
            user_id=admin_user_id,
            action="data_ingestion_profiles",
            resource_type="import_job",
            resource_id=str(job.id),
            status="success" if job.status == ImportJobStatus.COMPLETED else "failure",
            details={
                "job_id": job.id,
                "source": source_provenance,
                "total": len(records),
                "processed": processed_count,
                "failed": failed_count,
            },
        )
        db.add(audit)

        await db.commit()
        await db.refresh(job)
        return job

    @classmethod
    async def import_posts(
        cls,
        records: List[Dict[str, Any]],
        source_provenance: str,
        db: AsyncSession,
        admin_user_id: Optional[int] = None,
    ) -> ImportJob:
        """
        Idempotently imports social post records.
        Strictly preserves NULL representation for missing engagement metrics.
        """
        now = datetime.now(timezone.utc)
        job = ImportJob(
            job_type="influencer_posts_import",
            source_provenance=source_provenance,
            status=ImportJobStatus.PROCESSING,
            total_records=len(records),
            processed_records=0,
            failed_records=0,
            error_summary=[],
            created_at=now,
        )
        db.add(job)
        await db.flush()

        if len(records) == 0:
            job.status = ImportJobStatus.COMPLETED
            job.completed_at = datetime.now(timezone.utc)
            await db.commit()
            await db.refresh(job)
            return job

        error_list: List[Dict[str, Any]] = []
        processed_count = 0
        failed_count = 0

        for idx, row in enumerate(records):
            row_num = idx + 1
            try:
                post_in = RawPostInput(**row)

                # Match target influencer by handle
                c_res = await db.execute(
                    select(CreatorProfile).where(CreatorProfile.handle == post_in.influencer_handle)
                )
                creator = c_res.scalar_one_or_none()
                if not creator:
                    raise ValueError(
                        f"Target creator '{post_in.influencer_handle}' does not exist. Import creator profile first."
                    )

                # Parse metrics availability strictly:
                # None is stored if metric was omitted or unmonitored; 0 is stored ONLY if explicitly reported.
                likes_val = parse_explicit_metric(row.get("likes_count") if "likes_count" in row else row.get("likes"))
                views_val = parse_explicit_metric(row.get("views_count") if "views_count" in row else row.get("views"))
                comments_val = parse_explicit_metric(row.get("comments_count") if "comments_count" in row else row.get("comments"))
                shares_val = parse_explicit_metric(row.get("shares_count") if "shares_count" in row else row.get("shares"))

                metrics_avail = {
                    "likes": likes_val is not None,
                    "views": views_val is not None,
                    "comments": comments_val is not None,
                    "shares": shares_val is not None,
                }

                # Parse posted_at date
                posted_date = now
                raw_posted = row.get("posted_at")
                if raw_posted:
                    try:
                        posted_date = datetime.fromisoformat(str(raw_posted).replace("Z", "+00:00"))
                    except Exception:
                        posted_date = now

                # Duplicate detection on (platform, external_post_id)
                post_res = await db.execute(
                    select(InfluencerPost).where(
                        InfluencerPost.platform == post_in.platform.lower(),
                        InfluencerPost.external_post_id == post_in.external_post_id,
                    )
                )
                post = post_res.scalar_one_or_none()

                if post:
                    # Idempotent update
                    post.caption = post_in.caption or post.caption
                    post.url = post_in.url or post.url
                    post.media_type = post_in.media_type or post.media_type
                    post.likes_count = likes_val
                    post.views_count = views_val
                    post.comments_count = comments_val
                    post.shares_count = shares_val
                    post.metrics_availability = metrics_avail
                    post.data_source = source_provenance
                    post.last_synced_at = now
                else:
                    new_post = InfluencerPost(
                        influencer_id=creator.id,
                        platform=post_in.platform.lower(),
                        external_post_id=post_in.external_post_id,
                        url=post_in.url,
                        caption=post_in.caption or "",
                        media_type=post_in.media_type or "video",
                        posted_at=posted_date,
                        data_source=source_provenance,
                        last_synced_at=now,
                        likes_count=likes_val,
                        views_count=views_val,
                        comments_count=comments_val,
                        shares_count=shares_val,
                        metrics_availability=metrics_avail,
                    )
                    db.add(new_post)

                processed_count += 1

            except Exception as err:
                failed_count += 1
                error_list.append({
                    "row": row_num,
                    "record_identifier": row.get("external_post_id") or row.get("post_id") or f"row_{row_num}",
                    "error": str(err),
                })

        job.processed_records = processed_count
        job.failed_records = failed_count
        job.error_summary = error_list
        job.status = ImportJobStatus.COMPLETED if processed_count > 0 else ImportJobStatus.FAILED
        job.completed_at = datetime.now(timezone.utc)

        audit = AuditEvent(
            user_id=admin_user_id,
            action="data_ingestion_posts",
            resource_type="import_job",
            resource_id=str(job.id),
            status="success" if job.status == ImportJobStatus.COMPLETED else "failure",
            details={
                "job_id": job.id,
                "source": source_provenance,
                "total": len(records),
                "processed": processed_count,
                "failed": failed_count,
            },
        )
        db.add(audit)

        await db.commit()
        await db.refresh(job)
        return job

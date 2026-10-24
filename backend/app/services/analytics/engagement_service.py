from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from app.models.entities import CreatorProfile, InfluencerPost
from app.schemas.analytics import EngagementMetricsOut


class EngagementCalculator:
    """
    Transparent calculation service for creator engagement rates and sample metrics.
    Strictly follows the canonical specification:
    Formula: ((average likes + average comments) / follower count) * 100
    
    Guarantees robust boundary handling for:
    - Zero followers (no ZeroDivisionError; explicit status).
    - Missing metrics (unmonitored metrics are never silently replaced with 0).
    - Empty post history (clean explicit empty status).
    - Stale data tracking (>30 days threshold flagged clearly with provenance timestamps).
    """

    STALE_DATA_THRESHOLD_DAYS = 30

    @classmethod
    def calculate_from_posts(
        cls,
        creator: CreatorProfile,
        posts: List[InfluencerPost],
        now: Optional[datetime] = None,
    ) -> EngagementMetricsOut:
        now = now or datetime.now(timezone.utc)
        notes: List[str] = []
        follower_count = creator.total_followers or 0

        # 1. Evaluate Data Freshness & Timestamps
        last_fetched = creator.last_fetched_at
        if last_fetched:
            # Ensure timezone awareness
            if last_fetched.tzinfo is None:
                last_fetched = last_fetched.replace(tzinfo=timezone.utc)
            days_old = (now - last_fetched).total_seconds() / 86400.0
            if days_old > cls.STALE_DATA_THRESHOLD_DAYS:
                freshness = "stale"
                notes.append(
                    f"Data sample is stale ({int(days_old)} days old, fetched {last_fetched.strftime('%Y-%m-%d')}). "
                    "Metrics may not reflect recent creator trajectory."
                )
            else:
                freshness = "fresh"
        else:
            freshness = "unknown"
            notes.append("No explicit last_fetched_at timestamp recorded for this profile.")

        # 2. Handle Zero Followers Boundary Case
        if follower_count <= 0:
            notes.append("Follower count is 0 or negative. Engagement rate cannot be calculated without division by zero.")
            return EngagementMetricsOut(
                creator_id=creator.id,
                handle=creator.handle,
                follower_count=follower_count,
                sample_size_posts=len(posts),
                sample_start_date=None,
                sample_end_date=None,
                avg_likes=None,
                avg_comments=None,
                calculated_engagement_rate=None,
                calculation_status="zero_followers_uncomputable",
                metrics_availability={
                    "likes": False,
                    "comments": False,
                    "views": False,
                    "shares": False,
                },
                data_freshness=freshness,
                last_fetched_at=last_fetched,
                calculated_at=now,
                notes=notes,
            )

        # 3. Handle Empty Post History Case
        if not posts:
            notes.append("No post history exists for this creator. Observed engagement rate cannot be evaluated.")
            return EngagementMetricsOut(
                creator_id=creator.id,
                handle=creator.handle,
                follower_count=follower_count,
                sample_size_posts=0,
                sample_start_date=None,
                sample_end_date=None,
                avg_likes=None,
                avg_comments=None,
                calculated_engagement_rate=None,
                calculation_status="empty_post_history",
                metrics_availability={
                    "likes": False,
                    "comments": False,
                    "views": False,
                    "shares": False,
                },
                data_freshness=freshness,
                last_fetched_at=last_fetched,
                calculated_at=now,
                notes=notes,
            )

        # 4. Extract Date Range and Metric Samples
        valid_likes: List[int] = []
        valid_comments: List[int] = []
        has_views = False
        has_shares = False

        post_dates: List[datetime] = []
        for p in posts:
            if p.posted_at:
                p_date = p.posted_at
                if p_date.tzinfo is None:
                    p_date = p_date.replace(tzinfo=timezone.utc)
                post_dates.append(p_date)

            if p.likes_count is not None:
                valid_likes.append(p.likes_count)
            if p.comments_count is not None:
                valid_comments.append(p.comments_count)
            if p.views_count is not None:
                has_views = True
            if p.shares_count is not None:
                has_shares = True

        sample_start = min(post_dates) if post_dates else None
        sample_end = max(post_dates) if post_dates else None

        avg_likes = round(sum(valid_likes) / len(valid_likes), 2) if valid_likes else None
        avg_comments = round(sum(valid_comments) / len(valid_comments), 2) if valid_comments else None

        metrics_avail = {
            "likes": len(valid_likes) > 0,
            "comments": len(valid_comments) > 0,
            "views": has_views,
            "shares": has_shares,
        }

        # 5. Compute Engagement Rate Based on Metrics Availability
        calculated_rate: Optional[float] = None
        calculation_status: str

        if avg_likes is not None and avg_comments is not None:
            # Canonical standard formula: ((avg_likes + avg_comments) / follower_count) * 100
            raw_rate = ((avg_likes + avg_comments) / follower_count) * 100.0
            calculated_rate = round(raw_rate, 2)
            calculation_status = "complete"
            notes.append(
                f"Engagement rate calculated across {len(posts)} posts: "
                f"(({avg_likes} avg likes + {avg_comments} avg comments) / {follower_count} followers) * 100."
            )
        elif avg_likes is not None and avg_comments is None:
            # Partial calculation: Likes only
            raw_rate = (avg_likes / follower_count) * 100.0
            calculated_rate = round(raw_rate, 2)
            calculation_status = "partial_metrics_likes_only"
            notes.append(
                f"Comments metric was missing or unmonitored. "
                f"Partial engagement rate calculated from likes only: ({avg_likes} / {follower_count}) * 100."
            )
        elif avg_likes is None and avg_comments is not None:
            # Partial calculation: Comments only
            raw_rate = (avg_comments / follower_count) * 100.0
            calculated_rate = round(raw_rate, 2)
            calculation_status = "partial_metrics_comments_only"
            notes.append(
                f"Likes metric was missing or unmonitored. "
                f"Partial engagement rate calculated from comments only: ({avg_comments} / {follower_count}) * 100."
            )
        else:
            # Neither likes nor comments available
            calculated_rate = None
            calculation_status = "missing_metrics"
            notes.append("Neither likes nor comments were available in the post sample to calculate engagement rate.")

        return EngagementMetricsOut(
            creator_id=creator.id,
            handle=creator.handle,
            follower_count=follower_count,
            sample_size_posts=len(posts),
            sample_start_date=sample_start,
            sample_end_date=sample_end,
            avg_likes=avg_likes,
            avg_comments=avg_comments,
            calculated_engagement_rate=calculated_rate,
            calculation_formula="((avg_likes + avg_comments) / follower_count) * 100",
            calculation_status=calculation_status,
            metrics_availability=metrics_avail,
            data_freshness=freshness,
            last_fetched_at=last_fetched,
            calculated_at=now,
            notes=notes,
        )

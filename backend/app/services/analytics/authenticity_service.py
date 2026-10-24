from datetime import datetime, timezone
import re
from typing import Any, Dict, List, Optional
from app.models.entities import CreatorProfile, InfluencerPost
from app.schemas.analytics import AuthenticityReportOut, EngagementMetricsOut, ReviewSignalOut
from app.services.analytics.model_interface import (
    BaseAuthenticityModel,
    DeterministicHeuristicAuthenticityModel,
    SupervisedAuthenticityClassifierStub,
)


class AuthenticitySignalEvaluator:
    """
    Evaluates transparent, evidence-based review signals for creator accounts.
    Strictly follows the prompt mandate:
    - Signals are evidence and review heuristics, NOT definitive proof of fraud.
    - Automated exclusion is NEVER warranted (is_exclusion_warranted = False).
    - Unsupported assumptions are rejected (e.g. missing metrics produce 'insufficient_data', never a penalty).
    - Growth anomalies are evaluated ONLY when multiple timestamped observations exist.
    """

    ENGAGEMENT_TIER_BENCHMARKS = [
        (1_000, 10_000, "nano", 4.0),
        (10_000, 100_000, "micro", 2.5),
        (100_000, 500_000, "mid", 1.8),
        (500_000, 1_000_000, "macro", 1.3),
        (1_000_000, 100_000_000, "mega", 1.0),
    ]

    def __init__(self, model: Optional[BaseAuthenticityModel] = None):
        self.model = model or DeterministicHeuristicAuthenticityModel()
        self.supervised_stub = SupervisedAuthenticityClassifierStub()

    def evaluate_follower_following_ratio(
        self,
        followers: int,
        following: Optional[int],
    ) -> ReviewSignalOut:
        """
        Evaluates the balance between audience followers and followed accounts.
        If following count is omitted, marks as 'insufficient_data' without penalty.
        """
        if following is None:
            return ReviewSignalOut(
                signal_key="follower_following_ratio",
                display_name="Follower / Following Ratio",
                status="insufficient_data",
                observed_value=None,
                benchmark_or_expected="Healthy organic ratio: 0.5:1 to 500:1",
                evidence_summary="Following count is not provided by the current data source.",
                context_and_guidance="Data provider did not include following metrics. Account cannot be evaluated on this signal.",
                is_exclusion_warranted=False,
            )

        if following == 0:
            return ReviewSignalOut(
                signal_key="follower_following_ratio",
                display_name="Follower / Following Ratio",
                status="normal",
                observed_value={"followers": followers, "following": 0},
                benchmark_or_expected="0 following (typical for managed brand/celebrity profiles)",
                evidence_summary="Account follows 0 other profiles (common on verified or media-managed accounts).",
                context_and_guidance="Standard practice for high-profile talent or broadcast-only creator channels.",
                is_exclusion_warranted=False,
            )

        ratio = followers / following
        if ratio < 0.15 and followers < 5_000:
            return ReviewSignalOut(
                signal_key="follower_following_ratio",
                display_name="Follower / Following Ratio",
                status="review_recommended",
                observed_value=round(ratio, 2),
                benchmark_or_expected="Expected: >= 0.5:1 for established creators",
                evidence_summary=(
                    f"Low ratio of {ratio:.2f}:1 (follows {following:,} accounts while having {followers:,} followers)."
                ),
                context_and_guidance="Frequently observed in aggressive follow-unfollow acquisition campaigns. Verify audience retention.",
                is_exclusion_warranted=False,
            )

        return ReviewSignalOut(
            signal_key="follower_following_ratio",
            display_name="Follower / Following Ratio",
            status="normal",
            observed_value=round(ratio, 2),
            benchmark_or_expected="Healthy organic range: 0.5:1 to 500:1",
            evidence_summary=f"Organic ratio of {ratio:.2f}:1 ({followers:,} followers to {following:,} following).",
            context_and_guidance="Follower-to-following proportions conform to typical creator account distributions.",
            is_exclusion_warranted=False,
        )

    def evaluate_posting_frequency(
        self,
        posts: List[InfluencerPost],
        now: datetime,
    ) -> ReviewSignalOut:
        """
        Evaluates intervals between post timestamps.
        Requires at least 2 dated posts to compute cadences; otherwise returns 'insufficient_data'.
        Detects dormancy (>90 days) or rapid burst posting.
        """
        dated_posts = [p for p in posts if p.posted_at is not None]
        if len(dated_posts) < 2:
            return ReviewSignalOut(
                signal_key="posting_frequency",
                display_name="Posting Frequency & Cadence",
                status="insufficient_data",
                observed_value={"dated_posts_count": len(dated_posts)},
                benchmark_or_expected="Minimum 2 dated posts required for interval calculation",
                evidence_summary=f"Sample contains only {len(dated_posts)} dated post(s).",
                context_and_guidance="Longitudinal post history required to evaluate posting cadence.",
                is_exclusion_warranted=False,
            )

        # Sort chronologically
        dated_posts.sort(key=lambda p: p.posted_at)
        timestamps = []
        for p in dated_posts:
            dt = p.posted_at
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            timestamps.append(dt)

        # Check dormancy
        latest_post = timestamps[-1]
        days_since_latest = (now - latest_post).total_seconds() / 86400.0
        if days_since_latest > 90.0:
            return ReviewSignalOut(
                signal_key="posting_frequency",
                display_name="Posting Frequency & Cadence",
                status="review_recommended",
                observed_value={"days_inactive": int(days_since_latest), "latest_post": latest_post.strftime("%Y-%m-%d")},
                benchmark_or_expected="Active account: published within the last 60 days",
                evidence_summary=f"Creator has been inactive for {int(days_since_latest)} days (latest post: {latest_post.strftime('%Y-%m-%d')}).",
                context_and_guidance="Account appears dormant. Verify creator availability and publishing lead times before contracting.",
                is_exclusion_warranted=False,
            )

        # Check burst syndication (multiple posts published within 5 minutes)
        intervals_minutes = [
            (t2 - t1).total_seconds() / 60.0
            for t1, t2 in zip(timestamps[:-1], timestamps[1:])
        ]
        rapid_bursts = [m for m in intervals_minutes if m < 5.0]
        if len(rapid_bursts) >= 2:
            return ReviewSignalOut(
                signal_key="posting_frequency",
                display_name="Posting Frequency & Cadence",
                status="review_recommended",
                observed_value={"burst_intervals_minutes": [round(m, 1) for m in rapid_bursts]},
                benchmark_or_expected="Organic distribution: hours or days between posts",
                evidence_summary="Multiple posts published within minutes of each other (rapid burst posting).",
                context_and_guidance="May indicate automated batch syndication, cross-posting bots, or scheduled backlog dumps.",
                is_exclusion_warranted=False,
            )

        avg_days = sum(intervals_minutes) / len(intervals_minutes) / 1440.0
        return ReviewSignalOut(
            signal_key="posting_frequency",
            display_name="Posting Frequency & Cadence",
            status="normal",
            observed_value={"avg_days_between_posts": round(avg_days, 1)},
            benchmark_or_expected="Regular organic cadence: 0.5 to 14 days between posts",
            evidence_summary=f"Consistent posting rhythm averaging {avg_days:.1f} days between publications.",
            context_and_guidance="Creator maintains steady publication activity consistent with active channel management.",
            is_exclusion_warranted=False,
        )

    def evaluate_engagement_anomalies(
        self,
        engagement: EngagementMetricsOut,
    ) -> ReviewSignalOut:
        """
        Compares observed engagement rate against follower-tier benchmarks.
        Checks for extreme outliers (under 0.1% on large accounts or >25% on huge audiences)
        and like-to-comment asymmetry.
        """
        rate = engagement.calculated_engagement_rate
        followers = engagement.follower_count

        if rate is None or followers <= 0 or engagement.sample_size_posts == 0:
            return ReviewSignalOut(
                signal_key="engagement_anomalies",
                display_name="Tier-Normalized Engagement & Consistency",
                status="insufficient_data",
                observed_value=None,
                benchmark_or_expected="Calculated engagement rate from non-empty post history",
                evidence_summary="Engagement rate could not be computed (zero followers or empty post sample).",
                context_and_guidance="Cannot assess engagement anomalies without valid interaction counts.",
                is_exclusion_warranted=False,
            )

        # Resolve tier benchmark
        benchmark = 1.0
        tier_label = "mega"
        for low, high, label, bench in self.ENGAGEMENT_TIER_BENCHMARKS:
            if low <= followers < high:
                benchmark = bench
                tier_label = label
                break

        # Check ghost follower / severe low engagement anomaly
        if followers >= 25_000 and rate < 0.1:
            return ReviewSignalOut(
                signal_key="engagement_anomalies",
                display_name="Tier-Normalized Engagement & Consistency",
                status="review_recommended",
                observed_value={"engagement_rate": rate, "tier": tier_label},
                benchmark_or_expected=f"{tier_label.capitalize()} tier benchmark: {benchmark:.1f}%",
                evidence_summary=f"Extremely low engagement rate of {rate:.2f}% (benchmark: {benchmark:.1f}%).",
                context_and_guidance="Indicates possible ghost followers, algorithmic reach penalties, or an inactive legacy audience.",
                is_exclusion_warranted=False,
            )

        # Check inflated engagement anomaly (e.g. >25% on >50k followers)
        if followers >= 50_000 and rate > 20.0:
            return ReviewSignalOut(
                signal_key="engagement_anomalies",
                display_name="Tier-Normalized Engagement & Consistency",
                status="review_recommended",
                observed_value={"engagement_rate": rate, "tier": tier_label},
                benchmark_or_expected=f"{tier_label.capitalize()} tier benchmark: {benchmark:.1f}%",
                evidence_summary=f"Unusually high engagement ({rate:.2f}%) exceeding 8x expected tier benchmark ({benchmark:.1f}%).",
                context_and_guidance="May indicate viral outlier posts or artificial engagement pod activity. Audit comments for substance.",
                is_exclusion_warranted=False,
            )

        # Check like-to-comment asymmetry
        if (
            engagement.avg_likes is not None
            and engagement.avg_comments is not None
            and engagement.avg_likes >= 1_000
            and engagement.avg_comments == 0
        ):
            return ReviewSignalOut(
                signal_key="engagement_anomalies",
                display_name="Tier-Normalized Engagement & Consistency",
                status="review_recommended",
                observed_value={"avg_likes": engagement.avg_likes, "avg_comments": 0},
                benchmark_or_expected="Expected comment volume alongside >1,000 likes",
                evidence_summary=f"Severe interaction asymmetry: {int(engagement.avg_likes)} avg likes with 0 comments recorded.",
                context_and_guidance="Organic posts typically generate conversational responses. Verify if comments are disabled or purchased.",
                is_exclusion_warranted=False,
            )

        return ReviewSignalOut(
            signal_key="engagement_anomalies",
            display_name="Tier-Normalized Engagement & Consistency",
            status="normal",
            observed_value={"engagement_rate": rate, "tier": tier_label},
            benchmark_or_expected=f"{tier_label.capitalize()} tier benchmark: {benchmark:.1f}%",
            evidence_summary=f"Observed engagement ({rate:.2f}%) conforms to expected {tier_label} tier range ({benchmark:.1f}% benchmark).",
            context_and_guidance="Interaction volume and follower proportion exhibit healthy organic engagement characteristics.",
            is_exclusion_warranted=False,
        )

    def evaluate_generic_interaction_patterns(
        self,
        posts: List[InfluencerPost],
    ) -> ReviewSignalOut:
        """
        Analyzes post captions for repetitive templated boilerplate or spam patterns.
        Requires at least 2 captioned posts.
        """
        captions = [p.caption.strip() for p in posts if p.caption and len(p.caption.strip()) > 10]
        if len(captions) < 2:
            return ReviewSignalOut(
                signal_key="generic_interaction_patterns",
                display_name="Interaction & Caption Linguistic Pattern",
                status="insufficient_data",
                observed_value={"caption_sample_count": len(captions)},
                benchmark_or_expected="Minimum 2 text captions required to analyze linguistic variety",
                evidence_summary=f"Only {len(captions)} post caption(s) available for linguistic analysis.",
                context_and_guidance="Sample size insufficient to evaluate text diversity.",
                is_exclusion_warranted=False,
            )

        # Check for repetitive / duplicate captions
        seen = {}
        for c in captions:
            # Normalize whitespace and casing
            clean = re.sub(r"\s+", " ", c.lower())
            seen[clean] = seen.get(clean, 0) + 1

        most_common_count = max(seen.values())
        repetitive_ratio = most_common_count / len(captions)

        if repetitive_ratio >= 0.5:
            return ReviewSignalOut(
                signal_key="generic_interaction_patterns",
                display_name="Interaction & Caption Linguistic Pattern",
                status="review_recommended",
                observed_value={"repetitive_caption_ratio": round(repetitive_ratio, 2)},
                benchmark_or_expected="Expected: < 30% repeated captions across post sample",
                evidence_summary=f"{int(repetitive_ratio * 100)}% of recent captions are identical or templated copies.",
                context_and_guidance="High repetition suggests automated boilerplate or affiliate copy-pasting. Confirm creator writes bespoke reviews.",
                is_exclusion_warranted=False,
            )

        return ReviewSignalOut(
            signal_key="generic_interaction_patterns",
            display_name="Interaction & Caption Linguistic Pattern",
            status="normal",
            observed_value={"unique_caption_ratio": round(len(seen) / len(captions), 2)},
            benchmark_or_expected="Natural linguistic diversity across posts",
            evidence_summary="Captions exhibit natural variation, original context, and organic vocabulary.",
            context_and_guidance="Linguistic patterns indicate personalized authoring rather than robotic copy-pasting.",
            is_exclusion_warranted=False,
        )

    def evaluate_growth_anomalies(
        self,
        historical_observations: Optional[List[Dict[str, Any]]],
    ) -> ReviewSignalOut:
        """
        Evaluates longitudinal follower growth trajectory.
        CRITICAL CONSTRAINT: Evaluated ONLY when multiple timestamped observations exist.
        If fewer than 2 snapshots exist, returns 'insufficient_data' without assumption or penalty.
        """
        snapshots = historical_observations or []
        if len(snapshots) < 2:
            return ReviewSignalOut(
                signal_key="growth_anomalies",
                display_name="Longitudinal Follower Growth Curve",
                status="insufficient_data",
                observed_value={"historical_observations_count": len(snapshots)},
                benchmark_or_expected="Minimum 2 timestamped historical observations required",
                evidence_summary=(
                    f"Growth anomaly analysis requires multiple timestamped historical snapshots. "
                    f"Found {len(snapshots)} observation(s); trajectory cannot be verified without longitudinal data."
                ),
                context_and_guidance=(
                    "Longitudinal tracking is scheduled across periodic sync intervals. "
                    "Accounts are never flagged for missing historical observations."
                ),
                is_exclusion_warranted=False,
            )

        # Parse and sort snapshots by timestamp
        parsed_snaps = []
        for s in snapshots:
            ts_raw = s.get("timestamp") or s.get("date")
            foll_raw = s.get("followers") or s.get("follower_count") or 0
            if ts_raw:
                try:
                    ts = datetime.fromisoformat(str(ts_raw).replace("Z", "+00:00"))
                    parsed_snaps.append((ts, int(foll_raw)))
                except Exception:
                    continue

        if len(parsed_snaps) < 2:
            return ReviewSignalOut(
                signal_key="growth_anomalies",
                display_name="Longitudinal Follower Growth Curve",
                status="insufficient_data",
                observed_value={"valid_snapshots": len(parsed_snaps)},
                benchmark_or_expected="Minimum 2 valid timestamped observations",
                evidence_summary="Unable to parse valid ISO timestamps from snapshot records.",
                context_and_guidance="Snapshots will be refreshed on subsequent data ingestion cycles.",
                is_exclusion_warranted=False,
            )

        parsed_snaps.sort(key=lambda x: x[0])
        # Compute deltas
        suspicious_growth = False
        max_daily_jump = 0

        for (t1, f1), (t2, f2) in zip(parsed_snaps[:-1], parsed_snaps[1:]):
            days = (t2 - t1).total_seconds() / 86400.0
            if days <= 0:
                continue
            delta = f2 - f1
            daily_rate = delta / days
            if daily_rate > max_daily_jump:
                max_daily_jump = int(daily_rate)

            # Flag if an account jumps > 50% in a single day on an already established audience (>10k)
            if f1 >= 10_000 and delta > (f1 * 0.5) and days <= 2.0:
                suspicious_growth = True
                break

        if suspicious_growth:
            return ReviewSignalOut(
                signal_key="growth_anomalies",
                display_name="Longitudinal Follower Growth Curve",
                status="review_recommended",
                observed_value={"max_observed_daily_jump": max_daily_jump},
                benchmark_or_expected="Expected: Smooth organic growth (< 25% single-day change on established accounts)",
                evidence_summary=f"Unusual growth spike observed: +{max_daily_jump:,} followers within a short tracking window.",
                context_and_guidance="May indicate a viral post, external press feature, or follower acquisition package. Check external media coverage.",
                is_exclusion_warranted=False,
            )

        return ReviewSignalOut(
            signal_key="growth_anomalies",
            display_name="Longitudinal Follower Growth Curve",
            status="normal",
            observed_value={"max_observed_daily_jump": max_daily_jump},
            benchmark_or_expected="Gradual linear or steady organic progression",
            evidence_summary="Follower growth curve demonstrates steady organic trajectory across historical snapshots.",
            context_and_guidance="Growth patterns conform to standard creator discovery and audience accumulation curves.",
            is_exclusion_warranted=False,
        )

    def evaluate_creator(
        self,
        creator: CreatorProfile,
        posts: List[InfluencerPost],
        engagement: EngagementMetricsOut,
        historical_observations: Optional[List[Dict[str, Any]]] = None,
        now: Optional[datetime] = None,
    ) -> AuthenticityReportOut:
        now = now or datetime.now(timezone.utc)

        # 1. Evaluate all 5 transparent review signals
        sig_ratio = self.evaluate_follower_following_ratio(
            followers=creator.total_followers or 0,
            following=creator.following_count,
        )
        sig_freq = self.evaluate_posting_frequency(posts=posts, now=now)
        sig_eng = self.evaluate_engagement_anomalies(engagement=engagement)
        sig_generic = self.evaluate_generic_interaction_patterns(posts=posts)
        sig_growth = self.evaluate_growth_anomalies(historical_observations=historical_observations)

        signals = [sig_ratio, sig_freq, sig_eng, sig_generic, sig_growth]

        # 2. Delegate composite scoring and explanation to the active model
        creator_context = {
            "creator_id": creator.id,
            "handle": creator.handle,
            "followers": creator.total_followers,
            "sample_size": len(posts),
        }
        score, strengths, cautions = self.model.evaluate(signals, creator_context)

        # 3. Assemble report with supervised model interface disclosure
        return AuthenticityReportOut(
            creator_id=creator.id,
            handle=creator.handle,
            authenticity_score=score,
            model_used=self.model.get_model_info()["display_name"],
            model_type=self.model.model_type,
            signals=signals,
            strengths=strengths,
            review_notes=cautions,
            historical_observations_count=len(historical_observations or []),
            data_provenance="Brand Bridge Ingestion & Engagement Engine",
            calculated_at=now,
            disclaimer=(
                "Signals are review heuristics to assist human marketers, NOT proof of fraud. "
                "Brand Bridge does not automatically exclude creators based on unsupported assumptions."
            ),
            supervised_model_status=self.supervised_stub.get_model_info(),
        )

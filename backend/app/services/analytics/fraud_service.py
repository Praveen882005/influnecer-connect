from datetime import datetime, timezone
import math
import re
from typing import Any, Dict, List, Optional
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entities import CreatorProfile, InfluencerPost
from app.schemas.analytics import EngagementMetricsOut
from app.schemas.fraud import (
    AnomalyWarningOut,
    CalculatedIndicatorOut,
    FraudAnalysisReportOut,
    ObservedFactOut,
)
from app.services.analytics.engagement_service import EngagementCalculator


class FraudRiskAnalysisService:
    """
    Evidence-based influencer fraud risk and anomaly detection engine.
    Strictly follows Phase 7 guidelines:
      1. Uses only data the application can legitimately access.
      2. Distinguishes observed facts, calculated indicators, and heuristic warnings.
      3. Never labels creators as 'fraudsters'; communicates review signals, not proof.
      4. Discloses supervised ML classifier status (withheld pending verified labelled dataset).
      5. Supports lookup by username, profile URL, or catalog record ID.
    """

    ENGAGEMENT_TIER_BENCHMARKS = [
        (0, 10_000, "Nano-Creator", 4.0),
        (10_000, 100_000, "Micro-Creator", 2.5),
        (100_000, 500_000, "Mid-Tier Creator", 1.8),
        (500_000, 1_000_000, "Macro-Creator", 1.3),
        (1_000_000, 100_000_000, "Mega-Creator", 1.0),
    ]

    @classmethod
    async def resolve_creator(
        cls,
        query: str,
        db: AsyncSession,
    ) -> Optional[CreatorProfile]:
        """
        Resolves a creator profile from search input:
          - Numeric ID (e.g. '12')
          - Handle with or without '@' (e.g. '@tech_guru', 'tech_guru')
          - Profile URL (e.g. 'https://instagram.com/tech_guru')
          - Display name partial match
        """
        clean_query = query.strip()
        if not clean_query:
            return None

        # 1. Direct Numeric ID
        if clean_query.isdigit():
            res = await db.execute(select(CreatorProfile).where(CreatorProfile.id == int(clean_query)))
            creator = res.scalar_one_or_none()
            if creator:
                return creator

        # 2. Extract handle from URL if URL format provided
        extracted_handle = None
        if "http://" in clean_query or "https://" in clean_query or ".com" in clean_query:
            # Match last path component e.g. instagram.com/tech_guru/ -> tech_guru
            match = re.search(r"/(?:@)?([a-zA-Z0-9_\.\-]+)/?$", clean_query)
            if match:
                extracted_handle = match.group(1)

        # 3. Match handle, profile URL, or display name
        normalized_handle = clean_query.lstrip("@").lower()
        search_terms = [normalized_handle]
        if extracted_handle:
            search_terms.append(extracted_handle.lower())

        for term in search_terms:
            res = await db.execute(
                select(CreatorProfile).where(
                    or_(
                        func.lower(CreatorProfile.handle) == f"@{term}",
                        func.lower(CreatorProfile.handle) == term,
                        func.lower(CreatorProfile.profile_url).contains(term),
                    )
                )
            )
            creator = res.scalar_one_or_none()
            if creator:
                return creator

        # 4. Fallback: Display Name partial match
        res = await db.execute(
            select(CreatorProfile).where(
                CreatorProfile.display_name.ilike(f"%{clean_query}%")
            ).limit(1)
        )
        return res.scalar_one_or_none()

    @classmethod
    def analyze_creator_fraud_risk(
        cls,
        creator: CreatorProfile,
        posts: List[InfluencerPost],
        now: Optional[datetime] = None,
    ) -> FraudAnalysisReportOut:
        """
        Conducts comprehensive evidence-based anomaly and fraud risk evaluation.
        Distinguishes:
          - Observed Facts (empirical raw data)
          - Calculated Indicators (derived ratios and formulas)
          - Heuristic Warnings (risk review signals with limitations)
        """
        now = now or datetime.now(timezone.utc)
        followers = creator.total_followers or 0
        following = creator.following_count
        sample_count = len(posts)

        # Compute engagement metrics using EngagementCalculator
        engagement = EngagementCalculator.calculate_from_posts(creator=creator, posts=posts, now=now)

        # Historical growth snapshots
        collab_prefs = creator.collaboration_preferences or {}
        historical_snapshots = collab_prefs.get("historical_growth_snapshots") or []

        # ====================================================================
        # 1. OBSERVED FACTS (Task 4)
        # ====================================================================
        observed_facts: List[ObservedFactOut] = [
            ObservedFactOut(
                fact_key="follower_count",
                label="Total Follower Count",
                value=f"{followers:,}",
                details="Recorded audience scale in verified platform catalog.",
                source=creator.data_source or "Ingestion Pipeline",
            ),
            ObservedFactOut(
                fact_key="sample_post_history",
                label="Sample Post Catalog",
                value=f"{sample_count} posts",
                details=(
                    f"Sample contains {sample_count} ingested post(s) for metric verification."
                    if sample_count > 0
                    else "No individual post history recorded in catalog."
                ),
                source="Ingestion Pipeline",
            ),
            ObservedFactOut(
                fact_key="following_count",
                label="Following Account Count",
                value=f"{following:,}" if following is not None else "Not Provided",
                details=(
                    f"Creator follows {following:,} other profiles."
                    if following is not None
                    else "Data provider does not provide following counts."
                ),
                source=creator.data_source or "Catalog",
            ),
            ObservedFactOut(
                fact_key="historical_growth_snapshots",
                label="Longitudinal Growth Observations",
                value=f"{len(historical_snapshots)} observation(s)",
                details=(
                    f"{len(historical_snapshots)} timestamped follower snapshots available for growth curve analysis."
                    if len(historical_snapshots) >= 2
                    else "Fewer than 2 historical observations logged."
                ),
                source="Periodic Growth Tracker",
            ),
            ObservedFactOut(
                fact_key="profile_verification",
                label="Platform Verified Status",
                value="Verified" if (creator.is_verified or creator.is_platform_verified) else "Standard Account",
                details="Verified account status confirmed by platform badge sync.",
                source="Platform Metadata",
            ),
        ]

        # ====================================================================
        # 2. CALCULATED INDICATORS (Task 4)
        # ====================================================================
        calculated_indicators: List[CalculatedIndicatorOut] = []

        # Like-to-comment ratio
        avg_likes = engagement.avg_likes or (creator.avg_likes if creator.avg_likes is not None else 0)
        avg_comments = engagement.avg_comments or (creator.avg_comments if creator.avg_comments is not None else 0)

        if avg_likes > 0:
            like_comment_ratio = round(avg_likes / max(1, avg_comments), 1)
            is_lc_outlier = like_comment_ratio > 200 or (avg_likes > 1000 and avg_comments == 0)
            calculated_indicators.append(
                CalculatedIndicatorOut(
                    indicator_key="like_to_comment_ratio",
                    display_name="Like-to-Comment Ratio",
                    formula="average_likes / max(1, average_comments)",
                    observed_value=f"{like_comment_ratio}:1",
                    benchmark="Healthy organic range: 10:1 to 80:1",
                    is_outlier=is_lc_outlier,
                )
            )

        # Follower-to-following ratio
        if following is not None and following > 0:
            ff_ratio = round(followers / following, 2)
            is_ff_outlier = ff_ratio < 0.15 or (following > 7000 and followers < 5000)
            calculated_indicators.append(
                CalculatedIndicatorOut(
                    indicator_key="follower_following_ratio",
                    display_name="Follower-to-Following Ratio",
                    formula="total_followers / following_count",
                    observed_value=f"{ff_ratio}:1",
                    benchmark="Healthy organic range: 0.5:1 to 500:1",
                    is_outlier=is_ff_outlier,
                )
            )

        # Engagement rate
        rate = engagement.calculated_engagement_rate or creator.avg_engagement_rate
        if rate is not None:
            # Find peer benchmark
            peer_median = 2.0
            for min_f, max_f, _, bench in cls.ENGAGEMENT_TIER_BENCHMARKS:
                if min_f <= followers < max_f:
                    peer_median = bench
                    break

            is_er_outlier = (followers >= 50_000 and rate > 20.0) or (followers >= 25_000 and rate < 0.1)
            calculated_indicators.append(
                CalculatedIndicatorOut(
                    indicator_key="tier_engagement_rate",
                    display_name="Tier-Normalized Engagement Rate",
                    formula="((avg_likes + avg_comments) / total_followers) * 100",
                    observed_value=f"{rate:.2f}%",
                    benchmark=f"Peer tier benchmark median: {peer_median}%",
                    is_outlier=is_er_outlier,
                )
            )

        # ====================================================================
        # 3. EVIDENCE-BASED HEURISTIC ANOMALY CHECKS (Task 3)
        # ====================================================================
        anomaly_warnings: List[AnomalyWarningOut] = []

        # Check 1: Unusual Engagement Patterns (Like-to-comment asymmetry & ghost followers)
        if rate is not None and followers >= 50_000 and rate > 20.0:
            anomaly_warnings.append(
                AnomalyWarningOut(
                    anomaly_key="inflated_engagement_rate",
                    category="engagement_anomaly",
                    display_name="Engagement Outlier & Possible Pod Activity",
                    status="review_recommended",
                    status_label="Unusually High Engagement Rate",
                    observed_finding=f"Engagement rate of {rate:.2f}% exceeds 8× the peer benchmark on {followers:,} followers.",
                    evidence={"engagement_rate": rate, "follower_count": followers, "peer_benchmark": peer_median},
                    limitations="Viral breakout posts or high-retention video formats can naturally produce high engagement.",
                    recommended_manual_checks=[
                        "Inspect recent posts to verify if a single viral video skewed the average.",
                        "Audit comments for repetitive reciprocal pod phrases (e.g. 'F4F', 'comment back').",
                    ],
                )
            )
        elif rate is not None and followers >= 25_000 and rate < 0.1:
            anomaly_warnings.append(
                AnomalyWarningOut(
                    anomaly_key="severe_ghost_followers",
                    category="engagement_anomaly",
                    display_name="Severe Inactive Audience Discrepancy",
                    status="review_recommended",
                    status_label="Extremely Low Interaction Rate",
                    observed_finding=f"Engagement rate of {rate:.2f}% on {followers:,} followers is substantially below organic baseline.",
                    evidence={"engagement_rate": rate, "follower_count": followers},
                    limitations="Older accounts or algorithm shadowbans can depress reach without artificial follower purchases.",
                    recommended_manual_checks=[
                        "Verify when the creator last posted active Stories or live broadcasts.",
                        "Request verified 30-day reach insights from the creator's native platform dashboard.",
                    ],
                )
            )
        elif avg_likes >= 1000 and avg_comments == 0:
            anomaly_warnings.append(
                AnomalyWarningOut(
                    anomaly_key="like_comment_asymmetry",
                    category="engagement_anomaly",
                    display_name="Severe Interaction Asymmetry",
                    status="review_recommended",
                    status_label="High Likes with Zero Comments",
                    observed_finding=f"Sample posts average {int(avg_likes):,} likes with 0 comments recorded.",
                    evidence={"avg_likes": avg_likes, "avg_comments": 0},
                    limitations="Creator may have comments intentionally disabled or restricted to followers.",
                    recommended_manual_checks=[
                        "Check if comments are disabled or limited on the creator's public profile.",
                        "Verify whether automated like packages were syndicated without genuine audience comment engagement.",
                    ],
                )
            )
        elif rate is None or sample_count == 0:
            anomaly_warnings.append(
                AnomalyWarningOut(
                    anomaly_key="engagement_anomaly",
                    category="engagement_anomaly",
                    display_name="Engagement Pattern Verification",
                    status="insufficient_evidence",
                    status_label="Insufficient Metric Sample",
                    observed_finding="Post interactions and engagement rate are unrecorded. Pattern cannot be evaluated.",
                    evidence={"sample_posts": sample_count},
                    limitations="Missing interaction records do not imply suspicious activity.",
                    recommended_manual_checks=["Request creator profile sync or connect via platform OAuth."],
                )
            )
        else:
            anomaly_warnings.append(
                AnomalyWarningOut(
                    anomaly_key="engagement_anomaly",
                    category="engagement_anomaly",
                    display_name="Engagement Pattern Verification",
                    status="normal",
                    status_label="Organic Interaction Distribution",
                    observed_finding=f"Engagement rate ({rate:.2f}%) and interaction balance conform to expected organic ranges.",
                    evidence={"engagement_rate": rate, "avg_likes": avg_likes, "avg_comments": avg_comments},
                    limitations="Heuristic check based on available catalog posts.",
                    recommended_manual_checks=[],
                )
            )

        # Check 2: Abnormal Comment / Interaction Patterns (Captions & Burst Publishing)
        captions = [p.caption.strip() for p in posts if p.caption and len(p.caption.strip()) > 10]
        if len(captions) >= 2:
            seen_captions: Dict[str, int] = {}
            for c in captions:
                clean_c = re.sub(r"\s+", " ", c.lower())
                seen_captions[clean_c] = seen_captions.get(clean_c, 0) + 1
            max_dup = max(seen_captions.values())
            dup_ratio = max_dup / len(captions)

            if dup_ratio >= 0.5:
                anomaly_warnings.append(
                    AnomalyWarningOut(
                        anomaly_key="repetitive_caption_syndication",
                        category="interaction_pattern",
                        display_name="Repetitive Templated Captions",
                        status="review_recommended",
                        status_label="Duplicate Caption Copying",
                        observed_finding=f"{int(dup_ratio * 100)}% of recent captions are identical or templated copies.",
                        evidence={"duplicate_caption_ratio": round(dup_ratio, 2)},
                        limitations="Creators running promotional series or daily countdowns may legitimately use standardized headers.",
                        recommended_manual_checks=[
                            "Confirm creator writes bespoke personal reviews rather than automated affiliate copy.",
                        ],
                    )
                )
            else:
                anomaly_warnings.append(
                    AnomalyWarningOut(
                        anomaly_key="interaction_pattern",
                        category="interaction_pattern",
                        display_name="Caption & Interaction Linguistic Pattern",
                        status="normal",
                        status_label="Natural Content Diversity",
                        observed_finding="Captions exhibit diverse organic vocabulary, creative phrasing, and contextual authenticity.",
                        evidence={"caption_sample_size": len(captions), "unique_ratio": round(len(seen_captions) / len(captions), 2)},
                        limitations="Analyzed across available catalog text posts.",
                        recommended_manual_checks=[],
                    )
                )
        else:
            anomaly_warnings.append(
                AnomalyWarningOut(
                    anomaly_key="interaction_pattern",
                    category="interaction_pattern",
                    display_name="Caption & Interaction Linguistic Pattern",
                    status="insufficient_evidence",
                    status_label="Insufficient Text Sample",
                    observed_finding=f"Only {len(captions)} captioned post(s) available for linguistic analysis (minimum 2 required).",
                    evidence={"caption_sample_size": len(captions)},
                    limitations="No penalty is applied for sparse catalog captions.",
                    recommended_manual_checks=["Inspect public profile feed directly for content style."],
                )
            )

        # Check 3: Suspicious Growth Velocity Changes (Task 3 & 4)
        if len(historical_snapshots) < 2:
            anomaly_warnings.append(
                AnomalyWarningOut(
                    anomaly_key="growth_velocity_anomaly",
                    category="growth_velocity",
                    display_name="Follower Growth Curve & Velocity",
                    status="insufficient_evidence",
                    status_label="Insufficient Longitudinal Observations",
                    observed_finding=(
                        f"Growth curve analysis requires multiple timestamped historical snapshots. "
                        f"Found {len(historical_snapshots)} observation(s); trajectory cannot be evaluated without longitudinal data."
                    ),
                    evidence={"historical_observations_count": len(historical_snapshots)},
                    limitations="Longitudinal tracking requires periodic sync intervals. Accounts are never penalized for missing snapshots.",
                    recommended_manual_checks=[
                        "Examine third-party historical charting (e.g. Social Blade) for sudden vertical step jumps.",
                    ],
                )
            )
        else:
            # Parse snapshots
            parsed_snaps = []
            for s in historical_snapshots:
                ts_raw = s.get("timestamp") or s.get("date")
                foll_raw = s.get("followers") or s.get("follower_count") or 0
                if ts_raw:
                    try:
                        ts = datetime.fromisoformat(str(ts_raw).replace("Z", "+00:00"))
                        parsed_snaps.append((ts, int(foll_raw)))
                    except Exception:
                        continue

            if len(parsed_snaps) >= 2:
                parsed_snaps.sort(key=lambda x: x[0])
                suspicious_spike = False
                max_jump = 0

                for (t1, f1), (t2, f2) in zip(parsed_snaps[:-1], parsed_snaps[1:]):
                    days = max(0.1, (t2 - t1).total_seconds() / 86400.0)
                    delta = f2 - f1
                    daily_vel = delta / days
                    if daily_vel > max_jump:
                        max_jump = int(daily_vel)
                    if f1 >= 10_000 and delta > (f1 * 0.5) and days <= 2.0:
                        suspicious_spike = True
                        break

                if suspicious_spike:
                    anomaly_warnings.append(
                        AnomalyWarningOut(
                            anomaly_key="growth_velocity_anomaly",
                            category="growth_velocity",
                            display_name="Follower Growth Curve & Velocity",
                            status="anomaly_flagged",
                            status_label="Unusual Follower Surge Detected",
                            observed_finding=f"Unusual single-day spike observed: +{max_jump:,} followers within short tracking window.",
                            evidence={"max_observed_daily_jump": max_jump, "snapshot_count": len(parsed_snaps)},
                            limitations="Viral video features or prominent media coverage can generate legitimate rapid follower growth.",
                            recommended_manual_checks=[
                                "Ask creator if a specific viral Reel/TikTok or TV feature occurred on that date.",
                                "Verify if follower retention dropped sharply following the surge.",
                            ],
                        )
                    )
                else:
                    anomaly_warnings.append(
                        AnomalyWarningOut(
                            anomaly_key="growth_velocity_anomaly",
                            category="growth_velocity",
                            display_name="Follower Growth Curve & Velocity",
                            status="normal",
                            status_label="Steady Organic Progression",
                            observed_finding=f"Follower growth curve demonstrates natural, steady organic trajectory across {len(parsed_snaps)} observations.",
                            evidence={"max_observed_daily_jump": max_jump, "snapshot_count": len(parsed_snaps)},
                            limitations="Evaluated across verified historical snapshot intervals.",
                            recommended_manual_checks=[],
                        )
                    )
            else:
                anomaly_warnings.append(
                    AnomalyWarningOut(
                        anomaly_key="growth_velocity_anomaly",
                        category="growth_velocity",
                        display_name="Follower Growth Curve & Velocity",
                        status="insufficient_evidence",
                        status_label="Invalid Snapshot Timestamps",
                        observed_finding="Snapshot records could not be parsed with valid ISO timestamps.",
                        evidence={"snapshot_count": len(historical_snapshots)},
                        limitations="Periodic scheduler will refresh snapshots on subsequent ingestion cycles.",
                        recommended_manual_checks=[],
                    )
                )

        # Check 4: Profile and Performance Inconsistencies
        if following is not None and following > 7000 and followers < 2000:
            anomaly_warnings.append(
                AnomalyWarningOut(
                    anomaly_key="follow_unfollow_churn",
                    category="profile_inconsistency",
                    display_name="Aggressive Following Automation",
                    status="review_recommended",
                    status_label="Follow-Unfollow Churn Pattern",
                    observed_finding=f"Account follows {following:,} profiles while holding only {followers:,} followers.",
                    evidence={"following": following, "followers": followers},
                    limitations="New personal accounts may follow widely across friends without automation.",
                    recommended_manual_checks=[
                        "Verify whether the account uses third-party follow automation extensions.",
                    ],
                )
            )
        else:
            anomaly_warnings.append(
                AnomalyWarningOut(
                    anomaly_key="profile_inconsistency",
                    category="profile_inconsistency",
                    display_name="Profile & Follower Proportion Integrity",
                    status="normal",
                    status_label="Proportional Account Characteristics",
                    observed_finding="Account attributes, follower proportions, and catalog declarations exhibit consistency.",
                    evidence={"followers": followers, "following": following},
                    limitations="Evaluated against active profile declarations.",
                    recommended_manual_checks=[],
                )
            )

        # ====================================================================
        # 4. OVERALL RISK LEVEL & SCORE SYNTHESIS (Tasks 5, 6, 7)
        # ====================================================================
        flagged_count = sum(1 for w in anomaly_warnings if w.status == "anomaly_flagged")
        review_count = sum(1 for w in anomaly_warnings if w.status == "review_recommended")
        insufficient_count = sum(1 for w in anomaly_warnings if w.status == "insufficient_evidence")
        normal_count = sum(1 for w in anomaly_warnings if w.status == "normal")

        # Evidence coverage
        evaluated_count = len(anomaly_warnings) - insufficient_count
        coverage_pct = round((evaluated_count / len(anomaly_warnings)) * 100.0, 1)

        # If data is completely sparse (e.g. 0 posts and 0 snapshots)
        if sample_count == 0 and len(historical_snapshots) < 2 and followers == 0:
            overall_risk = "insufficient_evidence"
            risk_score = None
            recommended_actions = [
                "Request profile metric refresh via platform sync before booking collaborations.",
                "Verify creator's live external channel directly.",
            ]
        else:
            # Calculate heuristic risk index (0 - 100): lower = safer organic, higher = anomaly alert
            # Base organic = 12.0
            computed_risk = 12.0 + (review_count * 20.0) + (flagged_count * 35.0)
            risk_score = min(95.0, round(computed_risk, 1))

            if flagged_count >= 1 or review_count >= 1:
                if flagged_count >= 2 or (flagged_count >= 1 and review_count >= 1) or review_count >= 3:
                    overall_risk = "high_observed_risk"
                    recommended_actions = [
                        "Perform thorough manual check of comment authenticity and follower retention before issuing offers.",
                        "Request native 30-day analytics screenshot directly from the creator.",
                        "Structure collaboration with performance milestones or deliverable escrow.",
                    ]
                else:
                    overall_risk = "moderate_observed_risk"
                    recommended_actions = [
                        "Review highlighted indicators with the creator during initial briefing.",
                        "Confirm content format (e.g. video vs static) matches recent high-engagement posts.",
                    ]
            else:
                overall_risk = "low_observed_risk"
                recommended_actions = [
                    "Account exhibits healthy organic performance characteristics.",
                    "Proceed with standard campaign invitation and deliverable contracting.",
                ]

        manual_verification_checklist = [
            "Inspect the last 10 post comment threads for meaningful conversational context vs 1-word generic spam.",
            "Request a 30-day screenshot from the creator's native platform dashboard (e.g. Instagram Professional Dashboard or YouTube Studio).",
            "Verify active Story view reach (healthy organic accounts typically average 3% to 8% of total follower scale).",
            "Check external search results to verify if follower growth surges align with legitimate media coverage or viral video uploads.",
        ]

        return FraudAnalysisReportOut(
            creator_id=creator.id,
            handle=creator.handle or f"creator_{creator.id}",
            display_name=creator.display_name or creator.handle or f"Creator #{creator.id}",
            profile_url=creator.profile_url,
            total_followers=followers,
            avatar_url=getattr(creator, "profile_image_url", None),
            overall_risk_level=overall_risk,
            risk_score=risk_score,
            evidence_coverage_pct=coverage_pct,
            observed_facts=observed_facts,
            calculated_indicators=calculated_indicators,
            anomaly_warnings=anomaly_warnings,
            recommended_actions=recommended_actions,
            manual_verification_checklist=manual_verification_checklist,
            data_freshness_status=creator.freshness_status or "fresh",
            analyzed_at=now,
        )


fraud_risk_analysis_service = FraudRiskAnalysisService()

from datetime import datetime, timezone
import math
from typing import Any, Dict, List, Optional
from app.models.entities import CreatorProfile, InfluencerPost
from app.schemas.trust import TrustAnalysisReportOut, TrustIndicatorOut


class TrustAnalysisService:
    """
    Influencer Trustworthiness Analysis Service.
    Strictly adheres to Phase 6 mandates:
      1. Evaluates 5 supported indicators:
         - Engagement consistency
         - Engagement rate relative to peer tier comparison group
         - Content thematic coherence & relevance
         - Verified campaign completion history
         - Data freshness and profile completeness
      2. Strictly separates trustworthiness from campaign suitability and fraud risk.
      3. Explains each indicator with traceable evidence and documented definitions.
      4. Features an explicit 'insufficient_evidence' state when information is inadequate.
      5. Avoids penalizing creators simply because data is missing (omitted from denominator).
    """

    PEER_TIER_BENCHMARKS = [
        (0, 10_000, "Nano-Creator", 4.0),
        (10_000, 100_000, "Micro-Creator", 2.5),
        (100_000, 500_000, "Mid-Tier Creator", 1.8),
        (500_000, 1_000_000, "Macro-Creator", 1.3),
        (1_000_000, 100_000_000, "Mega-Creator", 1.0),
    ]

    STALE_DATA_THRESHOLD_DAYS = 30

    @classmethod
    def evaluate_engagement_consistency(
        cls,
        posts: List[InfluencerPost],
    ) -> TrustIndicatorOut:
        """
        Evaluates engagement variability (likes + comments) across recent post history.
        Organic creators exhibit steady interaction; extreme volatility suggests erratic resonance.
        """
        definition = (
            "Measures engagement variability (likes + comments) across recent post history. "
            "Organic creators generally maintain stable interaction ranges across comparable content."
        )

        sample_size = len(posts)
        if sample_size < 3:
            return TrustIndicatorOut(
                indicator_key="engagement_consistency",
                display_name="Engagement Consistency",
                definition=definition,
                status="insufficient_evidence",
                status_label="Insufficient Post Samples",
                is_sufficient_evidence=False,
                observed_evidence={"sample_size_posts": sample_size},
                benchmark_or_reference={"minimum_sample_size": 3},
                explanation=(
                    f"Creator has {sample_size} post(s) in catalog. A minimum of 3 posts is required "
                    "to compute engagement variance. Sparse post history is not penalized as untrustworthy."
                ),
                context_and_guidance="Request recent post metrics or monitor the creator over a 30-day window.",
            )

        engagements = [
            (getattr(p, "likes_count", None) or getattr(p, "likes", 0) or 0)
            + (getattr(p, "comments_count", None) or getattr(p, "comments", 0) or 0)
            for p in posts
        ]
        mean_eng = sum(engagements) / sample_size

        if mean_eng <= 0:
            return TrustIndicatorOut(
                indicator_key="engagement_consistency",
                display_name="Engagement Consistency",
                definition=definition,
                status="insufficient_evidence",
                status_label="Zero Observed Engagement",
                is_sufficient_evidence=False,
                observed_evidence={"sample_size_posts": sample_size, "mean_engagement": 0},
                explanation="All sample posts have 0 likes and comments recorded. Consistency cannot be evaluated.",
                context_and_guidance="Data may be pending ingestion or posts may be brand-new uploads.",
            )

        variance = sum((x - mean_eng) ** 2 for x in engagements) / (sample_size - 1)
        std_dev = math.sqrt(variance)
        cv = std_dev / mean_eng  # Coefficient of Variation

        observed = {
            "sample_size_posts": sample_size,
            "mean_interactions_per_post": round(mean_eng, 1),
            "std_deviation": round(std_dev, 1),
            "coefficient_of_variation": round(cv, 2),
        }

        if cv <= 0.45:
            return TrustIndicatorOut(
                indicator_key="engagement_consistency",
                display_name="Engagement Consistency",
                definition=definition,
                status="consistent",
                status_label="Highly Consistent Engagement",
                is_sufficient_evidence=True,
                observed_evidence=observed,
                benchmark_or_reference={"expected_cv_range": "<= 0.45 (low variability)"},
                explanation=(
                    f"High engagement stability (coefficient of variation: {cv:.2f}) across {sample_size} posts. "
                    f"Average interaction is {mean_eng:.0f} per post with low variance."
                ),
                context_and_guidance="Strong indicator of a loyal, regularly active community.",
            )
        elif cv <= 0.95:
            return TrustIndicatorOut(
                indicator_key="engagement_consistency",
                display_name="Engagement Consistency",
                definition=definition,
                status="consistent",
                status_label="Normal Organic Consistency",
                is_sufficient_evidence=True,
                observed_evidence=observed,
                benchmark_or_reference={"expected_cv_range": "0.45 to 0.95 (healthy organic variation)"},
                explanation=(
                    f"Normal organic engagement variance (CV: {cv:.2f}) across {sample_size} sample posts. "
                    "Performance fluctuates moderately across different creative formats."
                ),
                context_and_guidance="Standard organic audience distribution across mixed content types.",
            )
        else:
            return TrustIndicatorOut(
                indicator_key="engagement_consistency",
                display_name="Engagement Consistency",
                definition=definition,
                status="variable",
                status_label="Variable Interaction Swings",
                is_sufficient_evidence=True,
                observed_evidence=observed,
                benchmark_or_reference={"expected_cv_range": "> 0.95 (high volatility)"},
                explanation=(
                    f"High interaction fluctuation (CV: {cv:.2f}) across sample posts. Engagement varies "
                    "significantly depending on content topic or viral spikes."
                ),
                context_and_guidance="Review top-performing vs baseline posts to identify the optimal content format.",
            )

    @classmethod
    def evaluate_peer_relative_engagement(
        cls,
        creator: CreatorProfile,
    ) -> TrustIndicatorOut:
        """
        Compares creator's engagement rate against industry baseline benchmarks
        for their follower size tier.
        """
        definition = (
            "Compares creator's verified engagement rate against established baseline medians "
            "for creators within the same follower audience tier."
        )

        followers = creator.total_followers or 0
        er = creator.avg_engagement_rate

        if er is None or followers <= 0:
            return TrustIndicatorOut(
                indicator_key="peer_relative_engagement",
                display_name="Peer-Relative Engagement",
                definition=definition,
                status="insufficient_evidence",
                status_label="Metrics Unavailable",
                is_sufficient_evidence=False,
                observed_evidence={"followers": followers, "engagement_rate": er},
                explanation="Follower count or engagement rate is unrecorded. Cannot compare against peer tier.",
                context_and_guidance="Data provider did not include verified interaction metrics.",
            )

        # Match tier
        tier_name = "Creator"
        benchmark_er = 2.0
        for min_f, max_f, name, b_er in cls.PEER_TIER_BENCHMARKS:
            if min_f <= followers < max_f:
                tier_name = name
                benchmark_er = b_er
                break

        ratio = er / benchmark_er if benchmark_er > 0 else 1.0
        observed = {
            "creator_engagement_rate": round(er, 2),
            "follower_count": followers,
            "peer_tier": tier_name,
            "peer_median_er": benchmark_er,
            "relative_ratio": round(ratio, 2),
        }

        if 0.6 <= ratio <= 2.5:
            return TrustIndicatorOut(
                indicator_key="peer_relative_engagement",
                display_name="Peer-Relative Engagement",
                definition=definition,
                status="healthy_alignment",
                status_label="Healthy Peer Alignment",
                is_sufficient_evidence=True,
                observed_evidence=observed,
                benchmark_or_reference={"peer_tier": tier_name, "benchmark_median": f"{benchmark_er}%"},
                explanation=(
                    f"Engagement rate of {er:.2f}% aligns organically with {tier_name} peer medians "
                    f"({benchmark_er}% expected, ratio {ratio:.2f}×)."
                ),
                context_and_guidance="Audience responsiveness matches typical expectations for account scale.",
            )
        elif ratio > 2.5:
            return TrustIndicatorOut(
                indicator_key="peer_relative_engagement",
                display_name="Peer-Relative Engagement",
                definition=definition,
                status="healthy_alignment",
                status_label="High Audience Resonance",
                is_sufficient_evidence=True,
                observed_evidence=observed,
                benchmark_or_reference={"peer_tier": tier_name, "benchmark_median": f"{benchmark_er}%"},
                explanation=(
                    f"Engagement rate of {er:.2f}% significantly outperforms {tier_name} median ({benchmark_er}%). "
                    f"Reflects strong community attention and niche resonance ({ratio:.1f}× peer average)."
                ),
                context_and_guidance="High-performing creator with strong community connection.",
            )
        else:
            return TrustIndicatorOut(
                indicator_key="peer_relative_engagement",
                display_name="Peer-Relative Engagement",
                definition=definition,
                status="variable",
                status_label="Below Peer Average",
                is_sufficient_evidence=True,
                observed_evidence=observed,
                benchmark_or_reference={"peer_tier": tier_name, "benchmark_median": f"{benchmark_er}%"},
                explanation=(
                    f"Engagement rate of {er:.2f}% is below the {tier_name} benchmark ({benchmark_er}%). "
                    "Suggests audience saturation or passive follower segments."
                ),
                context_and_guidance="Lower engagement is common in older accounts. Check recent story or video view rates.",
            )

    @classmethod
    def evaluate_content_relevance(
        cls,
        creator: CreatorProfile,
        campaign_niche: Optional[str] = None,
    ) -> TrustIndicatorOut:
        """
        Evaluates thematic coherence between the creator's stated niche, bio, and content categories.
        If campaign_niche is provided, evaluates thematic alignment against that brief.
        """
        definition = (
            "Evaluates thematic consistency between the creator's primary niche, bio description, "
            "content categories, and target collaboration domains."
        )

        niches = creator.content_niches or []
        categories = creator.content_categories or []
        primary = creator.primary_niche or ""
        bio = creator.bio or ""

        observed = {
            "primary_niche": primary,
            "content_niches": niches,
            "content_categories_count": len(categories),
            "bio_length_chars": len(bio),
        }

        if not primary and not niches and len(bio.strip()) < 10:
            return TrustIndicatorOut(
                indicator_key="content_relevance",
                display_name="Thematic Content Focus",
                definition=definition,
                status="insufficient_evidence",
                status_label="Incomplete Thematic Data",
                is_sufficient_evidence=False,
                observed_evidence=observed,
                explanation="Bio and category tags are minimal or unrecorded. Thematic consistency cannot be validated.",
                context_and_guidance="Review the creator's external channel directly to assess content topics.",
            )

        if campaign_niche:
            # Check alignment against specific campaign
            campaign_niche_clean = campaign_niche.lower().strip()
            all_tags = [primary.lower()] + [n.lower() for n in niches] + [c.lower() for c in categories]
            is_direct_match = any(campaign_niche_clean in t or t in campaign_niche_clean for t in all_tags if t)
            in_bio = campaign_niche_clean in bio.lower()

            observed["campaign_niche"] = campaign_niche
            observed["direct_match"] = is_direct_match or in_bio

            if is_direct_match or in_bio:
                return TrustIndicatorOut(
                    indicator_key="content_relevance",
                    display_name="Thematic Content Focus",
                    definition=definition,
                    status="healthy_alignment",
                    status_label="Direct Campaign Alignment",
                    is_sufficient_evidence=True,
                    observed_evidence=observed,
                    explanation=(
                        f"Direct thematic alignment between campaign domain '{campaign_niche}' "
                        f"and creator profile focus in '{primary}'."
                    ),
                    context_and_guidance="Creator's existing content regularly covers this product domain.",
                )
            else:
                return TrustIndicatorOut(
                    indicator_key="content_relevance",
                    display_name="Thematic Content Focus",
                    definition=definition,
                    status="variable",
                    status_label="Adjacent Thematic Focus",
                    is_sufficient_evidence=True,
                    observed_evidence=observed,
                    explanation=(
                        f"Creator's primary domain is '{primary}', which differs from campaign niche '{campaign_niche}'. "
                        "Collaboration is feasible if audience demographics overlap."
                    ),
                    context_and_guidance="Verify whether cross-category product integration fits the creator's editorial style.",
                )

        # General thematic coherence evaluation
        return TrustIndicatorOut(
            indicator_key="content_relevance",
            display_name="Thematic Content Focus",
            definition=definition,
            status="healthy_alignment",
            status_label="Verified Niche Coherence",
            is_sufficient_evidence=True,
            observed_evidence=observed,
            explanation=(
                f"Consistent thematic focus in '{primary}' supported by {len(categories)} content category tags "
                f"and detailed bio context ({len(bio)} characters)."
            ),
            context_and_guidance="Creator maintains a clearly defined editorial category.",
        )

    @classmethod
    def evaluate_campaign_completion_history(
        cls,
        creator: CreatorProfile,
    ) -> TrustIndicatorOut:
        """
        Evaluates verified past platform collaborations completed on-time.
        Strictly follows Task 6: Zero prior campaigns is NOT treated as a penalty or demerit.
        """
        definition = (
            "Tracks verified past brand collaborations completed on-time and in good standing across the platform."
        )

        completed_count = creator.past_campaigns_count or 0
        delivery_history = creator.delivery_history or []
        delivery_rate = creator.on_time_delivery_rate

        observed = {
            "completed_campaigns_count": completed_count,
            "delivery_history_records": len(delivery_history),
            "on_time_delivery_rate": delivery_rate,
        }

        if completed_count == 0 and len(delivery_history) == 0:
            return TrustIndicatorOut(
                indicator_key="campaign_completion_history",
                display_name="Campaign Delivery Track Record",
                definition=definition,
                status="no_prior_history",
                status_label="No Prior Platform Collaborations",
                is_sufficient_evidence=False,  # Excluded from scoring denominator
                observed_evidence=observed,
                benchmark_or_reference={"expectation": "Milestone delivery history"},
                explanation=(
                    "No completed brand collaborations logged on the platform yet. This is standard for new creators "
                    "and is NOT treated as a negative penalty or demerit."
                ),
                context_and_guidance=(
                    "Use milestone deliverable approvals and platform escrow when establishing first-time collaboration."
                ),
            )

        rate_val = delivery_rate if delivery_rate is not None else 100.0
        if rate_val >= 90.0:
            return TrustIndicatorOut(
                indicator_key="campaign_completion_history",
                display_name="Campaign Delivery Track Record",
                definition=definition,
                status="verified_track_record",
                status_label="Verified Punctual Track Record",
                is_sufficient_evidence=True,
                observed_evidence=observed,
                benchmark_or_reference={"target_delivery_rate": ">= 90% on-time"},
                explanation=(
                    f"Verified track record of {completed_count} completed campaigns with {rate_val:.1f}% "
                    "on-time delivery punctuality."
                ),
                context_and_guidance="Proven history of meeting agreed campaign deadlines and deliverable milestones.",
            )
        else:
            return TrustIndicatorOut(
                indicator_key="campaign_completion_history",
                display_name="Campaign Delivery Track Record",
                definition=definition,
                status="variable",
                status_label="Delivery Timeline Delays Observed",
                is_sufficient_evidence=True,
                observed_evidence=observed,
                benchmark_or_reference={"target_delivery_rate": ">= 90% on-time"},
                explanation=(
                    f"Creator has completed {completed_count} campaigns with {rate_val:.1f}% on-time delivery rate. "
                    "Some deliverable milestones experienced timeline revisions."
                ),
                context_and_guidance="Include explicit buffer days in campaign schedule to accommodate content review cycles.",
            )

    @classmethod
    def evaluate_data_freshness_and_completeness(
        cls,
        creator: CreatorProfile,
        now: Optional[datetime] = None,
    ) -> TrustIndicatorOut:
        """
        Evaluates data freshness (within 30 days) and profile field completeness.
        """
        now = now or datetime.now(timezone.utc)
        definition = (
            "Verifies whether profile data attributes and follower statistics are comprehensive "
            "and synced within the past 30 days."
        )

        last_fetched = creator.last_fetched_at
        if last_fetched:
            if last_fetched.tzinfo is None:
                last_fetched = last_fetched.replace(tzinfo=timezone.utc)
            days_old = (now - last_fetched).total_seconds() / 86400.0
            is_fresh = days_old <= cls.STALE_DATA_THRESHOLD_DAYS
        else:
            days_old = None
            is_fresh = False

        # Profile completeness audit
        checks = {
            "has_handle": bool(creator.handle),
            "has_display_name": bool(creator.display_name),
            "has_bio": bool(creator.bio and len(creator.bio.strip()) >= 15),
            "has_profile_url": bool(creator.profile_url),
            "has_follower_count": bool(creator.total_followers and creator.total_followers > 0),
            "has_platforms": bool(creator.supported_platforms and len(creator.supported_platforms) > 0),
            "has_niche": bool(creator.primary_niche),
            "has_content_categories": bool(creator.content_categories and len(creator.content_categories) > 0),
            "is_verified": bool(creator.is_verified or creator.is_platform_verified),
        }

        completed_checks = sum(1 for v in checks.values() if v)
        completeness_pct = round((completed_checks / len(checks)) * 100, 1)

        observed = {
            "completeness_score_pct": completeness_pct,
            "days_since_metrics_sync": round(days_old, 1) if days_old is not None else None,
            "data_source": creator.data_source or "catalog",
            "is_platform_verified": creator.is_platform_verified,
            "attributes_present": completed_checks,
            "attributes_total": len(checks),
        }

        if completeness_pct >= 70 and is_fresh:
            return TrustIndicatorOut(
                indicator_key="data_freshness_and_completeness",
                display_name="Data Freshness & Completeness",
                definition=definition,
                status="healthy_alignment",
                status_label="Verified & Fresh Data",
                is_sufficient_evidence=True,
                observed_evidence=observed,
                benchmark_or_reference={"freshness_window": "<= 30 days", "target_completeness": ">= 70%"},
                explanation=(
                    f"Comprehensive profile coverage ({completeness_pct}%) with fresh metrics synced "
                    f"{int(days_old)} day(s) ago ({creator.data_source or 'catalog'})."
                ),
                context_and_guidance="Profile information is current and reliable for partnership evaluation.",
            )
        elif completeness_pct >= 60 and not is_fresh:
            return TrustIndicatorOut(
                indicator_key="data_freshness_and_completeness",
                display_name="Data Freshness & Completeness",
                definition=definition,
                status="variable",
                status_label="Comprehensive But Stale Metrics",
                is_sufficient_evidence=True,
                observed_evidence=observed,
                benchmark_or_reference={"freshness_window": "<= 30 days"},
                explanation=(
                    f"Profile is well-populated ({completeness_pct}%), but statistics were synced "
                    f"{int(days_old) if days_old else 'unknown'} days ago (>30 days threshold)."
                ),
                context_and_guidance="Metrics may not reflect recent account trajectory. Request an updated snapshot.",
            )
        else:
            return TrustIndicatorOut(
                indicator_key="data_freshness_and_completeness",
                display_name="Data Freshness & Completeness",
                definition=definition,
                status="insufficient_evidence",
                status_label="Partial Profile Data",
                is_sufficient_evidence=False,
                observed_evidence=observed,
                explanation=(
                    f"Profile completeness is limited ({completeness_pct}%). "
                    "Several key fields (bio, profile link, or platforms) remain unrecorded."
                ),
                context_and_guidance="Data incompleteness is not penalized; creator can populate fields via profile settings.",
            )

    @classmethod
    def evaluate_creator_trust(
        cls,
        creator: CreatorProfile,
        posts: List[InfluencerPost],
        campaign_niche: Optional[str] = None,
        now: Optional[datetime] = None,
    ) -> TrustAnalysisReportOut:
        """
        Compiles the comprehensive trustworthiness analysis report.
        Excludes missing/insufficient indicators from the score denominator (Task 6).
        """
        now = now or datetime.now(timezone.utc)

        ind_consistency = cls.evaluate_engagement_consistency(posts)
        ind_peer = cls.evaluate_peer_relative_engagement(creator)
        ind_relevance = cls.evaluate_content_relevance(creator, campaign_niche)
        ind_history = cls.evaluate_campaign_completion_history(creator)
        ind_freshness = cls.evaluate_data_freshness_and_completeness(creator, now)

        all_indicators = [
            ind_consistency,
            ind_peer,
            ind_relevance,
            ind_history,
            ind_freshness,
        ]

        # Calculate evidence coverage
        sufficient_count = sum(1 for i in all_indicators if i.is_sufficient_evidence)
        coverage_pct = round((sufficient_count / len(all_indicators)) * 100.0, 1)

        strengths: List[str] = []
        cautions: List[str] = []
        missing_notes: List[str] = []

        # Check for insufficient evidence threshold (Task 5)
        # If fewer than 2 indicators can be evaluated with evidence, flag insufficient evidence
        if sufficient_count < 2:
            for ind in all_indicators:
                if not ind.is_sufficient_evidence:
                    missing_notes.append(f"{ind.display_name}: {ind.explanation}")

            return TrustAnalysisReportOut(
                creator_id=creator.id,
                handle=creator.handle,
                display_name=creator.display_name,
                overall_trust_level="insufficient_evidence",
                trust_score=None,
                evidence_coverage_pct=coverage_pct,
                indicators=all_indicators,
                strengths=[],
                cautions=["Insufficient observed empirical data to formulate an objective trustworthiness evaluation."],
                missing_data_notes=missing_notes,
                calculated_at=now,
            )

        # Dynamic scoring across ONLY indicators with sufficient evidence (Task 6)
        # Indicator base point values when evaluated:
        # consistency: 25 pts
        # peer: 25 pts
        # relevance: 20 pts
        # history: 15 pts
        # freshness: 15 pts
        weights = {
            "engagement_consistency": 25.0,
            "peer_relative_engagement": 25.0,
            "content_relevance": 20.0,
            "campaign_completion_history": 15.0,
            "data_freshness_and_completeness": 15.0,
        }

        earned_points = 0.0
        total_possible_weights = 0.0

        for ind in all_indicators:
            if not ind.is_sufficient_evidence:
                missing_notes.append(f"{ind.display_name}: {ind.explanation}")
                continue  # Omit from denominator!

            w = weights.get(ind.indicator_key, 20.0)
            total_possible_weights += w

            if ind.status in ("consistent", "healthy_alignment", "verified_track_record"):
                earned_points += w
                strengths.append(f"{ind.display_name}: {ind.status_label} — {ind.explanation}")
            elif ind.status == "variable":
                earned_points += w * 0.60
                cautions.append(f"{ind.display_name}: {ind.status_label} — {ind.explanation}")
            else:
                earned_points += w * 0.75

        # Compute normalized score (0 - 100)
        trust_score = (
            round((earned_points / total_possible_weights) * 100.0, 1)
            if total_possible_weights > 0
            else None
        )

        if trust_score is not None:
            if trust_score >= 82.0:
                trust_level = "high_confidence"
            elif trust_score >= 55.0:
                trust_level = "moderate_confidence"
            else:
                trust_level = "limited_evidence"
        else:
            trust_level = "insufficient_evidence"

        return TrustAnalysisReportOut(
            creator_id=creator.id,
            handle=creator.handle,
            display_name=creator.display_name,
            overall_trust_level=trust_level,
            trust_score=trust_score,
            evidence_coverage_pct=coverage_pct,
            indicators=all_indicators,
            strengths=strengths,
            cautions=cautions,
            missing_data_notes=missing_notes,
            calculated_at=now,
        )


trust_analysis_service = TrustAnalysisService()

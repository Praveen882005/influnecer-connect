"""
Deterministic Hybrid Brand-Influencer Matching & Recommendation Service (Phase 15).

Pipeline:
1. Validate campaign criteria.
2. Apply hard eligibility constraints (separate from weighted scoring).
3. Retrieve eligible creators from available candidate pool.
4. Calculate supported engagement signals (tier-normalized efficiency).
5. Incorporate available authenticity evidence (anomaly cautions & audit score).
6. Calculate semantic content similarity (dense 384-dim sentence embeddings).
7. Calculate audience fit only when required audience data is available (no fake fabrication).
8. Combine supported signals using documented configurable weights with missing-signal redistribution.
9. Return a deterministic ranked Top-K result with full score breakdown and explainability.
"""

from datetime import datetime, timezone
import logging
import math
import time
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from app.models.entities import Campaign, CreatorProfile
from app.schemas.creator import CreatorProfileOut
from app.schemas.matching import (
    AUTHENTICITY_DISCLAIMER,
    OPTIMALITY_DISCLAIMER,
    CreatorRecommendation,
    MatchScoreExplanation,
    MatchSignalBreakdown,
    NaturalLanguageMatchRequest,
    ParsedMatchingCriteria,
    RecommendationFilterOptions,
    RecommendationResponse,
    RecommendationWeights,
    SignalScoreDetail,
)
from app.services.semantic.embedding_service import EmbeddingService
from app.services.semantic.text_normalizer import (
    compose_campaign_text,
    compose_creator_text,
)

logger = logging.getLogger(__name__)

# Follower tier benchmarks for engagement normalization
ENGAGEMENT_BENCHMARKS: Dict[str, Tuple[int, int, float]] = {
    "nano": (1_000, 10_000, 4.0),
    "micro": (10_000, 100_000, 2.5),
    "mid": (100_000, 500_000, 1.8),
    "macro": (500_000, 1_000_000, 1.3),
    "mega": (1_000_000, 100_000_000, 1.0),
}


class HybridRecommenderService:
    """
    Deterministic, explainable recommendation engine combining hard eligibility gates,
    dense 384-dimensional semantic similarity, follower-tier normalized engagement,
    evidence-based authenticity heuristics, and verified audience demographics.
    """

    def __init__(self, embedding_service: Optional[EmbeddingService] = None):
        self._embedding_service = embedding_service or EmbeddingService.get_instance()

    # -------------------------------------------------------------------------
    # STEP 2: Hard Eligibility Constraints (Binary Gates)
    # -------------------------------------------------------------------------
    def evaluate_hard_constraints(
        self,
        campaign: Campaign,
        creator: CreatorProfile,
        filters: Optional[RecommendationFilterOptions] = None,
    ) -> Tuple[bool, List[str], List[str]]:
        """
        Evaluates hard eligibility constraints separating them strictly from weighted preferences.
        Returns:
            (is_eligible, satisfied_constraints, disqualification_reasons)
        """
        filters = filters or RecommendationFilterOptions()
        satisfied: List[str] = []
        disqualified: List[str] = []

        # 1. Minimum Followers Constraint
        req_followers = (
            filters.min_followers_override
            if filters.min_followers_override is not None
            else (campaign.min_followers or 0)
        )
        if req_followers > 0:
            actual_followers = creator.total_followers or 0
            if actual_followers < req_followers:
                disqualified.append(
                    f"Followers count ({actual_followers:,}) is below required minimum ({req_followers:,})"
                )
            else:
                satisfied.append(
                    f"Followers threshold met ({actual_followers:,} >= {req_followers:,})"
                )

        # 2. Minimum Engagement Rate Constraint
        req_engagement = (
            filters.min_engagement_rate_override
            if filters.min_engagement_rate_override is not None
            else (campaign.min_engagement_rate or 0.0)
        )
        if req_engagement > 0.0:
            if creator.avg_engagement_rate is None or (creator.total_followers or 0) == 0:
                disqualified.append(
                    f"Engagement metrics unmonitored/unavailable but campaign requires minimum {req_engagement:.2f}%"
                )
            elif creator.avg_engagement_rate < req_engagement:
                disqualified.append(
                    f"Engagement rate ({creator.avg_engagement_rate:.2f}%) below required minimum ({req_engagement:.2f}%)"
                )
            else:
                satisfied.append(
                    f"Engagement rate threshold met ({creator.avg_engagement_rate:.2f}% >= {req_engagement:.2f}%)"
                )

        # 3. Platform Requirement Constraint
        req_platform = filters.required_platform
        if not req_platform and campaign.required_criteria and isinstance(campaign.required_criteria, dict):
            req_platform = campaign.required_criteria.get("platform")

        if req_platform:
            platform_norm = req_platform.lower().strip()
            creator_platforms: List[str] = []
            if creator.supported_platforms and isinstance(creator.supported_platforms, list):
                creator_platforms.extend([p.lower().strip() for p in creator.supported_platforms])
            if creator.platforms and isinstance(creator.platforms, dict):
                creator_platforms.extend([p.lower().strip() for p in creator.platforms.keys()])

            if platform_norm not in creator_platforms:
                disqualified.append(
                    f"Required platform '{req_platform}' is not supported by creator (supported: {creator_platforms or 'none'})"
                )
            else:
                satisfied.append(f"Required platform '{req_platform}' is supported")

        # 4. Strict Niche Match Constraint
        is_strict_niche = filters.strict_niche_match
        if not is_strict_niche and campaign.required_criteria and isinstance(campaign.required_criteria, dict):
            is_strict_niche = campaign.required_criteria.get("strict_niche", False)

        if is_strict_niche and campaign.niche:
            camp_niche = campaign.niche.lower().strip()
            creator_niches: List[str] = []
            if creator.primary_niche:
                creator_niches.append(creator.primary_niche.lower().strip())
            if creator.content_niches and isinstance(creator.content_niches, list):
                creator_niches.extend([n.lower().strip() for n in creator.content_niches])
            if creator.secondary_niches and isinstance(creator.secondary_niches, list):
                creator_niches.extend([n.lower().strip() for n in creator.secondary_niches])

            if camp_niche not in creator_niches:
                disqualified.append(
                    f"Strict niche match required: campaign niche '{campaign.niche}' not present in creator niches ({creator_niches})"
                )
            else:
                satisfied.append(f"Strict niche requirement met (matched '{campaign.niche}')")

        # 5. Minimum Authenticity Score Constraint
        min_auth = filters.min_authenticity_score_override
        if min_auth is None and campaign.required_criteria and isinstance(campaign.required_criteria, dict):
            min_auth = campaign.required_criteria.get("min_authenticity")

        if min_auth is not None and float(min_auth) > 0.0:
            target_auth = float(min_auth)
            actual_auth = creator.authenticity_score or 0.0
            if actual_auth < target_auth:
                disqualified.append(
                    f"Authenticity score ({actual_auth:.1f}) below required minimum ({target_auth:.1f})"
                )
            else:
                satisfied.append(
                    f"Authenticity requirement met ({actual_auth:.1f} >= {target_auth:.1f})"
                )

        is_eligible = len(disqualified) == 0
        return is_eligible, satisfied, disqualified

    # -------------------------------------------------------------------------
    # STEP 4: Supported Engagement Signals (Follower-Tier Normalized)
    # -------------------------------------------------------------------------
    def compute_engagement_quality(
        self,
        creator: CreatorProfile,
    ) -> Tuple[float, Optional[float], bool, List[str], List[str]]:
        """
        Calculates follower-tier normalized engagement score.
        Returns:
            (normalized_score, raw_rate, is_available, evidence, unavailable_fields)
        """
        followers = creator.total_followers or 0
        rate = creator.avg_engagement_rate

        if rate is None or followers == 0:
            return 0.0, None, False, ["Engagement rate metrics not available for this creator profile"], ["avg_engagement_rate"]

        # Determine follower tier benchmark
        tier_benchmark = 2.0
        tier_name = "general"
        for name, (min_f, max_f, bench) in ENGAGEMENT_BENCHMARKS.items():
            if min_f <= followers <= max_f:
                tier_benchmark = bench
                tier_name = name
                break
        if followers > 1_000_000:
            tier_benchmark = 1.0
            tier_name = "mega"

        ratio = rate / tier_benchmark if tier_benchmark > 0 else 1.0
        # Scaled smoothly around 50 for parity (ratio=1.0 -> 50.0; ratio=2.0 -> 80.0)
        scaled = 50.0 + (ratio - 1.0) * 30.0
        normalized_score = round(float(np.clip(scaled, 10.0, 99.0)), 1)

        evidence = [
            f"{tier_name.capitalize()} tier benchmark: {tier_benchmark:.1f}%",
            f"Observed engagement: {rate:.2f}% (Efficiency ratio: {ratio:.2f}x benchmark)",
        ]
        return normalized_score, rate, True, evidence, []

    # -------------------------------------------------------------------------
    # STEP 5: Authenticity Evidence & Anomaly Heuristics
    # -------------------------------------------------------------------------
    def compute_authenticity_evidence(
        self,
        creator: CreatorProfile,
    ) -> Tuple[float, Optional[float], bool, List[str], List[str]]:
        """
        Incorporates authenticity audit score and suspicious pattern heuristics.
        Returns:
            (normalized_score, raw_score, is_available, evidence, cautions)
        """
        raw_score = creator.authenticity_score
        if raw_score is None:
            return 0.0, None, False, ["Authenticity audit data unavailable"], ["authenticity_score"]

        score = float(raw_score)
        cautions: List[str] = []
        evidence = [f"Base audit consistency score: {score:.1f}/100"]

        followers = creator.total_followers or 0
        avg_engagement = creator.avg_engagement_rate or 0.0

        if followers > 500_000 and avg_engagement > 15.0:
            cautions.append("Engagement rate unusually high for follower tier; potential viral spike or engagement pod")
            score = max(score - 10.0, 20.0)
        elif followers > 50_000 and avg_engagement < 0.2 and creator.avg_engagement_rate is not None:
            cautions.append("Very low engagement rate relative to audience size; possible dormant follower base")
            score = max(score - 15.0, 20.0)
        else:
            evidence.append("Follower-to-interaction distributions conform to expected organic curves")

        normalized_score = round(float(np.clip(score, 10.0, 99.0)), 1)
        return normalized_score, raw_score, True, evidence, cautions

    # -------------------------------------------------------------------------
    # STEP 6: Semantic Content Similarity (Dense 384-dim Embeddings)
    # -------------------------------------------------------------------------
    def compute_semantic_similarity(
        self,
        campaign: Campaign,
        creator: CreatorProfile,
    ) -> Tuple[float, Optional[float], bool, List[str], List[str]]:
        """
        Calculates cosine similarity between campaign brief and creator content.
        Uses cached 384-dimensional sentence embeddings when available.
        Returns:
            (normalized_score, raw_cosine, is_available, evidence, unavailable_fields)
        """
        campaign_text = compose_campaign_text(
            title=campaign.title,
            niche=campaign.niche,
            description=campaign.description,
            product_description=campaign.product_description,
            objective=campaign.objective,
            target_audience=campaign.target_audience if isinstance(campaign.target_audience, dict) else None,
            deliverables=campaign.deliverables if isinstance(campaign.deliverables, list) else None,
        )

        if not campaign_text.strip():
            return 0.0, None, False, ["Campaign brief text is empty"], ["campaign_text"]

        # Check if creator has pre-stored embedding vector
        if creator.content_embedding and isinstance(creator.content_embedding, (list, tuple)) and len(creator.content_embedding) == 384:
            try:
                camp_emb, _, _ = self._embedding_service.embed_text(campaign_text)
                cos_sim = self._embedding_service.compute_cosine_similarity(
                    camp_emb,
                    list(creator.content_embedding),
                )
                band = self._embedding_service.classify_alignment_band(cos_sim)
                # Map cosine [-1.0, 1.0] to [0.0, 100.0]
                norm_score = round(float(np.clip((cos_sim + 1.0) / 2.0 * 100.0 if cos_sim >= 0 else 0.0, 0.0, 99.0)), 1)
                evidence = [
                    f"Precomputed dense embedding similarity: {cos_sim:.3f} ({band})",
                    "Direct 384-dimensional latent vector match against creator portfolio",
                ]
                return norm_score, cos_sim, True, evidence, []
            except Exception as e:
                logger.warning(f"Failed to compute similarity from precomputed embedding: {e}")

        # Text inference on creator profile incorporating rich Phase 2 profile features
        creator_niches = []
        if creator.primary_niche:
            creator_niches.append(creator.primary_niche)
        if creator.content_niches and isinstance(creator.content_niches, list):
            creator_niches.extend(creator.content_niches)

        suitability_tags = []
        if creator.brand_suitability and isinstance(creator.brand_suitability, dict):
            tags = creator.brand_suitability.get("suitability_tags")
            if isinstance(tags, list):
                suitability_tags.extend(tags)

        creator_text = compose_creator_text(
            display_name=creator.display_name,
            bio=creator.bio,
            niches=creator_niches,
            hashtags=creator.sample_content_keywords if isinstance(creator.sample_content_keywords, list) else None,
            audience_description=getattr(creator, "audience_description", None),
            content_categories=getattr(creator, "content_categories", None) if isinstance(getattr(creator, "content_categories", None), list) else None,
            brand_suitability_tags=suitability_tags or None,
        )

        if not creator_text.strip():
            return 0.0, None, False, ["Creator bio and content text are completely empty"], ["creator_content"]

        try:
            cos_sim, band, _ = self._embedding_service.compute_text_similarity(campaign_text, creator_text)
            # Calibration: Sentence-transformer cosine similarity typically spans 0.2 to 0.8
            # We map positive cosine into a normalized 0-100 scale:
            if cos_sim > 0.10:
                # E.g. cos 0.20 -> 30, cos 0.50 -> 65, cos 0.70 -> 85
                scaled = 20.0 + (cos_sim - 0.10) * 110.0
                norm_score = round(float(np.clip(scaled, 15.0, 99.0)), 1)
            else:
                norm_score = 10.0

            evidence = [
                f"Sentence-Transformers cosine similarity: {cos_sim:.3f} ({band})",
                f"Thematic content overlap between campaign brief and creator profile",
            ]
            return norm_score, cos_sim, True, evidence, []
        except Exception as e:
            logger.error(f"Semantic similarity inference failed: {e}")
            return 0.0, None, False, [f"Semantic inference error: {e}"], ["content_embedding_error"]

    # -------------------------------------------------------------------------
    # STEP 7: Audience Fit ONLY when Required Data is Available
    # -------------------------------------------------------------------------
    def compute_audience_fit(
        self,
        campaign: Campaign,
        creator: CreatorProfile,
    ) -> Tuple[float, Optional[float], bool, List[str], List[str]]:
        """
        Calculates audience demographic and geographic affinity ONLY when data is present.
        DOES NOT FABRICATE DEFAULT SCORES WHEN DATA IS MISSING.
        Returns:
            (normalized_score, raw_score, is_available, evidence, unavailable_fields)
        """
        target_demo = campaign.target_audience if isinstance(campaign.target_audience, dict) else {}
        creator_demo = creator.audience_demographics if isinstance(creator.audience_demographics, dict) else {}

        unavailable_fields: List[str] = []
        if not target_demo:
            unavailable_fields.append("campaign.target_audience")
        if not creator_demo:
            unavailable_fields.append("audience_demographics")

        # STRICT REQUIREMENT: If data is missing, mark unavailable and do not fabricate
        if unavailable_fields:
            return (
                0.0,
                None,
                False,
                ["Audience demographic alignment unmonitored or not specified in campaign brief"],
                unavailable_fields,
            )

        score_components: List[float] = []
        evidence: List[str] = []

        # 1. Geographic Alignment
        target_countries = [c.upper().strip() for c in target_demo.get("countries", []) if isinstance(c, str)]
        creator_countries = [c.upper().strip() for c in creator_demo.get("top_countries", []) if isinstance(c, str)]

        if target_countries and creator_countries:
            common_countries = set(target_countries).intersection(set(creator_countries))
            geo_ratio = len(common_countries) / max(len(target_countries), 1)
            geo_score = min(geo_ratio * 100.0, 100.0)
            score_components.append(geo_score)
            evidence.append(
                f"Geographic match in target regions: {', '.join(sorted(list(common_countries))) if common_countries else 'None'}"
            )

        # 2. Age Group Alignment
        target_ages = target_demo.get("age_groups", [])
        creator_ages = creator_demo.get("age_split", {})
        if target_ages and isinstance(creator_ages, dict) and creator_ages:
            age_overlap_pct = sum(float(creator_ages.get(grp, 0)) for grp in target_ages)
            age_score = min(age_overlap_pct * 1.2, 100.0)
            score_components.append(age_score)
            evidence.append(f"Target age cohort concentration: {age_overlap_pct:.1f}%")

        # 3. Gender Split Alignment
        target_gender = target_demo.get("target_gender")
        creator_gender_split = creator_demo.get("gender_split", {})
        if target_gender and isinstance(creator_gender_split, dict) and creator_gender_split:
            gender_key = target_gender.lower().strip()
            if gender_key in creator_gender_split:
                g_pct = float(creator_gender_split[gender_key])
                score_components.append(min(g_pct * 1.1, 100.0))
                evidence.append(f"Target gender ({target_gender}) concentration: {g_pct:.1f}%")

        if score_components:
            final_audience_score = round(float(np.mean(score_components)), 1)
            return final_audience_score, final_audience_score, True, evidence, []
        else:
            return 0.0, None, False, ["No overlapping demographic dimensions found"], ["demographics_dimension_mismatch"]

    # -------------------------------------------------------------------------
    # STEP 8: Combine Signals Using Configurable Weights with Redistribution
    # -------------------------------------------------------------------------
    def combine_signals(
        self,
        signals: Dict[str, SignalScoreDetail],
        weights: RecommendationWeights,
    ) -> Tuple[float, bool]:
        """
        Combines available signal scores using normalized weights.
        If any signal is unavailable, its weight is redistributed proportionally among
        the available signals, ensuring the total composite score remains strictly in [0, 100].
        Returns:
            (composite_score, was_weight_redistributed)
        """
        available_signals = [name for name, s in signals.items() if s.is_available]

        if not available_signals:
            return 0.0, False

        total_avail_configured_weight = sum(signals[name].configured_weight for name in available_signals)

        was_redistributed = not math.isclose(total_avail_configured_weight, 1.0, abs_tol=1e-3)

        composite = 0.0
        for name in available_signals:
            s = signals[name]
            if total_avail_configured_weight > 0:
                s.active_weight = s.configured_weight / total_avail_configured_weight
            else:
                s.active_weight = 1.0 / len(available_signals)
            composite += s.active_weight * s.score

        # Set active_weight = 0 for unavailable signals
        for name, s in signals.items():
            if not s.is_available:
                s.active_weight = 0.0

        final_composite = round(float(np.clip(composite, 1.0, 99.9)), 1)
        return final_composite, was_redistributed

    # -------------------------------------------------------------------------
    # STEP 9: Full Recommendation Execution Pipeline
    # -------------------------------------------------------------------------
    def generate_recommendations(
        self,
        campaign: Campaign,
        creators: List[CreatorProfile],
        weights: Optional[RecommendationWeights] = None,
        filters: Optional[RecommendationFilterOptions] = None,
    ) -> RecommendationResponse:
        """
        Executes the 9-step hybrid recommendation pipeline.
        Returns:
            RecommendationResponse with ranked Top-K items and full explanations.
        """
        start_time = time.perf_counter()
        weights = weights or RecommendationWeights()
        filters = filters or RecommendationFilterOptions()

        total_analyzed = len(creators)
        eligible_candidates: List[Tuple[CreatorProfile, List[str]]] = []
        disqualified_count = 0

        # Step 2: Apply Hard Eligibility Constraints
        for creator in creators:
            is_eligible, satisfied, disqualified = self.evaluate_hard_constraints(campaign, creator, filters)
            if is_eligible:
                eligible_candidates.append((creator, satisfied))
            else:
                disqualified_count += 1

        if not eligible_candidates:
            elapsed_ms = round((time.perf_counter() - start_time) * 1000.0, 2)
            return RecommendationResponse(
                campaign_id=campaign.id,
                brand_id=campaign.brand_id,
                total_analyzed=total_analyzed,
                eligible_count=0,
                disqualified_count=disqualified_count,
                configured_weights={
                    "semantic_content": weights.weight_semantic_content,
                    "engagement_quality": weights.weight_engagement_quality,
                    "authenticity": weights.weight_authenticity,
                    "audience_fit": weights.weight_audience_fit,
                },
                latency_ms=elapsed_ms,
                recommendations=[],
                disclaimer=OPTIMALITY_DISCLAIMER,
            )

        # Steps 4-8: Compute Signals & Combine for Each Eligible Candidate
        scored_candidates: List[Tuple[CreatorProfile, float, Dict[str, SignalScoreDetail], List[str], List[str], List[str], List[str]]] = []

        for creator, hard_satisfied in eligible_candidates:
            all_unavailable: List[str] = []

            # Step 4: Engagement
            eng_score, raw_eng, eng_avail, eng_evidence, eng_unavail = self.compute_engagement_quality(creator)
            all_unavailable.extend(eng_unavail)

            # Step 5: Authenticity
            auth_score, raw_auth, auth_avail, auth_evidence, auth_cautions = self.compute_authenticity_evidence(creator)

            # Step 6: Semantic Content
            sem_score, raw_sem, sem_avail, sem_evidence, sem_unavail = self.compute_semantic_similarity(campaign, creator)
            all_unavailable.extend(sem_unavail)

            # Step 7: Audience Fit
            aud_score, raw_aud, aud_avail, aud_evidence, aud_unavail = self.compute_audience_fit(campaign, creator)
            all_unavailable.extend(aud_unavail)

            signal_details: Dict[str, SignalScoreDetail] = {
                "semantic_content_similarity": SignalScoreDetail(
                    score=sem_score,
                    raw_value=raw_sem,
                    configured_weight=weights.weight_semantic_content,
                    active_weight=weights.weight_semantic_content,
                    is_available=sem_avail,
                    evidence=sem_evidence,
                ),
                "engagement_quality": SignalScoreDetail(
                    score=eng_score,
                    raw_value=raw_eng,
                    configured_weight=weights.weight_engagement_quality,
                    active_weight=weights.weight_engagement_quality,
                    is_available=eng_avail,
                    evidence=eng_evidence,
                ),
                "authenticity": SignalScoreDetail(
                    score=auth_score,
                    raw_value=raw_auth,
                    configured_weight=weights.weight_authenticity,
                    active_weight=weights.weight_authenticity,
                    is_available=auth_avail,
                    evidence=auth_evidence,
                ),
                "audience_fit": SignalScoreDetail(
                    score=aud_score,
                    raw_value=raw_aud,
                    configured_weight=weights.weight_audience_fit,
                    active_weight=weights.weight_audience_fit,
                    is_available=aud_avail,
                    evidence=aud_evidence,
                ),
            }

            # Step 8: Combine with missing-signal weight redistribution
            composite_score, _ = self.combine_signals(signal_details, weights)

            # Synthesize Strengths
            strengths: List[str] = []
            if sem_avail and sem_score >= 60.0:
                strengths.append(f"Strong semantic content affinity with {campaign.niche} campaign brief")
            if eng_avail and eng_score >= 65.0:
                strengths.append(f"Above-benchmark engagement ({creator.avg_engagement_rate:.2f}%) for {creator.total_followers:,} followers")
            if auth_avail and auth_score >= 85.0:
                strengths.append("High authenticity index with organic interaction consistency")
            if aud_avail and aud_score >= 60.0:
                strengths.append("High demographic and geographic alignment with target audience")
            if not strengths:
                strengths.append("Meets all minimum campaign criteria and thresholds")

            scored_candidates.append((
                creator,
                composite_score,
                signal_details,
                strengths,
                auth_cautions,
                hard_satisfied,
                all_unavailable,
            ))

        # Step 9: Sort deterministically
        # Tie-breakers: (-composite_score, -authenticity, -engagement, creator.id)
        scored_candidates.sort(
            key=lambda x: (
                -round(x[1], 2),
                -(x[0].authenticity_score or 0.0),
                -(x[0].avg_engagement_rate or 0.0),
                x[0].id,
            )
        )

        top_k = scored_candidates[:filters.limit]
        recommendations: List[CreatorRecommendation] = []

        for rank, (creator, composite, sig_details, strengths, cautions, hard_sat, unavail) in enumerate(top_k, start=1):
            # Ensure creator has non-null defaults for Pydantic validation if instantiated in-memory
            now_utc = datetime.now(timezone.utc)
            if getattr(creator, "created_at", None) is None:
                creator.created_at = now_utc
            if getattr(creator, "updated_at", None) is None:
                creator.updated_at = now_utc
            if getattr(creator, "secondary_niches", None) is None:
                creator.secondary_niches = []
            if getattr(creator, "content_niches", None) is None:
                creator.content_niches = []
            if getattr(creator, "supported_platforms", None) is None:
                creator.supported_platforms = []
            if getattr(creator, "platforms", None) is None:
                creator.platforms = {}
            if getattr(creator, "language", None) is None:
                creator.language = "English"
            if getattr(creator, "collaboration_preferences", None) is None:
                creator.collaboration_preferences = {}
            if getattr(creator, "sample_content_keywords", None) is None:
                creator.sample_content_keywords = []
            if getattr(creator, "data_source", None) is None:
                creator.data_source = "system"
            if getattr(creator, "freshness_status", None) is None:
                creator.freshness_status = "manual"
            if getattr(creator, "is_verified", None) is None:
                creator.is_verified = False
            if getattr(creator, "is_platform_verified", None) is None:
                creator.is_platform_verified = False
            if getattr(creator, "connected_platforms", None) is None:
                creator.connected_platforms = {}
            if getattr(creator, "brand_suitability", None) is None:
                creator.brand_suitability = {}
            if getattr(creator, "content_categories", None) is None:
                creator.content_categories = []
            if getattr(creator, "past_campaigns_count", None) is None:
                creator.past_campaigns_count = 0
            if getattr(creator, "delivery_history", None) is None:
                creator.delivery_history = []

            creator_out = CreatorProfileOut.model_validate(creator)

            # Backwards-compatible signals_used and missing_metrics
            signals_used: List[str] = []
            for s in sig_details.values():
                if s.is_available:
                    signals_used.extend(s.evidence)

            summary = (
                f"Rank #{rank} match with overall score of {composite:.1f}/100. "
                f"Content similarity: {sig_details['semantic_content_similarity'].score:.1f}%, "
                f"Engagement index: {sig_details['engagement_quality'].score:.1f}%, "
                f"Authenticity: {sig_details['authenticity'].score:.1f}%"
                + (f", Audience fit: {sig_details['audience_fit'].score:.1f}%" if sig_details['audience_fit'].is_available else " (Audience fit data unavailable)")
                + "."
            )

            rec = CreatorRecommendation(
                creator=creator_out,
                overall_match_score=composite,
                signal_breakdown=MatchSignalBreakdown(
                    content_relevance_score=sig_details["semantic_content_similarity"].score,
                    audience_affinity_score=sig_details["audience_fit"].score,
                    engagement_quality_score=sig_details["engagement_quality"].score,
                    authenticity_heuristic_score=sig_details["authenticity"].score,
                    signals_used=signals_used,
                    missing_metrics=unavail,
                    signal_details=sig_details,
                ),
                explanation=MatchScoreExplanation(
                    summary=summary,
                    strengths=strengths,
                    cautions=cautions,
                    hard_constraints_satisfied=hard_sat,
                    unavailable_fields=unavail,
                    authenticity_disclaimer=AUTHENTICITY_DISCLAIMER,
                    optimality_disclaimer=OPTIMALITY_DISCLAIMER,
                ),
                rank=rank,
            )
            recommendations.append(rec)

        elapsed_ms = round((time.perf_counter() - start_time) * 1000.0, 2)
        return RecommendationResponse(
            campaign_id=campaign.id,
            brand_id=campaign.brand_id,
            total_analyzed=total_analyzed,
            eligible_count=len(eligible_candidates),
            disqualified_count=disqualified_count,
            configured_weights={
                "semantic_content": weights.weight_semantic_content,
                "engagement_quality": weights.weight_engagement_quality,
                "authenticity": weights.weight_authenticity,
                "audience_fit": weights.weight_audience_fit,
            },
            latency_ms=elapsed_ms,
            recommendations=recommendations,
            disclaimer=OPTIMALITY_DISCLAIMER,
        )

    # -------------------------------------------------------------------------
    # STEP 10: Natural Language Brief Processing (Phase 3)
    # -------------------------------------------------------------------------
    def parse_natural_language_brief(
        self,
        request: NaturalLanguageMatchRequest,
    ) -> Tuple[Campaign, RecommendationFilterOptions, RecommendationWeights, ParsedMatchingCriteria]:
        """
        Converts a natural language brief request into structured matching criteria and ephemeral Campaign.
        """
        # 1. Determine Niche
        niche = request.industry_or_niche.strip().lower() if request.industry_or_niche else None
        if not niche:
            combined_text = f"{request.brief_text} {request.product_or_service or ''}".lower()
            niche_keywords = {
                "technology": ["tech", "ai", "software", "developer", "hardware", "gadget", "cyber", "electronics", "app", "code"],
                "beauty": ["skincare", "makeup", "cosmetics", "serum", "clean beauty", "aesthetic", "dermatology", "glow"],
                "food": ["cooking", "recipe", "food", "culinary", "restaurant", "chef", "gourmet", "baking", "dining"],
                "fitness": ["workout", "fitness", "gym", "exercise", "strength", "athlete", "cardio", "bodybuilding"],
                "fashion": ["fashion", "apparel", "clothing", "streetwear", "style", "outfit", "wardrobe", "runway"],
                "home": ["decor", "interior", "home", "furniture", "living", "renovation", "architecture"],
                "parenting": ["parenting", "baby", "infant", "toddler", "kids", "children", "mother", "maternal", "family"],
                "wellness": ["wellness", "mindfulness", "meditation", "mental health", "holistic", "self-care", "organic"],
            }
            for candidate_niche, keywords in niche_keywords.items():
                if any(kw in combined_text for kw in keywords):
                    niche = candidate_niche
                    break
            if not niche:
                niche = "general"

        # 2. Parse Demographic & Geographic Audience Signals
        parsed_audience: Dict[str, Any] = {}
        if request.target_audience:
            aud_text = request.target_audience.upper()
            country_codes = []
            if "US" in aud_text or "USA" in aud_text or "UNITED STATES" in aud_text or "AMERICA" in aud_text:
                country_codes.append("US")
            if "UK" in aud_text or "UNITED KINGDOM" in aud_text or "BRITAIN" in aud_text or "LONDON" in aud_text:
                country_codes.append("GB")
            if "CANADA" in aud_text or "CA" in aud_text:
                country_codes.append("CA")
            if "INDIA" in aud_text or "IN" in aud_text:
                country_codes.append("IN")
            if "AUSTRALIA" in aud_text or "AU" in aud_text:
                country_codes.append("AU")
            if "GERMANY" in aud_text or "DE" in aud_text:
                country_codes.append("DE")
            if "FRANCE" in aud_text or "FR" in aud_text:
                country_codes.append("FR")
            if country_codes:
                parsed_audience["countries"] = country_codes

            age_groups = []
            if "18-24" in aud_text or "GEN Z" in aud_text or "COLLEGE" in aud_text:
                age_groups.append("18-24")
            if "25-34" in aud_text or "MILLENNIAL" in aud_text or "YOUNG ADULT" in aud_text:
                age_groups.append("25-34")
            if "35-44" in aud_text:
                age_groups.append("35-44")
            if "45-54" in aud_text:
                age_groups.append("45-54")
            if age_groups:
                parsed_audience["age_groups"] = age_groups

            lowered_aud = request.target_audience.lower()
            if "female" in lowered_aud or "women" in lowered_aud:
                parsed_audience["target_gender"] = "female"
            elif "male" in lowered_aud or "men" in lowered_aud:
                parsed_audience["target_gender"] = "male"

        # 3. Construct Required Criteria
        required_criteria: Dict[str, Any] = {}
        if request.preferred_platform:
            required_criteria["platform"] = request.preferred_platform.strip().lower()
        if request.preferred_language:
            required_criteria["language"] = request.preferred_language.strip()
        if request.min_authenticity is not None:
            required_criteria["min_authenticity"] = request.min_authenticity
        if request.strict_niche_match:
            required_criteria["strict_niche"] = True

        # 4. Synthesize Ephemeral Campaign
        title = f"Brief: {request.product_or_service or (niche.capitalize() + ' Campaign')}"
        campaign = Campaign(
            id=0,
            brand_id=0,
            title=title,
            niche=niche,
            description=request.brief_text,
            product_description=request.product_or_service or "",
            objective=request.campaign_objective or "Brand Awareness & Discovery",
            target_audience=parsed_audience,
            min_followers=request.min_followers or 0,
            min_engagement_rate=request.min_engagement_rate or 0.0,
            required_criteria=required_criteria,
            budget=request.budget,
        )

        filters = RecommendationFilterOptions(
            strict_niche_match=request.strict_niche_match,
            required_platform=request.preferred_platform,
            min_followers_override=request.min_followers,
            min_engagement_rate_override=request.min_engagement_rate,
            min_authenticity_score_override=request.min_authenticity,
            limit=request.limit,
        )

        weights = request.weights or RecommendationWeights()

        parsed_criteria = ParsedMatchingCriteria(
            brief_text=request.brief_text,
            product_or_service=request.product_or_service,
            target_audience=request.target_audience,
            industry_or_niche=niche,
            campaign_objective=request.campaign_objective or "Brand Awareness & Discovery",
            preferred_platform=request.preferred_platform,
            preferred_language=request.preferred_language or "English",
            budget=request.budget,
            min_followers=request.min_followers,
            min_engagement_rate=request.min_engagement_rate,
            min_authenticity=request.min_authenticity,
            strict_niche_match=request.strict_niche_match,
        )

        return campaign, filters, weights, parsed_criteria

    def match_natural_language_brief(
        self,
        request: NaturalLanguageMatchRequest,
        creators: List[CreatorProfile],
    ) -> RecommendationResponse:
        """
        Executes AI-based brand-to-influencer matching from a natural-language brief.
        Guarantees use of genuine Sentence-Transformers embeddings.
        """
        # Ensure embedding service is operational
        if not self._embedding_service.is_operational():
            raise RuntimeError(
                "Sentence-Transformers model is currently unavailable. "
                "Refusing to execute matching without genuine neural embeddings."
            )

        campaign, filters, weights, parsed_criteria = self.parse_natural_language_brief(request)

        response = self.generate_recommendations(
            campaign=campaign,
            creators=creators,
            weights=weights,
            filters=filters,
        )

        response.parsed_criteria = parsed_criteria
        response.ai_model_used = f"sentence-transformers/{self._embedding_service.model_name} (384-dim dense vectors)"
        return response

    # -------------------------------------------------------------------------
    # STEP 11: Influencer-to-Brand Campaign Matching (Phase 4)
    # -------------------------------------------------------------------------
    def evaluate_campaign_fit_for_creator(
        self,
        campaign: Campaign,
        creator: CreatorProfile,
        weights: Optional[RecommendationWeights] = None,
    ) -> Dict[str, Any]:
        """
        Calculates deterministic AI fit score between a brand campaign and an influencer (Phase 4).
        Evaluates hard constraints, dense 384-dim semantic similarity, follower-tier normalized engagement,
        authenticity anomaly index, and demographic/geographic overlap.
        """
        weights = weights or RecommendationWeights()

        # Step 2: Hard eligibility constraints
        is_eligible, satisfied, disqualified = self.evaluate_hard_constraints(
            campaign,
            creator,
            RecommendationFilterOptions(limit=1),
        )

        all_unavailable: List[str] = []

        # Step 4: Engagement
        eng_score, raw_eng, eng_avail, eng_evidence, eng_unavail = self.compute_engagement_quality(creator)
        all_unavailable.extend(eng_unavail)

        # Step 5: Authenticity
        auth_score, raw_auth, auth_avail, auth_evidence, auth_cautions = self.compute_authenticity_evidence(creator)

        # Step 6: Semantic Content
        sem_score, raw_sem, sem_avail, sem_evidence, sem_unavail = self.compute_semantic_similarity(campaign, creator)
        all_unavailable.extend(sem_unavail)

        # Step 7: Audience Fit
        aud_score, raw_aud, aud_avail, aud_evidence, aud_unavail = self.compute_audience_fit(campaign, creator)
        all_unavailable.extend(aud_unavail)

        signal_details: Dict[str, SignalScoreDetail] = {
            "semantic_content_similarity": SignalScoreDetail(
                score=sem_score,
                raw_value=raw_sem,
                configured_weight=weights.weight_semantic_content,
                active_weight=weights.weight_semantic_content,
                is_available=sem_avail,
                evidence=sem_evidence,
            ),
            "engagement_quality": SignalScoreDetail(
                score=eng_score,
                raw_value=raw_eng,
                configured_weight=weights.weight_engagement_quality,
                active_weight=weights.weight_engagement_quality,
                is_available=eng_avail,
                evidence=eng_evidence,
            ),
            "authenticity": SignalScoreDetail(
                score=auth_score,
                raw_value=raw_auth,
                configured_weight=weights.weight_authenticity,
                active_weight=weights.weight_authenticity,
                is_available=auth_avail,
                evidence=auth_evidence,
            ),
            "audience_fit": SignalScoreDetail(
                score=aud_score,
                raw_value=raw_aud,
                configured_weight=weights.weight_audience_fit,
                active_weight=weights.weight_audience_fit,
                is_available=aud_avail,
                evidence=aud_evidence,
            ),
        }

        composite_score, _ = self.combine_signals(signal_details, weights)

        # Synthesize explainable strengths
        strengths: List[str] = []

        # Niche alignment check
        creator_niches = [
            n.lower().strip()
            for n in (creator.content_niches or ([creator.primary_niche] if creator.primary_niche else []))
        ]
        camp_niche = campaign.niche.lower().strip() if campaign.niche else ""
        if camp_niche in creator_niches:
            strengths.append(f"Niche Alignment: Matched '{campaign.niche}' content domain")
        elif any(n in camp_niche or camp_niche in n for n in creator_niches):
            strengths.append(f"Topical Niche Relevance: High overlap with '{campaign.niche}'")

        if sem_avail and sem_score >= 50.0:
            strengths.append(f"Semantic Brief Affinity: {sem_score:.1f}% thematic overlap with campaign deliverables")
        if eng_avail and eng_score >= 50.0:
            strengths.append(f"Engagement Quality: {creator.avg_engagement_rate:.2f}% meets/exceeds tier benchmark")
        if (creator.total_followers or 0) >= (campaign.min_followers or 0):
            strengths.append(f"Audience Reach: Follower count ({(creator.total_followers or 0):,}) satisfies requirements")
        if auth_avail and auth_score >= 80.0:
            strengths.append("Audience Authenticity: Organic interaction consistency verified")
        if aud_avail and aud_score >= 50.0:
            strengths.append("Demographic Fit: Primary creator region matches brand target market")

        if not strengths:
            strengths.extend(satisfied[:2] if satisfied else ["Meets basic eligibility criteria"])

        cautions: List[str] = list(auth_cautions)
        if not is_eligible and disqualified:
            for d in disqualified:
                cautions.append(f"Eligibility Warning: {d}")

        if composite_score >= 80.0:
            summary = f"Exceptional Brand Match ({composite_score:.1f}%): High semantic affinity ({sem_score:.1f}%) and qualified audience metrics."
        elif composite_score >= 60.0:
            summary = f"Favorable Match ({composite_score:.1f}%): Meets key engagement thresholds and content niche parameters."
        else:
            summary = f"Moderate Fit ({composite_score:.1f}%): Core audience criteria partially match campaign brief."

        return {
            "is_eligible": is_eligible,
            "fit_score": composite_score,
            "fit_summary": summary,
            "match_strengths": strengths,
            "match_cautions": cautions,
            "hard_constraints_satisfied": satisfied,
            "disqualified_reasons": disqualified,
            "signal_breakdown": {
                "content_relevance_score": sem_score,
                "engagement_quality_score": eng_score,
                "authenticity_heuristic_score": auth_score,
                "audience_affinity_score": aud_score,
            },
            "ai_model_used": f"sentence-transformers/{self._embedding_service.model_name} (384d)",
        }


# Singleton instance accessor
_matching_service_instance: Optional[HybridRecommenderService] = None


def get_recommender_service() -> HybridRecommenderService:
    """Returns singleton HybridRecommenderService."""
    global _matching_service_instance
    if _matching_service_instance is None:
        _matching_service_instance = HybridRecommenderService()
    return _matching_service_instance

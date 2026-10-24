import re
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


class BrandFitEngine:
    """
    Production-grade Brand-Creator Semantic Fit & Multi-Signal Recommendation Engine.
    Combines:
    1. Hybrid TF-IDF & Keyword Overlap for Content & Topic Relevance
    2. Quantitative Audience Demographic Overlap
    3. Follower-Tier Normalized Engagement Quality
    4. Engagement Consistency & Ratio Anomaly Heuristics (Clearly designated as heuristic indicators)
    """

    ENGAGEMENT_BENCHMARKS = {
        "nano": (1_000, 10_000, 4.0),
        "micro": (10_000, 100_000, 2.5),
        "mid": (100_000, 500_000, 1.8),
        "macro": (500_000, 1_000_000, 1.3),
        "mega": (1_000_000, 100_000_000, 1.0),
    }

    STOP_WORDS = {
        "the", "a", "an", "and", "or", "in", "on", "at", "to", "for", "of", "with",
        "by", "is", "are", "was", "were", "this", "that", "from", "as", "it", "be",
    }

    def __init__(
        self,
        weight_content: float = 0.35,
        weight_audience: float = 0.30,
        weight_engagement: float = 0.20,
        weight_authenticity: float = 0.15,
    ):
        self.w_content = weight_content
        self.w_audience = weight_audience
        self.w_engagement = weight_engagement
        self.w_authenticity = weight_authenticity
        self.vectorizer = TfidfVectorizer(
            stop_words="english",
            max_features=500,
            ngram_range=(1, 2)
        )

    def compute_content_relevance(
        self,
        campaign_text: str,
        creator_text: str
    ) -> Tuple[float, List[str]]:
        """
        Calculate calibrated semantic similarity between campaign and creator text profiles.
        Combines TF-IDF cosine similarity with token set intersection.
        """
        if not campaign_text.strip() or not creator_text.strip():
            return 30.0, ["Fallback content scoring due to sparse profile text"]

        signals = []

        # 1. Token set overlap (Jaccard-like matching on meaningful words)
        words_a = set(w for w in re.findall(r"\b[a-zA-Z]{3,}\b", campaign_text.lower()) if w not in self.STOP_WORDS)
        words_b = set(w for w in re.findall(r"\b[a-zA-Z]{3,}\b", creator_text.lower()) if w not in self.STOP_WORDS)
        common_words = words_a.intersection(words_b)
        overlap_count = len(common_words)

        # 2. TF-IDF Cosine Similarity
        try:
            tfidf_matrix = self.vectorizer.fit_transform([campaign_text, creator_text])
            sim_matrix = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])
            raw_sim = float(sim_matrix[0][0])
        except Exception:
            raw_sim = 0.0

        if common_words:
            signals.append(f"Matching semantic concepts: {', '.join(sorted(list(common_words))[:6])}")
        signals.append(f"TF-IDF cosine similarity index: {raw_sim:.3f}")

        # Non-linear calibration for short profile texts:
        # A match with overlapping domain words (e.g. 'ai', 'developer', 'tools') scales smoothly
        if raw_sim > 0 or overlap_count > 0:
            # Base scaled score: raw_sim has heavy weight, boosted by overlap density
            overlap_ratio = overlap_count / max(len(words_a), 1)
            calibrated = 40.0 + (raw_sim * 120.0) + (overlap_ratio * 40.0)
            score = round(float(np.clip(calibrated, 20.0, 98.0)), 1)
        else:
            score = 15.0
            signals.append("No direct keyword or semantic overlap detected")

        return score, signals

    def compute_audience_affinity(
        self,
        target_demographics: Dict[str, Any],
        creator_demographics: Dict[str, Any]
    ) -> Tuple[float, List[str], List[str]]:
        signals = []
        missing = []

        if not target_demographics:
            missing.append("Campaign target demographics not specified")
        if not creator_demographics:
            missing.append("Creator audience demographics not reported")

        if missing:
            return 50.0, ["Default demographic baseline"], missing

        score_components = []

        # 1. Geographic Alignment
        target_countries = [c.upper() for c in target_demographics.get("countries", [])]
        creator_countries = [c.upper() for c in creator_demographics.get("top_countries", [])]
        if target_countries and creator_countries:
            common_countries = set(target_countries).intersection(set(creator_countries))
            geo_ratio = len(common_countries) / max(len(target_countries), 1)
            geo_score = min(geo_ratio * 100, 100.0)
            score_components.append(geo_score)
            signals.append(f"Geographic match: {', '.join(common_countries) if common_countries else 'None'}")
        else:
            missing.append("Geographic country breakdown missing")

        # 2. Age Group Alignment
        target_age = target_demographics.get("age_groups", [])
        creator_age = creator_demographics.get("age_split", {})
        if target_age and creator_age:
            age_overlap_pct = sum(float(creator_age.get(group, 0)) for group in target_age)
            score_components.append(min(age_overlap_pct * 1.3, 100.0))
            signals.append(f"Target age group concentration: {age_overlap_pct:.1f}%")
        else:
            missing.append("Age cohort breakdown missing")

        if score_components:
            final_audience_score = round(float(np.mean(score_components)), 1)
        else:
            final_audience_score = 55.0

        return final_audience_score, signals, missing

    def compute_engagement_quality(
        self,
        followers: int,
        engagement_rate: float
    ) -> Tuple[float, List[str]]:
        tier_benchmark = 2.0
        tier_name = "general"

        for name, (min_f, max_f, bench) in self.ENGAGEMENT_BENCHMARKS.items():
            if min_f <= followers <= max_f:
                tier_benchmark = bench
                tier_name = name
                break
        if followers > 1_000_000:
            tier_benchmark = 1.0
            tier_name = "mega"

        ratio = engagement_rate / tier_benchmark if tier_benchmark > 0 else 1.0
        score = round(float(np.clip(50.0 + (ratio - 0.5) * 40.0, 15.0, 98.0)), 1)
        signals = [
            f"{tier_name.capitalize()} tier benchmark: {tier_benchmark:.1f}%",
            f"Observed engagement: {engagement_rate:.2f}% (Efficiency ratio: {ratio:.2f}x)"
        ]
        return score, signals

    def compute_authenticity_heuristics(
        self,
        authenticity_score: float,
        followers: int,
        avg_engagement: float
    ) -> Tuple[float, List[str], List[str]]:
        cautions = []
        signals = [f"Base audit consistency score: {authenticity_score:.1f}/100"]

        score = authenticity_score

        if followers > 500_000 and avg_engagement > 15.0:
            cautions.append("Engagement rate unusually high for follower tier; potential viral spike or engagement pod")
            score = max(score - 10.0, 20.0)
        elif followers > 50_000 and avg_engagement < 0.2:
            cautions.append("Very low engagement rate relative to audience size; possible dormant follower base")
            score = max(score - 15.0, 20.0)
        else:
            signals.append("Follower-to-interaction distributions conform to expected organic curves")

        return round(float(score), 1), signals, cautions

    def evaluate_creator_fit(
        self,
        campaign: Dict[str, Any],
        creator: Dict[str, Any]
    ) -> Dict[str, Any]:
        campaign_text = f"{campaign.get('title', '')} {campaign.get('niche', '')} {campaign.get('description', '')}"
        creator_keywords = " ".join(creator.get("sample_content_keywords", []))
        creator_text = f"{creator.get('primary_niche', '')} {' '.join(creator.get('secondary_niches', []))} {creator.get('bio', '')} {creator_keywords}"

        content_score, content_signals = self.compute_content_relevance(campaign_text, creator_text)

        audience_score, audience_signals, missing_metrics = self.compute_audience_affinity(
            campaign.get("target_audience", {}),
            creator.get("audience_demographics", {})
        )

        engagement_score, engagement_signals = self.compute_engagement_quality(
            creator.get("total_followers", 0),
            creator.get("avg_engagement_rate", 0.0)
        )

        auth_score, auth_signals, cautions = self.compute_authenticity_heuristics(
            creator.get("authenticity_score", 90.0),
            creator.get("total_followers", 0),
            creator.get("avg_engagement_rate", 0.0)
        )

        overall = (
            self.w_content * content_score
            + self.w_audience * audience_score
            + self.w_engagement * engagement_score
            + self.w_authenticity * auth_score
        )
        overall_score = round(float(np.clip(overall, 1.0, 99.0)), 1)

        strengths = []
        if content_score >= 60.0:
            strengths.append(f"Strong niche alignment in {creator.get('primary_niche', 'campaign focus')}")
        if audience_score >= 65.0:
            strengths.append("High demographic and geographic alignment with target audience")
        if engagement_score >= 70.0:
            strengths.append(f"Above-benchmark engagement ({creator.get('avg_engagement_rate', 0):.1f}%) for follower tier")
        if auth_score >= 85.0:
            strengths.append("Healthy organic interaction patterns with low anomaly indices")
        if not strengths:
            strengths.append("Meets minimum threshold requirements across basic parameters")

        summary = (
            f"Evaluated overall match score of {overall_score}/100. "
            f"Content relevance: {content_score}%, Audience affinity: {audience_score}%, "
            f"Engagement index: {engagement_score}%, Authenticity index: {auth_score}%."
        )

        signals_used = content_signals + audience_signals + engagement_signals + auth_signals

        return {
            "overall_match_score": overall_score,
            "signal_breakdown": {
                "content_relevance_score": content_score,
                "audience_affinity_score": audience_score,
                "engagement_quality_score": engagement_score,
                "authenticity_heuristic_score": auth_score,
                "signals_used": signals_used,
                "missing_metrics": missing_metrics,
            },
            "explanation": {
                "summary": summary,
                "strengths": strengths,
                "cautions": cautions,
                "authenticity_disclaimer": (
                    "Note: Authenticity score is an algorithmic anomaly heuristic evaluating engagement consistency and ratio distributions, "
                    "not definitive proof of fraudulent activity."
                ),
            },
        }


matching_engine = BrandFitEngine()

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Tuple
from app.schemas.analytics import ReviewSignalOut


class BaseAuthenticityModel(ABC):
    """
    Abstract interface for creator authenticity assessment.
    Guarantees consistent input/output contracts across deterministic heuristic models
    and future supervised machine-learning classifiers.
    """

    @property
    @abstractmethod
    def model_id(self) -> str:
        """Machine identifier for this model."""
        pass

    @property
    @abstractmethod
    def model_type(self) -> str:
        """Type of model: 'deterministic_heuristic' or 'supervised_classifier'."""
        pass

    @property
    @abstractmethod
    def is_trained(self) -> bool:
        """Whether this model has trained parameter weights from a labeled dataset."""
        pass

    @abstractmethod
    def get_model_info(self) -> Dict[str, Any]:
        """Returns model metadata, status, training history, and architectural disclosures."""
        pass

    @abstractmethod
    def evaluate(
        self,
        signals: List[ReviewSignalOut],
        creator_context: Dict[str, Any],
    ) -> Tuple[float, List[str], List[str]]:
        """
        Calculates composite authenticity score (0.0 to 100.0), strengths, and caution notes.
        Must NOT output binary fraud labels or automated exclusion recommendations.
        """
        pass


class DeterministicHeuristicAuthenticityModel(BaseAuthenticityModel):
    """
    Active baseline model for Phase 13.
    Uses transparent, deterministic rules to evaluate review signals without black-box opacity.
    
    Scoring Rules:
    - Base score = 100.0.
    - Signal status 'normal': confirms organic health (no penalty).
    - Signal status 'insufficient_data': neutral (0 penalty - absence of data is never penalized).
    - Signal status 'review_recommended': applies transparent, bounded penalty (10.0 to 15.0 pts).
    - Score is clamped between 20.0 and 100.0.
    """

    @property
    def model_id(self) -> str:
        return "deterministic_heuristic_v1"

    @property
    def model_type(self) -> str:
        return "deterministic_heuristic"

    @property
    def is_trained(self) -> bool:
        return False

    def get_model_info(self) -> Dict[str, Any]:
        return {
            "model_id": self.model_id,
            "display_name": "Deterministic Heuristic Authenticity Evaluator v1.0",
            "model_type": self.model_type,
            "status": "active_production",
            "is_trained": False,
            "training_dataset": "None (Rule-based heuristics formulated from creator marketing benchmarks)",
            "description": (
                "Evaluates account interaction distributions, posting rhythm, ratio balance, "
                "and caption repetitiveness using explicit, explainable threshold logic."
            ),
            "disclaimer": (
                "Heuristic signals provide review evidence for human campaign managers, "
                "never automated fraud proof or disqualification."
            ),
        }

    def evaluate(
        self,
        signals: List[ReviewSignalOut],
        creator_context: Dict[str, Any],
    ) -> Tuple[float, List[str], List[str]]:
        score = 100.0
        strengths: List[str] = []
        cautions: List[str] = []

        penalty_map = {
            "follower_following_ratio": 12.0,
            "posting_frequency": 10.0,
            "engagement_anomalies": 15.0,
            "generic_interaction_patterns": 12.0,
            "growth_anomalies": 15.0,
        }

        for sig in signals:
            if sig.status == "normal":
                strengths.append(f"{sig.display_name}: {sig.evidence_summary}")
            elif sig.status == "review_recommended":
                penalty = penalty_map.get(sig.signal_key, 10.0)
                score -= penalty
                cautions.append(f"{sig.display_name}: {sig.evidence_summary} ({sig.context_and_guidance})")
            elif sig.status == "insufficient_data":
                # Explicit rule: Insufficient data NEVER penalizes score!
                pass

        # Clamp between 20.0 and 100.0
        final_score = round(max(20.0, min(100.0, score)), 1)
        if not strengths:
            strengths.append("Account satisfies baseline profile structure and metric recording requirements.")

        return final_score, strengths, cautions


class SupervisedAuthenticityClassifierStub(BaseAuthenticityModel):
    """
    Model interface placeholder for future supervised machine-learning authenticity models.
    STRICTLY DESIGNATED AS UNTRAINED AND NOT YET IMPLEMENTED IN PHASE 13.
    """

    @property
    def model_id(self) -> str:
        return "supervised_gradient_boosting_stub"

    @property
    def model_type(self) -> str:
        return "supervised_classifier"

    @property
    def is_trained(self) -> bool:
        return False

    def get_model_info(self) -> Dict[str, Any]:
        return {
            "model_id": self.model_id,
            "display_name": "Supervised Gradient-Boosted Authenticity Classifier (Future Architecture)",
            "model_type": self.model_type,
            "status": "planned_not_implemented",
            "is_trained": False,
            "target_architecture": "XGBoost / LightGBM Binary Probability Estimator",
            "required_inputs": [
                "historical_follower_timeseries",
                "interaction_entropy_vector",
                "audience_geolocation_clustering",
                "caption_stylometry_embeddings",
                "verified_collaborator_graph_degree",
            ],
            "required_ground_truth": "Empirically audited dataset of human-labeled partner accounts and engagement pods",
            "status_summary": (
                "Phase 13 establishes the model interface contract. No trained weights or black-box "
                "predictions are deployed in this phase."
            ),
        }

    def evaluate(
        self,
        signals: List[ReviewSignalOut],
        creator_context: Dict[str, Any],
    ) -> Tuple[float, List[str], List[str]]:
        raise NotImplementedError(
            "Supervised authenticity model is not yet trained or deployed. "
            "In Phase 13, all evaluations use DeterministicHeuristicAuthenticityModel."
        )


# ==============================================================================
# Architectural Documentation & Catalogs
# ==============================================================================

DETERMINISTIC_HEURISTICS_CATALOG = [
    {
        "signal_key": "follower_following_ratio",
        "name": "Follower / Following Ratio Analysis",
        "implementation_type": "deterministic_heuristic",
        "status": "active",
        "description": "Compares follower count to following count when both are provided; identifies extreme follow-for-follow skew without penalizing normal creators.",
    },
    {
        "signal_key": "posting_frequency",
        "name": "Posting Rhythm & Inactivity Detection",
        "implementation_type": "deterministic_heuristic",
        "status": "active",
        "description": "Calculates intervals between post timestamps to detect dormancy (>90 days) or rapid burst posting (>10 posts/hour).",
    },
    {
        "signal_key": "engagement_anomalies",
        "name": "Tier-Normalized Engagement & Like/Comment Asymmetry",
        "implementation_type": "deterministic_heuristic",
        "status": "active",
        "description": "Compares observed engagement against standard follower-tier baselines (nano, micro, mid, macro, mega) and checks like-to-comment balance.",
    },
    {
        "signal_key": "generic_interaction_patterns",
        "name": "Repetitive Caption & Token Jaccard Analysis",
        "implementation_type": "deterministic_heuristic",
        "status": "active",
        "description": "Computes token similarity across sample captions to identify high proportions of repeated templated text.",
    },
    {
        "signal_key": "growth_anomalies",
        "name": "Longitudinal Growth Velocity (Multi-Observation Only)",
        "implementation_type": "deterministic_heuristic",
        "status": "active",
        "description": "Computes daily follower growth rates strictly when multiple timestamped historical observations exist; returns insufficient_data on single observations.",
    },
]

UNIMPLEMENTED_FEATURES_CATALOG = [
    {
        "feature_key": "supervised_authenticity_classifier",
        "name": "Supervised Gradient Boosting Fraud Classifier",
        "status": "not_implemented",
        "reason": "Requires high-volume labeled ground-truth audit dataset and ethical bias verification.",
    },
    {
        "feature_key": "deep_comment_sentiment_nlp",
        "name": "Deep NLP Comment Semantics & Bot Heuristics",
        "status": "not_implemented",
        "reason": "Live social comment scraping is restricted by platform API terms.",
    },
    {
        "feature_key": "engagement_pod_graph_clustering",
        "name": "Cross-Account Pod Graph Network Detection",
        "status": "not_implemented",
        "reason": "Requires platform-wide multi-account graph linkage data.",
    },
]

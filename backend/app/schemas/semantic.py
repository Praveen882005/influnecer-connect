"""
Pydantic schemas for Phase 14: Semantic Content Understanding.

Provides strict request and response schemas for:
- Text embedding generation
- Batch embedding generation
- Campaign vs creator cosine similarity analysis
- Niche prototype benchmark alignment across the 8 initial niches
- Model status and operational metadata
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# Canonical Disclaimers
COSINE_SIMILARITY_DISCLAIMER = (
    "Cosine similarity reflects directional proximity in the 384-dimensional latent embedding space, "
    "NOT a calibrated probability of campaign conversion or creator performance."
)

NICHE_ALIGNMENT_DISCLAIMER = (
    "Niche alignment scores represent geometric proximity to benchmark prototype vectors, "
    "NOT ground-truth supervised classification probabilities. Evaluation is uncalibrated without "
    "domain-specific labelled ground truth."
)


class EmbeddingRequest(BaseModel):
    """Request schema for single text embedding."""
    text: str = Field(..., min_length=1, max_length=10000, description="Input text to encode into a 384-dimensional dense vector.")
    normalize: bool = Field(default=True, description="Whether to apply text cleaning and Unicode NFKC normalization prior to inference.")


class BatchEmbeddingRequest(BaseModel):
    """Request schema for batch text embeddings."""
    texts: List[str] = Field(..., min_length=1, max_length=128, description="List of text strings to encode in batch.")
    batch_size: int = Field(default=32, ge=1, le=128, description="Batch size for model inference.")
    normalize: bool = Field(default=True, description="Whether to apply text cleaning prior to encoding.")


class EmbeddingResponse(BaseModel):
    """Response schema for single text embedding."""
    status: str = Field(default="success", description="Generation status: success, cached, or error.")
    dimension: int = Field(default=384, description="Dimensionality of the embedding vector (384 for all-MiniLM-L6-v2).")
    embedding: List[float] = Field(..., description="L2-normalized 384-dimensional float vector.")
    model_name: str = Field(..., description="Pretrained model identifier.")
    model_version: str = Field(..., description="Model version or commit reference.")
    cached: bool = Field(default=False, description="Whether the embedding was retrieved from versioned cache.")
    inference_time_ms: float = Field(..., description="Latency of inference or retrieval in milliseconds.")
    text_length: int = Field(..., description="Character count of normalized text.")
    disclaimer: str = Field(default=COSINE_SIMILARITY_DISCLAIMER)


class BatchEmbeddingResponse(BaseModel):
    """Response schema for batch embeddings."""
    status: str = Field(default="success")
    count: int = Field(..., description="Number of embeddings generated.")
    dimension: int = Field(default=384)
    embeddings: List[List[float]] = Field(..., description="List of 384-dimensional vectors.")
    model_name: str = Field(...)
    inference_time_ms: float = Field(...)
    disclaimer: str = Field(default=COSINE_SIMILARITY_DISCLAIMER)


class TextSimilarityRequest(BaseModel):
    """Direct text comparison request."""
    text_a: str = Field(..., min_length=1, max_length=10000, description="First text (e.g. campaign brief).")
    text_b: str = Field(..., min_length=1, max_length=10000, description="Second text (e.g. creator content).")
    label_a: Optional[str] = Field(default="text_a", description="Optional label for the first text.")
    label_b: Optional[str] = Field(default="text_b", description="Optional label for the second text.")


class CampaignCreatorSimilarityRequest(BaseModel):
    """Database entity or custom text similarity request."""
    campaign_id: Optional[int] = Field(default=None, description="Campaign ID to load from database.")
    creator_id: Optional[int] = Field(default=None, description="Creator ID to load from database.")
    campaign_text_override: Optional[str] = Field(default=None, description="Direct campaign text override.")
    creator_text_override: Optional[str] = Field(default=None, description="Direct creator text override.")


class SimilarityScoreResponse(BaseModel):
    """Response schema for semantic cosine similarity."""
    status: str = Field(default="success")
    cosine_similarity: float = Field(..., ge=-1.0, le=1.0, description="Cosine similarity in range [-1.0, 1.0].")
    alignment_band: str = Field(..., description="Semantic alignment band: High (>=0.55), Moderate (0.30-0.54), Low (0.15-0.29), Minimal (<0.15).")
    dimension: int = Field(default=384)
    model_name: str = Field(...)
    campaign_components_analyzed: List[str] = Field(default_factory=list)
    creator_components_analyzed: List[str] = Field(default_factory=list)
    inference_time_ms: float = Field(...)
    disclaimer: str = Field(default=COSINE_SIMILARITY_DISCLAIMER)


class NicheAlignmentScore(BaseModel):
    """Single niche benchmark alignment score."""
    niche: str = Field(..., description="One of the 8 canonical niches.")
    cosine_similarity: float = Field(..., ge=-1.0, le=1.0)
    alignment_band: str = Field(...)


class NicheAlignmentRequest(BaseModel):
    """Request schema for evaluating text against the 8 initial content niches."""
    text: str = Field(..., min_length=1, max_length=10000, description="Text to align against niche prototypes.")


class NicheAlignmentResponse(BaseModel):
    """Response schema for 8-niche benchmark alignment."""
    status: str = Field(default="success")
    query_length: int = Field(...)
    top_niche: str = Field(..., description="Niche with highest prototype cosine similarity.")
    top_similarity: float = Field(..., ge=-1.0, le=1.0)
    niches: List[NicheAlignmentScore] = Field(..., description="Alignment scores for all 8 initial niches in descending order.")
    model_name: str = Field(...)
    disclaimer: str = Field(default=NICHE_ALIGNMENT_DISCLAIMER)


class ModelStatusResponse(BaseModel):
    """Operational status and runtime limitations for semantic inference service."""
    model_name: str = Field(default="all-MiniLM-L6-v2")
    model_version: str = Field(default="1.0.0")
    dimension: int = Field(default=384)
    device: str = Field(default="cpu")
    status: str = Field(..., description="Status: 'loaded', 'download_failed', 'offline_cached', 'unloaded'.")
    cache_entries: int = Field(default=0)
    canonical_niches: List[str] = Field(default_factory=list)
    hardware_limitations: Dict[str, Any] = Field(default_factory=dict)
    runtime_limitations: Dict[str, Any] = Field(default_factory=dict)

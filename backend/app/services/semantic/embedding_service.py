"""
Semantic Embedding Service for Phase 14: Semantic Content Understanding.

Provides:
- Pretrained sentence transformer model loader (`all-MiniLM-L6-v2`, 384 dimensions).
- Request-time single embedding generation with versioned SHA-256 caching.
- Batch embedding generation separating model download and inference.
- Cosine similarity computation with strict mathematical validation.
- Zero-shot prototype benchmark alignment for the 8 canonical content niches.
- Transparent blocker error reporting without silent fake substitutions.
- Hardware, runtime, and deployment limit documentation.
"""

from collections import OrderedDict
import hashlib
import logging
import math
import os
import threading
import time
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from app.schemas.semantic import (
    COSINE_SIMILARITY_DISCLAIMER,
    NICHE_ALIGNMENT_DISCLAIMER,
    NicheAlignmentScore,
)
from app.services.semantic.text_normalizer import (
    clean_unicode_and_whitespace,
    compose_campaign_text,
    compose_creator_text,
)

logger = logging.getLogger(__name__)

# Constants
DEFAULT_MODEL_NAME = "all-MiniLM-L6-v2"
MODEL_VERSION = "1.0.0"
EMBEDDING_DIMENSION = 384
MAX_CACHE_SIZE = 5000

# Canonical 8 niches with authoritative prototype semantic definitions
NICHE_PROTOTYPES: Dict[str, str] = {
    "beauty": (
        "Beauty, cosmetics, skincare routines, makeup artistry, dermatological care, "
        "clean beauty products, serums, facial aesthetics, and personal grooming."
    ),
    "food": (
        "Food, culinary recipes, cooking techniques, restaurants, gourmet dining, "
        "baking sourdough breads, nutritious meal preparation, and food reviews."
    ),
    "fitness": (
        "Fitness, physical exercise, workout routines, strength training, athletic conditioning, "
        "gym workouts, bodybuilding, and cardiovascular health."
    ),
    "fashion": (
        "Fashion, apparel styling, runway trends, seasonal fashion collections, footwear, "
        "streetwear, outfit coordination, and designer clothing."
    ),
    "home": (
        "Home, interior design, home decor, modern furnishings, home organization, "
        "architectural styling, renovation, and comfortable living spaces."
    ),
    "technology": (
        "Technology, consumer electronics, software engineering, machine learning, gadgets, "
        "artificial intelligence, hardware reviews, smartphones, and developer tools."
    ),
    "parenting": (
        "Parenting, family life, child development, parenting tips, toddler care, infant health, "
        "educational activities, and maternal guidance."
    ),
    "wellness": (
        "Wellness, mental well-being, mindfulness meditation, holistic health, stress relief, "
        "healthy lifestyle habits, sleep hygiene, and personal self-care."
    ),
}


class ModelUnavailableError(RuntimeError):
    """Raised when the pretrained sentence transformer model cannot be downloaded or loaded."""
    pass


class EmbeddingService:
    """
    Production-grade Semantic Embedding Service.
    Uses sentence-transformers/all-MiniLM-L6-v2 (384-dimensional unit normalized vectors).
    """

    _instance: Optional["EmbeddingService"] = None
    _lock = threading.Lock()

    def __init__(self, model_name: str = DEFAULT_MODEL_NAME):
        self.model_name = model_name
        self.model_version = MODEL_VERSION
        self.dimension = EMBEDDING_DIMENSION
        self._model = None
        self._model_load_error: Optional[str] = None
        self._status = "unloaded"
        self._device = "cpu"
        self._cache: OrderedDict[str, List[float]] = OrderedDict()
        self._cache_lock = threading.Lock()
        self._niche_prototype_embeddings: Dict[str, List[float]] = {}
        self._niche_lock = threading.Lock()

    @classmethod
    def get_instance(cls) -> "EmbeddingService":
        """Singleton accessor for thread-safe shared model inference."""
        with cls._lock:
            if cls._instance is None:
                cls._instance = cls()
            return cls._instance

    def _determine_device(self) -> str:
        """Determines computation device (cpu or cuda)."""
        try:
            import torch
            if torch.cuda.is_available():
                return "cuda"
        except Exception:
            pass
        return "cpu"

    def load_model(self) -> Any:
        """
        Loads the SentenceTransformer model into memory.
        If loading fails (network, missing weights, corrupted cache),
        it sets status to 'download_failed' and raises ModelUnavailableError.
        IT NEVER SILENTLY SUBSTITUTES FAKE OR RANDOM VECTORS.
        """
        if self._model is not None:
            return self._model

        with self._lock:
            if self._model is not None:
                return self._model

            try:
                logger.info(f"Loading SentenceTransformer model: {self.model_name}...")
                from sentence_transformers import SentenceTransformer

                self._device = self._determine_device()
                model = SentenceTransformer(self.model_name, device=self._device)

                # Verify dimension with a probe encode
                probe = model.encode("healthcheck", normalize_embeddings=True)
                actual_dim = len(probe)
                if actual_dim != self.dimension:
                    raise ValueError(
                        f"Expected embedding dimension {self.dimension}, but model produced {actual_dim}."
                    )

                self._model = model
                self._status = "loaded"
                self._model_load_error = None
                logger.info(f"Model {self.model_name} loaded successfully on {self._device}.")

                # Precompute prototype vectors for 8 canonical niches
                self._precompute_niche_prototypes()

                return self._model

            except Exception as exc:
                self._status = "download_failed"
                self._model_load_error = str(exc)
                logger.error(
                    f"CRITICAL: Failed to load pretrained sentence-transformers model '{self.model_name}': {exc}"
                )
                raise ModelUnavailableError(
                    f"Pretrained embedding model '{self.model_name}' is unavailable: {exc}. "
                    "Refusing to generate silent mock or random embeddings."
                ) from exc

    def _precompute_niche_prototypes(self) -> None:
        """Precomputes and caches 384-dimensional prototype embeddings for canonical niches."""
        with self._niche_lock:
            if self._niche_prototype_embeddings:
                return

            if self._model is None:
                return

            for niche_key, prototype_desc in NICHE_PROTOTYPES.items():
                emb = self._model.encode(
                    clean_unicode_and_whitespace(prototype_desc),
                    normalize_embeddings=True
                )
                self._niche_prototype_embeddings[niche_key] = [float(x) for x in emb]

    def _get_cache_key(self, normalized_text: str) -> str:
        """Generates deterministic SHA-256 versioned cache key."""
        payload = f"{self.model_name}:{self.model_version}:{normalized_text}".encode("utf-8")
        return hashlib.sha256(payload).hexdigest()

    def embed_text(self, text: str, normalize: bool = True) -> Tuple[List[float], bool, float]:
        """
        Request-time inference for a single string.
        Returns:
            (embedding_vector, is_cached, inference_time_ms)
        Raises:
            ValueError: If input is empty or whitespace-only.
            ModelUnavailableError: If model cannot be loaded.
        """
        start_time = time.perf_counter()

        if not text or not text.strip():
            raise ValueError("Input text cannot be empty or whitespace-only.")

        cleaned = clean_unicode_and_whitespace(text) if normalize else text.strip()
        if not cleaned:
            raise ValueError("Normalized text is empty after cleaning control characters.")

        cache_key = self._get_cache_key(cleaned)

        # Check in-memory cache
        with self._cache_lock:
            if cache_key in self._cache:
                self._cache.move_to_end(cache_key)
                vector = self._cache[cache_key]
                elapsed_ms = round((time.perf_counter() - start_time) * 1000.0, 2)
                return vector, True, elapsed_ms

        # Load model and run inference
        model = self.load_model()
        raw_emb = model.encode(cleaned, normalize_embeddings=True)
        vector = [float(x) for x in raw_emb]

        # Validate vector
        if len(vector) != self.dimension:
            raise ValueError(f"Model produced vector of length {len(vector)}, expected {self.dimension}.")

        # Store in LRU cache
        with self._cache_lock:
            if len(self._cache) >= MAX_CACHE_SIZE:
                self._cache.popitem(last=False)
            self._cache[cache_key] = vector

        elapsed_ms = round((time.perf_counter() - start_time) * 1000.0, 2)
        return vector, False, elapsed_ms

    def embed_batch(
        self,
        texts: List[str],
        batch_size: int = 32,
        normalize: bool = True
    ) -> Tuple[List[List[float]], float]:
        """
        Batch embedding generation for pipeline ingestion.
        Separates model loading, batched forward passes, and caching.
        """
        start_time = time.perf_counter()
        if not texts:
            return [], 0.0

        cleaned_texts: List[str] = []
        for t in texts:
            c = clean_unicode_and_whitespace(t) if normalize else (t or "").strip()
            if not c:
                raise ValueError("Encountered empty text string in batch payload.")
            cleaned_texts.append(c)

        model = self.load_model()
        raw_embs = model.encode(
            cleaned_texts,
            batch_size=batch_size,
            normalize_embeddings=True,
            show_progress_bar=False,
        )

        vectors: List[List[float]] = []
        with self._cache_lock:
            for cleaned_t, emb in zip(cleaned_texts, raw_embs):
                v = [float(x) for x in emb]
                vectors.append(v)
                key = self._get_cache_key(cleaned_t)
                if len(self._cache) >= MAX_CACHE_SIZE:
                    self._cache.popitem(last=False)
                self._cache[key] = v

        elapsed_ms = round((time.perf_counter() - start_time) * 1000.0, 2)
        return vectors, elapsed_ms

    @staticmethod
    def compute_cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
        """
        Calculates cosine similarity between two float vectors:
        cos(u, v) = (u . v) / (||u|| * ||v||)
        Since vectors from SentenceTransformer with normalize_embeddings=True are L2 unit vectors,
        this is equivalent to the dot product.
        We verify finite numbers and clamp strictly to [-1.0, 1.0].
        """
        if len(vec_a) != len(vec_b):
            raise ValueError(f"Vector dimension mismatch: {len(vec_a)} vs {len(vec_b)}.")

        dot_product = 0.0
        norm_a = 0.0
        norm_b = 0.0

        for a, b in zip(vec_a, vec_b):
            if not math.isfinite(a) or not math.isfinite(b):
                raise ValueError("Embedding vector contains non-finite float (NaN or Inf).")
            dot_product += a * b
            norm_a += a * a
            norm_b += b * b

        if norm_a <= 0.0 or norm_b <= 0.0:
            return 0.0

        sim = dot_product / (math.sqrt(norm_a) * math.sqrt(norm_b))
        # Clamp against floating point precision drift
        clamped = max(-1.0, min(1.0, sim))
        return round(float(clamped), 4)

    def compute_text_similarity(
        self,
        text_a: str,
        text_b: str
    ) -> Tuple[float, str, float]:
        """
        Computes cosine similarity between two raw text inputs.
        Returns (similarity, alignment_band, inference_time_ms).
        """
        start = time.perf_counter()
        vec_a, _, _ = self.embed_text(text_a)
        vec_b, _, _ = self.embed_text(text_b)
        sim = self.compute_cosine_similarity(vec_a, vec_b)
        band = self.classify_alignment_band(sim)
        elapsed_ms = round((time.perf_counter() - start) * 1000.0, 2)
        return sim, band, elapsed_ms

    @staticmethod
    def classify_alignment_band(similarity: float) -> str:
        """
        Qualitative alignment band mapping:
        - High: >= 0.55
        - Moderate: 0.30 - 0.54
        - Low: 0.15 - 0.29
        - Minimal: < 0.15
        """
        if similarity >= 0.55:
            return "High Alignment"
        elif similarity >= 0.30:
            return "Moderate Alignment"
        elif similarity >= 0.15:
            return "Low Alignment"
        else:
            return "Minimal Alignment"

    def evaluate_niche_alignment(self, text: str) -> Tuple[str, float, List[NicheAlignmentScore]]:
        """
        Aligns arbitrary text against the 8 initial content niches using
        precomputed prototype benchmark embeddings.
        Returns:
            (top_niche, top_similarity, sorted_scores)
        """
        query_vec, _, _ = self.embed_text(text)

        # Ensure niche prototype embeddings are loaded
        if not self._niche_prototype_embeddings:
            self.load_model()

        scores: List[NicheAlignmentScore] = []
        for niche_name, proto_vec in self._niche_prototype_embeddings.items():
            sim = self.compute_cosine_similarity(query_vec, proto_vec)
            band = self.classify_alignment_band(sim)
            scores.append(NicheAlignmentScore(
                niche=niche_name,
                cosine_similarity=sim,
                alignment_band=band,
            ))

        # Sort descending by similarity
        scores.sort(key=lambda x: x.cosine_similarity, reverse=True)
        top_niche = scores[0].niche
        top_similarity = scores[0].cosine_similarity

        return top_niche, top_similarity, scores

    def is_operational(self) -> bool:
        """Verifies if model is loaded or can be loaded without error."""
        try:
            self.load_model()
            return self._status == "loaded" and self._model is not None
        except Exception:
            return False

    def get_status(self) -> Dict[str, Any]:
        """Returns operational status, model configuration, and documented limits."""
        with self._cache_lock:
            cache_size = len(self._cache)

        is_model_ready = (self._status == "loaded" and self._model is not None)
        return {
            "model_name": self.model_name,
            "model_version": self.model_version,
            "dimension": self.dimension,
            "device": self._device,
            "status": "ready" if is_model_ready else self._status,
            "raw_status": self._status,
            "is_loaded": is_model_ready,
            "cache_entries": cache_size,
            "cache_size": cache_size,
            "canonical_niches": list(NICHE_PROTOTYPES.keys()),
            "hardware_limitations": {
                "execution_target": self._device,
                "memory_footprint_mb": 120,
                "gpu_acceleration_supported": True,
                "recommended_production_worker_threads": 1,
            },
            "runtime_limitations": {
                "max_sequence_length_tokens": 256,
                "tokenizer": "WordPiece / BertTokenizer",
                "normalization": "L2 Unit Normalization (||v|| = 1.0)",
                "recommended_batch_size": 32,
                "disclaimer": COSINE_SIMILARITY_DISCLAIMER,
            },
        }

    def clear_cache(self) -> None:
        """Clears the in-memory embedding cache."""
        with self._cache_lock:
            self._cache.clear()

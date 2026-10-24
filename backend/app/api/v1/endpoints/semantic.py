"""
Semantic Content Understanding Endpoints for Phase 14.

Provides REST API routes for:
- Text embedding generation (/semantic/embed, /semantic/embed-batch)
- Campaign vs creator semantic similarity (/semantic/similarity)
- Niche prototype benchmark alignment across the 8 canonical niches (/semantic/niches/alignment)
- Pretrained model operational status and hardware limits (/semantic/model-status)
"""

import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.entities import Campaign, InfluencerPost, InfluencerProfile
from app.schemas.semantic import (
    BatchEmbeddingRequest,
    BatchEmbeddingResponse,
    CampaignCreatorSimilarityRequest,
    EmbeddingRequest,
    EmbeddingResponse,
    ModelStatusResponse,
    NicheAlignmentRequest,
    NicheAlignmentResponse,
    SimilarityScoreResponse,
    TextSimilarityRequest,
    COSINE_SIMILARITY_DISCLAIMER,
    NICHE_ALIGNMENT_DISCLAIMER,
)
from app.services.semantic.embedding_service import (
    EmbeddingService,
    ModelUnavailableError,
)
from app.services.semantic.text_normalizer import (
    compose_campaign_text,
    compose_creator_text,
)

logger = logging.getLogger(__name__)

router = APIRouter()


def get_embedding_service() -> EmbeddingService:
    """Dependency that returns the shared EmbeddingService instance."""
    return EmbeddingService.get_instance()


@router.post(
    "/embed",
    response_model=EmbeddingResponse,
    summary="Generate single text embedding",
    description="Encodes a normalized text string into a 384-dimensional L2-normalized vector using all-MiniLM-L6-v2.",
)
def generate_embedding(
    payload: EmbeddingRequest,
    service: EmbeddingService = Depends(get_embedding_service),
) -> EmbeddingResponse:
    if not payload.text or not payload.text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Input text cannot be empty or whitespace-only.",
        )

    try:
        vector, cached, latency_ms = service.embed_text(payload.text, normalize=payload.normalize)
        return EmbeddingResponse(
            status="success",
            dimension=service.dimension,
            embedding=vector,
            model_name=service.model_name,
            model_version=service.model_version,
            cached=cached,
            inference_time_ms=latency_ms,
            text_length=len(payload.text.strip()),
            disclaimer=COSINE_SIMILARITY_DISCLAIMER,
        )
    except ModelUnavailableError as exc:
        logger.error(f"Semantic service unavailable: {exc}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error": "MODEL_UNAVAILABLE",
                "blocker": str(exc),
                "action": "Ensure HuggingFace Hub network access or verify local cache integrity.",
            },
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post(
    "/embed-batch",
    response_model=BatchEmbeddingResponse,
    summary="Generate batch text embeddings",
    description="Encodes a list of texts in batch for high-throughput pipeline ingestion.",
)
def generate_batch_embeddings(
    payload: BatchEmbeddingRequest,
    service: EmbeddingService = Depends(get_embedding_service),
) -> BatchEmbeddingResponse:
    if not payload.texts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Batch list of texts cannot be empty.",
        )

    try:
        vectors, latency_ms = service.embed_batch(
            payload.texts,
            batch_size=payload.batch_size,
            normalize=payload.normalize,
        )
        return BatchEmbeddingResponse(
            status="success",
            count=len(vectors),
            dimension=service.dimension,
            embeddings=vectors,
            model_name=service.model_name,
            inference_time_ms=latency_ms,
            disclaimer=COSINE_SIMILARITY_DISCLAIMER,
        )
    except ModelUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"error": "MODEL_UNAVAILABLE", "blocker": str(exc)},
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post(
    "/similarity",
    response_model=SimilarityScoreResponse,
    summary="Compute semantic cosine similarity between campaign and creator",
    description=(
        "Computes exact cosine similarity in 384-dimensional latent embedding space between "
        "a campaign brief and a creator profile. Supports database entity IDs or direct text overrides."
    ),
)
async def compute_similarity(
    payload: CampaignCreatorSimilarityRequest,
    db: AsyncSession = Depends(get_db),
    service: EmbeddingService = Depends(get_embedding_service),
) -> SimilarityScoreResponse:
    campaign_components: List[str] = []
    creator_components: List[str] = []
    campaign_corpus: str = ""
    creator_corpus: str = ""

    # Resolve Campaign Text
    if payload.campaign_text_override:
        campaign_corpus = payload.campaign_text_override
        campaign_components.append("direct_campaign_override")
    elif payload.campaign_id is not None:
        c_res = await db.execute(select(Campaign).where(Campaign.id == payload.campaign_id))
        campaign = c_res.scalars().first()
        if not campaign:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Campaign with ID {payload.campaign_id} not found.",
            )
        campaign_corpus = compose_campaign_text(
            title=campaign.title,
            niche=campaign.niche,
            description=campaign.description,
            product_description=campaign.product_description,
            objective=campaign.objective,
            target_audience=campaign.target_audience if isinstance(campaign.target_audience, dict) else None,
            deliverables=campaign.deliverables if isinstance(campaign.deliverables, list) else None,
        )
        campaign_components.extend(["title", "niche", "objective", "description", "product_description"])
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Must provide either 'campaign_id' or 'campaign_text_override'.",
        )

    # Resolve Creator Text
    if payload.creator_text_override:
        creator_corpus = payload.creator_text_override
        creator_components.append("direct_creator_override")
    elif payload.creator_id is not None:
        cr_res = await db.execute(select(InfluencerProfile).where(InfluencerProfile.id == payload.creator_id))
        creator = cr_res.scalars().first()
        if not creator:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Creator profile with ID {payload.creator_id} not found.",
            )
        # Load posts for creator
        posts_res = await db.execute(
            select(InfluencerPost)
            .where(InfluencerPost.influencer_id == creator.id)
            .limit(20)
        )
        posts = posts_res.scalars().all()
        captions = [p.caption for p in posts if p.caption]
        all_tags: List[str] = []
        for p in posts:
            if hasattr(p, "hashtags") and isinstance(p.hashtags, list):
                all_tags.extend(p.hashtags)
        if hasattr(creator, "sample_content_keywords") and isinstance(creator.sample_content_keywords, list):
            all_tags.extend(creator.sample_content_keywords)

        creator_niches: List[str] = []
        if getattr(creator, "primary_niche", None):
            creator_niches.append(creator.primary_niche)
        if getattr(creator, "content_niches", None) and isinstance(creator.content_niches, list):
            creator_niches.extend(creator.content_niches)
        elif getattr(creator, "secondary_niches", None) and isinstance(creator.secondary_niches, list):
            creator_niches.extend(creator.secondary_niches)

        creator_corpus = compose_creator_text(
            display_name=creator.display_name,
            bio=creator.bio,
            niches=creator_niches if creator_niches else None,
            captions=captions,
            hashtags=all_tags,
        )
        creator_components.extend(["display_name", "bio", "niches", f"posts_analyzed_{len(posts)}"])
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Must provide either 'creator_id' or 'creator_text_override'.",
        )

    if not campaign_corpus.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Resolved campaign corpus is empty.",
        )
    if not creator_corpus.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Resolved creator corpus is empty.",
        )

    try:
        sim, band, latency_ms = service.compute_text_similarity(campaign_corpus, creator_corpus)
        return SimilarityScoreResponse(
            status="success",
            cosine_similarity=sim,
            alignment_band=band,
            dimension=service.dimension,
            model_name=service.model_name,
            campaign_components_analyzed=campaign_components,
            creator_components_analyzed=creator_components,
            inference_time_ms=latency_ms,
            disclaimer=COSINE_SIMILARITY_DISCLAIMER,
        )
    except ModelUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"error": "MODEL_UNAVAILABLE", "blocker": str(exc)},
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post(
    "/niches/alignment",
    response_model=NicheAlignmentResponse,
    summary="Evaluate text alignment across the 8 canonical niches",
    description=(
        "Measures semantic cosine similarity against benchmark prototype vectors for all "
        "8 initial content niches (beauty, food, fitness, fashion, home, technology, parenting, wellness). "
        "Results are geometric proximity ranks, not supervised classification probabilities."
    ),
)
def evaluate_niches(
    payload: NicheAlignmentRequest,
    service: EmbeddingService = Depends(get_embedding_service),
) -> NicheAlignmentResponse:
    if not payload.text or not payload.text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Input text cannot be empty or whitespace-only.",
        )

    try:
        top_niche, top_sim, scores = service.evaluate_niche_alignment(payload.text)
        return NicheAlignmentResponse(
            status="success",
            query_length=len(payload.text.strip()),
            top_niche=top_niche,
            top_similarity=top_sim,
            niches=scores,
            model_name=service.model_name,
            disclaimer=NICHE_ALIGNMENT_DISCLAIMER,
        )
    except ModelUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"error": "MODEL_UNAVAILABLE", "blocker": str(exc)},
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get(
    "/model-status",
    response_model=ModelStatusResponse,
    summary="Inspect semantic model operational status and hardware limits",
    description="Returns model architecture, dimension, device target, cache stats, and documented runtime constraints.",
)
def get_model_status(
    service: EmbeddingService = Depends(get_embedding_service),
) -> ModelStatusResponse:
    status_dict = service.get_status()
    return ModelStatusResponse(**status_dict)

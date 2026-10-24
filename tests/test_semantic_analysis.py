"""
Comprehensive Automated Test Suite for Phase 14: Semantic Content Understanding.

Verifies:
1. Sentence-Transformers model properties (384 dimensions, L2 normalization, finite floats).
2. Text normalization pipeline (Unicode NFKC, noise stripping, hashtag expansion, caption deduplication).
3. Reusable embedding service (model loading, caching, batch generation, request-time inference).
4. Cosine similarity mathematical precision and boundary clamping ([-1.0, 1.0]).
5. Expected semantic similarity ordering (related > unrelated concepts).
6. 8 canonical content niches benchmark prototype alignment (beauty, food, fitness, fashion, home, technology, parenting, wellness).
7. Empty / invalid input error handling (strict validation, no silent fallback).
8. Blocker error reporting (no fake or random substitutions if model fails).
9. REST API endpoints (/embed, /embed-batch, /similarity, /niches/alignment, /model-status).
"""

from datetime import datetime, timezone
import math
from unittest.mock import patch
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import app
from app.models.entities import BrandProfile, Campaign, CampaignStatus, InfluencerPost, InfluencerProfile, User, UserRole
from app.schemas.semantic import (
    COSINE_SIMILARITY_DISCLAIMER,
    NICHE_ALIGNMENT_DISCLAIMER,
)
from app.services.semantic.embedding_service import (
    DEFAULT_MODEL_NAME,
    EMBEDDING_DIMENSION,
    NICHE_PROTOTYPES,
    EmbeddingService,
    ModelUnavailableError,
)
from app.services.semantic.text_normalizer import (
    clean_unicode_and_whitespace,
    compose_campaign_text,
    compose_creator_text,
    deduplicate_captions,
    normalize_hashtag,
    normalize_hashtags,
)


@pytest.fixture
def embedding_service():
    """Provides the singleton embedding service instance."""
    service = EmbeddingService.get_instance()
    # Ensure model is initialized
    service.load_model()
    return service


# ============================================================================
# 1. TEXT NORMALIZER & CORPUS COMPOSITION TESTS
# ============================================================================

def test_clean_unicode_and_whitespace():
    raw = "  Hello\u00a0World!   Here\tis\na \x00control\x1f char.\nVisit https://example.com/item?id=123 @mention today!  "
    cleaned = clean_unicode_and_whitespace(raw)
    assert "Hello World!" in cleaned
    assert "https://" not in cleaned
    assert "\x00" not in cleaned
    assert "  " not in cleaned


def test_clean_unicode_empty_and_none():
    assert clean_unicode_and_whitespace(None) == ""
    assert clean_unicode_and_whitespace("") == ""
    assert clean_unicode_and_whitespace("   ") == ""


def test_normalize_hashtag_camelcase_and_punctuation():
    assert normalize_hashtag("#CleanSkincare") == "clean skincare"
    assert normalize_hashtag("#organic_food_recipe") == "organic food recipe"
    assert normalize_hashtag("##FashionTrends2026") == "fashion trends 2026"
    assert normalize_hashtag("") == ""
    assert normalize_hashtag("#") == ""


def test_normalize_hashtags_deduplication():
    raw_tags = ["#skincare", "#SkinCare", "#CleanSkincare", "#skincare", "#makeup", "#a"]
    normalized = normalize_hashtags(raw_tags)
    assert "skincare" in normalized
    assert "clean skincare" in normalized
    assert "makeup" in normalized
    # Check deduplication and length filter
    assert normalized.count("skincare") == 1
    assert "a" not in normalized


def test_deduplicate_captions_preserves_unique_order():
    captions = [
        "Morning glow routine with hydrating serum #skincare",
        "Morning glow routine with hydrating serum #skincare",  # Duplicate
        "  morning glow routine with hydrating serum #skincare  ",  # Case/whitespace duplicate
        "New sunset outfit styling video!",
        "Morning glow routine with hydrating serum #skincare",  # Duplicate again
        "Healthy green smoothie recipe for energy",
    ]
    deduped = deduplicate_captions(captions)
    assert len(deduped) == 3
    assert "Morning glow routine with hydrating serum #skincare" in deduped[0]
    assert "New sunset outfit styling video!" in deduped[1]
    assert "Healthy green smoothie recipe for energy" in deduped[2]


def test_compose_creator_text():
    corpus = compose_creator_text(
        display_name="Elena Rostova",
        bio="Dermatology student sharing evidence-based skincare.",
        niches=["beauty", "wellness"],
        captions=["Gentle retinol review", "Sunscreen protection tips"],
        hashtags=["#CleanBeauty", "#Dermatology"],
    )
    assert "Creator: Elena Rostova" in corpus
    assert "Bio: Dermatology student" in corpus
    assert "Niches: beauty, wellness" in corpus
    assert "Recent Content: Gentle retinol review | Sunscreen protection tips" in corpus
    assert "Keywords: clean beauty, dermatology" in corpus


def test_compose_campaign_text():
    corpus = compose_campaign_text(
        title="Hydrating Peptide Launch",
        niche="beauty",
        description="Influencer partnership for new botanical peptide cream.",
        product_description="Fragrance-free barrier repair moisturizer.",
        objective="Drive retail store awareness",
        target_audience={"age": "20-35", "location": "US"},
        deliverables=["1 Instagram Reel", "2 Story sets"],
    )
    assert "Campaign: Hydrating Peptide Launch" in corpus
    assert "Primary Niche: beauty" in corpus
    assert "Objective: Drive retail store awareness" in corpus
    assert "Product Description: Fragrance-free barrier repair moisturizer" in corpus
    assert "age: 20-35" in corpus


# ============================================================================
# 2. EMBEDDING SERVICE CORE PROPERTIES & VECTOR DIMENSIONS
# ============================================================================

def test_model_properties(embedding_service):
    assert embedding_service.model_name == DEFAULT_MODEL_NAME
    assert embedding_service.dimension == 384
    assert embedding_service.dimension == EMBEDDING_DIMENSION


def test_embedding_dimensions_and_unit_norm(embedding_service):
    text = "Sustainable organic linen clothing collection for spring."
    vector, cached, latency = embedding_service.embed_text(text)

    # 1. Dimensionality must be exactly 384
    assert len(vector) == 384

    # 2. Vector must be list of finite floats
    assert all(isinstance(x, float) and math.isfinite(x) for x in vector)

    # 3. L2 norm must be approximately 1.0 (unit vector)
    norm = math.sqrt(sum(x * x for x in vector))
    assert math.isclose(norm, 1.0, rel_tol=1e-3)

    assert latency >= 0.0


def test_empty_input_raises_validation_error(embedding_service):
    with pytest.raises(ValueError, match="Input text cannot be empty"):
        embedding_service.embed_text("")

    with pytest.raises(ValueError, match="Input text cannot be empty"):
        embedding_service.embed_text("     ")

    with pytest.raises(ValueError, match="empty after cleaning"):
        embedding_service.embed_text("\x00\x01\x02")


def test_versioned_cache_hit_and_speed(embedding_service):
    text = "High-protein plant-based recipes for athletic training"
    embedding_service.clear_cache()

    v1, cached1, latency1 = embedding_service.embed_text(text)
    assert cached1 is False

    # Second call should be a cache hit
    v2, cached2, latency2 = embedding_service.embed_text(text)
    assert cached2 is True
    assert v1 == v2
    assert latency2 < latency1 or latency2 < 5.0  # Cache lookup is sub-millisecond


def test_batch_embedding_generation(embedding_service):
    texts = [
        "First test post about summer skincare",
        "Second test post about home kitchen renovation",
        "Third test post about marathon running shoes",
    ]
    vectors, latency = embedding_service.embed_batch(texts, batch_size=2)
    assert len(vectors) == 3
    for v in vectors:
        assert len(v) == 384
        norm = math.sqrt(sum(x * x for x in v))
        assert math.isclose(norm, 1.0, rel_tol=1e-3)


def test_batch_embedding_empty_text_raises_error(embedding_service):
    texts = ["Valid text", "", "Another valid text"]
    with pytest.raises(ValueError, match="Encountered empty text string"):
        embedding_service.embed_batch(texts)


# ============================================================================
# 3. COSINE SIMILARITY & MATHEMATICAL BOUNDARIES
# ============================================================================

def test_cosine_similarity_identical_vectors(embedding_service):
    vec, _, _ = embedding_service.embed_text("Smart home automation with IoT sensors")
    sim = embedding_service.compute_cosine_similarity(vec, vec)
    assert math.isclose(sim, 1.0, abs_tol=1e-4)


def test_cosine_similarity_dimension_mismatch(embedding_service):
    with pytest.raises(ValueError, match="dimension mismatch"):
        embedding_service.compute_cosine_similarity([0.1, 0.2], [0.1, 0.2, 0.3])


def test_cosine_similarity_non_finite_values(embedding_service):
    with pytest.raises(ValueError, match="non-finite"):
        embedding_service.compute_cosine_similarity([float("nan"), 0.5], [0.1, 0.2])


def test_cosine_similarity_clamped_boundaries(embedding_service):
    # Perfect alignment
    sim = embedding_service.compute_cosine_similarity([1.0, 0.0], [1.0, 0.0])
    assert sim == 1.0

    # Opposite vectors
    sim_neg = embedding_service.compute_cosine_similarity([1.0, 0.0], [-1.0, 0.0])
    assert sim_neg == -1.0


# ============================================================================
# 4. EXPECTED SEMANTIC SIMILARITY ORDERING
# ============================================================================

def test_expected_similarity_ordering_skincare_vs_tech(embedding_service):
    campaign = "Hydrating botanical facial oil and anti-aging serum for sensitive skin"
    related_creator = "Organic skincare routines, cruelty-free cosmetics, and skin barrier health"
    unrelated_creator = "Quantitative algorithmic cryptocurrency trading and high-frequency arbitrage bots"

    sim_related, band_related, _ = embedding_service.compute_text_similarity(campaign, related_creator)
    sim_unrelated, band_unrelated, _ = embedding_service.compute_text_similarity(campaign, unrelated_creator)

    # Directional verification: Skincare campaign must be significantly closer to skincare creator than trading bots
    assert sim_related > sim_unrelated
    assert sim_related >= 0.35  # Moderate to high alignment for specialized niche match
    assert sim_unrelated < 0.15  # Minimally aligned concepts
    assert band_related in ("High Alignment", "Moderate Alignment")
    assert band_unrelated == "Minimal Alignment"


def test_expected_similarity_ordering_fitness_vs_food(embedding_service):
    campaign = "HIIT strength training equipment, dumbbells, and athletic performance supplements"
    fitness_creator = "Daily gym workouts, deadlift form tutorials, and bodybuilding coaching"
    culinary_creator = "Gourmet French pastry baking, sourdough fermentation, and dessert styling"

    sim_fitness, _, _ = embedding_service.compute_text_similarity(campaign, fitness_creator)
    sim_culinary, _, _ = embedding_service.compute_text_similarity(campaign, culinary_creator)

    assert sim_fitness > sim_culinary
    assert sim_fitness > 0.45


# ============================================================================
# 5. EIGHT CANONICAL NICHES BENCHMARK ALIGNMENT
# ============================================================================

def test_canonical_niches_prototype_coverage(embedding_service):
    expected_niches = {
        "beauty", "food", "fitness", "fashion", "home",
        "technology", "parenting", "wellness"
    }
    assert set(NICHE_PROTOTYPES.keys()) == expected_niches


@pytest.mark.parametrize("query_text, expected_top_niche", [
    ("Gentle exfoliating cleanser with salicylic acid for acne-prone skin", "beauty"),
    ("Sourdough bread recipe with caramelized garlic and herb butter", "food"),
    ("Barbell squat progression and progressive overload strength routine", "fitness"),
    ("Autumn capsule wardrobe styling, oversized coats, and designer boots", "fashion"),
    ("Scandinavian minimalist living room interior styling and furniture arrangement", "home"),
    ("Open-source machine learning frameworks and microservices architecture", "technology"),
    ("Toddler sleep regression tips and gentle positive parenting discipline", "parenting"),
    ("Guided mindfulness meditation and stress reduction breathwork exercises", "wellness"),
])
def test_niche_alignment_accuracy(embedding_service, query_text, expected_top_niche):
    top_niche, top_sim, scores = embedding_service.evaluate_niche_alignment(query_text)

    # Verify top niche matches expectation
    assert top_niche == expected_top_niche, f"Query '{query_text}' expected '{expected_top_niche}' but got '{top_niche}'"
    assert top_sim > 0.15

    # Verify all 8 niches are represented in descending order
    assert len(scores) == 8
    similarities = [s.cosine_similarity for s in scores]
    assert similarities == sorted(similarities, reverse=True)


# ============================================================================
# 6. ERROR TRANSPARENCY & REFUSAL TO RETURN FAKE EMBEDDINGS
# ============================================================================

def test_blocker_reporting_when_model_fails():
    """
    CRITICAL REQUIREMENT:
    'If downloading a model is not possible, report the exact blocker instead of silently substituting a fake embedding.'
    """
    broken_service = EmbeddingService(model_name="nonexistent-corrupted-model-repo-404")

    with patch("sentence_transformers.SentenceTransformer", side_effect=RuntimeError("HuggingFace 404 Repository Not Found")):
        with pytest.raises(ModelUnavailableError) as exc_info:
            broken_service.load_model()

        assert "Refusing to generate silent mock or random embeddings" in str(exc_info.value)
        assert "Repository Not Found" in str(exc_info.value)
        assert broken_service._status == "download_failed"


# ============================================================================
# 7. REST API ENDPOINT TESTS (FASTAPI TESTCLIENT)
# ============================================================================

@pytest.mark.asyncio
async def test_api_embed_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/v1/semantic/embed",
            json={"text": "Organic soothing matcha green tea latte recipe", "normalize": True},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"
        assert data["dimension"] == 384
        assert len(data["embedding"]) == 384
        assert data["model_name"] == DEFAULT_MODEL_NAME
        assert data["disclaimer"] == COSINE_SIMILARITY_DISCLAIMER


@pytest.mark.asyncio
async def test_api_embed_empty_validation_error():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/v1/semantic/embed",
            json={"text": "   "},
        )
        assert res.status_code == 400


@pytest.mark.asyncio
async def test_api_embed_batch_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/v1/semantic/embed-batch",
            json={
                "texts": [
                    "Morning yoga flow for flexibility",
                    "Vegan protein smoothie bowl",
                ],
                "batch_size": 16,
            },
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"
        assert data["count"] == 2
        assert len(data["embeddings"]) == 2
        assert len(data["embeddings"][0]) == 384


@pytest.mark.asyncio
async def test_api_similarity_direct_text_override(client: AsyncClient):
    res = await client.post(
        "/api/v1/semantic/similarity",
        json={
            "campaign_text_override": "Sustainable zero-waste bamboo toothbrush and oral care",
            "creator_text_override": "Eco-friendly living tips, plastic-free lifestyle, and sustainable hygiene",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert -1.0 <= data["cosine_similarity"] <= 1.0
    assert data["cosine_similarity"] > 0.40
    assert data["alignment_band"] in ("High Alignment", "Moderate Alignment")
    assert data["disclaimer"] == COSINE_SIMILARITY_DISCLAIMER


@pytest.mark.asyncio
async def test_api_similarity_missing_inputs(client: AsyncClient):
    res = await client.post(
        "/api/v1/semantic/similarity",
        json={},
    )
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_api_similarity_with_db_entities(client: AsyncClient, db_session: AsyncSession):
    # 1. Create brand user and profile
    brand_user = User(
        email="brand_semantic@example.com",
        hashed_password="hashed_secret_test",
        full_name="Eco Skincare Brand",
        role=UserRole.BRAND,
        is_active=True,
    )
    db_session.add(brand_user)
    await db_session.flush()

    brand_profile = BrandProfile(
        user_id=brand_user.id,
        company_name="Glow Lab Botanical",
        industry="Beauty & Cosmetics",
        description="Botanical skincare formulated for sensitive skin.",
    )
    db_session.add(brand_profile)
    await db_session.flush()

    # 2. Create campaign
    campaign = Campaign(
        brand_id=brand_profile.id,
        title="Hydration Barrier Serum Launch",
        description="Seeking beauty creators to demonstrate barrier repair results.",
        product_description="Ceramide and squalane deeply moisturizing serum.",
        niche="beauty",
        objective="Drive retail store awareness",
        budget=1500.0,
        status=CampaignStatus.ACTIVE,
    )
    db_session.add(campaign)

    # 3. Create creator user and influencer profile
    creator_user = User(
        email="creator_semantic@example.com",
        hashed_password="hashed_secret_test",
        full_name="Aria Beauty Reviewer",
        role=UserRole.CREATOR,
        is_active=True,
    )
    db_session.add(creator_user)
    await db_session.flush()

    creator_profile = InfluencerProfile(
        user_id=creator_user.id,
        display_name="Aria Glow",
        handle="ariaglow",
        bio="Esthetician reviewing hydrating serums, cleansers, and barrier creams.",
        primary_niche="beauty",
        content_niches=["beauty", "wellness"],
        total_followers=25000,
        avg_engagement_rate=4.2,
    )
    db_session.add(creator_profile)
    await db_session.flush()

    # 4. Add posts for creator
    post1 = InfluencerPost(
        influencer_id=creator_profile.id,
        platform="instagram",
        external_post_id="post_aria_1",
        url="https://instagram.com/p/aria1",
        caption="Top 3 barrier repair serums that transformed my winter dry patches! #skincare #barrierrepair",
        media_type="video",
        posted_at=datetime.now(timezone.utc),
        data_source="synthetic_test",
    )
    post2 = InfluencerPost(
        influencer_id=creator_profile.id,
        platform="instagram",
        external_post_id="post_aria_2",
        url="https://instagram.com/p/aria2",
        caption="How to layer ceramides and squalane for maximum skin hydration. #hydration #esthetician",
        media_type="video",
        posted_at=datetime.now(timezone.utc),
        data_source="synthetic_test",
    )
    db_session.add_all([post1, post2])
    await db_session.commit()

    # 5. Execute similarity endpoint comparing the campaign and creator
    res = await client.post(
        "/api/v1/semantic/similarity",
        json={"campaign_id": campaign.id, "creator_id": creator_profile.id},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["cosine_similarity"] > 0.35
    assert data["alignment_band"] in ("High Alignment", "Moderate Alignment")
    assert "title" in data["campaign_components_analyzed"]
    assert "bio" in data["creator_components_analyzed"]
    assert data["disclaimer"] == COSINE_SIMILARITY_DISCLAIMER


@pytest.mark.asyncio
async def test_api_similarity_entity_not_found(client: AsyncClient):
    # Campaign not found
    res1 = await client.post(
        "/api/v1/semantic/similarity",
        json={"campaign_id": 99999, "creator_text_override": "Some creator text"},
    )
    assert res1.status_code == 404
    assert "Campaign with ID 99999 not found" in res1.json()["detail"]

    # Creator not found
    res2 = await client.post(
        "/api/v1/semantic/similarity",
        json={"campaign_text_override": "Some campaign text", "creator_id": 99999},
    )
    assert res2.status_code == 404
    assert "Creator profile with ID 99999 not found" in res2.json()["detail"]


@pytest.mark.asyncio
async def test_api_503_when_model_fails_gracefully(client: AsyncClient):
    """Verifies that API returns HTTP 503 and actionable blocker reason instead of mock values."""
    with patch.object(
        EmbeddingService,
        "load_model",
        side_effect=ModelUnavailableError("Offline blocker: HuggingFace weights missing")
    ):
        res = await client.post(
            "/api/v1/semantic/embed",
            json={"text": "Query text during outage"},
        )
        assert res.status_code == 503
        detail = res.json()["detail"]
        assert detail["error"] == "MODEL_UNAVAILABLE"
        assert "HuggingFace weights missing" in detail["blocker"]



@pytest.mark.asyncio
async def test_api_niches_alignment_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/v1/semantic/niches/alignment",
            json={"text": "Reviewing new flagship smartphone camera sensor and mobile processor benchmarks"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"
        assert data["top_niche"] == "technology"
        assert len(data["niches"]) == 8
        assert data["disclaimer"] == NICHE_ALIGNMENT_DISCLAIMER


@pytest.mark.asyncio
async def test_api_model_status_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/semantic/model-status")
        assert res.status_code == 200
        data = res.json()
        assert data["model_name"] == DEFAULT_MODEL_NAME
        assert data["dimension"] == 384
        assert data["status"] in ("loaded", "offline_cached")
        assert len(data["canonical_niches"]) == 8
        assert "execution_target" in data["hardware_limitations"]
        assert data["runtime_limitations"]["max_sequence_length_tokens"] == 256

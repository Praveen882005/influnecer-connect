import pytest
from httpx import AsyncClient
from app.ml.engine import BrandFitEngine, matching_engine


def test_engine_content_relevance_semantic_matching():
    engine = BrandFitEngine()

    campaign_text = "AI code generation developer workflow productivity tools Python TypeScript"
    creator_match = "Senior software engineer reviewing developer tools, AI coding assistants, and IDE setups."
    creator_mismatch = "Vegan pastry chef baking sourdough bread and gluten-free cupcakes in Paris."

    score_match, signals_match = engine.compute_content_relevance(campaign_text, creator_match)
    score_mismatch, signals_mismatch = engine.compute_content_relevance(campaign_text, creator_mismatch)

    assert score_match > score_mismatch
    assert score_match >= 50.0
    assert len(signals_match) > 0


def test_engine_missing_demographics_handling():
    engine = BrandFitEngine()

    # Empty demographics
    score, signals, missing = engine.compute_audience_affinity({}, {})
    assert len(missing) == 2
    assert "Campaign target demographics not specified" in missing
    assert "Creator audience demographics not reported" in missing
    assert score == 50.0  # Safe default baseline


def test_authenticity_heuristics_caution_and_disclaimer():
    engine = BrandFitEngine()

    # Suspicious anomaly: 1 million followers with 25% engagement rate (statistically aberrant)
    score, signals, cautions = engine.compute_authenticity_heuristics(95.0, 1_000_000, 25.0)
    assert len(cautions) > 0
    assert "potential viral spike or engagement pod" in cautions[0]
    assert score < 95.0


@pytest.mark.asyncio
async def test_recommendations_endpoint_workflow(client: AsyncClient):
    # Register brand
    b_res = await client.post("/api/v1/auth/register", json={
        "email": "brand.ai@test.com",
        "password": "Password123!",
        "full_name": "AI Vision Studio",
        "role": "brand",
        "company_name": "AI Vision Studio",
        "industry": "Tech & AI",
    })
    brand_token = b_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {brand_token}"}

    # Register two creators: one matching tech, one in cooking
    await client.post("/api/v1/auth/register", json={
        "email": "tech.c@test.com",
        "password": "Password123!",
        "full_name": "Tech Reviewer",
        "role": "creator",
        "handle": "@tech_hero",
        "primary_niche": "Tech & AI",
    })
    await client.post("/api/v1/auth/register", json={
        "email": "baker.c@test.com",
        "password": "Password123!",
        "full_name": "Artisan Baker",
        "role": "creator",
        "handle": "@artisan_baker",
        "primary_niche": "Food & Baking",
    })

    # Create Tech Campaign
    c_res = await client.post("/api/v1/campaigns/", json={
        "title": "Machine Learning IDE Benchmark",
        "description": "Reviews of real-time copilot completions and latency benchmarks.",
        "budget": 3000.0,
        "deliverables": ["1x Benchmark video"],
        "niche": "Tech & AI",
        "target_audience": {"age_groups": ["18-24", "25-34"], "countries": ["US"]},
    }, headers=headers)
    campaign_id = c_res.json()["id"]

    # Request recommendations
    rec_res = await client.get(f"/api/v1/recommendations/campaign/{campaign_id}", headers=headers)
    assert rec_res.status_code == 200
    rec_data = rec_res.json()

    assert rec_data["total_analyzed"] >= 2
    recommendations = rec_data["recommendations"]
    assert len(recommendations) >= 2

    # Top recommended creator should be the tech reviewer
    top_rec = recommendations[0]
    assert top_rec["creator"]["primary_niche"] == "Tech & AI"
    assert top_rec["overall_match_score"] >= recommendations[1]["overall_match_score"]

    # Verify explainability structure
    breakdown = top_rec["signal_breakdown"]
    assert "content_relevance_score" in breakdown
    assert "audience_affinity_score" in breakdown
    assert "engagement_quality_score" in breakdown
    assert "authenticity_heuristic_score" in breakdown
    assert len(breakdown["signals_used"]) > 0

    explanation = top_rec["explanation"]
    assert "summary" in explanation
    assert len(explanation["strengths"]) > 0
    assert "not definitive proof of fraudulent activity" in explanation["authenticity_disclaimer"]

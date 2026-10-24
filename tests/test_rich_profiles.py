import pytest
from app.models.entities import CreatorProfile, User, UserRole
from app.schemas.creator import CreatorProfileCreate, CreatorProfileOut, CreatorProfileUpdate


def test_creator_profile_rich_fields_model():
    profile = CreatorProfile(
        user_id=999,
        handle="@test_creator",
        display_name="Test Creator",
        primary_niche="technology",
        profile_url="https://youtube.com/@test_creator",
        audience_description="Engineers and developers",
        avg_likes=12000,
        avg_comments=450,
        avg_views=65000,
        brand_suitability={
            "safety_level": "brand_safe",
            "sponsored_content_ratio": 0.20,
            "family_friendly": True,
            "suitability_tags": ["Tech", "SaaS"],
        },
        content_categories=["Consumer Electronics", "AI Tools"],
        past_campaigns_count=5,
        on_time_delivery_rate=100.0,
        delivery_history=[
            {"campaign_title": "Launch Alpha", "status": "COMPLETED", "on_time": True}
        ],
    )

    assert profile.profile_url == "https://youtube.com/@test_creator"
    assert profile.avg_likes == 12000
    assert profile.avg_comments == 450
    assert profile.avg_views == 65000
    assert profile.brand_suitability["safety_level"] == "brand_safe"
    assert "AI Tools" in profile.content_categories
    assert profile.past_campaigns_count == 5
    assert profile.on_time_delivery_rate == 100.0
    assert len(profile.delivery_history) == 1


def test_creator_profile_missing_fields_preserved_as_none():
    """Verify missing metrics remain None and are NOT fabricated or defaulted to fake numbers."""
    profile = CreatorProfile(
        user_id=1000,
        handle="@sparse_creator",
        display_name="Sparse Creator",
        primary_niche="fashion",
        total_followers=5000,
        avg_likes=None,
        avg_comments=None,
        avg_views=None,
        on_time_delivery_rate=None,
        profile_url=None,
        audience_description=None,
    )

    assert profile.avg_likes is None
    assert profile.avg_comments is None
    assert profile.avg_views is None
    assert profile.on_time_delivery_rate is None
    assert profile.profile_url is None
    assert profile.audience_description is None


def test_calculate_completeness_incorporates_rich_fields():
    profile = CreatorProfile(
        user_id=1001,
        handle="@complete_creator",
        display_name="Complete Creator",
        bio="Detailed biography about fashion and sustainability over 20 chars.",
        primary_niche="fashion",
        profile_image_url="https://example.com/avatar.jpg",
        content_categories=["Sustainable Fashion", "Vintage"],
        supported_platforms=["instagram"],
        collaboration_preferences={"location": "New York"},
        language="English",
        audience_description="Urban fashion seekers",
    )

    completeness = profile.calculate_completeness()
    assert completeness["score"] == 100
    assert len(completeness["missing_fields"]) == 0


def test_creator_profile_update_schema_camel_case():
    update = CreatorProfileUpdate(
        profileUrl="https://instagram.com/my_feed",
        audienceDescription="Fitness lovers",
        avgLikes=5000,
        avgComments=250,
        avgViews=40000,
        contentCategories=["Gym", "CrossFit"],
    )

    assert update.profile_url == "https://instagram.com/my_feed"
    assert update.audience_description == "Fitness lovers"
    assert update.avg_likes == 5000
    assert update.avg_comments == 250
    assert update.avg_views == 40000
    assert update.content_categories == ["Gym", "CrossFit"]

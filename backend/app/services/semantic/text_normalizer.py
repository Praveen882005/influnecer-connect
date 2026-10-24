"""
Text normalization and content composition pipeline for Phase 14: Semantic Content Understanding.

Provides deterministic cleaning, Unicode normalization, hashtag tokenization,
and caption deduplication for creator profiles and campaign briefs.
"""

import html
import re
import unicodedata
from typing import Any, Dict, List, Optional, Set


# Regex patterns for cleaning
URL_PATTERN = re.compile(r"https?://\S+|www\.\S+", re.IGNORECASE)
MENTION_PATTERN = re.compile(r"@\w+")
CONTROL_CHAR_PATTERN = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]")
WHITESPACE_PATTERN = re.compile(r"\s+")
CAMEL_CASE_PATTERN = re.compile(
    r"(?<=[a-zA-Z])(?=[0-9])|(?<=[0-9])(?=[a-zA-Z])|(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])"
)


def clean_unicode_and_whitespace(text: Optional[str]) -> str:
    """
    Standardize text with NFKC Unicode normalization, HTML entity unescaping,
    removal of control characters and URLs, and collapsed whitespace.
    """
    if not text:
        return ""

    # Unescape HTML entities
    unescaped = html.unescape(text)

    # Unicode normalization (NFKC decomposes compatibility chars and standardizes accents)
    normalized = unicodedata.normalize("NFKC", unescaped)

    # Remove URLs and control characters
    no_urls = URL_PATTERN.sub(" ", normalized)
    no_control = CONTROL_CHAR_PATTERN.sub(" ", no_urls)

    # Collapse multiple whitespaces and newlines
    cleaned = WHITESPACE_PATTERN.sub(" ", no_control).strip()
    return cleaned


def normalize_hashtag(tag: str) -> str:
    """
    Normalizes a single hashtag:
    - Strips leading '#'
    - Splits camelCase (e.g. '#CleanSkincare' -> 'clean skincare')
    - Replaces underscores with spaces
    - Lowercases
    """
    if not tag:
        return ""

    raw = tag.lstrip("#").strip()
    if not raw:
        return ""

    # Split underscores
    with_spaces = raw.replace("_", " ")

    # Split camelCase
    split_words = CAMEL_CASE_PATTERN.sub(" ", with_spaces)

    cleaned = WHITESPACE_PATTERN.sub(" ", split_words).strip().lower()
    return cleaned


def normalize_hashtags(hashtags: Optional[List[str]]) -> List[str]:
    """
    Normalizes a list of hashtags, tokenizing camelCase and removing duplicates
    while preserving discovery order.
    """
    if not hashtags:
        return []

    seen: Set[str] = set()
    cleaned_tags: List[str] = []

    for tag in hashtags:
        cleaned = normalize_hashtag(tag)
        if cleaned and len(cleaned) > 1 and cleaned not in seen:
            seen.add(cleaned)
            cleaned_tags.append(cleaned)

    return cleaned_tags


def deduplicate_captions(captions: Optional[List[str]]) -> List[str]:
    """
    Cleans and deduplicates a list of post captions.
    Detects repeated exact captions, promotional boilerplates, and duplicate posts.
    Preserves chronological / original order of unique posts.
    """
    if not captions:
        return []

    seen_hashes: Set[str] = set()
    unique_captions: List[str] = []

    for cap in captions:
        cleaned = clean_unicode_and_whitespace(cap)
        if not cleaned:
            continue

        # Use normalized lowercase representation for deduplication key
        norm_key = cleaned.lower()
        if norm_key not in seen_hashes:
            seen_hashes.add(norm_key)
            unique_captions.append(cleaned)

    return unique_captions


def compose_creator_text(
    display_name: Optional[str] = None,
    bio: Optional[str] = None,
    niches: Optional[List[str]] = None,
    captions: Optional[List[str]] = None,
    hashtags: Optional[List[str]] = None,
    audience_description: Optional[str] = None,
    content_categories: Optional[List[str]] = None,
    brand_suitability_tags: Optional[List[str]] = None,
    max_captions: int = 15,
) -> str:
    """
    Composes a unified semantic corpus for a creator profile.
    Integrates bio, niche keywords, deduplicated post captions, normalized hashtags,
    audience descriptions, content categories, and brand suitability tags.
    """
    sections: List[str] = []

    if display_name:
        clean_name = clean_unicode_and_whitespace(display_name)
        if clean_name:
            sections.append(f"Creator: {clean_name}")

    if bio:
        clean_bio = clean_unicode_and_whitespace(bio)
        if clean_bio:
            sections.append(f"Bio: {clean_bio}")

    if niches:
        clean_niches = [clean_unicode_and_whitespace(n).lower() for n in niches if n]
        if clean_niches:
            sections.append(f"Niches: {', '.join(clean_niches)}")

    if content_categories:
        clean_cats = [clean_unicode_and_whitespace(c).lower() for c in content_categories if c]
        if clean_cats:
            sections.append(f"Content Categories: {', '.join(clean_cats)}")

    if audience_description:
        clean_aud = clean_unicode_and_whitespace(audience_description)
        if clean_aud:
            sections.append(f"Audience Profile: {clean_aud}")

    if brand_suitability_tags:
        clean_tags = [clean_unicode_and_whitespace(t).lower() for t in brand_suitability_tags if t]
        if clean_tags:
            sections.append(f"Brand Suitability: {', '.join(clean_tags)}")

    if captions:
        deduped = deduplicate_captions(captions)[:max_captions]
        if deduped:
            sections.append("Recent Content: " + " | ".join(deduped))

    if hashtags:
        norm_tags = normalize_hashtags(hashtags)
        if norm_tags:
            sections.append(f"Keywords: {', '.join(norm_tags[:30])}")

    full_text = "\n".join(sections).strip()
    return full_text


def compose_campaign_text(
    title: str,
    niche: str,
    description: str,
    product_description: Optional[str] = None,
    objective: Optional[str] = None,
    target_audience: Optional[Dict[str, Any]] = None,
    deliverables: Optional[List[str]] = None,
    platform: Optional[str] = None,
    language: Optional[str] = None,
) -> str:
    """
    Composes a unified semantic corpus for a marketing campaign brief.
    """
    sections: List[str] = []

    clean_title = clean_unicode_and_whitespace(title)
    if clean_title:
        sections.append(f"Campaign: {clean_title}")

    clean_niche = clean_unicode_and_whitespace(niche).lower()
    if clean_niche:
        sections.append(f"Primary Niche: {clean_niche}")

    if objective:
        clean_obj = clean_unicode_and_whitespace(objective)
        if clean_obj:
            sections.append(f"Objective: {clean_obj}")

    clean_desc = clean_unicode_and_whitespace(description)
    if clean_desc:
        sections.append(f"Brief: {clean_desc}")

    if product_description:
        clean_prod = clean_unicode_and_whitespace(product_description)
        if clean_prod:
            sections.append(f"Product Description: {clean_prod}")

    if platform:
        clean_plat = clean_unicode_and_whitespace(platform)
        if clean_plat:
            sections.append(f"Target Platform: {clean_plat}")

    if language:
        clean_lang = clean_unicode_and_whitespace(language)
        if clean_lang:
            sections.append(f"Content Language: {clean_lang}")

    if target_audience and isinstance(target_audience, dict):
        aud_parts = []
        for k, v in target_audience.items():
            if v:
                aud_parts.append(f"{k}: {v}")
        if aud_parts:
            sections.append("Target Audience: " + ", ".join(aud_parts))

    if deliverables and isinstance(deliverables, list):
        clean_deliv = [clean_unicode_and_whitespace(d) for d in deliverables if d]
        if clean_deliv:
            sections.append("Deliverables: " + ", ".join(clean_deliv))

    return "\n".join(sections).strip()

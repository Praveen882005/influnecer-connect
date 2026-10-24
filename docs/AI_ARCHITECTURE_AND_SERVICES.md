# BRAND BRIDGE — AI & Intelligence Architecture Reference

This document serves as the comprehensive architectural and operational reference for all AI, Machine Learning, and Analytical Intelligence services integrated into **Brand Bridge** through the 10-Phase Enhancement Roadmap.

---

## 1. Architectural Principles & Global Governance

Every analytical and algorithmic service adheres to strict ethical and engineering standards:

1. **Non-Fabrication**: Under no circumstances does the system fabricate creator statistics, audience scale, sales projections, fraud classifications, or AI capabilities.
2. **Explicit Uncertainty & Missing Data Transparency**: Missing metrics or unimported fields are explicitly rendered as `None` / `"Unavailable"`, never silently substituted with synthetic zeros or fake values.
3. **Non-Penalization Mandate**: Creators with sparse histories or zero past campaigns receive an `"insufficient_evidence"` / `"no_prior_history"` status and are omitted from score denominators rather than unfairly penalized.
4. **Domain Separation**:
   - **Campaign Suitability**: Semantic overlap, platform fit, and audience demographics.
   - **Trustworthiness**: Longitudinal consistency, peer-relative engagement, delivery track record, and data freshness.
   - **Fraud Risk**: Evidence-based anomalies (interaction asymmetry, ghost follower saturation, sudden growth velocity, duplicate caption spam).
5. **Human Marketer Agency**: Algorithmic review signals are presented as heuristics to guide human marketers. Automated account exclusion or labeling creators as fraudsters based solely on algorithmic heuristics is strictly prohibited.
6. **Machine Learning Model Disclosure**: Supervised predictive regression models (e.g., sales forecasting) and supervised fraud classifiers require ground-truth verified datasets ($n \ge 30$ completed campaigns) before activation. When data is below threshold, status is transparently disclosed as `WITHHELD`.

---

## 2. Core Subsystems & Services Overview

```
Brand Bridge Core Intelligence
├── 1. Semantic Embedding & NLP Pipeline
│   ├── Pretrained Model: Sentence-Transformers (all-MiniLM-L6-v2, 384-dim)
│   ├── Unicode NFKC Normalization & Noise Stripping
│   ├── Dense Vector Caching with SHA-256 Keying
│   └── Multi-Directional Semantic Matching (Brand-to-Creator & Creator-to-Brand)
│
├── 2. Sales Potential & Campaign Forecaster
│   ├── Deterministic Mathematical Outcome Formulas
│   ├── Multi-Variable Scenarios: Conservative, Baseline, Optimistic
│   ├── Campaign Actuals Logging & Variance Analysis
│   └── Supervised Regression Guard (Threshold n >= 30)
│
├── 3. Influencer Trustworthiness Service
│   ├── Indicator 1: Engagement Consistency (Variance & CV)
│   ├── Indicator 2: Peer-Relative Engagement (Tier Benchmarking)
│   ├── Indicator 3: Thematic Content Focus & Coherence
│   ├── Indicator 4: Verified Campaign Milestone Delivery History
│   └── Indicator 5: Data Freshness & Profile Completeness
│
└── 4. Influencer Fraud-Risk & Anomaly Auditor
    ├── Tri-Partite Separation: Observed Facts, Indicators, Heuristic Warnings
    ├── Like-to-Comment Interaction Asymmetry (>250:1)
    ├── Ghost Follower Activity (<0.1% engagement rate on >50k accounts)
    ├── Longitudinal Follower Growth Velocity Surge (>50% surge on >=2 snapshots)
    └── Duplicate Templated Caption Detection (>=50% identical captions)
```

---

## 3. Detailed Subsystem Specifications

### 3.1 Semantic Content Understanding & Matching (Phases 3 & 4)

- **Embedding Model**: `sentence-transformers/all-MiniLM-L6-v2`
- **Dimensionality**: 384-dimensional unit-normalized L2 vectors ($||\vec{v}|| = 1.0$)
- **Similarity Metric**: Cosine Similarity:
  $$\text{Cosine Similarity}(\vec{u}, \vec{v}) = \frac{\vec{u} \cdot \vec{v}}{||\vec{u}|| \cdot ||\vec{v}||}$$
- **Scoring Breakdown**:
  1. *Content Semantic Relevance* (40%): Vector cosine similarity between campaign brief and creator profile/content.
  2. *Engagement Quality* (25%): Tier-normalized median engagement comparison.
  3. *Audience Demographic Affinity* (25%): Age, gender, and geographic alignment.
  4. *Authenticity Heuristic* (10%): Comment ratio and profile completeness factor.
- **Hard Constraints**: Evaluated independently prior to ranking. Creators failing hard criteria (e.g., minimum followers, platform requirements, budget threshold) are marked `is_eligible=False` with explicit disqualification explanations.

### 3.2 Sales Potential & Outcome Forecasting (Phase 5)

All scenario projections are calculated deterministically using transparent mathematical formulas:

$$\begin{aligned}
\text{Estimated Clicks} &= \text{Impressions} \times \left(\frac{\text{CTR}}{100}\right) \\
\text{Estimated Conversions} &= \text{Estimated Clicks} \times \left(\frac{\text{CVR}}{100}\right) \\
\text{Estimated Gross Revenue} &= \text{Estimated Conversions} \times \text{AOV} \\
\text{Estimated Net Profit} &= \text{Estimated Gross Revenue} - \text{Campaign Cost} \\
\text{Estimated ROI (\%)} &= \left(\frac{\text{Estimated Gross Revenue} - \text{Campaign Cost}}{\text{Campaign Cost}}\right) \times 100 \\
\text{Estimated CPC} &= \frac{\text{Campaign Cost}}{\text{Estimated Clicks}} \\
\text{Estimated CPA} &= \frac{\text{Campaign Cost}}{\text{Estimated Conversions}}
\end{aligned}$$

#### Multi-Variable Scenarios
- **Conservative**: Multi-variable stress-test dampening ($-25\%$ reach, $-30\%$ CTR, $-30\%$ CVR, $-10\%$ AOV) with budget fixed at $100\%$.
- **Baseline**: 1.0x input assumptions or verified historical brand averages.
- **Optimistic**: Viral resonance boost ($+40\%$ reach, $+40\%$ CTR, $+35\%$ CVR, $+10\%$ AOV) with budget fixed at $100\%$.

### 3.3 Influencer Trustworthiness Analysis (Phase 6)

Evaluates 5 supported indicators:
1. **Engagement Consistency**: Coefficient of variation ($\text{CV} = \sigma / \mu$) across recent post interactions. $\text{CV} \le 0.45 \to$ Highly Consistent; $\text{CV} \ge 0.95 \to$ Variable. Requires $\ge 3$ posts.
2. **Peer-Relative Engagement**: Follower tier benchmarking (Nano, Micro, Mid-Tier, Macro, Mega).
3. **Thematic Content Focus**: Coherence of keywords, primary niche, and content categories.
4. **Campaign Delivery Track Record**: Percentage of verified on-time deliverable milestones. Creators with 0 past campaigns receive `no_prior_history` and are excluded from the score denominator.
5. **Data Freshness & Completeness**: Metric sync freshness window ($\le 30$ days) and profile checklist completion score.

### 3.4 Influencer Fraud-Risk & Anomaly Auditor (Phase 7)

- **Search Resolution**: Resolves target creators via handle (`@username` or `username`), profile URL (`instagram.com/username`), or catalog ID.
- **Tri-Partite Reporting**:
  1. *Observed Facts*: Empirical raw measurements without inference (Followers, Following, Ingested Posts, Snapshots).
  2. *Calculated Indicators*: Mathematical ratios compared to organic benchmarks (Like-to-Comment Ratio, Follower-Following Ratio).
  3. *Heuristic Anomaly Signals*: Specific review signals (Asymmetry, Ghost Followers, Growth Surge, Duplicate Captions) with findings, limitations, and recommended human verification steps.
- **Manual Checklist**: Actionable steps for human marketers before committing capital.

---

## 4. API Endpoints Reference

| Endpoint | Method | Role | Description |
| :--- | :---: | :---: | :--- |
| `/api/v1/recommendations/campaign/{id}` | GET | Brand | Ranked AI creator recommendations with 4-signal breakdown |
| `/api/v1/recommendations/match-brief` | POST | Brand | Natural language campaign brief semantic matching |
| `/api/v1/opportunities` | GET | Creator | Personalized AI campaign opportunity feed |
| `/api/v1/opportunities/{id}/explain` | GET | Creator | Explainable AI fit score and 4-signal progress bars |
| `/api/v1/forecasting/calculate` | POST | All | Stateless scenario projection calculation |
| `/api/v1/forecasting/benchmark` | GET | Brand | Verified historical benchmarks and predictive model status |
| `/api/v1/forecasting/campaign/{id}` | GET/POST | Brand | Campaign forecasting context and snapshot saving |
| `/api/v1/forecasting/campaign/{id}/actual` | POST | Brand | Post-campaign actual outcome logging & variance analysis |
| `/api/v1/analytics/creator/{id}/trust` | GET | Brand | 5-indicator creator trustworthiness audit report |
| `/api/v1/fraud/search` | POST | Brand | Multi-mode search and fraud risk audit generation |
| `/api/v1/fraud/creator/{id}` | GET | Brand | Direct creator fraud risk analysis by catalog ID |

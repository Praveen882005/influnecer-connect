# Phase 17 — Campaign Analytics Architecture & Verification

## 1. Overview & Architecture

Brand Bridge Phase 17 implements production-grade, event-driven campaign analytics for both brands and influencers. All metrics are computed strictly from real, persisted application data (campaigns, shortlists, invitations, notifications, and interaction events).

### System Principles
1. **Zero Fabrication**: Metrics reflect actual state changes logged in the database.
2. **Strict Separation of Platform Activity vs. Social Performance**: The platform measures invitation workflows, responses, and candidate progression. It **does not claim external ROI, conversions, or sales attribution** without verified tracking pixels or affiliate integration.
3. **Defense-in-Depth CSV Security**: Authorized streaming CSV exports enforce RFC 4180 escaping and prefix neutralization against Formula Injection (`=`, `+`, `-`, `@`, `\t`, `\r`).
4. **Accessible Visualizations**: Front-end dashboards utilize Recharts with responsive SVG containers, high-contrast palette tokens, accessible tooltip labels, and robust empty states.

---

## 2. API Endpoints & Capabilities

| Endpoint | Method | Role | Description |
|---|---|---|---|
| `/api/v1/analytics/brand` | `GET` | Brand | Aggregates active campaigns, invitation counts, 5-stage participation funnel, and daily activity timeline. Accepts `campaign_id`, `start_date`, and `end_date` query filters. |
| `/api/v1/analytics/brand/export` | `GET` | Brand | Streams an RFC 4180 CSV export of candidate outreach and response history with formula injection mitigation. |
| `/api/v1/analytics/creator` | `GET` | Creator | Computes brief discovery numbers, invitation response rates, total earned compensation, profile freshness, and activity history. |
| `/api/v1/analytics/creator/export` | `GET` | Creator | Streams an RFC 4180 CSV export of creator collaboration history and earnings. |

---

## 3. Mathematical Formulations & Funnel Logic

### 3.1 5-Stage Participation Funnel
The brand participation funnel tracks unique creator progression through campaign collaboration milestones:

$$\text{Shortlist-to-Invite \%} = \left(\frac{\text{Stage 2 (Invited)}}{\text{Stage 1 (Shortlisted)}}\right) \times 100$$

$$\text{Invite-to-View \%} = \left(\frac{\text{Stage 3 (Viewed)}}{\text{Stage 2 (Invited)}}\right) \times 100$$

$$\text{View-to-Response \%} = \left(\frac{\text{Stage 4 (Responded)}}{\text{Stage 3 (Viewed)}}\right) \times 100$$

$$\text{Response-to-Confirm \%} = \left(\frac{\text{Stage 5 (Confirmed)}}{\text{Stage 4 (Responded)}}\right) \times 100$$

- **Stage 1 (Shortlisted)**: Unique creators added to campaign shortlists.
- **Stage 2 (Invited)**: Unique creators sent a formal invitation.
- **Stage 3 (Viewed)**: Unique creators who reviewed invitation details (status $\in \{\text{'viewed'}, \text{'accepted'}, \text{'declined'}\}$).
- **Stage 4 (Responded)**: Unique creators who submitted a formal decision (status $\in \{\text{'accepted'}, \text{'declined'}\}$).
- **Stage 5 (Confirmed)**: Unique creators who accepted the terms and confirmed participation.

### 3.2 Rates & Response Times
- **Response Rate**:
  $$\text{Response Rate} = \left(\frac{\text{Accepted} + \text{Declined}}{\text{Total Invitations Sent}}\right) \times 100$$
- **Acceptance Rate**:
  $$\text{Acceptance Rate} = \left(\frac{\text{Accepted}}{\text{Accepted} + \text{Declined}}\right) \times 100$$
- **Average Response Time**:
  $$\text{Avg Hours} = \frac{1}{N}\sum_{i=1}^{N} \frac{\text{RespondedAt}_i - \text{SentAt}_i}{3600}$$

### 3.3 Creator Profile Freshness & Completeness
Evaluates data freshness based on `last_fetched_at` or `updated_at`:
- **Fresh**: $\le 30$ days old.
- **Stale**: $> 30$ days old.
- **Completeness Score (0–100%)**: Evaluates availability of handle, bio, niche, follower metrics, engagement rate, demographics, keywords, and verification.

---

## 4. CSV Formula Injection Mitigation (RFC 4180)

Spreadsheet applications (Excel, Google Sheets, LibreOffice) can execute formulas when cells begin with sensitive characters. To protect users against malicious creator handles or campaign titles:

```python
def _sanitize_csv_cell(val: Any) -> str:
    s = str(val or "")
    if s and s[0] in ("=", "+", "-", "@", "\t", "\r"):
        return f"'{s}"
    return s
```

Any cell starting with `=, +, -, @, \t, \r` is prefixed with a single quote (`'`), rendering it as benign literal text.

---

## 5. Frontend Visualizations (Recharts)

The frontend integrates Recharts for accessible, responsive analytics:

- **Brand Analytics Dashboard (`BrandAnalyticsPage.tsx`)**:
  - Horizontal conversion funnel bar chart with custom tooltips showing stage-to-stage conversion rates.
  - Daily activity area chart tracking invites sent vs accepted over time.
  - KPI stat cards with trend indicators.
  - Campaign scoping dropdown and time range selector (`7d`, `30d`, `90d`, `All Time`).
  - RFC 4180 CSV export download trigger.
  - Platform vs. social performance transparency disclaimer banner.

- **Influencer Activity Dashboard (`InfluencerActivityPage.tsx`)**:
  - Donut pie chart representing invitation response outcomes (Accepted, Pending, Declined, Expired).
  - Opportunity discovery bar chart (Eligible briefs vs Saved briefs vs Dismissed).
  - Partnerships count and earned compensation metrics.
  - Profile data freshness and completeness indicator badge.
  - Collaboration outreach log table with status badges and CSV export.

---

## 6. Verification Results

### 6.1 Backend Automated Tests (`tests/test_campaign_analytics.py`)
- `test_brand_analytics_calculations_and_funnel`: **PASS**
- `test_brand_analytics_campaign_and_date_filtering`: **PASS**
- `test_brand_csv_export_and_formula_injection_mitigation`: **PASS**
- `test_creator_analytics_and_export`: **PASS**
- `test_analytics_rbac_and_cross_user_isolation`: **PASS**
- **Total Suite Passing**: **152 / 152 tests (100%)**

### 6.2 Frontend Vitest & TypeScript Build
- TypeScript (`tsc -b`): **Zero errors**
- Vite Production Bundle: **Built successfully in 17.11s**
- Vitest Component Suite: **4 test files, 30 tests passing (100%)**

### 6.3 Live End-to-End Daemon Verification (`scripts/verify_campaign_analytics.py`)
- Live Brand & Creator accounts created.
- Campaign, shortlist, invitation, opportunity save, and acceptance executed.
- Live funnel metrics and rates verified against database.
- Streaming CSV exports with RFC 4180 headers and `@` formula escape verified.
- Cross-role access control verified (HTTP 403 / 401).

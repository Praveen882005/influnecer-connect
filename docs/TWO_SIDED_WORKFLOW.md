# Two-Sided Workflow Architecture & Specification (Phase 16)

This document details the implementation, state machines, transactional behaviors, authorization rules, and transparency disclaimers for the Brand Bridge two-sided collaboration workflow.

---

## 1. Overview & Core Entities

Phase 16 connects brands and creators through an interactive, authenticated lifecycle:
1. **Brand Campaign Shortlists**: Pipeline tracking (`considering`, `contacted`, `invited`, `negotiating`, `confirmed`, `declined`, `archived`) with confidential internal evaluation notes.
2. **Direct Campaign Invitations**: Official brand outreach specifying proposed compensation ($ USD), requested deliverables scope, expiration window, and custom pitch messages.
3. **Creator Opportunities Feed**: Discovery surface for eligible creators featuring transparent, explainable AI fit scores, match strengths, save/dismiss controls, and direct invitation links.
4. **Persistent In-App Notifications**: Real-time delivery of workflow alerts with read/unread tracking and transparent provider disclosures.

---

## 2. Documented State Machines

### 2.1 Invitation State Machine

```
                   [Brand Sends]
                         │
                         ▼
                     ┌───────┐
                     │ SENT  │
                     └───┬───┘
                         │ (Creator reviews detail)
                         ▼
                    ┌────────┐
                    │ VIEWED │
                    └───┬────┘
           ┌────────────┼────────────┐
 (Creator  │   (Creator │     (Brand │
  Accepts) │   Declines)│    Cancels)│ (Window passes)
           ▼            ▼            ▼            ▼
     ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐
     │ ACCEPTED │ │ DECLINED │ │ CANCELED │ │ EXPIRED │
     └──────────┘ └──────────┘ └──────────┘ └─────────┘
      (Terminal)   (Terminal)   (Terminal)   (Terminal)
```

- **Initial State**: `sent` (or `pending`).
- **Intermediate State**: `viewed` (automatically triggered when the invited creator inspects the invitation details).
- **Terminal States**: `accepted`, `declined`, `canceled`, `expired`.
- **Terminal Guard**: Once an invitation transitions into any terminal state, all further status update attempts are rejected with `HTTP 400 Bad Request` ("Cannot change status of a finalized invitation").
- **Expiration Policy**: Evaluated on retrieval and state mutation. If `expires_at < utcnow()`, status immediately resolves to `expired` and mutation is blocked.

### 2.2 Shortlist Status Pipeline

- `considering` $\rightarrow$ `contacted` $\rightarrow$ `invited` $\rightarrow$ `negotiating` $\rightarrow$ `confirmed` | `declined` | `archived`.
- **Transactional Synchronization**:
  - When a brand sends an invitation, the corresponding shortlist record is automatically created or transitioned to `invited`.
  - When a creator accepts an invitation, the corresponding shortlist record is updated to `confirmed`.
  - When a creator declines an invitation, the shortlist status transitions to `declined`.
  - When a brand cancels an invitation, the shortlist status transitions to `archived`.

---

## 3. Duplicate-Action Protection & Ownership Rules

1. **Duplicate Invitation Prevention**:
   - The backend checks for active, non-terminal invitations (`sent`, `viewed`, `pending`) for the same `(campaign_id, creator_id)`.
   - Attempting to issue a duplicate active invitation returns `HTTP 400 Bad Request` ("An active invitation for this creator and campaign is already pending").
2. **Strict Role & Ownership Authorization**:
   - **Campaign Ownership**: Only the brand that created a campaign can invite creators or cancel existing invitations.
   - **Creator Authorization**: Only the recipient creator can view private invitation messages, accept, or decline with a reason. Cross-user response attempts return `HTTP 403 Forbidden`.
   - **Shortlist Isolation**: Brands cannot view, modify, or delete another brand's private shortlist or evaluation notes.
   - **In-App Notification Security**: Notifications are scoped strictly to `current_user.id`. Marking another user's notifications as read returns `HTTP 404 Not Found`.

---

## 4. In-App Notification System & Provider Disclosure

- **Persistent In-App Storage**: Notifications are persisted in SQLite/PostgreSQL with `is_read`, `read_at`, `notification_type`, and metadata payload.
- **Provider Transparency Notice**:
  > [!NOTE]
  > **Delivery Disclaimer**: Persistent in-app notification delivery is active. External SMS and email alerts are explicitly disabled until production provider API keys (Twilio, SendGrid/Postmark) are configured and verified.

---

## 5. Automated Verification Results

- **Backend Pytest Suite**: 147 tests passed (100% pass rate).
- **Frontend Vitest Suite**: 30 tests passed (100% pass rate).
- **Frontend Production Build**: `tsc -b && vite build` clean with 0 TypeScript errors.
- **End-to-End Browser Journey Script** (`scripts/verify_two_sided_journey.py`):
  1. Brand registration & authentication.
  2. Influencer registration & authentication.
  3. Brand campaign creation & publishing.
  4. Brand shortlist creation with private evaluation notes.
  5. Brand direct invitation creation with deliverables & fee.
  6. Creator in-app notification delivery.
  7. Creator opportunity discovery & AI fit score calculation.
  8. Creator review of invitation & auto-transition to `viewed`.
  9. Creator acceptance with response timestamp.
  10. Brand shortlist confirmation and acceptance notification synchronization.
  11. State machine terminal guard validation.

---

## 6. Security Limitations & Scope Disclaimers

> [!WARNING]
> This phase implements rigorous application-level authorization, role-based access control (RBAC), and state machine enforcement. It does **not** constitute a full third-party security or cryptographic audit. External rate limiting should be reinforced at reverse-proxy or API-gateway layers (e.g. Nginx, Cloudflare) for high-scale DDoS protection.

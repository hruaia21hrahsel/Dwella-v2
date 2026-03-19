---
phase: 03-edge-functions-backend
verified: 2026-03-19T14:30:00Z
status: human_needed
score: 9/9 must-haves verified
human_verification:
  - test: "Confirm cron jobs are registered in Supabase dashboard pg_cron"
    expected: "auto-confirm-payments runs every hour, mark-overdue at midnight daily, send-reminders at 9 AM daily"
    why_human: "Cron schedule registration lives in the Supabase dashboard (pg_cron), not in any code file. config.toml contains no schedule entries. Cannot verify programmatically."
---

# Phase 03: Edge Functions Backend Verification Report

**Phase Goal:** All 12 deployed Edge Functions are verified against the Phase 2 confirmed DB contracts — each returns correct HTTP status codes, filters archived data, and executes its intended action reliably; scheduled cron jobs run on the correct schedules; the bot message flow completes end-to-end

**Verified:** 2026-03-19
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | send-push returns 400 for missing/invalid messages input, 502 for Expo API failure, 500 for unexpected errors | VERIFIED | Lines 6-11 (400), lines 27-34 (502), lines 40-46 (500) all present with Content-Type headers |
| 2  | invite-redirect error response is JSON `{ error: ... }` not plain text, and store URLs come from env vars with fallbacks | VERIFIED | Lines 20-23: `Deno.env.get('APPLE_APP_STORE_URL') ?? '...'`; lines 29-34: `JSON.stringify({ error: 'Missing invite token' })` |
| 3  | auto-confirm-payments and mark-overdue filter out archived tenants before processing | VERIFIED | auto-confirm: `is_archived` in select string (line 19) + `activePayments = ... .filter(!p.tenants?.is_archived)` (line 30); mark-overdue: `is_archived` in select (line 17) + combined filter (lines 30-32) |
| 4  | All 5 non-bot functions include Content-Type: application/json on every Response | VERIFIED | All Response constructors in send-push, invite-redirect, auto-confirm-payments, mark-overdue, send-reminders have the header on error paths; HTML response in invite-redirect correctly uses `text/html` |
| 5  | send-reminders isolates per-tenant errors with try/catch so one failure does not abort the batch | VERIFIED | Lines 58-108: `for (const tenant...) { try { ... } catch (err) { console.error(...send-reminders: failed for tenant ${tenant.id}...) } }` |
| 6  | process-bot-message validates Claude JSON response shape before executing any DB action handler | VERIFIED | Lines 36-46: `function isValidClaudeIntent(obj: unknown): obj is ClaudeIntent`; lines 521-531: guard applied before return in `callClaude()` |
| 7  | If Claude returns malformed JSON shape, the bot falls back to general_chat instead of crashing or corrupting data | VERIFIED | Lines 522-530: `if (!isValidClaudeIntent(parsed)) { return { intent: 'general_chat', ... } }`; lines 532-539: catch block also returns general_chat |
| 8  | ai-insights, ai-draft-reminders, and ai-search wrap JSON.parse of Claude responses in try/catch with structured error fallback | VERIFIED | ai-insights lines 151-159: inner try/catch with 502; ai-draft-reminders lines 136-147: try/catch sets `drafts = []`; ai-search lines 85-102: try/catch with 502 |
| 9  | ai-search validates filters.type before executing query branch | VERIFIED | Lines 88-95: `const validTypes = ['payments', 'tenants', 'properties']; if (!parsed || ... || !validTypes.includes(parsed.type)) { filters = { type: 'properties', ... } }` |

**Score:** 9/9 truths verified

---

### Required Artifacts

| Artifact | Provided | Status | Evidence |
|----------|----------|--------|----------|
| `supabase/functions/send-push/index.ts` | Hardened push dispatch with input validation and error handling | VERIFIED | 47-line file; `Array.isArray(messages)` at line 6, `status: 502` at line 31, `status: 500` at line 43 |
| `supabase/functions/invite-redirect/index.ts` | Env-var based store URLs with fallback | VERIFIED | `Deno.env.get('APPLE_APP_STORE_URL')` at line 20, `Deno.env.get('GOOGLE_PLAY_STORE_URL')` at line 22 |
| `supabase/functions/auto-confirm-payments/index.ts` | Soft-delete filtered auto-confirm with Content-Type headers | VERIFIED | `is_archived` in select at line 19, filter at line 30, Content-Type on 500 at line 25 |
| `supabase/functions/mark-overdue/index.ts` | Soft-delete filtered overdue marking with Content-Type headers | VERIFIED | `is_archived` in select at line 17, combined filter at lines 30-32, Content-Type on both 500 responses |
| `supabase/functions/send-reminders/index.ts` | Per-tenant error isolation in cron loop | VERIFIED | try/catch at lines 58-108 with `console.error(...send-reminders: failed for tenant...)` |
| `supabase/functions/process-bot-message/index.ts` | Claude response shape validation guard before action dispatch | VERIFIED | `isValidClaudeIntent` function at line 36, applied in `callClaude()` at line 521 |
| `supabase/functions/ai-insights/index.ts` | Safe JSON parsing of Claude response with try/catch | VERIFIED | Inner try/catch block at lines 151-159 returning 502 with `{ error: 'Failed to parse AI response' }` |
| `supabase/functions/ai-draft-reminders/index.ts` | Safe JSON parsing + array validation of Claude response | VERIFIED | `Array.isArray(parsed)` check at line 138; `drafts = []` fallback on both failure paths |
| `supabase/functions/ai-search/index.ts` | Safe JSON parsing + type validation of Claude filters | VERIFIED | `filters.type` validated against `validTypes` at line 89; parse failure returns 502 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `auto-confirm-payments/index.ts` | tenants table | soft-delete filter on joined tenants | WIRED | `is_archived` selected at line 19; `activePayments.filter(!p.tenants?.is_archived)` at line 30; `activePayments` used for ownerIds (line 34) and push loop (line 48) |
| `mark-overdue/index.ts` | tenants table | soft-delete filter on joined tenants | WIRED | `is_archived` selected at line 17; combined in single `.filter()` at lines 30-32: `p.tenants?.due_day < currentDay && !p.tenants?.is_archived` |
| `invite-redirect/index.ts` | env vars | `Deno.env.get` for store URLs | WIRED | `Deno.env.get('APPLE_APP_STORE_URL') ?? fallback` and `Deno.env.get('GOOGLE_PLAY_STORE_URL') ?? fallback`; both used in HTML template (lines 176, 183) and JavaScript block (line 197) |
| `process-bot-message/index.ts` | ACTION_HANDLERS dispatch | `isValidClaudeIntent` guard before handler lookup | WIRED | Guard at line 521 precedes `return parsed` at line 531; `ACTION_HANDLERS[result.intent]` lookup at line 594 only receives validated intents |
| `ai-insights/index.ts` | Claude API response | try/catch around JSON.parse | WIRED | `try { result = JSON.parse(jsonStr.trim()); } catch { ... return 502 }` at lines 151-159; inner catch is isolated from outer catch |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| EDGE-01 | 03-01-PLAN, 03-02-PLAN | All Edge Functions return appropriate HTTP status codes (400/404/500/503) | SATISFIED | send-push: 400/502/500; invite-redirect: 400 JSON; auto-confirm: 500; mark-overdue: 500x2; send-reminders: 500; process-bot-message: 400/500; ai-insights: 400/502/500; ai-draft-reminders: 400/500; ai-search: 400/502/500 |
| EDGE-02 | 03-01-PLAN | Scheduled functions verified with correct cron schedules and archived data filtering | PARTIAL — code logic verified, schedule registration requires human check | Soft-delete filters confirmed in code. Timing logic verified in research (3-day-before, on-day, 3-day-after). pg_cron schedule registration not in config.toml — requires dashboard verification |
| EDGE-03 | 03-02-PLAN | Bot action flow traced end-to-end | SATISFIED | Full path: telegram-webhook (Phase 2 hardened) → process-bot-message (isValidClaudeIntent guard) → ACTION_HANDLERS dispatch → DB mutation → reply. All 5 handlers (log_payment, confirm_payment, add_property, add_tenant, send_reminder) verified to execute with is_archived filtering |
| EDGE-05 | 03-01-PLAN | App Store / Play Store URLs replaced with env var reads | SATISFIED | invite-redirect lines 20-23: `Deno.env.get('APPLE_APP_STORE_URL') ?? '...'` and `Deno.env.get('GOOGLE_PLAY_STORE_URL') ?? '...'`; hardcoded fallbacks preserved for dev environments |

**Orphaned requirements check:** EDGE-04 is assigned to Phase 1 (Complete) per REQUIREMENTS.md traceability table. No Phase 3 plans claimed EDGE-04. No orphaned requirements for this phase.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `supabase/functions/invite-redirect/index.ts` | 17 | `TODO before launch: replace the placeholder store URLs below with real ones.` — comment left in file | Info | Cosmetic; harmless since URLs are now env-var configurable. Pre-launch checklist already tracks this. |

No blocker or warning-level anti-patterns found. All modified files contain substantive implementations. No `return null`, empty handlers, or placeholder returns found.

---

### Human Verification Required

#### 1. Cron Schedule Registration in pg_cron

**Test:** Log into Supabase dashboard for the production project. Navigate to Database > Extensions and confirm `pg_cron` is enabled. Navigate to Database > Cron Jobs and verify three jobs exist:
- `auto-confirm-payments` — schedule: `0 * * * *` (every hour)
- `mark-overdue` — schedule: `0 0 * * *` (daily midnight)
- `send-reminders` — schedule: `0 9 * * *` (daily 9 AM)

**Expected:** All three cron jobs are registered, enabled, and pointing to the correct Edge Function URLs for the production deployment.

**Why human:** Cron schedule registration for Supabase Edge Functions lives in the Supabase dashboard (pg_cron), not in any code file. The `supabase/config.toml` contains no `[functions.*.schedule]` entries. The code logic (timing calculations) was verified correct during research, but whether the functions are actually scheduled to run can only be confirmed in the dashboard. This was explicitly scoped as a manual step in the project's CONTEXT.md: "No health-check endpoints — actual pg_cron verification is a Supabase dashboard manual step."

---

### Gaps Summary

No code-level gaps. All 9 must-have truths are verified against actual file contents. All four commits (4684680, beedb2e, 5e2ec44, a5a37ff) are confirmed present in git log with the correct file changes.

The single outstanding item is the pg_cron schedule registration, which is a deployment-infrastructure check that cannot be done from code inspection alone. EDGE-02 is partially satisfied: the code logic (archived data filtering, timing calculations) is correct, but the scheduling mechanism requires human confirmation in the Supabase dashboard.

Once the human verification passes, all requirements (EDGE-01, EDGE-02, EDGE-03, EDGE-05) are fully closed for Phase 3.

---

_Verified: 2026-03-19_
_Verifier: Claude (gsd-verifier)_

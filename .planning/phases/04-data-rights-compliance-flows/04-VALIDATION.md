---
phase: 4
slug: data-rights-compliance-flows
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-06
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual verification + SQL assertions + Edge Function invocation |
| **Config file** | none — no test framework installed; validation via CLI commands |
| **Quick run command** | `supabase db reset && supabase functions serve` |
| **Full suite command** | `supabase db reset && supabase functions serve` then invoke endpoints |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `supabase db reset` to verify migration applies cleanly
- **After every plan wave:** Full reset + Edge Function smoke test
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | COMP-02 | — | FK changed from RESTRICT to SET NULL; anonymization trigger fires | migration | `supabase db reset` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | COMP-02 | — | BEFORE DELETE trigger anonymizes payment personal fields | migration | `supabase db reset` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 2 | COMP-01 | — | Delete Account button renders, type-DELETE confirmation works | manual | Visual inspection | N/A | ⬜ pending |
| 04-02-02 | 02 | 2 | COMP-01 | — | deletion_scheduled_at set on users row, session invalidated | integration | `curl` Edge Function | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 2 | COMP-04 | — | Export JSON contains all user data tables | integration | `curl` Edge Function | ❌ W0 | ⬜ pending |
| 04-04-01 | 04 | 3 | COMP-03 | — | Retention job deletes archived rows older than window | integration | `curl` Edge Function | ❌ W0 | ⬜ pending |
| 04-05-01 | 05 | 1 | COMP-07 | — | Users with NULL telegram_chat_id have zero data sent to Telegram | code review | `grep` telegram-webhook | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] No test framework to install — validation via `supabase db reset` and manual Edge Function invocation
- [ ] Migration files must apply cleanly on fresh reset

*Existing infrastructure covers all phase requirements via Supabase CLI commands.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Delete Account UX flow | COMP-01 | UI interaction requires visual verification | 1. Open profile screen 2. Scroll to Danger Zone 3. Tap Delete Account 4. Type "DELETE" 5. Confirm button activates 6. Tap confirm 7. Verify sign-out |
| Data export download | COMP-04 | File download requires device interaction | 1. Tap Export My Data 2. Wait for JSON generation 3. Verify browser opens signed URL 4. Verify JSON contains all tables |
| Telegram deletion message | COMP-01 | Requires Telegram chat to verify message delivery | 1. Link Telegram account 2. Request account deletion 3. Verify Telegram message received 4. Verify bot stops responding |

*All other behaviors have automated verification via migration reset or Edge Function invocation.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

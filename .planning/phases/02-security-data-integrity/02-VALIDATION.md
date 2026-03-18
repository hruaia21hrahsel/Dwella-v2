---
phase: 2
slug: security-data-integrity
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Deno test (Edge Functions) / manual SQL validation (migrations) |
| **Config file** | none — Wave 0 installs if needed |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npx tsc --noEmit && supabase db reset` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npx tsc --noEmit && supabase db reset`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | SEC-03 | migration | `supabase db reset` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | SEC-06 | migration | `supabase db reset` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | SEC-04 | integration | `curl -X POST (no secret) → 401` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 1 | SEC-05 | integration | `curl -X POST (bad HMAC) → 401` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 1 | SEC-01, SEC-02 | grep audit | `grep -r "Math.random" lib/ hooks/` | ✅ | ⬜ pending |
| 02-03-02 | 03 | 1 | DATA-01 | grep audit | `grep -rL "is_archived" hooks/ lib/` | ✅ | ⬜ pending |
| 02-04-01 | 04 | 2 | DATA-02, DATA-03, DATA-04 | migration | `supabase db reset` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] SQL migration files for RLS policy replacement (SEC-03)
- [ ] SQL migration for payment state machine trigger (SEC-06, DATA-02)
- [ ] Webhook auth validation code in Edge Functions (SEC-04, SEC-05)

*Existing TypeScript infrastructure covers audit-type tasks.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Supabase Security Advisor zero warnings | SEC-03 | Requires Supabase dashboard | Open Security Advisor in Supabase dashboard after migration |
| Telegram webhook re-registration | SEC-04 | Requires API call with secret_token | Call setWebhook with secret_token param, verify X-Telegram-Bot-Api-Secret-Token sent |
| WhatsApp webhook HMAC in production | SEC-05 | Requires Meta webhook secret | Send test event from Meta developer portal, verify 401 on tampered payload |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

---
phase: 03
slug: edge-functions-backend
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — no test framework in project (deferred to QUAL-01 post-launch) |
| **Config file** | None — Wave 0 gap |
| **Quick run command** | `npx tsc --noEmit` (app-level type check only) |
| **Full suite command** | `npx tsc --noEmit` + manual code-review verification |
| **Estimated runtime** | ~15 seconds (tsc only) |

---

## Sampling Rate

- **After every task commit:** Code-review verification (read modified function, confirm changes match intent)
- **After every plan wave:** `npx tsc --noEmit` on main app; manual review of each modified Edge Function
- **Before `/gsd:verify-work`:** All 12 functions reviewed and changes confirmed
- **Max feedback latency:** 15 seconds (tsc check)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-xx | 01 | 1 | EDGE-01 | code-review | `grep -n 'return new Response' {function}/index.ts` | N/A | ⬜ pending |
| 03-02-xx | 02 | 1 | EDGE-02 | code-review | `grep -n 'is_archived' {function}/index.ts` | N/A | ⬜ pending |
| 03-03-xx | 03 | 2 | EDGE-03 | code-review + manual | `grep -n 'isValidClaudeIntent\|intent.*entities' process-bot-message/index.ts` | N/A | ⬜ pending |
| 03-04-xx | 04 | 2 | EDGE-05 | code-review | `grep -n 'Deno.env.get' invite-redirect/index.ts` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing infrastructure covers basic verification (code review + tsc)
- No test framework installation needed for this phase
- Edge Function tests would require Deno test runner + Supabase local dev — deferred to QUAL-01

*Testing infrastructure for Edge Functions is deferred to post-launch per REQUIREMENTS.md QUAL-01*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cron schedules active in Supabase | EDGE-02 | pg_cron is dashboard-only | Check Supabase Dashboard → Database → Extensions → pg_cron for active jobs |
| Bot message end-to-end flow | EDGE-03 | Requires live Telegram bot + Claude API | Send test message via Telegram, verify DB action + reply |
| App Store deep link redirect | EDGE-05 | Requires deployed function + real device | Open invite-redirect URL on iOS/Android, verify redirect to store |
| App Store/Play Store URL validity | EDGE-05 | Only owner can verify | Check App Store Connect / Google Play Console for matching IDs |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

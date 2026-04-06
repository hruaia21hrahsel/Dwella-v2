---
phase: 3
slug: security-hardening
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-06
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual testing (no automated test framework exists) |
| **Config file** | none |
| **Quick run command** | Manual curl commands per function |
| **Full suite command** | Manual smoke test checklist (all 5 SEC-* curl tests) |
| **Estimated runtime** | ~60 seconds (manual execution) |

---

## Sampling Rate

- **After every task commit:** Run relevant curl test for the changed function
- **After every plan wave:** Run all 5 manual tests
- **Before `/gsd-verify-work`:** Full suite must pass
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | SEC-02 | T-3-02 | Malicious token in invite-redirect rejected with 400 | manual | `curl -s -o /dev/null -w "%{http_code}" "$INVITE_URL?token=</script><script>alert(1)</script>"` | N/A | ⬜ pending |
| 03-02-01 | 02 | 1 | SEC-01 | T-3-01 | Webhook rejects request without secret header with 401 | manual | `curl -s -o /dev/null -w "%{http_code}" -X POST $WEBHOOK_URL -d '{}'` | N/A | ⬜ pending |
| 03-02-02 | 02 | 1 | SEC-03 | — | config.toml has auth-mechanism comments for all verify_jwt=false functions | manual | `grep -c "auth:" supabase/config.toml` | N/A | ⬜ pending |
| 03-03-01 | 03 | 2 | SEC-05 | T-3-03 | Rate limit returns 429 after threshold exceeded | manual | Curl loop abuse simulation (see test instructions) | N/A | ⬜ pending |
| 03-04-01 | 04 | 3 | SEC-04 | T-3-04 | Sentry captures errors from mobile + edge functions | manual | Trigger test error, check Sentry dashboard | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- No automated test framework exists (FUT-01 is deferred). All verification is manual curl + visual Sentry dashboard check.

*Existing infrastructure covers verification needs via curl commands and Sentry dashboard.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Webhook rejects unauthenticated requests | SEC-01 | Requires deployed edge function + curl | `curl -s -o /dev/null -w "%{http_code}" -X POST $WEBHOOK_URL -d '{}'` expect 401 |
| Invite-redirect rejects malicious token | SEC-02 | Requires deployed edge function + curl | `curl -s -o /dev/null -w "%{http_code}" "$INVITE_URL?token=</script><script>alert(1)</script>"` expect 400 |
| config.toml auth-mechanism comments | SEC-03 | Grep verification | `grep -c "auth:" supabase/config.toml` expect 3 |
| Sentry captures errors | SEC-04 | Requires Sentry dashboard visual check | Trigger test error in app/edge function, verify appears in Sentry within minutes |
| Rate limit blocks abuse | SEC-05 | Requires deployed function + rapid curl | `for i in $(seq 1 65); do curl -s -o /dev/null -w "%{http_code}\n" -X POST $WEBHOOK_URL -d '{}'; done` expect 429 after threshold |

---

## Validation Sign-Off

- [ ] All tasks have manual verify commands documented
- [ ] Sampling continuity: curl test after each task commit
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

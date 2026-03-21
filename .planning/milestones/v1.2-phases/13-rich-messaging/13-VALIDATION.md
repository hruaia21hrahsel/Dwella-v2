---
phase: 13
slug: rich-messaging
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — Supabase Edge Functions have no automated test runner in this project |
| **Config file** | None |
| **Quick run command** | `supabase functions serve` + manual curl |
| **Full suite command** | Manual end-to-end test via actual WhatsApp/Telegram |
| **Estimated runtime** | ~30 seconds per curl test |

---

## Sampling Rate

- **After every task commit:** Run `supabase functions serve` + curl test of the specific changed function
- **After every plan wave:** Manual end-to-end smoke test: send "menu" via WhatsApp and Telegram, verify both show correct buttons
- **Before `/gsd:verify-work`:** All 5 RICH requirements manually verified
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | RICH-02, RICH-03, RICH-04 | manual | curl simulate button_reply + freeform text | n/a | ⬜ pending |
| 13-01-02 | 01 | 1 | RICH-05 | manual | Telegram client test with callback_query | n/a | ⬜ pending |
| 13-02-01 | 02 | 1 | RICH-01 | manual | WhatsApp/Telegram linking flow test | n/a | ⬜ pending |
| 13-02-02 | 02 | 1 | RICH-02 | manual | curl simulate message after 1-hour gap | n/a | ⬜ pending |
| 13-03-01 | 03 | 2 | RICH-03 | manual | History > download PDF flow test | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. `supabase functions serve` is sufficient for local testing.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Welcome message fires on WhatsApp linking | RICH-01 | Requires live WhatsApp session with verification code flow | Link new WhatsApp number, verify welcome + menu appears |
| Welcome message fires on Telegram /start | RICH-01 | Requires live Telegram session | Send /start with valid link token, verify welcome + menu |
| Main menu appears after 1-hour gap | RICH-02 | Requires time elapse or DB manipulation | Set last_bot_message_at to >1 hour ago, send message, verify menu |
| "menu"/"help" triggers menu | RICH-02 | Can be curl-tested locally | curl POST to webhook with text "menu", verify button response |
| Sub-option buttons per category | RICH-03 | Each button_id must return correct sub-options | curl simulate button_reply for each menu_* id |
| Freeform text still works | RICH-04 | Smoke test against process-bot-message | curl POST freeform text, verify Claude response (not menu) |
| Telegram mirrors WhatsApp layout | RICH-05 | Visual comparison required | Compare button layout side-by-side on both platforms |
| PDF report via History menu | RICH-03 | Requires full flow: year pick → month pick → PDF delivery | Navigate History > download PDF, pick year/month, verify PDF received |

---

## Validation Sign-Off

- [ ] All tasks have manual verify instructions
- [ ] Sampling continuity: curl test after each task commit
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

---
phase: 14
slug: intents-outbound-notifications
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — no automated test infrastructure in project |
| **Config file** | None |
| **Quick run command** | `supabase functions deploy <function> && curl <endpoint>` |
| **Full suite command** | Manual end-to-end: message bot via WhatsApp/Telegram, verify DB state + notification rows |
| **Estimated runtime** | ~120 seconds (manual smoke) |

---

## Sampling Rate

- **After every task commit:** Deploy modified function, send one test message, verify response
- **After every plan wave:** Full flow test across both WhatsApp and Telegram channels
- **Before `/gsd:verify-work`:** All 6 requirements manually verified with real notifications delivered
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | INTENT-01 | manual-smoke | Deploy process-bot-message, send "check maintenance status" via WA/TG | N/A | pending |
| 14-01-02 | 01 | 1 | INTENT-02 | manual-smoke | Deploy process-bot-message, send "upcoming payments" via WA/TG | N/A | pending |
| 14-01-03 | 01 | 1 | INTENT-03 | manual-smoke | Deploy process-bot-message, send "property summary" via WA/TG | N/A | pending |
| 14-01-04 | 01 | 1 | INTENT-01,02,03 | manual-smoke | Tap sub_maint_status / sub_payments_upcoming / sub_properties_summary buttons | N/A | pending |
| 14-02-01 | 02 | 2 | OUT-01 | manual-smoke | Set due_day, trigger send-reminders via curl, check WA + TG delivery | N/A | pending |
| 14-02-02 | 02 | 2 | OUT-02 | manual-smoke | Set payment 'paid' 49h ago, trigger auto-confirm-payments, check WA + TG | N/A | pending |
| 14-02-03 | 02 | 2 | OUT-03 | manual-smoke | Update maintenance_requests.status, check notify-whatsapp fires, check WA + TG | N/A | pending |

*Status: pending · green · red · flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No automated test setup needed.

- [ ] Verify `TELEGRAM_BOT_TOKEN` env var available to `notify-whatsapp` Edge Function deploy

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Maintenance status query response | INTENT-01 | No test framework; requires live bot interaction | Send "what's the status of my sink repair?" via WA/TG, verify structured response with emoji markers and follow-up buttons |
| Upcoming payments query response | INTENT-02 | No test framework; requires live bot interaction | Send "what do I owe?" via WA/TG, verify amounts + due dates in response |
| Property summary response | INTENT-03 | No test framework; requires live bot interaction | Send "property summary" as landlord, verify occupancy + collection rate |
| Sub-menu button execution | INTENT-01,02,03 | Requires WhatsApp/Telegram interactive message flow | Tap each of the 3 sub-menu buttons, verify real query results (not instructional text) |
| Rent reminder delivery | OUT-01 | Requires Meta template approval + scheduled trigger | Adjust due_day, invoke send-reminders, verify WA template + TG plain text delivered |
| Payment confirmation receipt | OUT-02 | Requires auto-confirm cron trigger | Set payment to 'paid' with old paid_at, invoke auto-confirm-payments, verify WA + TG receipt |
| Maintenance status change notification | OUT-03 | Requires DB trigger + pg_net | Change maintenance_requests.status in app, verify both tenant and landlord receive WA + TG notification |

---

## Validation Sign-Off

- [ ] All tasks have manual verification instructions
- [ ] Sampling continuity: each task commit includes a deploy + smoke test
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

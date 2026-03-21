---
phase: 12
slug: media-handling
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual + curl/httpie for Edge Function testing |
| **Config file** | none — Edge Functions tested via `supabase functions serve` |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npx tsc --noEmit && curl -s localhost:54321/functions/v1/whatsapp-media` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | MEDIA-01 | integration | `curl whatsapp-media endpoint` | ❌ W0 | ⬜ pending |
| 12-01-02 | 01 | 1 | MEDIA-01 | integration | `curl whatsapp-media with image` | ❌ W0 | ⬜ pending |
| 12-02-01 | 02 | 2 | MEDIA-02 | integration | `curl whatsapp-webhook with media payload` | ❌ W0 | ⬜ pending |
| 12-02-02 | 02 | 2 | MEDIA-02 | unit | `grep confirmation reply in webhook` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements — Supabase Storage buckets, Edge Function runtime, and TypeScript compiler already in place.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Photo sent via WhatsApp attaches as payment proof | MEDIA-01 | Requires real WhatsApp message with image | Send photo in WhatsApp chat, verify payment proof appears in app |
| Document sent via WhatsApp stores correctly | MEDIA-02 | Requires real WhatsApp message with document | Send PDF in WhatsApp chat, verify document appears in documents list |
| Bot confirmation reply after media processed | MEDIA-01, MEDIA-02 | Requires WhatsApp round-trip | Verify bot sends confirmation text after processing |
| CDN download within 5 min window | MEDIA-01 | Timing-dependent, real Meta CDN | Monitor logs for download latency |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

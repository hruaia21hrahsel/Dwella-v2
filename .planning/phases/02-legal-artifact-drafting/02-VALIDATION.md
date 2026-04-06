---
phase: 02
slug: legal-artifact-drafting
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-06
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual verification (no automated tests — this phase produces documents, not code) |
| **Config file** | N/A |
| **Quick run command** | `grep -c '## ' docs/privacy-policy.md docs/terms-of-service.md` |
| **Full suite command** | Verify all URLs return 200 after GitHub Pages deploy, verify all GDPR Art 13 items, verify DPDP §5 items, verify CCPA section |
| **Estimated runtime** | ~30 seconds (grep checks) |

---

## Sampling Rate

- **After every task commit:** Grep verification of mandatory sections and keywords
- **After every plan wave:** Full URL accessibility test after GitHub Pages deployment
- **Before `/gsd-verify-work`:** All 6 requirements verified with checklist
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-T1 | 02-01 | 1 | LEGAL-01 | T-02-01-01 | Privacy policy file exists with Jekyll config | grep | `test -f docs/privacy-policy.md && test -f docs/_config.yml` | Wave 1 | pending |
| 02-01-T2 | 02-01 | 1 | LEGAL-01, LEGAL-02, COMP-08, COMP-09 | T-02-01-02 | Privacy policy has all mandatory GDPR/DPDP/CCPA sections | grep | `grep -c 'Supabase\|Anthropic\|Telegram\|Expo\|Do Not Sell\|grievance' docs/privacy-policy.md` | Wave 1 | pending |
| 02-02-T1 | 02-02 | 1 | LEGAL-03, LEGAL-04 | T-02-02-01 | ToS has record-keeper disclaimer, governing law, paid features clause | grep | `grep -c 'record-keeper\|India\|paid\|premium\|subscription' docs/terms-of-service.md` | Wave 1 | pending |
| 02-03-T1 | 02-03 | 2 | All | — | GitHub Pages enabled, URLs live | manual | `curl -s -o /dev/null -w "%{http_code}" https://hruaia21hrahsel.github.io/Dwella-v2/privacy-policy` | Wave 2 | pending |
| 02-03-T2 | 02-03 | 2 | All | — | Placeholders replaced with real values | grep | `! grep -E '\{DEVELOPER_NAME\}\|\{DEVELOPER_EMAIL\}\|\{EFFECTIVE_DATE\}' docs/privacy-policy.md docs/terms-of-service.md` | Wave 2 | pending |

---

## Wave 0 Requirements

- GitHub Pages must be enabled in repo settings (manual step — Plan 02-03)
- URLs must be tested after deployment (cannot pre-verify)

---

## Coverage Summary

| Requirement | Plans | Tasks | Test Type |
|-------------|-------|-------|-----------|
| LEGAL-01 | 02-01, 02-03 | T1, T2, T1 | grep + manual URL check |
| LEGAL-02 | 02-01 | T2 | grep for sub-processor names |
| LEGAL-03 | 02-02, 02-03 | T1, T1 | grep + manual URL check |
| LEGAL-04 | 02-02 | T1 | grep for paid/premium/subscription |
| COMP-08 | 02-01 | T2 | grep for "Do Not Sell" |
| COMP-09 | 02-01 | T2 | grep for "grievance" |

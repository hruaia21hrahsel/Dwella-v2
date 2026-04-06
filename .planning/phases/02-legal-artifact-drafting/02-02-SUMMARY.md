---
phase: 02-legal-artifact-drafting
plan: 02
subsystem: legal-docs
tags: [tos, eula, legal, compliance, store-submission]
dependency_graph:
  requires: []
  provides: [terms-of-service]
  affects: [phase-05-consent-flows, phase-06-store-submission]
tech_stack:
  added: []
  patterns: [jekyll-front-matter, github-pages-permalink]
key_files:
  created:
    - docs/terms-of-service.md
  modified: []
decisions:
  - "19-section ToS structure covering all mandatory areas for store submission"
  - "Blockquote formatting for record-keeper disclaimer (prominent visibility)"
  - "Informal dispute resolution clause before formal legal proceedings"
  - "Liability cap at INR 50 or 12-month usage fees (whichever greater)"
metrics:
  duration: "3 minutes"
  completed: "2026-04-06T02:38:00Z"
  tasks_completed: 1
  tasks_total: 1
  files_created: 1
  files_modified: 0
---

# Phase 02 Plan 02: Terms of Service / EULA Summary

19-section Terms of Service covering dual-role landlord/tenant users with prominent record-keeper disclaimer, India governing law (Aizawl jurisdiction), forward-looking paid features clause, and AI bot liability disclaimers.

## What Was Done

### Task 1: Draft the Terms of Service / EULA

Created `docs/terms-of-service.md` with Jekyll front matter (`permalink: /terms-of-service`) and 19 mandatory sections:

1. Agreement to Terms -- binding agreement with solo developer
2. Description of Service -- dual-role system (landlord + tenant)
3. Important Disclaimers -- **bold blockquote** record-keeper disclaimer (NOT payment processor, escrow, legal advisor, rent guarantee)
4. User Accounts -- email, Google, Apple sign-in; credential responsibility
5. User Responsibilities -- accurate data, no illegal use, no reverse engineering
6. AI Features and Bot -- Anthropic Claude disclosure, consent requirement, accuracy caveat
7. Intellectual Property -- copyright and trademark protection
8. User Content -- user retains ownership, limited license for app functionality
9. Privacy -- cross-reference to Privacy Policy URL
10. Future Paid Features -- forward-looking monetization clause (LEGAL-04)
11. Limitation of Liability -- comprehensive liability cap
12. Disclaimer of Warranties -- AS IS / AS AVAILABLE
13. Indemnification -- user indemnifies developer
14. Termination -- account deletion reference, surviving sections
15. Changes to Terms -- 30-day notice for material changes
16. Governing Law and Dispute Resolution -- India, Aizawl courts
17. Severability
18. Entire Agreement -- ToS + Privacy Policy
19. Contact -- developer identity placeholder

**Commit:** `8725942`

## Verification Results

| Check | Result |
|-------|--------|
| File exists at `docs/terms-of-service.md` | PASS |
| Line count (184, min 120) | PASS |
| Jekyll permalink `/terms-of-service` | PASS |
| `{DEVELOPER_NAME}` placeholders (10 occurrences, min 3) | PASS |
| `{DEVELOPER_EMAIL}` placeholders (2 occurrences, min 2) | PASS |
| `{EFFECTIVE_DATE}` placeholders (2 occurrences, min 1) | PASS |
| Record-keeper disclaimer present | PASS |
| "NOT" in disclaimer context | PASS |
| Payment processor disclaimer | PASS |
| Escrow disclaimer | PASS |
| Legal advisor disclaimer | PASS |
| Both landlord and tenant roles addressed | PASS |
| India governing law | PASS |
| Aizawl jurisdiction | PASS |
| Premium/paid features clause | PASS |
| Privacy Policy cross-reference links (4) | PASS |
| Section headings (19 H2, min 15) | PASS |

## Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| LEGAL-03 | Satisfied | ToS covers both roles, record-keeper disclaimer, India governing law |
| LEGAL-04 | Satisfied | Section 10 (Future Paid Features) with 30-day notice clause |

## Deviations from Plan

None -- plan executed exactly as written.

## Decisions Made

1. **Blockquote formatting for disclaimer** -- Used Markdown blockquote (`>`) with bold text for the record-keeper disclaimer section to ensure visual prominence across renderers.
2. **Informal dispute resolution** -- Added a 30-day informal resolution period before formal legal proceedings (Section 16), which is common practice and reduces litigation risk.
3. **Liability cap** -- Set at INR 50 or 12-month fees paid (whichever greater), providing a concrete floor even for free-tier users.
4. **Surviving sections enumerated** -- Explicitly listed which sections survive termination (11, 12, 13, 16) rather than using vague "as applicable" language.

## Self-Check: PASSED

---
phase: 02-legal-artifact-drafting
plan: 01
subsystem: legal-docs
tags: [privacy-policy, gdpr, dpdp, ccpa, github-pages, legal]
dependency_graph:
  requires: []
  provides: [privacy-policy-document, github-pages-config]
  affects: [app.json, store-submissions, in-app-settings]
tech_stack:
  added: [jekyll, github-pages]
  patterns: [jekyll-front-matter-permalink, jurisdiction-layered-legal-docs]
key_files:
  created:
    - docs/_config.yml
    - docs/privacy-policy.md
  modified: []
decisions:
  - "Table of contents added to privacy policy for navigation (18 sections)"
  - "Placeholder tokens {DEVELOPER_NAME}, {DEVELOPER_EMAIL}, {EFFECTIVE_DATE} used throughout to prevent PII in commits"
  - "Jekyll permalink front matter controls URL path (/privacy-policy) regardless of file location"
metrics:
  duration: "2m 58s"
  completed: "2026-04-06T02:38:04Z"
  tasks: 2
  files: 2
---

# Phase 02 Plan 01: Privacy Policy + GitHub Pages Infrastructure Summary

GDPR Art 13 baseline privacy policy with DPDP Act 2023 and CCPA/CPRA jurisdiction sections, hosted via Jekyll on GitHub Pages at /Dwella-v2/privacy-policy.

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create GitHub Pages infrastructure | 95e4609 | docs/_config.yml |
| 2 | Draft the Privacy Policy | 863a59b | docs/privacy-policy.md |

## What Was Built

### docs/_config.yml (7 lines)
Jekyll configuration for GitHub Pages project site. Sets `baseurl: /Dwella-v2` for correct URL resolution on project sites, kramdown renderer, and jekyll-seo-tag plugin.

### docs/privacy-policy.md (209 lines)
Full privacy policy with 18 sections covering:

- **GDPR Art 13 compliance:** All 12 mandatory information items present (data controller, DPO status, 7 data categories with purpose/legal basis/retention, legitimate interests, 4 sub-processors, cross-border transfers, retention periods, data subject rights, consent withdrawal, complaint rights, statutory requirements, automated decision-making)
- **7 data categories:** Account/Identity, Property Data, Tenant Data, Payment/Financial Data, Bot Conversation Logs, Notifications, Push Tokens -- each with specific retention period
- **4 sub-processors:** Supabase (Japan, ap-northeast-1), Anthropic (US), Telegram (global), Expo (US) -- each with country, purpose, data received, transfer basis, DPA reference
- **Cross-border transfers:** Japan (EU adequacy decision 2019 + SCCs), US (SCCs via Commercial Terms), Telegram (user-initiated)
- **DPDP Act 2023 section:** Grievance officer contact, Data Protection Board complaint, Section 16 cross-border permissive regime
- **CCPA/CPRA section:** "Do Not Sell or Share" affirmative disclosure, categories collected in last 12 months, California privacy rights
- **Soft-delete disclosure:** Honest disclosure that deletion means 30-day archival before permanent deletion, with option to request immediate deletion
- **AI disclosure:** Anthropic's Claude assists but does not make automated decisions with legal effects; all actions require explicit confirmation
- **Placeholder tokens:** {DEVELOPER_NAME}, {DEVELOPER_EMAIL}, {EFFECTIVE_DATE} -- to be filled in at Plan 02-03 checkpoint

## Deviations from Plan

None -- plan executed exactly as written.

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| {DEVELOPER_NAME} | docs/privacy-policy.md | multiple (4 occurrences) | Intentional placeholder; filled at Plan 02-03 checkpoint before publishing |
| {DEVELOPER_EMAIL} | docs/privacy-policy.md | multiple (15 occurrences) | Intentional placeholder; filled at Plan 02-03 checkpoint before publishing |
| {EFFECTIVE_DATE} | docs/privacy-policy.md | lines 9, 153 (3 occurrences) | Intentional placeholder; filled at Plan 02-03 checkpoint before publishing |

These stubs are by design per T-02-02 threat mitigation (prevent accidental PII commit). They do not block this plan's goal.

## Self-Check: PASSED

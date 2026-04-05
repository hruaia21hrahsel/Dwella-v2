# Phase 1: Fact-Finding & Unblockers - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-05
**Phase:** 01-fact-finding-unblockers
**Areas discussed:** Trademark Clearance, License Audit Tooling, NoBroker Cleanup Scope, Cookie/Tracker Audit Depth, Anthropic DPA Execution, Logo/Icon Provenance

---

## Trademark Clearance (IP-01)

| Option | Description | Selected |
|--------|-------------|----------|
| DIY free-search memo | Manual USPTO TESS + EUIPO eSearch + Indian IP Office. Zero cost, proves due diligence. | ✓ |
| DIY + paid monitoring | Same DIY now + Markify/Trademarkia watch service (~$30-100/yr). | |
| Punt to attorney | Skip DIY, placeholder memo, wait for lawyer. | |

**User's choice:** DIY free-search memo (Recommended)
**Notes:** Solo developer with no legal budget. Memo must still exist covering all 3 jurisdictions per phase goal.

---

## Third-Party License Audit Tooling (IP-03 + IP-05)

| Option | Description | Selected |
|--------|-------------|----------|
| license-checker CLI + manual asset sweep | `license-checker-rseidelsohn --production --json` for npm deps + manual asset audit. | ✓ |
| FOSSA / ScanCode Toolkit | Full SCA scanner, catches embedded licenses. | |
| Manual spreadsheet from package.json | Walk package.json by hand. Error-prone, misses transitive deps. | |

**User's choice:** license-checker CLI + manual asset sweep (Recommended)
**Notes:** React Native app with no native vendored code — CLI + manual sweep is sufficient, FOSSA is overkill.

---

## NoBroker Reference Cleanup Scope (IP-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Working tree only + grep verification | Delete files, verify grep returns zero matches, leave git history. | ✓ |
| Working tree + git history rewrite | git-filter-repo to scrub history. Destructive. | |
| Working tree + rename repo | Delete files AND rename GitHub repo. | |

**User's choice:** Working tree only + grep verification (Recommended)
**Notes:** History rewrite provides no real protection (public GitHub already indexed), and shipped artifacts contain no history.

---

## Cookie / Tracker Audit Depth (COMP-10)

| Option | Description | Selected |
|--------|-------------|----------|
| package.json grep + runtime network log | Static grep for known tracker SDKs + 60s runtime capture via Expo DevTools. | ✓ |
| Static grep only | package.json grep only. Weaker evidence. | |
| Full mitmproxy session capture | mitmproxy HAR export. Gold standard but heavy. | |

**User's choice:** package.json grep + runtime network log (Recommended)
**Notes:** Both static + runtime evidence gives the strongest attestation. Sentry/PostHog already removed per memory, so runtime capture should be clean.

---

## Anthropic DPA Execution (COMP-06)

| Option | Description | Selected |
|--------|-------------|----------|
| Self-serve via console.anthropic.com | Download standard DPA from Settings → Compliance, sign, store. | ✓ |
| Email privacy@anthropic.com for custom DPA | Negotiated DPA. Slow, unnecessary for solo dev on pay-as-you-go. | |

**User's choice:** Self-serve via console.anthropic.com (Recommended)
**Notes:** Self-serve DPA covers GDPR Art 28 clauses — no need to negotiate.

---

## Logo / Icon Provenance (IP-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Write provenance memo for existing assets | Fact-finding only — document who/what/when for each asset. | ✓ |
| Regenerate all icons now | Scope creep — belongs in STORE phase. | |

**User's choice:** Write provenance memo for existing assets (Recommended)
**Notes:** Phase 1 is fact-finding, not redesign. If memo surfaces risky AI-generated assets, regeneration happens in STORE phase (6).

---

## Claude's Discretion

- Exact file layout inside `.planning/legal/` (flat vs. nested).
- Whether to consolidate the DPA register, cross-border memo, and tracker audit into a single file or split.
- Shell command specifics for grep patterns.
- Screenshot vs. text-export format for trademark search evidence.

## Deferred Ideas

- Ongoing trademark monitoring service (post-launch).
- Full SCA tooling (FOSSA/ScanCode).
- Git history rewrite to scrub NoBroker.
- Icon redesign (belongs in STORE phase).
- Attorney review of trademark clearance (post-launch).
- mitmproxy full session capture.

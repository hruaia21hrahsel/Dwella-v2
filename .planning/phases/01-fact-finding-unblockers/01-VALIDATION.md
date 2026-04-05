---
phase: 1
slug: fact-finding-unblockers
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-05
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
>
> **Note:** Phase 1 is a fact-finding/evidence-gathering phase with no application code changes. "Tests" here mean shell-level verification commands (grep, file-exists, jq checks against outputs). There is no unit-test framework to run — the verification surface is the filesystem and the written artifacts themselves. RESEARCH.md §"Validation Architecture" holds the per-decision check commands; this file maps them to tasks.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | shell + grep + jq + file-exists checks (no unit test runner needed) |
| **Config file** | none — all checks are ad-hoc shell commands defined in RESEARCH.md §Validation Architecture |
| **Quick run command** | `bash .planning/phases/01-fact-finding-unblockers/verify.sh` (created in Wave 0) |
| **Full suite command** | `bash .planning/phases/01-fact-finding-unblockers/verify.sh --full` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run the specific `<automated>` check from that task's PLAN.md entry
- **After every plan wave:** Run `verify.sh` to re-check all completed tasks' artifacts
- **Before `/gsd-verify-work`:** `verify.sh --full` must exit 0
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

> To be filled by the planner. Each task must map to a RESEARCH.md §Validation Architecture check.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | COMP-05/06/10, IP-01..05 | — | N/A (no runtime behavior) | shell | see RESEARCH.md §Validation Architecture | ❌ W0 | ⬜ pending |

---

## Wave 0 Requirements

- [ ] `.planning/phases/01-fact-finding-unblockers/verify.sh` — aggregated shell script running every per-decision check from RESEARCH.md §Validation Architecture
- [ ] `.planning/legal/` directory — must exist before any evidence file is written
- [ ] `license-checker-rseidelsohn` available via `npx` (no install needed; verify with `npx --yes license-checker-rseidelsohn --version`)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Supabase region matches dashboard | COMP-05 | Requires human login to Supabase dashboard | Log in → Project Settings → General → Region; compare against `.planning/PROJECT.md` Infrastructure section |
| Anthropic Commercial Terms acceptance evidence | COMP-06 | Requires human login to console.anthropic.com | Per RESEARCH.md correction: capture acceptance timestamp + archive public DPA PDF into `.planning/legal/anthropic-dpa-public.pdf`; record in `dpa-register.md` |
| Trademark clearance search results | IP-01 | USPTO/EUIPO/IP-India portals require browser interaction + may hit CAPTCHA | Per RESEARCH.md: use new post-TESS USPTO search; perform exact + phonetic searches in Classes 9, 36 (optionally 42); paste evidence into `trademark-clearance-dwella.md` |
| Runtime tracker capture | COMP-10 | Requires device + Expo dev build running | Launch dev build; perform login→properties→payment→bot→logout journey; export hostnames from Expo DevTools Network; paste into `tracker-audit.md` |
| Asset provenance | IP-04 | Requires human memory of which tool created which asset | For each asset in `assets/`: record creator, tool, license, date in `asset-provenance.md` |

---

## Validation Sign-Off

- [ ] Every task has either an `<automated>` shell check OR is paired with a scaffold-then-verify twin (autonomous verifier task that re-runs the check after the human step)
- [ ] Sampling continuity: no 3 consecutive tasks without an automated verify
- [ ] Wave 0 creates `verify.sh` + `.planning/legal/` dir before any evidence-writing task runs
- [ ] No watch-mode flags (N/A — no test runner)
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter once planner maps every task to a check

**Approval:** pending

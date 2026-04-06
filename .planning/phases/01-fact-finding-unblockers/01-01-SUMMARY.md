---
phase: 01-fact-finding-unblockers
plan: 01
subsystem: legal/ip
tags: [nobroker-scrub, license-audit, ip-clearance]
dependency_graph:
  requires: [01-00]
  provides: [THIRD-PARTY-LICENSES.md, .planning/legal/npm-licenses.json]
  affects: [01-05]
tech_stack:
  added: [license-checker-rseidelsohn]
  patterns: [dual-license-election, optional-dep-exclusion]
key_files:
  created:
    - THIRD-PARTY-LICENSES.md
    - .planning/legal/npm-licenses.json
  modified:
    - constants/colors.ts
    - .gitignore
decisions:
  - "UNLICENSED package is dwella-v2 itself (private project) -- not a concern"
  - "sharp LGPL component (libvips) not shipped in mobile binary -- optionalDependency only"
  - "node-forge dual-licensed BSD-3-Clause OR GPL-2.0 -- elected BSD-3-Clause"
metrics:
  duration: 210s
  completed: 2026-04-06T01:34:00Z
  tasks_completed: 2
  tasks_total: 2
---

# Phase 01 Plan 01: NoBroker Scrub + License Audit Summary

NoBroker trademark references fully removed from working tree; 762 production npm packages audited with zero copyleft contamination in the shipped binary. THIRD-PARTY-LICENSES.md published with per-license-type breakdown and attestation.

## Task Results

### Task 1: NoBroker Scrub (IP-02, D-06..D-09)

**Commit:** `0fe5e50`

- Deleted `dwella-nobroker-teal.jsx` (untracked legacy JSX design file, was gitignored)
- Cleaned `constants/colors.ts` line 6: removed "NoBroker Teal" brand comment, left neutral "Brand" comment
- Removed stale `.gitignore` line referencing the deleted file
- Final grep verification: zero NoBroker matches outside `.planning/`
- TypeScript typecheck: clean (no errors in colors.ts)
- Git history intentionally not rewritten (D-08)
- Repo name unchanged at "Dwella v2" (D-09)

### Task 2: License Audit + THIRD-PARTY-LICENSES.md (IP-03, IP-05, D-10..D-14)

**Commit:** `a7510dc`

- Generated `.planning/legal/npm-licenses.json` with 762 production packages
- GPL/AGPL/LGPL/SSPL scan: 2 matches, both non-contaminating:
  - `@img/sharp-win32-x64@0.34.5` (Apache-2.0 AND LGPL-3.0-or-later) -- optionalDependency, not in mobile binary
  - `node-forge@1.3.3` (BSD-3-Clause OR GPL-2.0) -- dual-licensed, elected BSD-3-Clause
- D-14 confirmed moot: zero `@expo-google-fonts` packages in package.json
- Top licenses: MIT (650), ISC (42), BSD-3-Clause (17), BSD-2-Clause (15), Apache-2.0 (13)
- 1 UNLICENSED entry is `dwella-v2@1.0.0` itself (private project)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] dwella-nobroker-teal.jsx was untracked, not git-tracked**
- **Found during:** Task 1, Step 2
- **Issue:** `git rm dwella-nobroker-teal.jsx` failed because the file was in `.gitignore` and never committed
- **Fix:** Used `rm` instead of `git rm` to delete the untracked file
- **Files modified:** dwella-nobroker-teal.jsx (deleted from disk)

**2. [Rule 3 - Blocking] jq not available on Windows**
- **Found during:** Task 2, Step 1
- **Issue:** `jq` command not found on Windows environment
- **Fix:** Used `node -e` with `require()` and `Object.keys().length` as equivalent
- **Files modified:** None (tooling workaround only)

**3. [Rule 3 - Blocking] license-checker stderr mixed into JSON output**
- **Found during:** Task 2, Step 1
- **Issue:** Node deprecation warning appended to JSON file, making it unparseable
- **Fix:** Regenerated with `2>/dev/null` redirection
- **Files modified:** .planning/legal/npm-licenses.json (regenerated clean)

## Verification Results

| Check | Result |
|-------|--------|
| `dwella-nobroker-teal.jsx` deleted | PASS |
| Zero NoBroker matches in code | PASS (grep exit 1 = no matches) |
| `constants/colors.ts` typecheck | PASS (clean) |
| Repo name = "Dwella v2" | PASS |
| npm-licenses.json >= 1 entry | PASS (762) |
| Zero copyleft in shipped binary | PASS (2 matches, both excluded from binary) |
| THIRD-PARTY-LICENSES.md exists | PASS |
| Attestation line present | PASS |
| 4+ sections in THIRD-PARTY-LICENSES.md | PASS (5 sections) |
| No @expo-google-fonts | PASS (0) |

## Requirements Closed

- **IP-02:** NoBroker references removed from code
- **IP-03:** THIRD-PARTY-LICENSES.md published at repo root
- **IP-05:** No GPL/AGPL/LGPL/SSPL contamination in shipped binary verified

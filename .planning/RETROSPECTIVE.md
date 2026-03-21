# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — Launch Audit & Hardening

**Shipped:** 2026-03-19
**Phases:** 5 | **Plans:** 14

### What Was Built
- TypeScript compilation baseline with zero errors + ESLint security rules enforced at error severity
- Full security hardening: RLS policies (28 per-operation), crypto-secure tokens, webhook auth, payment state machine trigger
- Edge Function audit: proper HTTP status codes, soft-delete filtering, Claude response validation
- Client resilience: auth error visibility, env fail-fast, subscription cleanup, push token fix
- App Store readiness: privacy checklist, AI disclosure modal, fingerprint OTA policy, UpdateGate

### What Worked
- Bottom-up audit sequence (DB → Edge Functions → Client → Store) caught issues at root cause before they compounded
- Phase verification with VERIFICATION.md prevented false completion claims — each phase was verified against actual codebase
- Parallel execution within waves (e.g., Phase 5 plans 01 + 02) saved time without introducing conflicts
- Yolo mode + balanced model profile kept execution fast without sacrificing quality

### What Was Inefficient
- SUMMARY.md frontmatter `requirements-completed` was not consistently filled — 7 of 26 requirements were absent from summaries despite being fully implemented (caught during milestone audit 3-source cross-reference)
- ESLint file globs didn't cover `supabase/functions/` (Deno runtime) — 8 `as any` casts in Edge Functions were invisible until integration check
- Gap closure phases (01-03, 01-04) added 2 extra plans to Phase 1 that could have been caught during initial planning

### Patterns Established
- `requireEnv()` fail-fast pattern for critical env vars — throw at module evaluation before client init
- Two-component pattern for hooks that require `Updates.isEnabled` guard (UpdateGate/UpdateGateInner)
- AI disclosure per-screen placement (not global layout) — non-AI users never see consent modal
- `catch (err: unknown)` with `instanceof Error` guard over `catch (err: any)` — TypeScript-safe error handling

### Key Lessons
1. Phase verification should be non-negotiable — the gap closure cycle in Phase 1 (ESLint as-any cleanup) would have been a launch blocker if skipped
2. Integration checks at milestone level catch cross-phase wiring issues that per-phase verification misses (ESLint scope gap, WhatsApp HMAC bypass)
3. Audit milestones (fix-only, no new features) are highly efficient — 26 requirements in 15 days with zero regressions
4. Pre-launch checklists (Sentry DSN, store URLs, App Store ID) should be tracked as explicit TODO items from day one, not discovered during verification

### Cost Observations
- Model mix: ~20% opus (orchestration), ~80% sonnet (execution + verification)
- Plans averaged ~10 minutes each (fastest: 2 min for simple audits, longest: 45 min for comprehensive as-any removal)
- Notable: Parallel wave execution in Phase 5 completed both plans simultaneously in ~5 minutes total orchestrator time

---

## Milestone: v1.1 — Tools Expansion

**Shipped:** 2026-03-21
**Phases:** 5 | **Plans:** 14

### What Was Built
- AI tools removal — deprecated screens, Edge Functions, and tool definitions cleaned out
- Document Storage — full upload/view/download/delete with property + tenant scoping, RLS, atomic deletes
- Maintenance Requests — tenant submission with photos, landlord status management, cost logging, push notifications
- Reporting Dashboards — P&L, expense donut, payment reliability, occupancy, portfolio summary with Victory Native charts
- Maintenance wiring fixes — notification tap routing and property detail shortcut card (gap closure)

### What Worked
- Milestone audit before shipping caught 2 integration gaps (notification routing, property shortcut) that Phase 10 closed
- DB-level state machines for maintenance (matching payment pattern) prevented bypass — consistent pattern across domains
- Victory Native chart components with tap-to-highlight provided native performance without web dependencies
- Research phase before planning identified the notification INSERT gap that would have been missed otherwise
- Gap closure as a dedicated phase (Phase 10) kept scope clean — no scope creep into feature phases

### What Was Inefficient
- Nyquist validation remained incomplete for 3 of 5 phases (06, 07, 08) — VALIDATION.md files were draft or missing
- Some SUMMARY.md one-liners were just filenames (e.g., "app/maintenance/submit.tsx") instead of descriptive sentences
- usePortfolioData loads all expenses without year filter — unbounded query that will degrade at scale
- 2 pre-existing test failures in documents.test.ts were carried through without resolution

### Patterns Established
- Maintenance state machine trigger at DB level (matches payment pattern) — `maintenance_valid_transition()` function
- Non-blocking notification INSERTs with try/catch + console.warn — decouple notification delivery from primary action
- Shortcut card pattern on property detail — consistent navigation entry point for property-scoped features
- Victory Native chart components with per-datum tap-to-highlight and floating tooltip overlay

### Key Lessons
1. Milestone audits are essential — gap closure phases are cheap but finding integration gaps after shipping is expensive
2. Notification routing should be wired at the same time as push notification delivery, not deferred
3. Feature phases (7, 8, 9) benefited from 4-plan wave structure: DB → hooks → components → screens
4. Research agents save planning time — Phase 10 researcher identified the exact `handlePress` gap and INSERT requirement

### Cost Observations
- Model mix: ~15% opus (orchestration + planning), ~85% sonnet (research + execution + verification)
- 5 phases completed in ~18 hours of wall time across 2 days
- Notable: Phase 10 (gap closure) executed in a single plan with 2 tasks — minimal overhead for high-value integration fixes

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 5 | 14 | Established bottom-up audit sequence, verification gates, gap closure cycle |
| v1.1 | 5 | 14 | Feature development with 4-plan wave structure, milestone audit gap closure |

### Cumulative Quality

| Milestone | Requirements | Coverage | Tech Debt Items |
|-----------|-------------|----------|-----------------|
| v1.0 | 26/26 | 100% | 10 (non-blocking) |
| v1.1 | 21/21 | 100% | 6 (non-blocking) |

### Top Lessons (Verified Across Milestones)

1. Bottom-up sequencing (fix root causes first) prevents compounding regressions
2. 3-source cross-reference at milestone audit catches gaps that per-phase checks miss
3. Gap closure phases are high-value, low-cost — catch integration issues before shipping
4. DB-level state machines (payments, maintenance) provide consistent, bypass-proof domain enforcement

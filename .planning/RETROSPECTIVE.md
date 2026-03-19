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

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 5 | 14 | Established bottom-up audit sequence, verification gates, gap closure cycle |

### Cumulative Quality

| Milestone | Requirements | Coverage | Tech Debt Items |
|-----------|-------------|----------|-----------------|
| v1.0 | 26/26 | 100% | 10 (non-blocking) |

### Top Lessons (Verified Across Milestones)

1. Bottom-up sequencing (fix root causes first) prevents compounding regressions
2. 3-source cross-reference at milestone audit catches gaps that per-phase checks miss

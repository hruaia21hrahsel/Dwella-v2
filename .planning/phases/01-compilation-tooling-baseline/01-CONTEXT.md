# Phase 1: Compilation & Tooling Baseline - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Get the codebase compiling with zero TypeScript errors, configure ESLint with security and type-aware rules, replace unsafe `as any` casts in critical paths, and integrate Sentry for production crash monitoring. This establishes a reliable foundation so all subsequent audit phases can trust compilation output and catch regressions automatically.

Requirements: TS-01, TS-02, TS-03, EDGE-04

</domain>

<decisions>
## Implementation Decisions

### Sentry Integration
- Crashes only at launch — no performance monitoring or breadcrumbs initially
- DSN stored as environment variable (`EXPO_PUBLIC_SENTRY_DSN`) consistent with existing env var pattern
- Mobile app only — Edge Functions use Supabase's built-in function logs
- Plan should include Sentry project creation instructions (user doesn't have one yet)

### ESLint Rollout
- Warn on existing violations, error on new code — avoids a massive fix-all PR
- Security + types only: `eslint-plugin-security` + `@typescript-eslint` — no style, React hooks, or a11y rules
- On-demand only via npm script — no pre-commit hooks (solo developer, hooks add friction)
- App code only (`app/`, `components/`, `hooks/`, `lib/`, `constants/`) — Edge Functions excluded (Deno has its own linter)

### `as any` Cleanup
- Critical paths only: `lib/supabase.ts` (auth storage), `app/_layout.tsx` (auth fallback), `supabase/functions/send-reminders` (tenant casts), and payment flows
- Non-critical `as any` casts left for post-launch cleanup

### PostHog Fix
- Remove invalid `captureLifecycleEvents` property entirely — don't find replacement API
- Leave `captureTouches` and `captureScreens` autocapture as-is — PostHog tuning is a separate concern

### Claude's Discretion
- Auth storage `as any` fix approach (typed adapter vs narrower assertion — pick cleanest for @supabase/supabase-js API)
- Exact ESLint config structure and rule severity levels
- Sentry SDK initialization placement and error boundary setup
- Loading skeleton for ESLint baseline file approach

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Compilation errors
- `.planning/codebase/CONCERNS.md` §1 — PostHog captureLifecycleEvents error details and fix guidance
- `.planning/codebase/CONCERNS.md` §5 — Auth storage `as any` cast details
- `.planning/codebase/CONCERNS.md` §16 — send-reminders `as any` cast details

### Stack & conventions
- `.planning/codebase/STACK.md` — Full technology stack with versions (PostHog 4.37.3, Expo 54, TypeScript 5.3)
- `.planning/codebase/CONVENTIONS.md` — Existing code patterns, import conventions, env var pattern

### Requirements
- `.planning/REQUIREMENTS.md` — TS-01, TS-02, TS-03, EDGE-04 acceptance criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `constants/config.ts`: Central config file — Sentry DSN export belongs here
- `lib/posthog.ts`: Existing PostHog setup pattern — Sentry init can follow same structure
- `.env.example`: Env var template — add SENTRY_DSN here

### Established Patterns
- Env vars use `EXPO_PUBLIC_` prefix for client-side access
- Config constants exported from `constants/config.ts`
- Third-party SDK init happens in `app/_layout.tsx`
- `lib/types.ts` defines all TypeScript interfaces for DB models

### Integration Points
- `app/_layout.tsx:243` — PostHog autocapture config (fix site)
- `app/_layout.tsx:94-114` — Auth state init with `as any` fallback (fix site)
- `lib/supabase.ts:24` — Auth storage `as any` cast (fix site)
- `supabase/functions/send-reminders/index.ts:35,47` — Tenant `as any` casts (fix site)
- `tsconfig.json` — Already excludes `supabase/functions` from compilation
- `package.json` — Add ESLint deps and lint script here

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for all tooling setup.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-compilation-tooling-baseline*
*Context gathered: 2026-03-18*

---
phase: 01-compilation-tooling-baseline
plan: 03
subsystem: ui
tags: [typescript, eslint, react-native, expo-router, posthog, material-community-icons]

# Dependency graph
requires:
  - phase: 01-compilation-tooling-baseline
    provides: ESLint configured with @typescript-eslint/no-explicit-any at error severity (plan 01-02)

provides:
  - Zero as any casts in hooks/, components/, and lib/analytics.ts
  - No phantom "Definition for rule not found" ESLint errors
  - Typed error catch pattern (catch err unknown) established across all data hooks
  - Typed MaterialCommunityIcons name prop pattern via ComponentProps cast
  - Typed router.replace via Href (consistent with _layout.tsx pattern)

affects: [04-app-screens-as-any, future-hooks, future-components]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "catch (err: unknown) + instanceof Error guard for all Supabase hook error handling"
    - "ComponentProps<typeof MaterialCommunityIcons>['name'] cast for icon name props"
    - "import { type Href } from 'expo-router' for router.replace typed casts"
    - "PostHogEventProperties from @posthog/core for analytics capture type"
    - "(err as { code?: string }).code pattern for typed error code access on unknown catch"

key-files:
  created: []
  modified:
    - hooks/useProperties.ts
    - hooks/useTenants.ts
    - hooks/usePayments.ts
    - hooks/useNotifications.ts
    - hooks/useExpenses.ts
    - hooks/useAllExpenses.ts
    - hooks/useBotConversations.ts
    - components/SocialAuthButtons.tsx
    - components/ChatBubble.tsx
    - components/Skeleton.tsx
    - components/CustomTabBar.tsx
    - components/EmptyState.tsx
    - components/GradientButton.tsx
    - components/PaymentStatusBadge.tsx
    - components/TourGuideCard.tsx
    - lib/analytics.ts

key-decisions:
  - "catch (err: unknown) with instanceof Error guard chosen over catch (err: any) — eliminates no-explicit-any violation while making error type safety explicit"
  - "ComponentProps<typeof MaterialCommunityIcons>['name'] cast chosen over string union literal — derives type from library, resilient to icon library updates"
  - "PostHogEventProperties imported from @posthog/core for analytics.ts — exact required type, no widening or narrowing needed"
  - "(err as { code?: string }).code pattern for Apple cancel code check — minimal cast surface, preserves unknown for err itself"
  - "lib/analytics.ts Record<string,any> replaced with PostHogEventProperties (not Record<string,unknown>) because posthog.capture() requires JsonType-indexed properties"

patterns-established:
  - "Hook error catch: catch (err: unknown) { setError(err instanceof Error ? err.message : 'Fallback message') }"
  - "Icon name prop: name={iconVar as ComponentProps<typeof MaterialCommunityIcons>['name']}"
  - "Router cast: router.replace(route as Href) with Href imported from expo-router"

requirements-completed: [TS-03]

# Metrics
duration: 18min
completed: 2026-03-18
---

# Phase 01 Plan 03: Remove as any from hooks, components, and lib/analytics Summary

**Eliminated all `as any` casts from 16 files in hooks/, components/, and lib/analytics.ts using four typed patterns — catch unknown, ComponentProps icon cast, Href router cast, and PostHogEventProperties — with zero new TypeScript errors introduced**

## Performance

- **Duration:** 18 min
- **Started:** 2026-03-18T16:35:00Z
- **Completed:** 2026-03-18T16:53:00Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments

- Removed phantom `Definition for rule 'react-hooks/exhaustive-deps' was not found` ESLint error from useProperties.ts
- Replaced all `catch (err: any)` blocks (9 total) with `catch (err: unknown)` + instanceof Error guard across 7 hooks and SocialAuthButtons.tsx
- Typed all 6 MaterialCommunityIcons `name={x as any}` casts via `ComponentProps<typeof MaterialCommunityIcons>['name']`
- Typed TourGuideCard router.replace cast via `Href` and analytics.ts via `PostHogEventProperties`
- TypeScript still compiles with zero new errors in target files

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove invalid eslint-disable comment from useProperties.ts** - `4c6ff0a` (fix)
2. **Task 2: Remove all as any casts from hooks, components, and lib/analytics.ts** - `b70962b` (fix)

## Files Created/Modified

- `hooks/useProperties.ts` - Removed eslint-disable-line comment; catch err: unknown
- `hooks/useTenants.ts` - catch err: unknown
- `hooks/usePayments.ts` - catch err: unknown
- `hooks/useNotifications.ts` - catch err: unknown
- `hooks/useExpenses.ts` - catch err: unknown
- `hooks/useAllExpenses.ts` - catch err: unknown
- `hooks/useBotConversations.ts` - catch err: unknown
- `components/SocialAuthButtons.tsx` - Two catch blocks to unknown; typed err.code access
- `components/ChatBubble.tsx` - metadata as Record<string, unknown>
- `components/Skeleton.tsx` - width as number
- `components/CustomTabBar.tsx` - ComponentProps icon cast; added ComponentProps import
- `components/EmptyState.tsx` - ComponentProps icon cast; added ComponentProps import
- `components/GradientButton.tsx` - ComponentProps icon cast x2; added ComponentProps import
- `components/PaymentStatusBadge.tsx` - ComponentProps icon cast; added ComponentProps import
- `components/TourGuideCard.tsx` - ComponentProps icon cast + Href router cast; added Href + ComponentProps imports
- `lib/analytics.ts` - PostHogEventProperties import from @posthog/core; replaced Record<string, any>

## Decisions Made

- `PostHogEventProperties` used in analytics.ts instead of `Record<string, unknown>` because PostHog's `capture()` type requires `JsonType`-indexed properties — `unknown` caused a type error
- `(err as { code?: string }).code` used for Apple sign-in cancel check — minimal cast surface on the unknown error while preserving type safety for the cancel condition check

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] lib/analytics.ts PostHogEventProperties mismatch**
- **Found during:** Task 2 verification (TypeScript compile check)
- **Issue:** Changing `Record<string, any>` to `Record<string, unknown>` broke `posthog.capture()` call — PostHog expects `PostHogEventProperties` which uses `JsonType` indexer, not `unknown`
- **Fix:** Imported `PostHogEventProperties` from `@posthog/core` and used it as the parameter type — exact correct type, no narrowing/widening
- **Files modified:** lib/analytics.ts
- **Verification:** `npx tsc --noEmit` produced zero errors in lib/analytics.ts
- **Committed in:** b70962b (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — type mismatch discovered during verification)
**Impact on plan:** Fix was necessary for correctness; plan specified `Record<string, unknown>` but that type is incompatible with posthog API. Using the actual library type is strictly better.

## Issues Encountered

None beyond the PostHogEventProperties mismatch documented above.

## Next Phase Readiness

- hooks/, components/, and lib/analytics.ts are now `no-explicit-any` clean
- Plan 01-04 can proceed to clean remaining `as any` casts in app/ screens
- Pre-existing TypeScript errors in app/ (reminders, ai-search, useDashboard) remain out of scope — handled by plan 01-04

---
*Phase: 01-compilation-tooling-baseline*
*Completed: 2026-03-18*

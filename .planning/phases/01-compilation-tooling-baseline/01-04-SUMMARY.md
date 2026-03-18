---
phase: 01-compilation-tooling-baseline
plan: 04
subsystem: ui
tags: [typescript, eslint, react-native, expo-router, supabase]

# Dependency graph
requires:
  - phase: 01-compilation-tooling-baseline plan 02
    provides: ESLint no-explicit-any rule at error severity, Sentry SDK infrastructure
provides:
  - Zero no-explicit-any ESLint errors across entire codebase
  - npm run lint exits with zero errors (only warnings) — usable as CI gate
  - Typed search result interfaces in ai-search.tsx
  - Typed Supabase query row interfaces in useDashboard.ts
  - NativeSyntheticEvent typed keyboard handler in phone-verify.tsx
  - ThemeColors typed InfoRow props in tenant detail screen
affects: [CI pipeline, any future screen additions must use typed patterns established here]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "item as unknown as TypedInterface — double-cast for Supabase untyped joins (ai-search, reminders)"
    - "ComponentProps<typeof MaterialCommunityIcons>['name'] — typed icon name prop pattern"
    - "headerStyle as object — narrowest safe cast for Expo Router AnimatedStyle/headerStyle prop"
    - "router.push/replace as Href — typed navigation via expo-router Href type"
    - "catch err: unknown + err instanceof Error check — replaces catch err: any pattern"
    - "inline interface (p: { amount_paid?: number }) — minimal typed reducer callbacks"

key-files:
  created: []
  modified:
    - app/tools/ai-search.tsx
    - hooks/useDashboard.ts
    - app/log-payment.tsx
    - app/payments/index.tsx
    - app/reminders/index.tsx
    - app/expenses/index.tsx
    - app/(tabs)/dashboard/index.tsx
    - app/property/[id]/expenses/index.tsx
    - app/tools/_layout.tsx
    - app/notifications/index.tsx
    - app/(tabs)/properties/[id].tsx
    - app/property/[id]/expenses/add.tsx
    - app/property/[id]/expenses/[expenseId].tsx
    - app/property/[id]/tenant/[tenantId]/index.tsx
    - app/property/[id]/tenant/[tenantId]/payment/mark-paid.tsx
    - app/(tabs)/tools/index.tsx
    - app/onboarding/index.tsx
    - app/(auth)/phone-verify.tsx
    - app/(tabs)/profile/index.tsx
    - app/invite/[token].tsx

key-decisions:
  - "headerStyle as object (not as AnimatedStyle) — Expo Router's headerStyle expects AnimatedStyle but accepts plain object at runtime; as object is narrowest safe cast"
  - "SearchResult as unknown as TypedInterface — double-cast required because SearchResult has index signature [key: string]: unknown that doesn't overlap with concrete typed interfaces"
  - "RawTenants inline type in reminders filter — Supabase infers tenants as array for joined relations; cast to single-object interface before filter, then as unknown as ReminderItem[] after"
  - "payload.new as Record<string,unknown> then as unknown as User — Supabase Realtime payload.new is typed as object; narrowest path to User without introducing any"

patterns-established:
  - "Typed Supabase join rows: define local interface matching query shape, cast via as unknown as TypedInterface[]"
  - "Expo Router icon names: ComponentProps<typeof MaterialCommunityIcons>['name'] pattern"
  - "Expo Router navigation: import type Href, cast string routes as Href"

requirements-completed: [TS-03, EDGE-04]

# Metrics
duration: 45min
completed: 2026-03-18
---

# Phase 01 Plan 04: Remove All no-explicit-any Casts Summary

**Eliminated all 30+ `as any` and `: any` casts across 20 app/ screens and hooks, achieving zero ESLint errors and a clean lint CI gate**

## Performance

- **Duration:** 45 min
- **Started:** 2026-03-18T16:30:00Z
- **Completed:** 2026-03-18T17:15:00Z
- **Tasks:** 2 of 3 (Task 3 is non-blocking Sentry checkpoint)
- **Files modified:** 20

## Accomplishments
- Replaced all `as any` / `: any` casts in app/ screens and hooks/ — zero remain
- `npm run lint` now exits 0 with zero errors (89 warnings only) — usable as CI gate
- `npx tsc --noEmit` passes with zero errors
- Established typed patterns for Supabase join rows, Expo Router icon names, typed navigation

## Task Commits

Each task was committed atomically:

1. **Task 1: Type ai-search, useDashboard, payments, expenses, dashboard** - `b2dee9f` (fix)
2. **Task 2: Fix headerStyle, router, profile, phone-verify, tenant casts** - `e4ef0e1` (fix)
3. **Task 3: Sentry DSN checkpoint** - Non-blocking human-verify (no code changes needed)

## Files Created/Modified
- `app/tools/ai-search.tsx` - Added PaymentSearchResult, TenantSearchResult, PropertySearchResult interfaces; cast via unknown
- `hooks/useDashboard.ts` - Added DashboardPayment, DashboardTenant, RecentPaymentRow interfaces; catch err: unknown
- `app/log-payment.tsx` - Inline typed filter, catch err: unknown
- `app/payments/index.tsx` - RawPaymentRow type, ComponentProps icon cast, catch err: unknown
- `app/reminders/index.tsx` - RawTenants inline type for Supabase join filter
- `app/expenses/index.tsx` - Inline typed reducer callback
- `app/(tabs)/dashboard/index.tsx` - ComponentProps icon cast, typed expense reducer
- `app/property/[id]/expenses/index.tsx` - Inline typed reducer callback
- `app/tools/_layout.tsx` - headerStyle as object
- `app/notifications/index.tsx` - headerStyle as object
- `app/(tabs)/properties/[id].tsx` - headerStyle as object
- `app/property/[id]/expenses/add.tsx` - headerStyle as object
- `app/property/[id]/expenses/[expenseId].tsx` - headerStyle as object
- `app/property/[id]/tenant/[tenantId]/index.tsx` - headerStyle as object, ThemeColors for InfoRow
- `app/property/[id]/tenant/[tenantId]/payment/mark-paid.tsx` - headerStyle as object
- `app/(tabs)/tools/index.tsx` - router.push as Href, icon as ComponentProps
- `app/onboarding/index.tsx` - router.replace as Href
- `app/(auth)/phone-verify.tsx` - NativeSyntheticEvent<TextInputKeyPressEventData> handler
- `app/(tabs)/profile/index.tsx` - payload.new as Record<string,unknown>; setUser via unknown cast
- `app/invite/[token].tsx` - property_id ?? null to satisfy JsonType (pre-existing issue fixed)

## Decisions Made
- `headerStyle as object` — Expo Router's headerStyle expects `AnimatedStyle<ViewStyle>` but accepts plain objects at runtime. `as object` is the narrowest safe cast that avoids introducing `any`.
- `SearchResult as unknown as TypedInterface` — Double-cast is required because `SearchResult` has `[key: string]: unknown` index signature which TypeScript considers structurally incompatible with concrete property interfaces.
- `RawTenants` inline type in reminders filter — Supabase generates `tenants` as an array type for joined relations in TypeScript inference even when queried as a single nested object. We cast `item.tenants` to the correct single-object type before accessing filtered fields.
- `payload.new as Record<string, unknown> then as unknown as User` — Supabase Realtime `payload.new` is `object` type; we narrow to a dictionary first, check the field, then cast to `User` for `setUser()` — no `any` needed at any step.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pre-existing TypeScript error in app/invite/[token].tsx**
- **Found during:** Task 1 (running npx tsc --noEmit verification)
- **Issue:** `property_id: inviteData?.property_id` was typed as `string | undefined` but `track()` event properties use `JsonType` which excludes `undefined`
- **Fix:** Changed to `property_id: inviteData?.property_id ?? null`
- **Files modified:** app/invite/[token].tsx
- **Verification:** npx tsc --noEmit passes with zero errors
- **Committed in:** b2dee9f (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - pre-existing bug surfaced by tsc run)
**Impact on plan:** Fix was necessary to restore TypeScript baseline to zero errors. No scope creep.

## Issues Encountered
- Supabase infers joined table columns as array types in TypeScript even for single-object joins — required `as unknown as SingleType` pattern rather than direct cast.
- TypeScript rejected `item as TypedInterface` when `SearchResult` had `[key: string]: unknown` index — required double-cast through `unknown`.

## User Setup Required (Sentry — Task 3 Non-blocking Checkpoint)

Sentry SDK infrastructure is fully implemented (lib/sentry.ts, constants/config.ts, app/_layout.tsx). The only remaining step is creating a Sentry project and adding a DSN:

1. Create a Sentry account at https://sentry.io
2. Create a new project: Projects → Create Project → React Native
3. Copy the DSN from Project Settings → Client Keys (DSN)
4. Add to your .env file: `EXPO_PUBLIC_SENTRY_DSN=https://...@sentry.io/...`
5. Start the app: `npx expo start`
6. Optionally verify: temporarily add `Sentry.captureException(new Error('test'))` to any screen, check Sentry dashboard within 30 seconds, then remove.

**This is non-blocking.** The app works without a DSN. Production crash monitoring requires this setup before App Store submission.

## Next Phase Readiness
- `npm run lint` is now a clean CI gate: exits 0 with warnings only, zero errors
- `npx tsc --noEmit` passes with zero errors
- Phase 1 (Compilation & Tooling Baseline) is fully complete — all 4 plans done
- Phase 2 can begin: Deep Security Audit (auth, RLS, invite flow, bot webhooks)

---
*Phase: 01-compilation-tooling-baseline*
*Completed: 2026-03-18*

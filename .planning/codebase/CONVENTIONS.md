# Coding Conventions

**Analysis Date:** 2026-04-05

## TypeScript Configuration

**Strictness:**
- `strict: true` enabled in `tsconfig.json` (extends `expo/tsconfig.base`)
- Path alias: `@/*` maps to project root — used consistently across app, hooks, lib, components
- `supabase/functions` is excluded from the app-side `tsc` run (Edge Functions are Deno, type-checked separately by the Supabase CLI at deploy time)
- Type checking command: `npm run ts-check` → `tsc --noEmit`

**Type organization:**
- All shared database row types live in `lib/types.ts` as exported `interface` declarations (`User`, `Property`, `Tenant`, `Payment`, `Notification`, etc.)
- Enums-as-unions at top of `lib/types.ts`: `PaymentStatus = 'pending' | 'partial' | 'paid' | 'confirmed' | 'overdue'`, `InviteStatus = 'pending' | 'accepted' | 'expired'`
- Joined shapes are modelled inline via intersection: `(Tenant & { properties: Property })[]`
- Hook return shapes are declared as local `interface Use<Name>Result` inside each hook file (see `hooks/useProperties.ts` line 6)
- Component prop types are declared as local `interface <Component>Props` directly above the component (see `components/PropertyCard.tsx` line 17)
- `any` is used sparingly but not banned — typically at error-catch boundaries (`catch (err: any)`) and at Supabase storage cast sites

## Naming Patterns

**Files:**
- Components: PascalCase — `components/PropertyCard.tsx`, `components/ErrorBanner.tsx`
- Hooks: camelCase with `use` prefix — `hooks/useProperties.ts`, `hooks/usePayments.ts`
- Lib modules: kebab-case or single-word lowercase — `lib/supabase.ts`, `lib/theme-context.tsx`, `lib/biometric-auth.ts`, `lib/social-auth.ts`
- Expo Router screens: lowercase, kebab-case, brackets for dynamic segments — `app/log-payment.tsx`, `app/invite/[token].tsx`, `app/(tabs)/index.tsx`
- Edge Functions: kebab-case folders — `supabase/functions/process-bot-message/index.ts`

**Symbols:**
- Functions, variables, hooks: `camelCase` (`useProperties`, `bumpPropertyRefresh`, `formatCurrency`)
- React components: `PascalCase` (`PropertyCard`, `ErrorBanner`, `DwellaHeader`)
- TypeScript types, interfaces: `PascalCase` (`Property`, `Tenant`, `PaymentStatus`, `UsePropertiesResult`)
- Constants objects: `PascalCase` (`Colors`, `Shadows`, `LightTheme`)
- Database columns (coming from Supabase): `snake_case` (`owner_id`, `is_archived`, `invite_status`) — never renamed, used as-is throughout the app

## Component Patterns

**All components are function components.** No class components exist in the codebase.

**Export style:** Named exports, not default. Example from `components/PropertyCard.tsx`:
```tsx
export function PropertyCard({ property, isTenantView = false, ... }: PropertyCardProps) { ... }
```

**Default prop values:** Destructured inline with defaults (`isTenantView = false`) rather than `defaultProps`.

**Theme access:** Every component that needs colours calls `const { colors, shadows } = useTheme()` from `@/lib/theme-context`. Styles are split: layout/geometry in a `StyleSheet.create({})` at the bottom of the file, colour/shadow values passed inline via the `style={[styles.x, { backgroundColor: colors.y }]}` pattern. This is how dark-mode support is implemented without re-computing stylesheets.

**Paper vs raw RN:** Text always comes from `react-native-paper` (`import { Text } from 'react-native-paper'`). Layout primitives (`View`, `TouchableOpacity`, `ScrollView`, `StyleSheet`) come from `react-native`. Icons are `@expo/vector-icons` (`MaterialCommunityIcons`). Gradients use `expo-linear-gradient`.

**No error boundaries.** Grep for `ErrorBoundary` / `componentDidCatch` returns zero matches. Errors surface via per-screen `ErrorBanner` components (see `components/ErrorBanner.tsx`) driven by hook-level `error` state, and via `ToastProvider` in `components/ToastProvider.tsx` for transient failures.

## Hook Patterns

**Data hooks follow a single canonical shape.** Reference: `hooks/useProperties.ts`, `hooks/usePayments.ts`, `hooks/useTenants.ts`.

```typescript
export function useX(): UseXResult {
  const { user } = useAuthStore();
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!user) { setIsLoading(false); return; }
    setIsLoading(true); setError(null);
    try {
      const { data, error } = await supabase.from('x').select('*').eq('is_archived', false);
      if (error) throw error;
      setData((data as T[]) ?? []);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => { fetch(); }, [fetch]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel('x-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'x' }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetch]);

  return { data, isLoading, error, refresh: fetch };
}
```

**Conventions baked into this pattern:**
- Every list hook returns `{ data, isLoading, error, refresh }`
- Errors are stored as `string | null` (extracted via `err.message ?? 'fallback'`) — never the raw `Error` object
- Every query filters `is_archived = false` explicitly (the soft-delete contract is enforced at the query layer, not the DB layer)
- Realtime subscriptions are cleanup-safe and gated on `user`
- `propertyRefreshAt` in the Zustand store is used as a manual refresh trigger — screens call `bumpPropertyRefresh()` after mutations, which re-fires the hook's `useCallback` via dependency

## Zustand Store Patterns

**Single store:** `useAuthStore` in `lib/store.ts`. No slicing; one flat state interface.

**Persistence strategy:** Wraps the creator in `persist(..., { name: 'dwella-store', storage: createJSONStorage(() => AsyncStorage), partialize })`. Only `onboardingCompletedByUser` and `themeMode` are persisted. `isLocked` deliberately resets to `true` on every cold launch so the PIN screen always shows.

**Session vs app lock separation:** `isLocked` is an in-memory UI flag, completely orthogonal to the Supabase session. A valid session can coexist with a locked UI. Never touch Supabase to flip this.

**Setters:** Every field has a `setX` method that takes the value directly. Complex updates use the `set((s) => ({ ... }))` form.

**Derived helpers live on the store:** `isOnboardingCompleted()` is a method, not a selector, because it keys off `session.user.id` which may lag behind `user.id`.

**Per-user keying:** Onboarding state is keyed by user id (`onboardingCompletedByUser: Record<string, boolean>`) so switching accounts does not leak state. Fallback chain: `session.user.id → store.user.id → '_anon'`.

## Supabase Client Usage

**Single client singleton:** `lib/supabase.ts` exports `supabase` — a `createClient()` instance. Do not create additional clients in app code.

**Platform-aware storage:** Web uses `window.localStorage` (with SSR fallback to `undefined`); native uses `AsyncStorage`. This is why `auth.storage` is cast as `any`.

**Auth config:**
- `autoRefreshToken: true`
- `persistSession: true`
- `detectSessionInUrl: false`
- `flowType: 'implicit'` — PKCE is deliberately avoided because the code verifier gets lost when the JS thread is suspended during in-app browser auth (documented in the file comment)

**Query patterns:**
- Parallel fetches use `Promise.all([...])` (see `hooks/useProperties.ts` line 32)
- Joins use the string syntax `.select('*, properties(*)')`
- Results are cast to the typed shape: `(data as Property[]) ?? []`
- Errors are re-thrown inside the try block and caught by the surrounding `catch (err: any)`

**RLS assumptions:** The app assumes Supabase RLS policies enforce ownership. Queries still include `.eq('owner_id', user.id)` or `.eq('user_id', user.id)` as a defence-in-depth layer and to reduce row-count for performance — but the security boundary lives in Postgres. Every user-scoped table (`properties`, `tenants`, `payments`, `notifications`, `bot_conversations`) is expected to have RLS policies filtering by `auth.uid()`. Service-role access is only used from Edge Functions (`SUPABASE_SERVICE_ROLE_KEY` from env), never from the client app.

## Error Handling

**Pattern:** try/catch inside every async hook and action, with errors surfaced as strings.

```typescript
try {
  const { data, error } = await supabase.from('x')...;
  if (error) throw error;
  // ...
} catch (err: any) {
  setError(err.message ?? 'Failed to load x');
} finally {
  setIsLoading(false);
}
```

**No centralised error handler.** No error boundary. No Sentry wired up (see `CONCERNS.md` — Sentry DSN is still a pre-launch TODO).

**User-facing surfaces:**
- `components/ErrorBanner.tsx` — inline banner with retry, shown at the top of list screens
- `components/ToastProvider.tsx` + `lib/toast.ts` — transient toasts for action feedback
- `console.error` / `console.warn` for diagnostic noise that should never reach the user (e.g. `lib/supabase.ts` line 7)

**Edge Function errors:** Functions in `supabase/functions/*` catch and return `{ error: string }` JSON with non-200 status. The webhook-style functions (`telegram-webhook`, `process-bot-message`) generally swallow errors and return a user-friendly reply rather than bubbling an HTTP 500, to avoid Telegram retry storms.

## Import Organization

**Observed order** (see `hooks/useProperties.ts`, `app/_layout.tsx`, `components/PropertyCard.tsx`):

1. React / React Native built-ins (`react`, `react-native`)
2. Third-party packages (`expo-*`, `react-native-paper`, `@expo/vector-icons`, `@supabase/supabase-js`, `zustand`)
3. Internal `@/` path-aliased imports — typically in the order `@/lib/*`, `@/hooks/*`, `@/components/*`, `@/constants/*`
4. Relative imports (rare — mostly `./pdf.ts` inside Edge Functions)

No auto-import ordering tool is configured, so minor deviations exist. Group separation via a blank line is **not** consistent.

## Style Patterns

**Two layers of style:**
1. **Static layout** — `StyleSheet.create({})` at the bottom of each component file, for geometry, spacing, typography sizes.
2. **Dynamic theme values** — injected inline via `style={[styles.container, { backgroundColor: colors.background }]}` after calling `useTheme()`.

**Never hardcode colour hex values in components.** All colours flow from `constants/theme.ts` → `lib/theme-context.tsx` → `useTheme()`. The `constants/colors.ts` re-export exists for backward compatibility only — new code should import from `@/lib/theme-context`.

**Status colours** — always reference by semantic name from the theme:
- `colors.statusPending` (gray)
- `colors.statusPartial` (amber)
- `colors.statusPaid` (blue, unconfirmed)
- `colors.statusConfirmed` (green)
- `colors.statusOverdue` (red)
- Each has a `*Soft` variant for background tinting (e.g. `statusOverdueSoft` — see `components/ErrorBanner.tsx` line 17)

**Brand colour** is `colors.primary` (NoBroker Teal, per `constants/theme.ts`). Not indigo — the value in `CLAUDE.md` is stale.

**Shadows:** Pulled from `shadows.sm`, `shadows.md` on the `useTheme()` return value. Never construct `elevation` / `shadowOpacity` manually.

**Shared spacing tokens** live in `constants/spacing.ts`; typography in `constants/typography.ts`.

## Module Design

**Exports:** Named exports only. No `export default` in app code.

**Barrel files:** None. Import directly from the file (`@/components/PropertyCard`, not `@/components`).

**Lib modules are single-purpose:** `lib/payments.ts` holds payment state-machine logic, `lib/invite.ts` handles invite tokens, `lib/pdf.ts` handles PDF generation, `lib/notifications.ts` handles push registration, etc.

## Comments & Documentation

**Comments explain *why*, not *what*.** Examples from the codebase:
- `lib/supabase.ts` line 28-31: explains why `flowType: 'implicit'` is chosen (PKCE verifier loss)
- `lib/store.ts` line 17-23: explains why `isLocked` starts `true` on cold launch
- `hooks/useProperties.ts` line 22-23: explains the `propertyRefreshAt` dependency trick

**JSDoc** is used on Zustand store fields to document semantics (see `lib/store.ts` lines 14, 17-23, 24, 25-27, 28-32).

**No auto-generated API docs.** No doc-site generator.

---

*Convention analysis: 2026-04-05*

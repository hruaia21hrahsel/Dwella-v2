# Phase 1: Compilation & Tooling Baseline - Research

**Researched:** 2026-03-18
**Domain:** TypeScript compilation, ESLint configuration, Sentry React Native integration
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Sentry:** Crashes only at launch — no performance monitoring or breadcrumbs initially
- **Sentry DSN:** Stored as `EXPO_PUBLIC_SENTRY_DSN` env var, exported from `constants/config.ts`
- **Sentry scope:** Mobile app only — Edge Functions use Supabase's built-in function logs
- **Sentry project:** User doesn't have one yet — plan must include creation instructions
- **ESLint rollout:** Warn on existing violations, error on new code
- **ESLint plugins:** `eslint-plugin-security` + `@typescript-eslint` only — no style, React hooks, or a11y rules
- **ESLint trigger:** On-demand via npm script only — no pre-commit hooks
- **ESLint scope:** `app/`, `components/`, `hooks/`, `lib/`, `constants/` — Edge Functions excluded
- **`as any` scope:** Critical paths only: `lib/supabase.ts` auth storage, `app/_layout.tsx` auth fallback, `supabase/functions/send-reminders` tenant casts, payment flows
- **PostHog fix:** Remove `captureLifecycleEvents` entirely — do not find replacement API
- **Approach:** Auth storage `as any` fix — Claude's discretion (typed adapter vs narrower assertion)
- **ESLint config structure:** Claude's discretion
- **Sentry initialization placement:** Claude's discretion
- **ESLint baseline file approach:** Claude's discretion

### Claude's Discretion
- Auth storage `as any` fix approach (typed adapter vs narrower assertion)
- Exact ESLint config structure and rule severity levels
- Sentry SDK initialization placement and error boundary setup
- Loading skeleton for ESLint baseline file approach

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TS-01 | App compiles with zero errors via `npx tsc --noEmit` (fix PostHog captureLifecycleEvents) | Compilation already exits 0 — `captureLifecycleEvents` was removed previously. Plan must verify this and confirm zero errors as the baseline checkpoint. |
| TS-02 | All `as any` type casts in critical paths (auth, payments, Edge Functions) resolved with proper types | `SupportedStorage` type identified; `fallbackUser as any` pattern identified; send-reminders query shape identified. Typed solutions documented below. |
| TS-03 | ESLint with `eslint-plugin-security` and `@typescript-eslint` configured and passing | ESLint 10.0.3 + `@typescript-eslint/eslint-plugin` 8.57.1 compatible. Flat config (`eslint.config.js`) is correct format for ESLint 9+/10. |
| EDGE-04 | `@sentry/react-native` integrated for production error tracking | `@sentry/react-native` 8.4.0 is current. Compatible with Expo 54 (requires Expo >=49). Crash-only config documented. User must create Sentry project first. |
</phase_requirements>

---

## Summary

Phase 1 establishes the tooling baseline: compile-clean TypeScript, ESLint enforcement, and Sentry crash monitoring. Research reveals that **TypeScript already compiles with zero errors** — `npx tsc --noEmit` exits 0 today. The PostHog `captureLifecycleEvents` concern in CONCERNS.md was already addressed; the current code at `_layout.tsx:261` uses the correct `{ captureTouches: true, captureScreens: true }` shape which matches `PostHogAutocaptureOptions`. The TS-01 task therefore becomes: verify zero errors, document the baseline, then proceed to the `as any` fixes.

The three `as any` casts in scope have concrete typed solutions. The `lib/supabase.ts` storage cast requires understanding `SupportedStorage = PromisifyMethods<Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>>` — `AsyncStorage` satisfies this because its methods are already async, but `window.localStorage` (synchronous `Storage`) does not satisfy it directly, which is why the cast exists. The `app/_layout.tsx` `fallbackUser as any` is simpler — the `fallbackUser` object is missing fields required by the `User` interface (e.g., `created_at`, `updated_at`, `telegram_*`, etc.). The `send-reminders` edge function casts arise from Supabase's inferred type for a nested select not including `due_day` and `properties.name` in the static type without a local interface.

ESLint configuration uses ESLint 10 flat config format (`eslint.config.js`) since `@typescript-eslint/eslint-plugin` 8.57.1 supports ESLint `^8.57.0 || ^9.0.0 || ^10.0.0` and ESLint 10 is current. Sentry 8.4.0 supports Expo >=49 (project uses 54) and initializes in `app/_layout.tsx` wrapping the root component or via a standalone `lib/sentry.ts` init module called early in `_layout.tsx`.

**Primary recommendation:** Tackle in order — (1) verify TS baseline, (2) fix `as any` casts, (3) configure ESLint, (4) integrate Sentry. Each is independently verifiable.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@sentry/react-native` | 8.4.0 | Production crash monitoring | Official Sentry SDK for React Native/Expo. Peer: Expo >=49, React >=17, RN >=0.65. |
| `eslint` | 10.0.3 | JS/TS linting runner | Current stable. Flat config (eslint.config.js) is the required format for v9+. |
| `@typescript-eslint/eslint-plugin` | 8.57.1 | TypeScript-aware lint rules | Official TS lint plugin. Pairs with same-version parser. |
| `@typescript-eslint/parser` | 8.57.1 | TypeScript parser for ESLint | Required peer of the plugin. Must match plugin version. |
| `eslint-plugin-security` | 4.0.0 | Security-focused lint rules | Catches `Math.random()`, `eval`, regex injection, etc. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@sentry/babel-plugin-component-annotator` | - | Component name in Sentry stack traces | Optional — only if trace readability is needed immediately |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ESLint 10 flat config | ESLint 8 + `.eslintrc.json` | ESLint 8 is EOL; flat config is future-proof and required for v10 |
| `@sentry/react-native` | Bugsnag, Datadog | Sentry has best-in-class Expo integration and free tier |

**Installation:**
```bash
npx expo install @sentry/react-native
npm install --save-dev eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint-plugin-security
```

**Version verification (confirmed 2026-03-18):**
- `@sentry/react-native`: 8.4.0
- `eslint`: 10.0.3
- `@typescript-eslint/eslint-plugin`: 8.57.1
- `@typescript-eslint/parser`: 8.57.1
- `eslint-plugin-security`: 4.0.0

---

## Architecture Patterns

### TypeScript Compilation State

The codebase **already compiles clean**. `npx tsc --noEmit` exits 0. The CONCERNS.md entry for `captureLifecycleEvents` refers to a historical state. Current `_layout.tsx:261`:

```typescript
// Current code — already correct, no TS error
autocapture={{ captureTouches: true, captureScreens: true }}
```

`PostHogAutocaptureOptions` (verified from `node_modules/posthog-react-native/dist/types.d.ts`) contains `captureTouches?: boolean` and `captureScreens?: boolean`. `captureLifecycleEvents` was never valid and was already removed from the live code before this planning cycle began.

**TS-01 task:** Run `npx tsc --noEmit`, confirm exit 0, record as baseline. No fix needed.

### Pattern 1: Fix `lib/supabase.ts` Auth Storage `as any`

**What:** Replace `authStorage as any` with a typed `SupportedStorage` compatible adapter.

**Why `as any` exists:** `SupportedStorage` is defined as `PromisifyMethods<Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>> & { isServer?: boolean }`. This means `getItem` must return `Promise<string | null>`. `window.localStorage.getItem` returns `string | null` synchronously — it does not satisfy the type. `AsyncStorage.getItem` returns `Promise<string | null | undefined>` — the `undefined` case also technically mismatches `string | null`.

**Cleanest approach — typed union with explicit cast on the web branch only:**

```typescript
// Source: @supabase/auth-js dist/module/lib/types.d.ts (inspected 2026-03-18)
import { SupportedStorage } from '@supabase/supabase-js';

const authStorage: SupportedStorage | undefined =
  Platform.OS === 'web'
    ? typeof window !== 'undefined'
      ? window.localStorage as unknown as SupportedStorage  // narrowed cast — localStorage satisfies runtime shape
      : undefined
    : AsyncStorage as unknown as SupportedStorage;          // narrowed cast — AsyncStorage satisfies runtime shape
```

This replaces a single unguarded `as any` with a narrower `as unknown as SupportedStorage` applied to each branch separately. TypeScript still sees the explicit conversion chain (not a silent bypass), and the runtime behavior is identical.

**Alternative (simpler but less self-documenting):**

```typescript
// Declare authStorage type explicitly, then cast once at use site
const authStorage = Platform.OS === 'web'
  ? (typeof window !== 'undefined' ? window.localStorage : undefined)
  : AsyncStorage;

// In createClient:
storage: authStorage as SupportedStorage | undefined,
```

This keeps the original structure and replaces `as any` with the precise destination type. Both are acceptable; the planner should pick whichever produces cleaner diff.

### Pattern 2: Fix `app/_layout.tsx` `fallbackUser as any`

**What:** Replace `setUser(fallbackUser as any)` with a typed partial that satisfies the `User` interface.

**Why `as any` exists:** The `User` interface (from `lib/types.ts`) contains fields that aren't available from session metadata alone (e.g., `created_at`, `updated_at`, any telegram/whatsapp fields). The fallback constructs a minimal object.

**Typed fix — use `Partial<User> & Pick<User, 'id' | 'email'>` or extend the store:**

Option A — Extend store to accept `Partial<User>`:
```typescript
// In lib/store.ts, change setUser signature:
setUser: (user: User | Partial<User> | null) => void;
```

Option B — Make the fallback satisfy `User` by supplying null defaults for optional fields:
```typescript
const fallbackUser: User = {
  id: uid,
  email: newSession.user.email ?? '',
  full_name: newSession.user.user_metadata?.full_name ?? null,
  phone: newSession.user.user_metadata?.phone ?? null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  // any other required User fields with null/empty defaults
};
setUser(fallbackUser);  // no cast needed
```

Option B is preferred — it stays entirely local to `_layout.tsx`, makes the fallback contract explicit, and requires no store interface change. The planner should inspect `lib/types.ts` `User` interface to enumerate all required fields and supply nulls/empty strings for missing ones.

### Pattern 3: Fix `send-reminders/index.ts` Tenant `as any` Casts

**Context (Edge Function — Deno runtime, excluded from `tsconfig.json`):**

The query is:
```typescript
.from('tenants')
.select('id, tenant_name, due_day, user_id, property_id, properties(name)')
```

Supabase's generated types (if `@supabase/supabase-js` types are present) don't automatically include nested `properties` in the inferred row type. Without database-generated types, the query result is typed as the base table row, so `tenant.due_day` and `(tenant as any).properties?.name` require casts.

**Fix — define a local interface for the query result:**

```typescript
// At the top of send-reminders/index.ts
interface TenantWithProperty {
  id: string;
  tenant_name: string;
  due_day: number;
  user_id: string | null;
  property_id: string;
  properties: { name: string } | null;
}

// Then cast the query result, not individual fields:
const { data: tenants } = await supabase
  .from('tenants')
  .select('id, tenant_name, due_day, user_id, property_id, properties(name)')
  .eq('is_archived', false)
  .not('user_id', 'is', null) as { data: TenantWithProperty[] | null; error: unknown };

// Now access without casts:
const daysUntilDue = tenant.due_day - todayDay;
const propertyName = tenant.properties?.name ?? 'your property';
```

Note: Edge Functions run on Deno. TypeScript is checked by the Deno runtime's own type checker, not the project's `tsconfig.json` (which excludes `supabase/functions`). The fix above is valid Deno/TypeScript. Verification for this fix must use `deno check` or review the code directly, not `npx tsc --noEmit`.

### Pattern 4: ESLint Flat Config (`eslint.config.js`)

ESLint 9+ uses flat config by default. ESLint 10 (current) requires it. The `.eslintrc.*` legacy format is not supported in v10.

```javascript
// eslint.config.js — Source: @typescript-eslint docs + eslint-plugin-security README
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import security from 'eslint-plugin-security';

export default [
  {
    // Scope: app code only, not Edge Functions or node_modules
    files: [
      'app/**/*.{ts,tsx}',
      'components/**/*.{ts,tsx}',
      'hooks/**/*.{ts,tsx}',
      'lib/**/*.{ts,tsx}',
      'constants/**/*.{ts,tsx}',
    ],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      security,
    },
    rules: {
      // TypeScript rules — error on new code, warn on existing violations
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',

      // Security rules — all warn to avoid breaking existing code
      'security/detect-non-literal-regexp': 'warn',
      'security/detect-unsafe-regex': 'warn',
      'security/detect-object-injection': 'warn',
      'security/detect-possible-timing-attacks': 'warn',
      'security/detect-pseudoRandomBytes': 'warn',
    },
  },
];
```

**Severity rationale (per user decision):** `@typescript-eslint/no-explicit-any` is set to `'error'` to catch new `as any` introductions. Type-checking rules (`no-unsafe-*`) are `'warn'` because they generate noise on existing code that isn't in the critical path. Security rules are all `'warn'` to start — allows review without blocking.

**npm script to add to `package.json`:**
```json
"lint": "eslint ."
```

Run with: `npm run lint`

### Pattern 5: Sentry Initialization for Expo (Crash-Only)

```typescript
// lib/sentry.ts — new file following lib/posthog.ts pattern
import * as Sentry from '@sentry/react-native';
import { SENTRY_DSN } from '@/constants/config';

export function initSentry(): void {
  if (!SENTRY_DSN) return; // no-op in dev without DSN

  Sentry.init({
    dsn: SENTRY_DSN,
    // Crash-only config per user decision — no performance monitoring
    tracesSampleRate: 0,        // disable performance monitoring
    enableAutoPerformanceTracing: false,
    enableAutoSessionTracking: false,
    debug: false,
  });
}
```

```typescript
// constants/config.ts — add one export:
export const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';
```

```typescript
// app/_layout.tsx — call initSentry() early, before component render:
import { initSentry } from '@/lib/sentry';

initSentry(); // call at module level (before SplashScreen.preventAutoHideAsync)
```

**Sentry project setup steps (user must do before task can complete):**
1. Create account at sentry.io → New Project → React Native
2. Copy DSN from project settings
3. Add `EXPO_PUBLIC_SENTRY_DSN=https://...@sentry.io/...` to `.env`
4. Add `EXPO_PUBLIC_SENTRY_DSN=` to `.env.example`

**Note on `@sentry/react-native` with Expo managed workflow:** Sentry 8.x works with Expo managed workflow without native code changes for basic crash capture. The SDK wraps the JS error handler (`global.ErrorUtils`) which works in both Expo Go and production builds. For full native crash reporting (OOM kills, native crashes), EAS build with the Sentry plugin is required — but this is out of scope for the crash-only baseline.

### Recommended Project Structure Changes

No new directories needed. New/modified files:

```
eslint.config.js         # new — ESLint flat config
lib/sentry.ts            # new — Sentry init (follows lib/posthog.ts pattern)
lib/supabase.ts          # modify line 24 — remove as any from authStorage
app/_layout.tsx          # modify — initSentry() call + fallbackUser typed fix
constants/config.ts      # modify — add SENTRY_DSN export
.env.example             # modify — add EXPO_PUBLIC_SENTRY_DSN=
package.json             # modify — add lint script + devDeps
supabase/functions/send-reminders/index.ts  # modify — local interface, remove as any
```

### Anti-Patterns to Avoid

- **Do not use `eslint:recommended` alone** — it doesn't cover TypeScript-specific rules and will miss type errors.
- **Do not use `.eslintrc.json`** — ESLint 10 ignores legacy config files by default; use `eslint.config.js`.
- **Do not set `tracesSampleRate > 0` for Sentry** — user decision is crash-only; performance traces cost quota and add overhead.
- **Do not add Sentry as a navigation wrapper** — Sentry routing instrumentation is out of scope; keep init minimal.
- **Do not use `as any` anywhere in the fixed files** — defeats the purpose of TS-02.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Production crash capture | Custom `global.ErrorUtils` wrapper | `@sentry/react-native` | Handles symbolication, grouping, alerts, rate limiting, and filtering — none of which a custom handler gives you |
| TypeScript linting | Manual code review | `@typescript-eslint/eslint-plugin` | Rule coverage is comprehensive; type-aware rules require parser integration that's non-trivial to replicate |
| Security smell detection | Grep for `Math.random` | `eslint-plugin-security` | `detect-pseudoRandomBytes` and `detect-unsafe-regex` cover patterns that grep misses |

**Key insight:** All three tools have been the standard for years in the React Native ecosystem. There are no credible custom alternatives worth considering.

---

## Common Pitfalls

### Pitfall 1: Assuming TS Compilation Has Errors (It Doesn't)

**What goes wrong:** Plan includes a task to "fix the PostHog captureLifecycleEvents error" but the error is already gone. Task spends time on a phantom problem.
**Why it happens:** CONCERNS.md was written before the fix was applied to `_layout.tsx`. The current file uses the correct `{ captureTouches, captureScreens }` shape.
**How to avoid:** Run `npx tsc --noEmit` first. Confirm exit 0. Then proceed to `as any` fixes.
**Warning signs:** If tsc reports an error on line 261 of `_layout.tsx`, the file has been modified since this research.

### Pitfall 2: Using ESLint Legacy Config Format

**What goes wrong:** Creates `.eslintrc.json` which ESLint 10 silently ignores, giving a false "no errors" result.
**Why it happens:** ESLint 10 switched to flat config by default and ignores `.eslintrc.*` unless `ESLINT_USE_FLAT_CONFIG=false` is set.
**How to avoid:** Use `eslint.config.js` (flat config). Verify with `npx eslint --version` (should be 10.x) and `npx eslint --print-config app/_layout.tsx` to confirm rules are loaded.
**Warning signs:** `npm run lint` produces no output at all despite obvious violations.

### Pitfall 3: `@typescript-eslint` Type-Aware Rules Require `parserOptions.project`

**What goes wrong:** Rules like `no-unsafe-assignment` report "Parsing error: You have used a rule which requires parserServices to be generated."
**Why it happens:** Type-aware rules need access to the TypeScript program, which requires `project: './tsconfig.json'` in `parserOptions`.
**How to avoid:** Include `parserOptions: { project: './tsconfig.json' }` in `eslint.config.js` (shown in Pattern 4 above).
**Warning signs:** ESLint output contains "requires parserServices" error.

### Pitfall 4: Sentry DSN in Wrong Env Var Format

**What goes wrong:** Sentry never receives errors because the DSN is defined as `SENTRY_DSN` (server-side) instead of `EXPO_PUBLIC_SENTRY_DSN` (client-side). The value is `undefined` at runtime in the Expo bundle.
**Why it happens:** Expo only includes env vars with the `EXPO_PUBLIC_` prefix in the client bundle (via `process.env`).
**How to avoid:** Always use `EXPO_PUBLIC_SENTRY_DSN`. The `lib/sentry.ts` `initSentry()` function should log a dev warning if DSN is empty.
**Warning signs:** `Sentry.init()` called but DSN is empty string; no events appear in Sentry dashboard.

### Pitfall 5: `as any` Fix on `authStorage` Breaks Web Support

**What goes wrong:** Removing the `as any` cast and replacing with a strict `AsyncStorage` type reference causes a TypeScript error on the `window.localStorage` branch, or vice versa.
**Why it happens:** `window.localStorage` is synchronous; `SupportedStorage` expects async methods. Direct assignment without a cast still fails type checking.
**How to avoid:** Use the `as unknown as SupportedStorage` pattern (Pattern 1 above) on each branch independently. This is structurally safe because both storage objects satisfy the runtime contract.
**Warning signs:** After fix, `tsc --noEmit` reports a type error on `lib/supabase.ts`.

---

## Code Examples

### Verify Compilation Baseline
```bash
# Source: package.json scripts.ts-check
npx tsc --noEmit
echo "Exit code: $?"
# Expected: Exit code: 0
```

### Run ESLint After Configuration
```bash
# After adding eslint.config.js and devDependencies:
npm run lint
# To see rule counts:
npm run lint -- --format compact
```

### Verify Sentry is Capturing (Dev Test)
```typescript
// Temporary test — add to a screen, verify in Sentry dashboard, then remove
import * as Sentry from '@sentry/react-native';
Sentry.captureException(new Error('Sentry baseline test'));
```

### ESLint Rule: Catch Future `as any` Introductions
```javascript
// In eslint.config.js — this rule catches new `as any` at error severity
'@typescript-eslint/no-explicit-any': 'error',
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `.eslintrc.json` / `.eslintrc.js` | `eslint.config.js` (flat config) | ESLint v9 (2024), required in v10 | All ESLint config must be in flat format |
| Separate `@typescript-eslint/eslint-plugin` + config packages | Single `@typescript-eslint` package (v8) | v8.0 (2024) | Simpler setup; `tseslint.config()` helper available |
| `@sentry/expo` wrapper package | Direct `@sentry/react-native` | Sentry SDK v7+ consolidation | One package for all Expo/RN projects |
| `Sentry.wrap(App)` HOC pattern | Module-level `Sentry.init()` | Modern Sentry RN SDK | Simpler — no component wrapping needed for crash capture |

**Deprecated/outdated:**
- `@sentry/expo`: Do not use — it's a thin wrapper that adds complexity. Use `@sentry/react-native` directly.
- `eslint-config-universe` (Expo's own config): Not relevant for this project — it's an opinionated style config, not security+types focused.
- `tslint`: Fully deprecated since 2019. All TS linting is via `@typescript-eslint`.

---

## Open Questions

1. **`fallbackUser` Required Fields**
   - What we know: `fallbackUser` needs `id`, `email`, `full_name`, `phone`
   - What's unclear: The complete `User` interface in `lib/types.ts` — how many fields are required vs optional
   - Recommendation: Planner must read `lib/types.ts` during implementation to enumerate all required fields and supply null/empty defaults in the typed `fallbackUser`

2. **Sentry Source Maps for Production**
   - What we know: Sentry crash reports are most useful with symbolicated stack traces
   - What's unclear: Whether EAS build + Sentry source map upload is in scope for this phase
   - Recommendation: Out of scope for Phase 1 (crash-only baseline). Source map upload can be added in a post-launch phase. Raw JS stack traces are still useful for unhandled errors.

3. **`eslint-plugin-security` False Positive Rate**
   - What we know: `detect-object-injection` fires on nearly all `obj[key]` patterns, including legitimate ones in React Native code
   - What's unclear: How noisy it will be on this codebase specifically
   - Recommendation: Start with all security rules at `'warn'`. After first run, identify false-positive-heavy rules and either disable them or add inline suppressions. Do not block on this.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7.0 + jest-expo 55.0.9 |
| Config file | `jest.config.js` (exists) |
| Quick run command | `npx jest --passWithNoTests` |
| Full suite command | `npx jest` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TS-01 | `npx tsc --noEmit` exits 0 | CLI verification | `npx tsc --noEmit && echo OK` | N/A — compiler, not test |
| TS-02 | No `as any` in critical paths | Code inspection + CLI | `grep -rn "as any" lib/supabase.ts app/_layout.tsx supabase/functions/send-reminders/` | N/A — grep count |
| TS-03 | ESLint passes with no errors in `app/`, `components/`, `hooks/`, `lib/`, `constants/` | CLI verification | `npm run lint` | ❌ Wave 0 — `eslint.config.js` needed |
| EDGE-04 | Sentry DSN present and init called | Code inspection | `grep -n "initSentry\|Sentry.init" app/_layout.tsx lib/sentry.ts` | ❌ Wave 0 — `lib/sentry.ts` needed |

### Sampling Rate
- **Per task commit:** Run the specific CLI verification for that requirement (e.g., `npx tsc --noEmit` after TS-01)
- **Per wave merge:** `npx tsc --noEmit && npm run lint`
- **Phase gate:** All four CLI verifications green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `eslint.config.js` — ESLint flat config covering TS-03
- [ ] `lib/sentry.ts` — Sentry init module covering EDGE-04

*(No missing test files — this phase is tooling setup, not feature code; verification is CLI-based)*

---

## Sources

### Primary (HIGH confidence)
- `node_modules/posthog-react-native/dist/types.d.ts` — `PostHogAutocaptureOptions` interface verified: `captureTouches`, `captureScreens`, no `captureLifecycleEvents`
- `node_modules/@supabase/auth-js/dist/module/lib/types.d.ts` — `SupportedStorage` type definition verified
- `node_modules/@react-native-async-storage/async-storage/lib/typescript/index.d.ts` — AsyncStorage type verified
- `npm view @sentry/react-native` (run 2026-03-18) — version 8.4.0, peerDependencies: expo >=49, react >=17, RN >=0.65
- `npm view eslint` (run 2026-03-18) — version 10.0.3
- `npm view @typescript-eslint/eslint-plugin` (run 2026-03-18) — version 8.57.1, peerDeps: eslint ^8.57.0 || ^9.0.0 || ^10.0.0
- `npm view @typescript-eslint/parser` (run 2026-03-18) — version 8.57.1
- `npm view eslint-plugin-security` (run 2026-03-18) — version 4.0.0
- `npx tsc --noEmit` (run 2026-03-18) — exits 0, zero errors confirmed

### Secondary (MEDIUM confidence)
- Sentry React Native flat config initialization pattern — based on `@sentry/react-native` 8.x README pattern (module-level init without HOC)

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified from npm registry 2026-03-18
- Architecture: HIGH — all types verified from installed node_modules, not assumed from training data
- Pitfalls: HIGH — ESLint flat config requirement verified from ESLint 10 changelog; Sentry DSN naming verified from Expo env var docs pattern

**Research date:** 2026-03-18
**Valid until:** 2026-06-18 (stable tooling ecosystem — versions may update but patterns remain)

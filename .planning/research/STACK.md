# Stack Research

**Domain:** React Native / Expo mobile app — audit, hardening, and launch readiness
**Researched:** 2026-03-17
**Confidence:** HIGH (core tools), MEDIUM (profiling/leak detection)

---

## Context

This stack targets an **existing** React Native + Expo SDK 54 + Supabase app (Dwella v2) that is
feature-complete and in TestFlight beta. The audit covers four dimensions:

1. **Code quality** — TypeScript strictness, ESLint, type safety
2. **Security** — Crypto, RLS, token safety, log hygiene
3. **Launch config** — EAS, app.json, store metadata
4. **Runtime resilience** — Error tracking, memory leaks, Realtime cleanup

Nothing below requires ejecting from the Expo managed workflow.

---

## Recommended Stack

### Core Audit Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| TypeScript strict mode | ^5.3.0 (already present) | Catch `as any`, untyped nulls, unsafe calls at compile time | The single highest-ROI change — already has TS, turning `strict: true` on in tsconfig catches the `as any` casts that are already flagged in CONCERNS.md without writing a single new test |
| `@typescript-eslint/eslint-plugin` | ^7.x | Enforce `no-explicit-any`, `no-unsafe-call`, `no-floating-promises` as errors | Works with the existing ESLint/TS setup; the recommended-type-checked config catches runtime-unsafe patterns that tsc alone misses |
| `eslint-plugin-security` | ^3.x | Flag `Math.random()` usage, RegExp injection, `eval()` calls | Directly catches the CONCERNS.md #2 and #3 issues (weak UUID/code generation with `Math.random()`) at lint time rather than requiring manual audit |
| `expo-crypto` | ~15.0.8 (already installed) | Cryptographically secure `randomUUID()` and `getRandomValues()` | Already in package.json — zero install cost. `Crypto.randomUUID()` uses the platform CSPRNG on iOS/Android/Web; replaces the `Math.random()` UUID in `lib/bot.ts` directly |

### Security Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `expo-crypto` | ~15.0.8 (installed) | Replace `Math.random()` with CSPRNG for UUID/code generation | Immediately — both `lib/bot.ts` issues (CONCERNS #2, #3) are fixed with `Crypto.randomUUID()` and `getRandomValues()` |
| Supabase Security Advisor | Built into Supabase Dashboard | Scan RLS policies for misconfiguration using Splinter (Postgres security linter) | Run against live Supabase project to catch tables with RLS disabled or overly permissive policies |
| Supabase `auth.uid()` guard pattern | SQL | Enforce per-user RLS at DB level | Every table in the public schema must have `ENABLE ROW LEVEL SECURITY` plus a SELECT policy that gates on `auth.uid() = owner_id` |

### Error Monitoring

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@sentry/react-native` | ^6.x | Production error capture with full stack traces, Expo Router breadcrumbs, session replay | Use instead of the deprecated `sentry-expo` (dropped at SDK 50). Requires adding `@sentry/react-native/metro` to `metro.config.js` and `@sentry/react-native/expo` plugin to `app.json` |

Note: The app already has PostHog for analytics. Sentry is complementary — PostHog captures user behavior, Sentry captures crashes and exceptions. They do not overlap.

### Launch Config & Store Tooling

| Tool | Purpose | Notes |
|------|---------|-------|
| EAS CLI (`eas-cli`) | Build validation, store submission, OTA update config | Already implied by project. Validate `eas.json` has production profile with correct `bundleIdentifier` / `applicationId` before final submission |
| `expo-updates` | OTA patches post-launch without store review | Already installed (v29). Configure `runtimeVersion` and `channel` in `eas.json` before production release |
| App Store Connect / Play Console metadata check | Screenshot dimensions, privacy nutrition label, privacy policy URL | Not a library — manual pre-launch checklist step. Required before App Review will approve |

### Development & Profiling Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| React Native DevTools (built into Expo SDK 54) | Memory heap snapshots, Console, Network, Profiler tabs | Access via `npx expo start` → DevTools. Use Memory tab to take heap snapshot before and after navigating between screens to confirm Realtime channel cleanup (CONCERNS #10) |
| Hermes Heap Snapshots | Identify retained objects across navigation events | Available through React Native DevTools Memory tab. Take a snapshot, navigate away from a screen, force GC, take another — leaked subscriptions show as retained nodes |
| `npx tsc --noEmit` | Catch all compile errors before any build | Already in `package.json` as `npm run ts-check`. Must pass with zero errors before release |

---

## Installation

```bash
# ESLint security audit plugins (dev deps)
npx expo install --dev @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint-plugin-security eslint-plugin-react-hooks

# Error monitoring
npx expo install @sentry/react-native

# expo-crypto is already installed — no install needed
# expo-updates is already installed — no install needed
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `@sentry/react-native` | Bugsnag, Datadog RUM | Use Bugsnag if the team already has a Bugsnag account from another project. Datadog if the org uses Datadog for backend — unified dashboard is worth the cost. For a greenfield launch, Sentry is the default because it has the deepest Expo Router integration |
| Supabase Security Advisor | Manual RLS review via `psql` | Manual review is sufficient for small schemas. Security Advisor is faster and catches edge cases (functions that bypass RLS via `SECURITY DEFINER`) |
| `eslint-plugin-security` | Manual grep for `Math.random` | Manual grep finds it once; the lint rule prevents it from being reintroduced post-launch |
| TypeScript `strict: true` | `strictNullChecks: true` only | Enable full strict mode — the individual flags (`strictNullChecks`, `noImplicitAny`, `strictFunctionTypes`) are all subsets. There is no reason to enable them piecemeal |
| React Native DevTools (Hermes CDP) | Flipper | Flipper is largely abandoned as of 2024. React Native DevTools replaced it as the official debugger from RN 0.73+. Since this project is on RN 0.81.5, use DevTools exclusively |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `sentry-expo` | Deprecated at Expo SDK 50, no longer maintained | `@sentry/react-native` with the metro and expo config plugins |
| Flipper | Officially deprecated and not maintained for RN 0.73+; setup is fragile on modern architectures | React Native DevTools (built into the runtime, no plugin install required) |
| `Math.random()` for security tokens | Not a CSPRNG — output is predictable and can be reverse-engineered by an attacker watching multiple token outputs | `expo-crypto`'s `Crypto.randomUUID()` or `Crypto.getRandomValues()` |
| `console.log()` for sensitive data | Logs are accessible in Xcode Console, Android Logcat, and may be captured by device analytics | Remove all logs of tokens, verification codes, and API keys before production build. Use `__DEV__` guards on debug logging |
| Manual SQL `psql` for RLS testing | Error-prone, doesn't simulate the `auth.uid()` JWT context correctly | Supabase Dashboard Security Advisor or integration tests using the Supabase client with a test user's JWT |
| `as any` to satisfy TypeScript | Bypasses the entire type system at that point; hides real interface mismatches | Define proper interfaces for query result shapes. Supabase's `supabase gen types typescript` generates typed client from the DB schema |

---

## Stack Patterns by Variant

**For the TypeScript/ESLint audit pass:**
- Enable `"strict": true` in `tsconfig.json`
- Add `@typescript-eslint/recommended-type-checked` to ESLint extends
- Add `eslint-plugin-security` recommended config
- Run `npm run ts-check` until zero errors — fix each `as any` by defining the correct interface

**For the Supabase RLS audit:**
- Open Supabase Dashboard → Database → Security Advisor
- Run the scan — it uses Splinter to enumerate tables without RLS and policies that allow all access
- Also manually verify: every table has `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` and all Edge Functions that bypass RLS use `service_role` key only (never `anon` key for writes)

**For the crypto fix (CONCERNS #2, #3):**
- In `lib/bot.ts`, replace the `randomUUID()` polyfill with `import * as Crypto from 'expo-crypto'; Crypto.randomUUID()`
- Replace the 6-digit code with `const arr = new Uint32Array(1); Crypto.getRandomValues(arr); const code = String(100000 + (arr[0] % 900000))`
- Both are synchronous on native; no async changes needed

**For launch config validation:**
- Run `eas build --platform all --profile production --dry-run` to validate eas.json before triggering a real build
- Confirm `app.json` has correct `version`, `ios.buildNumber`, `android.versionCode` incremented from last TestFlight build
- Confirm `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are set as EAS environment variables (not committed to repo)

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `@sentry/react-native` ^6.x | Expo SDK 54, RN 0.81.5, Expo Router v6 | Requires `@sentry/react-native/expo` plugin in `app.json` plugins array. Check that the Sentry metro transformer wraps the existing metro config — do not replace it |
| `@typescript-eslint/eslint-plugin` ^7.x | TypeScript ^5.3 | Version 7 requires ESLint v8 or v9. Check existing ESLint version in project before installing |
| `eslint-plugin-security` ^3.x | ESLint v8+ | No React Native specific conflicts; pure static analysis |
| `expo-crypto` ~15.0.8 | Expo SDK 54 | Already installed and versioned correctly — no upgrade needed |
| `expo-updates` ~29.0.16 | Expo SDK 54 | Already installed. Requires `runtimeVersion` field in `app.json` and matching `channel` in `eas.json` production profile to be set before first OTA update is published |

---

## Sources

- [Expo Crypto Documentation](https://docs.expo.dev/versions/latest/sdk/crypto/) — `randomUUID()` and `getRandomValues()` are CSPRNG-backed. HIGH confidence.
- [Supabase Security Advisor / Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) — official RLS docs. HIGH confidence.
- [Supabase Security Retro 2025](https://supaexplorer.com/dev-notes/supabase-security-2025-whats-new-and-how-to-stay-secure.html) — Security Advisor and Splinter tool. MEDIUM confidence (third-party summary of official changes).
- [Sentry for Expo (official)](https://docs.expo.dev/guides/using-sentry/) — confirms `sentry-expo` deprecation, recommends `@sentry/react-native` directly. HIGH confidence.
- [Sentry React Native docs](https://docs.sentry.io/platforms/react-native/manual-setup/expo/) — Expo Router instrumentation. HIGH confidence.
- [eslint-plugin-security npm](https://www.npmjs.com/package/eslint-plugin-security) — `detect-pseudo-random-number` and related rules catch `Math.random()`. HIGH confidence.
- [TypeScript ESLint rules](https://typescript-eslint.io/rules/) — `no-explicit-any`, `no-unsafe-call` rule specs. HIGH confidence.
- [React Native DevTools](https://reactnative.dev/docs/react-native-devtools) — Flipper replacement, CDP-based. HIGH confidence.
- [Expo Debugging Tools](https://docs.expo.dev/debugging/tools/) — Memory tab for heap snapshots. HIGH confidence.
- [Supabase Edge Functions Error Handling](https://supabase.com/docs/guides/functions/error-handling) — proper HTTP status code guidance for Edge Functions. HIGH confidence.

---

*Stack research for: Dwella v2 — Audit & Hardening (React Native + Expo + Supabase)*
*Researched: 2026-03-17*

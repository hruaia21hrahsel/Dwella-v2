# Testing Patterns

**Analysis Date:** 2026-04-05

## Honest Summary

**There are no automated tests in this repository.** This section is load-bearing for any legal, compliance, or launch-readiness audit — it must be read as-is, not softened.

- Zero unit tests
- Zero integration tests
- Zero end-to-end tests
- Zero snapshot tests
- No test runner installed (no `jest`, no `vitest`, no `@testing-library/*`, no `detox`, no `playwright`, no `maestro`)
- No `__tests__` directories anywhere in `app/`, `components/`, `hooks/`, `lib/`, or `supabase/functions/`
- No `.test.ts`, `.test.tsx`, `.spec.ts`, or `.spec.tsx` files anywhere in the repository
- `package.json` has no `test` script — only `start`, `android`, `ios`, `web`, `ts-check`
- No test-related entries in `devDependencies` in `package.json`

**What this means:**
- Any regression surfaces only at runtime, in the app, by a human clicking through it
- The payment state machine (`pending → partial → paid → confirmed → overdue`) has no tests — correctness depends entirely on the DB-level `BEFORE UPDATE` trigger and manual QA
- The AI bot intent router in `supabase/functions/process-bot-message/index.ts` has no tests — 10 intents, all destructive/write ops, no coverage
- The server-side pdf-lib receipt generator in `supabase/functions/process-bot-message/pdf.ts` has no tests
- RLS policies have no automated verification
- Deep-link invite flow (`app/invite/[token].tsx`) has no tests
- Edge Function HTTP contracts have no tests

This is normal for a solo-built launch-stage app and abnormal for an app that collects rent money from tenants. The gap should be acknowledged explicitly in any launch audit.

## Type Checking (the only automated check that exists)

**Command:**
```bash
npm run ts-check
# equivalent to: npx tsc --noEmit
```

**Config:** `tsconfig.json`
- `extends: expo/tsconfig.base`
- `strict: true`
- Covers `**/*.ts`, `**/*.tsx`, `.expo/types/**/*.d.ts`, `expo-env.d.ts`
- **Excludes** `supabase/functions` (those are Deno — type-checked separately)

**What this catches:** Missing props, wrong types on Supabase row casts, incorrect hook return shapes, broken path aliases. This is the only guardrail that runs without a human.

**What it does not catch:** Logic errors, runtime errors, Supabase query shape mismatches (because `.select('*')` returns `any` unless manually typed), RLS failures, state-machine transitions, async race conditions.

## Linting

**No ESLint config.** No `.eslintrc`, `.eslintrc.js`, `.eslintrc.json`, or `eslint.config.*` in the repo root.

**No Prettier config.** No `.prettierrc` or `prettier.config.*`.

**No Biome config.** No `biome.json`.

Code style is maintained by convention and by the author's editor-level defaults, not by any tool that can be run in CI.

## CI / CD

**No CI setup.** There is no `.github/workflows/` directory. No GitLab CI, no CircleCI, no Travis config. Nothing runs automatically on push or pull request — not even `tsc --noEmit`.

**Build pipeline:** EAS Build (Expo Application Services) is used for iOS/Android builds (`eas.json` present). EAS does not run tests. EAS also does not run `tsc --noEmit` by default — a broken type can ship to TestFlight unless the developer runs the check manually first.

## Edge Function Testing

**None.** The ten Edge Functions in `supabase/functions/` (`ai-draft-reminders`, `ai-insights`, `ai-search`, `auto-confirm-payments`, `invite-redirect`, `mark-overdue`, `process-bot-message`, `send-push`, `send-reminders`, `telegram-webhook`) are verified only by:
1. `supabase functions serve` locally and poking with curl
2. Deploying to staging and hitting from the real Telegram bot / cron
3. Reading Supabase function logs after the fact

There is no Deno test file (`*_test.ts`), no `deno test` invocation, and no mock for the Anthropic or Telegram APIs.

## Manual Verification Workflow

This is the *entire* test strategy for the project. The commands below are the actual QA process.

**Prerequisites:**
- `.env` with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (`constants/config.ts` calls `requireEnv()` which throws at import time if missing)

**Start the app:**
```bash
npx expo install           # install / reconcile deps (not npm install)
npx expo start             # Metro bundler
# Then press i (iOS simulator), a (Android emulator), or scan the QR with Expo Go / dev client
npx expo run:ios           # native iOS build
npx expo run:android       # native Android build
```

**Local Supabase stack:**
```bash
supabase start             # spin up local Postgres + Auth + Storage + Edge runtime
supabase db reset          # apply all migrations from supabase/migrations/ in order
supabase functions serve   # serve Edge Functions on localhost (respects config.toml verify_jwt flags)
```

**Deploy Edge Functions to staging/prod:**
```bash
supabase functions deploy telegram-webhook
supabase functions deploy process-bot-message
supabase functions deploy auto-confirm-payments
supabase functions deploy mark-overdue
supabase functions deploy send-reminders
# etc.
```

**Run type check before shipping anything:**
```bash
npm run ts-check
```

**Manual smoke-test checklist** (what a human has to click through to validate a release):
1. Sign up a new user → verify email flow → land on onboarding
2. Create a property → create a tenant → generate invite link → accept invite from a second account
3. Log a payment → mark paid → confirm → verify state transitions in DB
4. Archive a property → verify tenants cascade archive → verify payments remain
5. Link Telegram bot → send `/menu` → exercise all 10 intents → verify confirm/cancel inline buttons work
6. Generate a rent receipt PDF through the bot → verify cache hit on second request
7. Force a pending payment past its `due_day` → wait for or manually trigger `mark-overdue`
8. Wait 48h on a `paid` payment → verify `auto-confirm-payments` promotes to `confirmed`

None of this is automated. Any of it can break silently between releases.

## Gaps That Matter for a Compliance / Launch Audit

| Area | Risk | Mitigation today |
|---|---|---|
| Payment state machine | Financial state corruption | DB trigger + manual QA |
| RLS policies | Cross-tenant data leak | Manual SQL review only |
| Bot write intents (add_property, archive_tenant, bulk_send_reminder, update_tenant) | Destructive action on wrong entity | Inline confirm buttons — no test coverage |
| PDF generation (server) | Wrong amount / wrong tenant on receipt | Visual inspection only |
| Deep-link invite (`app/invite/[token].tsx`) | Token reuse, wrong account linkage | Manual test |
| Auth flow (`flowType: 'implicit'`) | Session loss during OAuth | Manual iOS/Android test |
| Push token registration | Silent notification failure | Inspection of Supabase logs |
| Edge Function auth (`BOT_INTERNAL_SECRET`) | Open webhook if secret misconfigured | Runtime header check only |

**Recommendation for any future testing phase:**
1. Start with a Deno test suite for `supabase/functions/process-bot-message/` (pure intent-routing logic, no I/O)
2. Add a Jest/Vitest suite for `lib/payments.ts` (payment state machine) and `lib/invite.ts` (token generation)
3. Add integration tests that hit a local `supabase start` instance to exercise RLS policies with two different JWTs
4. Wire `tsc --noEmit` into a GitHub Action on push so at minimum the type safety guardrail runs on every commit

---

*Testing analysis: 2026-04-05*

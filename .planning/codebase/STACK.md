# Technology Stack

**Analysis Date:** 2026-04-05

## Languages

**Primary:**
- TypeScript `^5.3.0` — All mobile app code under `app/`, `components/`, `hooks/`, `lib/`, `constants/`. Strict mode enabled in `tsconfig.json`.
- TypeScript (Deno flavor) — All Supabase Edge Functions under `supabase/functions/*/index.ts`. Excluded from the app `tsconfig.json` via `"exclude": ["supabase/functions"]` because they run on Deno, not Node.

**Secondary:**
- SQL (PostgreSQL 17) — Schema, RLS policies, triggers, storage bucket setup in `supabase/migrations/001_initial_schema.sql` through `supabase/migrations/028_fix_properties_tenant_read_policy.sql`.
- JSX — Two standalone logo component files at project root (`Logo final.jsx`, `Real final logo.jsx`, `dwella-nobroker-teal.jsx`); not wired into the app build.

## Runtime

**Mobile app:**
- React Native `0.81.5` on Hermes (default for Expo SDK 54).
- React `19.1.0` / React DOM `19.1.0`.
- Expo SDK `~54.0.0` — managed workflow, with `expo-dev-client ~6.0.20` for custom native builds.

**Edge Functions:**
- Deno 2 — configured in `supabase/config.toml` at `[edge_runtime] deno_version = 2`, `policy = "per_worker"` (hot reload in local dev), inspector on port `8083`.
- Imports are URL-based: `https://deno.land/std@0.177.0/http/server.ts` for `serve`, `https://esm.sh/@supabase/supabase-js@2` for the Supabase client, `https://esm.sh/pdf-lib@1.17.1` for server-side PDF rendering in `supabase/functions/process-bot-message/pdf.ts`.

**Database:**
- Postgres `major_version = 17` (per `supabase/config.toml [db]`).

**Package Manager:**
- npm — `package-lock.json` is committed. The CLAUDE.md guidance says to use `npx expo install` for adding dependencies so Expo pins compatible versions.
- Lockfile: present (`package-lock.json`).

## Frameworks

**Core (mobile):**
- `expo` `~54.0.0` — managed workflow shell.
- `expo-router` `~6.0.23` — file-based routing under `app/`. `app.json` sets `main: "expo-router/entry"` and enables `experiments.typedRoutes`.
- `react-native-paper` `^5.12.0` — Material Design component library (primary UI kit).
- `zustand` `^4.5.0` — client state with persist middleware (`lib/store.ts`).
- `@supabase/supabase-js` `^2.45.0` — Supabase client (see `lib/supabase.ts`).

**Navigation / routing helpers:**
- `react-native-screens` `~4.16.0`
- `react-native-safe-area-context` `~5.6.0`
- `expo-linking` `~8.0.11` — deep-link parsing for `dwella://` scheme.

**Native capability plugins (via Expo):**
- `expo-apple-authentication` `~8.0.8` — native Sign in with Apple (see `lib/social-auth.ts`).
- `expo-auth-session` `~7.0.10` — OAuth redirect URI helpers.
- `expo-web-browser` `~15.0.10` — in-app browser for OAuth flow.
- `expo-notifications` `^0.32.16` — push notifications (Expo push tokens in `lib/notifications.ts`).
- `expo-device` `~8.0.10` — physical device check before registering push tokens.
- `expo-haptics` `~15.0.8`
- `expo-image-picker` `~17.0.10` — payment proof photo capture.
- `expo-local-authentication` `~17.0.8` — biometric unlock.
- `expo-secure-store` `~15.0.8` — secure token storage.
- `expo-crypto` `~15.0.8`
- `expo-print` `~15.0.8` — client-side PDF rendering.
- `expo-sharing` `~14.0.8` — share receipts out to other apps.
- `expo-font` `~14.0.11`
- `expo-splash-screen` `~31.0.13`
- `expo-status-bar` `~3.0.9`
- `expo-linear-gradient` `~15.0.8`
- `expo-constants` `~18.0.13`
- `@react-native-async-storage/async-storage` `2.2.0` — Supabase session persistence store (see `lib/supabase.ts`).
- `@react-native-community/datetimepicker` `8.4.4`
- `@expo/vector-icons` `^15.0.3`
- `react-native-vector-icons` `^10.1.0`
- `react-native-svg` `15.12.1`
- `react-native-web` `^0.21.0`

**Edge Function runtime libs (Deno, URL imports):**
- `@supabase/supabase-js@2` via `https://esm.sh/@supabase/supabase-js@2` — used in every function.
- Deno std HTTP server `https://deno.land/std@0.177.0/http/server.ts` — used in `ai-*`, `process-bot-message`, `telegram-webhook`. `send-push/index.ts` uses the newer built-in `Deno.serve`.
- `pdf-lib@1.17.1` via `https://esm.sh/pdf-lib@1.17.1` — only in `supabase/functions/process-bot-message/pdf.ts` for server-side receipt generation.

**Build / tooling:**
- `@babel/core` `^7.24.0` with `babel-preset-expo` (see `babel.config.js`).
- TypeScript `^5.3.0` extending `expo/tsconfig.base`.
- EAS Build CLI `>= 18.3.0` (pinned in `eas.json` `cli.version`); `appVersionSource = "remote"`. Production profile has `autoIncrement = true` and injects `EXPO_PUBLIC_TELEGRAM_BOT_USERNAME=Dwellav2_bot`.
- `sharp` `^0.34.5` — listed in `optionalDependencies` (used only on the host for image resizing during build).

**Testing:**
- Not detected. No Jest, Vitest, Detox, or Playwright config found in `package.json` or at project root. The `ts-check` script (`npx tsc --noEmit`) is the only automated verification step.

## Key Dependencies

**Critical to app boot:**
- `@supabase/supabase-js` — all data access. Initialized in `lib/supabase.ts` with `flowType: 'implicit'` (PKCE explicitly avoided in React Native due to code-verifier loss on JS thread suspension).
- `expo-router` — app shell; `app.json` declares `"plugins": ["expo-router", ...]` and typed routes experiment.
- `zustand` — auth state and cached lists in `lib/store.ts`.
- `@react-native-async-storage/async-storage` — Supabase auth persistence on native (web falls back to `localStorage`).

**Critical to Edge Functions:**
- `ANTHROPIC_API_KEY` + Claude REST endpoint (see INTEGRATIONS.md) — all four AI functions hard-fail without it.
- `SUPABASE_SERVICE_ROLE_KEY` — required by every scheduled/server function for privileged writes.
- `BOT_INTERNAL_SECRET` — the shared secret between `telegram-webhook` and `process-bot-message` (see `supabase/config.toml` comment at `[functions.process-bot-message]`).

## Configuration

**TypeScript (`tsconfig.json`):**
```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": { "@/*": ["./*"] }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.d.ts", "expo-env.d.ts"],
  "exclude": ["supabase/functions"]
}
```
- Path alias `@/*` resolves from project root — used throughout the app (`@/constants/config`, `@/lib/supabase`, etc.).
- Edge Functions are excluded because they are Deno and have incompatible module resolution.

**Expo (`app.json`):**
- `scheme: "dwella"` — powers deep links for invite flow (`dwella://invite/{token}`) and OAuth callback (`dwella://auth/callback`).
- iOS `bundleIdentifier: com.dwella.app`, `ITSAppUsesNonExemptEncryption: false`.
- Android `package: com.dwella.app` with a `VIEW` intent filter for `dwella://` scheme (`autoVerify: true`).
- Plugins: `expo-router`, `expo-font`, `expo-apple-authentication`, `@react-native-community/datetimepicker`, `expo-notifications` (configured with icon `./assets/icon.png`, color `#4F46E5`, `defaultChannel: "default"`).
- `experiments.typedRoutes: true`.
- `extra.eas.projectId: 3bc7de51-47e7-4c4e-92e3-e6e1a40ae71b`.

**Babel (`babel.config.js`):**
- Single preset `babel-preset-expo`; no custom plugins.

**Supabase (`supabase/config.toml`):**
- Postgres 17, realtime enabled, storage enabled (`file_size_limit = "50MiB"`).
- Auth: email signup enabled, `jwt_expiry = 3600`, password minimum 6 chars, Google OAuth enabled (client_id committed — intentional), Apple OAuth enabled with `skip_nonce_check = true` for the native identity-token flow.
- Additional redirect URL: `dwella://auth/callback`.
- Edge runtime: Deno 2, per-worker policy.
- `verify_jwt = false` on three functions: `telegram-webhook`, `invite-redirect`, `process-bot-message` (each documented inline with the security rationale).

**EAS (`eas.json`):**
- Profiles: `development` (developmentClient + internal distribution), `preview` (internal), `production` (autoIncrement, injects `EXPO_PUBLIC_TELEGRAM_BOT_USERNAME=Dwellav2_bot`).
- Supabase URL/anon key are injected via EAS environment variables (not committed), per the recent commit `c9f58e2 chore: move Supabase URL/anon key from eas.json to EAS env vars`.

**Environment files:**
- `.env.example` present with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` placeholders.
- `.env` expected at project root for local dev (not committed).

## Env Vars Required

**Mobile app (prefixed `EXPO_PUBLIC_` so they inline into the JS bundle at build time):**
- `EXPO_PUBLIC_SUPABASE_URL` — consumed in `constants/config.ts` line 1, also used directly in `lib/invite.ts` and `lib/bot.ts`.
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — consumed in `constants/config.ts` line 2.
- `EXPO_PUBLIC_TELEGRAM_BOT_USERNAME` — consumed in `constants/config.ts` line 7; injected by EAS production profile as `Dwellav2_bot`.

Note: The current `constants/config.ts` does NOT contain a `requireEnv()` helper (the CLAUDE.md and memory reference it, but on `main` today only soft defaults of `?? ''` exist, and `lib/supabase.ts` logs a `console.error` + falls back to placeholder values if missing). Treat the two Supabase vars as hard requirements despite the non-throwing read.

**Edge Functions (server-side, configured via `supabase secrets set ...`):**
- `SUPABASE_URL` — auto-injected by platform; read in every function.
- `SUPABASE_SERVICE_ROLE_KEY` — auto-injected; read in every function. Note from `supabase/config.toml` comment: auto-injection has become flaky since the new `sb_publishable`/`sb_secret` API key rollout, which is why `BOT_INTERNAL_SECRET` exists.
- `ANTHROPIC_API_KEY` — required by `supabase/functions/process-bot-message/index.ts`, `ai-insights/index.ts`, `ai-search/index.ts`, `ai-draft-reminders/index.ts`.
- `TELEGRAM_BOT_TOKEN` — required by `supabase/functions/telegram-webhook/index.ts` for all `api.telegram.org` calls.
- `BOT_INTERNAL_SECRET` — shared secret between `telegram-webhook` and `process-bot-message`; enforced via `x-bot-internal-secret` header check inside `process-bot-message/index.ts`.

**Supabase Auth external providers (set in dashboard or `config.toml` via env substitution):**
- `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`
- `SUPABASE_AUTH_EXTERNAL_APPLE_CLIENT_ID`
- `SUPABASE_AUTH_EXTERNAL_APPLE_SECRET`

## Platform Requirements

**Development:**
- Node.js for the Expo tooling (Expo SDK 54 requires Node 18+).
- Deno 2 for local Edge Function serving (`supabase functions serve`).
- Supabase CLI (for `supabase start`, `supabase db reset`, `supabase functions deploy`).
- Xcode for iOS native builds (`npx expo run:ios`), Android Studio for Android.
- `.env` file present at project root before first `expo start` or `lib/supabase.ts` will fall back to placeholder URLs.

**Production:**
- iOS: App Store — bundle `com.dwella.app`, listing at `https://apps.apple.com/app/id6760478576` (hard-coded in `supabase/functions/invite-redirect/index.ts` line 20).
- Android: Google Play — package `com.dwella.app`, listing at `https://play.google.com/store/apps/details?id=com.dwella.app` (hard-coded in `supabase/functions/invite-redirect/index.ts` line 21).
- Build/distribution via EAS Build + EAS Submit.
- Hosted Supabase project (URL from EAS env var) for Postgres, Auth, Storage, Edge Functions.

---

*Stack analysis: 2026-04-05*

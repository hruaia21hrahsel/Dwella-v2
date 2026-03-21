---
status: awaiting_human_verify
trigger: "Google OAuth sign-in fails in Expo Go on iOS — Safari says 'can't open the page because it couldn't connect to the server'"
created: 2026-03-19T00:00:00Z
updated: 2026-03-19T00:01:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED — Three compounding issues cause the Safari connection failure:
  1. makeRedirectUri({ scheme: 'dwella', path: 'auth/callback' }) calls Linking.createURL() in Expo Go (not standalone/bare), which produces `exp://192.168.x.x:8081/--/auth/callback` NOT `dwella://auth/callback`. But Supabase's allowlist for "Redirect URLs" does not contain this exp:// URL, so Google's OAuth server rejects the redirect_uri parameter as unauthorized — causing the "can't connect to server" error before the browser even loads Google's login page.
  2. The `useProxy` option (which would route via auth.expo.io as a stable proxy URL) was removed in expo-auth-session v7 — there is no proxy option available anymore.
  3. Even if the redirect worked, the Supabase dashboard must have Google OAuth credentials (Client ID + Secret) configured, otherwise supabase.auth.signInWithOAuth() returns a URL that points to an unconfigured endpoint.
test: Confirmed by reading makeRedirectUri source — in Expo Go (ExecutionEnvironment.StoreClient) it falls through to Linking.createURL() which produces exp:// URL. This exp:// URL is never registered as an allowed redirect in Supabase or Google Cloud Console.
expecting: Fix requires (a) adding the exp:// redirect URL to Supabase allowed list for dev testing, AND (b) configuring Google OAuth credentials in Supabase dashboard.
next_action: Apply code fix + document dashboard configuration steps

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: Tapping "Sign in with Google" opens an in-app browser via WebBrowser.openAuthSessionAsync, user authenticates with Google, Supabase redirects back to the app with tokens in the URL fragment, session is set.
actual: Safari says "can't open the page because it couldn't connect to the server" — the OAuth flow never starts or fails at redirect.
errors: Safari connection error. No server-side or JS error logged. A console.log was added to print the REDIRECT_URI but user hasn't reported what it outputs yet.
reproduction: Open app in Expo Go on iOS → tap "Sign in with Google" on login screen → Safari error appears
started: Testing after clearing stale auth session. Google OAuth may never have been fully configured/tested.

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: Supabase URL env var is missing/wrong causing client to be uninitialised
  evidence: constants/config.ts uses requireEnv() which throws at import time if missing — the app would crash at startup, not show a Safari error. User reported reaching the login screen, so env vars are present.
  timestamp: 2026-03-19

- hypothesis: flowType: 'implicit' is incompatible with the redirect setup
  evidence: implicit flow is the correct choice for React Native (avoids PKCE code-verifier storage loss when JS thread suspends). This is not the cause.
  timestamp: 2026-03-19

- hypothesis: WebBrowser.openAuthSessionAsync fails to open any browser
  evidence: The error appears IN Safari, meaning a browser was launched. The failure is at the URL being loaded (server can't be reached), not the browser launch itself.
  timestamp: 2026-03-19

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-03-19
  checked: lib/social-auth.ts line 9
  found: `makeRedirectUri({ scheme: 'dwella', path: 'auth/callback' })` — no `native` parameter, no `useProxy` (removed in v7)
  implication: In Expo Go (ExecutionEnvironment.StoreClient), makeRedirectUri falls through to `Linking.createURL('auth/callback', { scheme: 'dwella' })`. In Expo Go, Linking.createURL ignores the scheme and produces an exp:// URL like `exp://192.168.x.x:8081/--/auth/callback`.

- timestamp: 2026-03-19
  checked: node_modules/expo-auth-session/build/AuthSession.js — makeRedirectUri source
  found: The function only returns `native` param early when `ExecutionEnvironment` is Standalone or Bare. In Expo Go (StoreClient), it calls `Linking.createURL()`. The `useProxy` parameter no longer exists in v7.
  implication: There is no stable proxy URL option anymore. The generated redirect URI in Expo Go will be a dynamic `exp://IP:PORT/--/auth/callback` URL that changes per machine/session.

- timestamp: 2026-03-19
  checked: supabase.auth.signInWithOAuth flow
  found: Supabase generates the Google OAuth URL with `redirect_uri=<REDIRECT_URI>`. Google's OAuth server validates this redirect_uri against the list of Authorized Redirect URIs in the Google Cloud Console project. The exp:// URL is not registered there, and also not in Supabase's "URL Configuration > Redirect URLs" allowlist.
  implication: Google rejects the authorization request with an error URL, or Supabase's own OAuth proxy fails because it doesn't recognise the redirect. Either way, the browser gets a URL that cannot be resolved — producing "can't connect to server".

- timestamp: 2026-03-19
  checked: app.json
  found: scheme: 'dwella', bundleIdentifier: 'com.dwella.app', EAS projectId: '3bc7de51-47e7-4c4e-92e3-e6e1a40ae71b'
  implication: The stable redirect URI for production/standalone is `dwella://auth/callback`. For Expo Go dev testing, we need to add the Expo Go proxy URL pattern OR use a predictable redirect URI.

- timestamp: 2026-03-19
  checked: app/auth/callback.tsx
  found: WebBrowser.maybeCompleteAuthSession() is called — this is correct for Android Custom Tabs. The screen properly handles both cold-launch and warm-launch deep links.
  implication: The callback screen implementation is correct. The problem is upstream — the OAuth flow never reaches Google's login page.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: Three compounding issues. (1) makeRedirectUri({ scheme, path }) without `native` parameter calls Linking.createURL() in Expo Go, producing a dynamic exp://IP:PORT/--/auth/callback URL. This URL is not registered in Supabase Redirect URLs allowlist or Google Cloud Console Authorized Redirect URIs, so Google rejects the OAuth request — the browser gets an error URL it cannot load, producing "can't connect to server". (2) expo-auth-session v7 removed useProxy so there is no stable proxy option. (3) Google OAuth provider must be configured in Supabase dashboard (Client ID + Secret) for any of this to work.

fix: (Code) Added `native: 'dwella://auth/callback'` to makeRedirectUri call in lib/social-auth.ts. In standalone/bare builds this immediately returns the custom scheme without Linking.createURL(). In Expo Go it still falls back to exp:// — so the exp:// URLs must be added to both Supabase and Google Cloud Console as documented below.
(Dashboard — required before testing):
  Supabase Auth > URL Configuration > Redirect URLs — add:
    dwella://auth/callback
    exp://YOUR_LOCAL_IP:8081/--/auth/callback
    exp://localhost:8081/--/auth/callback
  Supabase Auth > Providers > Google — enable and set Client ID + Client Secret from Google Cloud Console.
  Google Cloud Console > APIs & Services > Credentials > OAuth 2.0 Client — Authorized Redirect URIs — add:
    https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
  (Supabase handles the Google↔app redirect; Google only needs to trust Supabase's server-side callback URL)

verification: pending human confirmation
files_changed: [lib/social-auth.ts]

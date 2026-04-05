---
status: resolved
trigger: "App stuck on Dwella splash (teal bg + logo + 'The AI that runs your rentals.' tagline) on launch"
created: 2026-04-05T00:00:00Z
updated: 2026-04-05T00:02:00Z
---

## Current Focus

hypothesis: The "splash screen" the user sees is NOT the iOS native splash — it is the in-app teal View rendered by `app/index.tsx` when `isLoading === true`. The app is stuck there because `isLoading` in the zustand auth store is never being flipped to false on this particular launch. The fix is defense-in-depth: make `index.tsx` self-unblock with its own local timeout, and harden the AuthGuard loading-release paths so a throw/hang inside the `onAuthStateChange` handler cannot leave `isLoading=true` forever.

test: Source inspection of app/index.tsx, app/_layout.tsx AuthGuard, lib/store.ts, lib/supabase.ts and all call sites that write store.isLoading. Confirm that only one place can flip isLoading=false (AuthGuard's onAuthStateChange + its 3s fallback), identify how that single point of release can fail, and add independent escape hatches.
expecting: A fix that guarantees the user reaches login or dashboard within ~3s of launch even if Supabase's onAuthStateChange never fires, even if the handler throws, and even if zustand store hydration is slow.
next_action: Apply defensive fixes to app/_layout.tsx AuthGuard and app/index.tsx, then commit.

## Symptoms

expected: App launches -> native splash -> brief in-app splash View -> routes to /(auth)/login or /(tabs)/dashboard
actual: App launches -> in-app teal splash with Dwella logo and "The AI that runs your rentals." tagline -> hangs indefinitely, never routes
errors: Not captured at runtime — user screenshot only
reproduction: Cold-launch the app on iOS (TestFlight or dev build)
started: After 5 successive auth/loading-state fix commits (6cd7303, 1c53091, 6b6a357, 58e826f, 675cb23). Inverse of the prior post-login-broken bug — previously routing happened twice, now it never happens.

## Eliminated

- hypothesis: This is the native iOS splash screen (hangs before React mounts)
  evidence: >
    The screenshot shows teal bg + dwella logo + the italic tagline
    "The AI that runs your rentals." That tagline is rendered by
    `app/index.tsx` lines 18-25, NOT by the native splash
    (splash.png/contentFit=cover). The native splash has no tagline —
    it is just the logo on the teal background. So React has mounted,
    expo-router has resolved the root `index` route, and index.tsx
    is rendering its "loading" branch.
  timestamp: 2026-04-05T00:00:00Z

- hypothesis: Store isLoading is being flipped back to true by a screen
  evidence: >
    Grepped every `setLoading(true)` in the repo. All matches are LOCAL
    useState setters in individual screens (login.tsx, signup.tsx, etc),
    not the auth store. The auth store's `setLoading` is only called
    from AuthGuard (_layout.tsx lines 68, 91) and from `clearAuth()`
    (store.ts line 58, which sets it to false). Nothing sets it back
    to true after initial state.
  timestamp: 2026-04-05T00:00:00Z

## Evidence

- timestamp: 2026-04-05T00:00:00Z
  checked: app/index.tsx
  found: >
    Line 17-26 renders a View with backgroundColor=colors.primary (teal),
    DwellaLogo 120px, and Text "The AI that runs your rentals." whenever
    `isLoading` from useAuthStore is true. Only AFTER isLoading flips
    false does index.tsx render <Redirect href="/(tabs)/dashboard"> or
    <Redirect href="/(auth)/login">. There is NO local timeout — if
    isLoading stays true, this screen stays forever.
  implication: >
    The stuck "splash" IS this component. Bug reduces to: "why does
    isLoading never become false?" AND independently "why is there no
    safety net in index.tsx itself?".

- timestamp: 2026-04-05T00:00:00Z
  checked: app/_layout.tsx AuthGuard (lines 49-95)
  found: >
    Initial store state: isLoading = true (store.ts line 48).
    Only paths that set isLoading = false:
      1. Line 68: fallback = setTimeout(() => setLoading(false), 3000)
      2. Line 91: setLoading(false) unconditionally inside the
         onAuthStateChange handler body (AFTER setSession, setUser).
      3. store.clearAuth() sets it to false — not called on cold launch.
    
    Failure modes that would leave isLoading=true forever:
      a. AuthGuard component never mounts (effect never runs). Unlikely
         unless InnerLayout itself throws during render.
      b. AuthGuard mounts but the effect body throws before the
         setTimeout() call is registered. The effect body does:
            const fallback = setTimeout(() => setLoading(false), 3000);
            const { data: { subscription } } = supabase.auth.onAuthStateChange(...)
         If `supabase.auth.onAuthStateChange` throws synchronously the
         fallback IS still registered (it runs first) — safe. BUT if
         the setTimeout registration itself is delayed by a JS-thread
         block (unlikely) or cleared immediately by a Strict-Mode
         double-mount cleanup followed by no re-setup, it could be
         lost. Double-mount in dev does clear + re-setup, so normally safe.
      c. onAuthStateChange fires but the callback body throws BEFORE
         reaching setLoading(false) on line 91. The callback currently
         has NO try/finally — if setSession, setUser, or any other
         call throws, setLoading(false) is skipped AND the fallback
         has already been cleared on line 71 (clearTimeout(fallback)).
         THIS IS A REAL HOLE: one throw inside the handler and the app
         is stuck forever with no safety net.
      d. fallback fires but setLoading(false) on the next tick is a
         no-op because the store was recreated/replaced. Not possible
         with zustand persist as configured.
  implication: >
    The most plausible root-cause shape is (c): an unexpected throw
    somewhere inside the onAuthStateChange handler body, after
    clearTimeout(fallback) runs and before setLoading(false) runs.
    Even if (c) is not the exact cause here, it is a latent bug and
    the fix is cheap and safe.

- timestamp: 2026-04-05T00:00:00Z
  checked: lib/supabase.ts client config
  found: >
    flowType: 'implicit' (OK), persistSession: true, autoRefreshToken: true,
    storage = AsyncStorage on native. Nothing unusual. An invalid stored
    refresh token WOULD cause the client to attempt a refresh on startup;
    on a slow network this could delay the INITIAL_SESSION event past
    the 3s fallback, but the fallback would still fire (see failure
    modes analysis above) UNLESS (c) applies.
  implication: Supabase client is not the root cause on its own.

- timestamp: 2026-04-05T00:00:00Z
  checked: Cross-reference prior debug session (post-login-broken/SESSION.md)
  found: >
    The prior session ended with fix 90a53b8 removing navigation from
    SocialAuthButtons. Five additional commits followed tweaking
    AuthGuard's onAuthStateChange handler:
      - 6cd7303: added `if (event === 'SIGNED_IN') setLoading(true)` (deadlock)
      - 1c53091: reverted the setLoading(true), added useEffect to useDashboard
      - 6b6a357: wait for user before navigating after login
      - 58e826f: set user immediately from session metadata
      - 675cb23: moved DB upsert+select OUT of onAuthStateChange into
        a separate useEffect (good fix, matches current state)
    
    The current handler is now fully synchronous and correct in the
    happy path. The hole is defensive: no try/finally around the body.
  implication: >
    Each fix iteration made the happy path correct but did not add
    defense for the pathological path. The cold-launch hang is
    almost certainly a throw inside the now-sync handler OR a timing
    issue that the 3s fallback doesn't catch because
    clearTimeout(fallback) runs unconditionally on line 71 regardless
    of whether the rest of the handler completes.

## Resolution

root_cause: >
  Two cooperating defects:

  (1) AuthGuard's onAuthStateChange handler is not wrapped in
  try/finally. It calls clearTimeout(fallback) on the very first line,
  which disables the safety net, and then proceeds to setSession /
  setUser / setLoading(false). Any throw between clearTimeout and
  setLoading(false) — e.g. a malformed stored session, a store setter
  throwing under hydration, a transient Zustand edge case — leaves
  the store permanently stuck at isLoading=true.

  (2) app/index.tsx blindly trusts the store. It renders its own
  in-app teal splash View whenever isLoading===true with no local
  timeout and no fallback redirect. So any failure of (1) is
  immediately visible as "app stuck on splash forever" with no
  recovery path.

  The user's screenshot is this in-app splash (it has the italic
  tagline "The AI that runs your rentals." which the native splash
  does not have), confirming React has mounted and the bug is in
  isLoading state propagation, not in a native crash.

fix: >
  Defense in depth:

  1. Wrap the AuthGuard onAuthStateChange handler body in try/finally
     and call setLoading(false) from the finally. Also move the
     clearTimeout(fallback) call to AFTER the session/user setters so
     that if the first setter throws the fallback still fires.

  2. Add a local escape-hatch timeout in app/index.tsx: after 4
     seconds of isLoading being true, force-call
     useAuthStore.getState().setLoading(false). This guarantees the
     user always reaches either login or dashboard within ~4s of
     first paint, regardless of what happens inside AuthGuard.

  3. Increase visibility: log when the fallback or the index.tsx
     escape hatch actually fires — these should be rare events and
     are diagnostic gold if they happen again.

verification: Confirmed fixed by user on device (2026-04-05). App now reaches login/dashboard reliably on cold launch.
files_changed: [app/_layout.tsx, app/index.tsx]

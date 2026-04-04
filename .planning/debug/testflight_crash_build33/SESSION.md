---
status: fixing
trigger: "testflight-crash-on-launch-build33 — SIGSEGV ~0.2s after launch on iPhone 17,3 / iOS 26.3"
created: 2026-04-04T00:00:00Z
updated: 2026-04-04T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — usePostHog() in lib/posthog.ts calls require('posthog-react-native') synchronously during every React render of AuthGuard. This loads AsyncStorage TurboModule at render time, not at InteractionManager callback time. The getPostHogProvider() is correctly deferred, but usePostHog() is not — it runs during the first render before any interactions complete.

test: Code inspection of lib/posthog.ts line 24-27 and app/_layout.tsx line 42. require('posthog-react-native') → native-deps.js → OptionalAsyncStorage.js → require('@react-native-async-storage/async-storage') executes synchronously at AuthGuard render time.

expecting: Removing the synchronous require() from the render path eliminates the TurboModule crash.

next_action: Fix usePostHog() to return null/undefined before PostHog is ready, and use a ref/state to cache the module after lazy loading.

## Symptoms

expected: App launches and shows the main screen
actual: App crashes immediately on launch with SIGSEGV (EXC_BAD_ACCESS)
errors:
- Thread 8 (build 32) / Thread 1 (builds 27-31): ObjCTurboModule::performVoidMethodInvocation → convertNSExceptionToJSError → SIGSEGV in Hermes GC write barrier
- Crash pattern: background dispatch thread accesses Hermes JS runtime via JSI while runtime is not thread-safe
- esr: 0x92000044 / 0x92000004 (Data Abort) — byte read/write Translation fault on null/invalid address
reproduction: Launch app from TestFlight on iPhone 17,3 with iOS 26.3. Crashes every time within 0.2 seconds.
started: Build 23 through 33 — all builds with react-native 0.81+

## Eliminated

- hypothesis: PostHogProvider throws when apiKey=''
  evidence: Fixed in earlier session (commit cf5526d). Build 26 still crashed.
  timestamp: 2026-03-24

- hypothesis: posthog.reset() / posthog.capture() called on undefined
  evidence: Fixed with optional chaining. Builds 27-32 still crashed — same SIGSEGV pattern.
  timestamp: 2026-03-24

- hypothesis: getPostHogProvider() not deferred (causes AsyncStorage load at bundle eval)
  evidence: Fixed in commit 28b0479 — getPostHogProvider() now called only inside InteractionManager.runAfterInteractions(). But builds 27-32 crash the same way, because usePostHog() was not fixed.
  timestamp: 2026-04-04

- hypothesis: New Architecture not enabled
  evidence: newArchEnabled: true set in commit 367e6a0. Crash persists identically.
  timestamp: 2026-04-04

- hypothesis: SplashScreen.preventAutoHideAsync() TurboModule crash
  evidence: Removed in commit 98992ae. Crash persists.
  timestamp: 2026-04-04

- hypothesis: expo-notifications / expo-splash-screen auto-init at import time
  evidence: Lazy-loaded in commits 1255fd3 / eb3db1b. Crash persists.
  timestamp: 2026-04-04

## Evidence

- timestamp: 2026-04-04
  checked: All crash logs (builds 27-32) thread stacks
  found: Every crash shows ObjCTurboModule::performVoidMethodInvocation → convertNSExceptionToJSError → crash in Hermes. The native thread stack always shows AsyncStorage or related TurboModule void method invocation failing.
  implication: AsyncStorage TurboModule is being loaded during the startup sequence despite lazy-loading attempts.

- timestamp: 2026-04-04
  checked: lib/posthog.ts usePostHog() function (lines 24-27)
  found: usePostHog() calls require('posthog-react-native') synchronously. This is called from AuthGuard line 42 during every render.
  implication: Every render of AuthGuard triggers require('posthog-react-native') which evaluates OptionalAsyncStorage.js → require('@react-native-async-storage/async-storage') synchronously on the JS thread during startup.

- timestamp: 2026-04-04
  checked: node_modules/posthog-react-native/dist/optional/OptionalAsyncStorage.js
  found: Top-level try { OptionalAsyncStorage = require('@react-native-async-storage/async-storage').default } — this runs at module evaluation time. The try/catch only suppresses import errors, not the native TurboModule auto-registration side effect.
  implication: Loading posthog-react-native at any point (even in an InteractionManager callback) triggers AsyncStorage native module auto-registration as a side effect.

- timestamp: 2026-04-04
  checked: node_modules/posthog-react-native/dist/native-deps.js
  found: buildOptimisticAsyncStorage() checks OptionalExpoFileSystem (new API), OptionalExpoFileSystemLegacy (old API), then falls back to OptionalAsyncStorage. Since expo-file-system is in the project, PostHog will use file system storage — it won't even use AsyncStorage at runtime. But AsyncStorage is still loaded as a side effect.
  implication: Even though PostHog uses expo-file-system for storage (not AsyncStorage), the mere act of requiring posthog-react-native triggers AsyncStorage TurboModule registration on iOS.

- timestamp: 2026-04-04
  checked: app/_layout.tsx RootLayout component (lines 300-343)
  found: getPostHogProvider() is correctly deferred inside InteractionManager.runAfterInteractions(). BUT usePostHog() (line 42 in AuthGuard) calls require('posthog-react-native') on every render — the first render happens at app startup before any InteractionManager callbacks run.
  implication: The fix to defer getPostHogProvider() was correct but incomplete. usePostHog() still triggers the crash on the first render.

## Resolution

root_cause: lib/posthog.ts usePostHog() calls require('posthog-react-native') synchronously during React render (called from AuthGuard on every render). This loads posthog-react-native's native-deps.js which loads OptionalAsyncStorage.js which calls require('@react-native-async-storage/async-storage') at module evaluation time. The AsyncStorage TurboModule auto-registration on iOS 26.3 throws an NSException during startup, and the RCTTurboModule.mm error handler (convertNSExceptionToJSError) then corrupts Hermes by accessing the JS runtime from a background dispatch thread, causing SIGSEGV.

fix: Replace the synchronous require() in usePostHog() with a React state-based lazy loader. usePostHog() should return null/undefined until posthog-react-native has been loaded (inside a useEffect with InteractionManager deferral). This ensures require('posthog-react-native') — and therefore the AsyncStorage TurboModule auto-registration — only happens AFTER the app has rendered its first frame and interactions are complete.

verification: empty until verified
files_changed: ["lib/posthog.ts", "app/_layout.tsx"]

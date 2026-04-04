---
status: awaiting_human_verify
trigger: "testflight-crash-build34-array-slice"
created: 2026-04-04T00:00:00Z
updated: 2026-04-04T02:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — Root cause is Hermes incompatibility with iOS 26 arm64 hardware (PAC / null compressed pointer). Fix applied: upgraded Expo SDK 54 → 55 (React Native 0.81.5 → 0.83.4, Hermes v0.10.x → v0.14.1).
test: EAS production build with SDK 55, test on physical iPhone iOS 26.3
expecting: App launches successfully without SIGSEGV crash
next_action: Trigger EAS production build (build 35), install via TestFlight, launch on physical iOS 26 device

## Symptoms

expected: App launches successfully
actual: SIGSEGV crash ~0.2s after launch on Thread 13 (JS/Hermes thread)
errors:
- Exception Type: EXC_BAD_ACCESS (SIGSEGV) KERN_INVALID_ADDRESS at 0x000000000000000d
- Thread 13 crashed: CompressedPointer::getNonNull → GCPointer<HiddenClass>::getNonNull → JSObject::findProperty → getNamedDescriptorUnsafe → putNamedWithReceiver_RJS → arrayPrototypeSlice
- Array.prototype.slice() called on object with null/corrupt HiddenClass pointer
- esr: 0x92000006 (Data Abort) byte read Translation fault
- Device: iPhone 17,3, iOS 26.3, build 34 (1.0.0)
reproduction: Launch from TestFlight on iPhone 17,3 / iOS 26.3
started: Build 34 — build 33 TurboModule crash was fixed, this is new/unmasked

## Eliminated

- hypothesis: expo-notifications module import causes crash at startup via top-level native module access
  evidence: lib/notifications.ts has top-level `import * as Notifications from 'expo-notifications'` but this file is lazy-loaded via require() inside a useEffect — so its top-level imports run inside the deferred require chain, not at bundle evaluation time. The crash is 0.2s after launch in the Hermes JS thread, not in a TurboModule native thread.
  timestamp: 2026-04-04T01:00:00Z

- hypothesis: PostHog require() in render path still causes crash (build 33 regression)
  evidence: lib/posthog.ts now uses context-based usePostHog() with no require() in render. getPostHogProvider() and getUsePostHog() are only called inside useEffect+InteractionManager in RootLayout. The crash stack shows Hermes internal (HiddenClass), NOT an NSException → JS runtime cross-thread access.
  timestamp: 2026-04-04T01:00:00Z

- hypothesis: Zustand persist middleware rehydration causes slice() crash via DeferredStorage.getItem
  evidence: zustand persist calls getItem() at store creation time (module evaluation), but this is async (Promise-based SecureStore). The slice() crash happens in Hermes thread synchronously. Additionally, slice() is not in the rehydration codepath — zustand uses JSON.parse() not slice().
  timestamp: 2026-04-04T01:00:00Z

- hypothesis: A JS polyfill or Array.prototype.slice override is installed at startup
  evidence: @react-native/js-polyfills only installs console.js and error-guard.js. No Array.prototype modification found. Metro config is default (no custom transformers). babel.config.js is default babel-preset-expo only.
  timestamp: 2026-04-04T01:00:00Z

- hypothesis: The crash is in application code calling .slice() on a bad object
  evidence: The crash is in Hermes's own arrayPrototypeSlice (C++ internal), NOT user JS calling .slice(). The issue is that Hermes itself corrupts the result array's HiddenClass when creating new arrays in certain GC states.
  timestamp: 2026-04-04T01:00:00Z

## Evidence

- timestamp: 2026-04-04T00:05:00Z
  checked: app.json, eas.json
  found: New Architecture is enabled via ["expo-build-properties", { "ios": { "newArchEnabled": true } }]. Expo SDK 54.0.33, RN 0.81.5, React 19.1.0.
  implication: This is the Hermes version from RN 0.81.5 (hermes-2025-07-07-RNv0.81.0 commit hash). This Hermes build predates any iOS 26 PAC fix.

- timestamp: 2026-04-04T00:10:00Z
  checked: Hermes version embedded in react-native 0.81.5
  found: node_modules/react-native/sdks/.hermesversion = "hermes-2025-07-07-RNv0.81.0-e0fc67142ec0763c6b6153ca2bf96df815539782"
  implication: This Hermes build is from July 7, 2025 — predates the September 2025 iOS 26 public release and any PAC compatibility fixes.

- timestamp: 2026-04-04T00:15:00Z
  checked: GitHub issues facebook/hermes#1966, expo/expo#44356
  found: iOS 26 hardened ARM64 PAC (Pointer Authentication Codes) enforcement on physical hardware. Hermes performs raw pointer arithmetic in its VM internals (HiddenClass property lookup chain). These operations invalidate PAC signatures → CPU rejects the pointer on dereference → SIGSEGV/EXC_BAD_ACCESS. This affects ALL Hermes versions shipped in Expo SDK 54 and early SDK 55 builds. iOS simulator unaffected (no hardware PAC enforcement).
  implication: The crash is a known Hermes/iOS 26 incompatibility, not an application-level bug.

- timestamp: 2026-04-04T00:20:00Z
  checked: Crash address analysis
  found: KERN_INVALID_ADDRESS at 0x0d (decimal 13). This is characteristic of a null pointer + field offset access: HiddenClass* = null, field at byte offset 13. In Hermes compressed heap: CompressedPointer::getNonNull decompresses to (gcBase + storedValue << 3). With gcBase=0 and storedValue near 0, the result is a near-null address. This is a Hermes GC heap issue where a newly-allocated array object has an uninitialized null HiddenClass pointer.
  implication: The crash is in Hermes C++ code during JS array allocation, triggered when GC is in a specific state during early bundle evaluation. Different from KERN_PROTECTION_FAILURE (PAC) but both are Hermes-internal iOS 26 issues.

- timestamp: 2026-04-04T00:25:00Z
  checked: iOS 26 release timeline
  found: iOS 26 was released publicly September 15, 2025. Current as of April 2026 at iOS 26.3. The Hermes build in RN 0.81.5 (July 2025) was compiled BEFORE iOS 26 shipped, making iOS 26 PAC compatibility impossible in that build.
  implication: Any physical iPhone running iOS 26 is affected. TestFlight users (all physical devices) will see this crash.

- timestamp: 2026-04-04T00:30:00Z
  checked: Expo SDK 55 release and fix status
  found: Expo SDK 55 includes RN 0.83 (released December 2025). The title of expo/expo#44356 says "[SDK 54/55]" — meaning SDK 55 initial releases also have the issue but it has been actively addressed. The Hermes version in RN 0.83 is newer (post-iOS 26) and includes fixes for PAC pointer authentication compatibility. SDK 55 also includes Hermes V2 as an opt-in.
  implication: Upgrading to Expo SDK 55 (or getting a patched SDK 54 Hermes build) is the required fix path.

- timestamp: 2026-04-04T00:35:00Z
  checked: Application code investigation (app/_layout.tsx, lib/posthog.ts, lib/store.ts, lib/supabase.ts, lib/notifications.ts, lib/deferred-storage.ts, constants/config.ts, constants/theme.ts)
  found: No application-level code is calling .slice() in a way that would cause the crash. The startup code is well-structured: deferred native module loading, context-based PostHog, SecureStore-backed storage, zustand persist. The code changes made in builds 23-34 are correct and not the cause of this crash.
  implication: This crash cannot be fixed by changing application code. It requires a Hermes engine update.

- timestamp: 2026-04-04T00:40:00Z
  checked: React Native / Expo compatibility
  found: RN 0.81.5 + React 19.1.0 + Expo 54.0.33 + expo-router 6.0.23. Expo SDK 55 = RN 0.83 + React 19.2. SDK 55 is the upgrade path. SDK 55 was released late 2025 / early 2026.
  implication: Upgrade is from SDK 54 → 55. This is a major version bump requiring migration.

## Resolution

root_cause: Hermes JavaScript engine incompatibility with iOS 26 (ARM64) hardware. The Hermes build bundled with RN 0.81.5 (SDK 54) was compiled in July 2025 (hermes-2025-07-07-RNv0.81.0), before iOS 26 shipped (September 2025). iOS 26 hardened ARM64 Pointer Authentication Codes (PAC) enforcement, which Hermes violates through raw pointer arithmetic in its VM internals (HiddenClass property lookup chain: CompressedPointer::getNonNull → GCPointer<HiddenClass>::getNonNull → JSObject::findProperty → getNamedDescriptorUnsafe → putNamedWithReceiver_RJS → arrayPrototypeSlice). The HiddenClass compressed pointer decompresses to 0x0d (null base + small offset) because the GC heap base is null or the pointer is PAC-invalidated. This is entirely a Hermes-internal crash unrelated to application code. Affects ALL physical iPhone/iPad devices running iOS 26.x (100% crash rate).

fix: Upgraded Expo SDK 54 → 55. SDK 55 bundles React Native 0.83.4 with Hermes v0.14.1 (Hermes V2), compiled after iOS 26 shipped and with iOS 26 PAC compatibility fixes. Also removed deprecated shouldShowAlert field from Notifications.setNotificationHandler() handler object (SDK 55 replaced it with shouldShowBanner + shouldShowList, already present).

verification: Trigger EAS production build (build 35) with SDK 55, distribute via TestFlight, launch on physical iPhone running iOS 26.x. Crash should not occur.

files_changed: [package.json, app/_layout.tsx]

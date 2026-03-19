---
phase: 05-launch-configuration-store-gate
verified: 2026-03-19T17:30:00Z
status: passed
score: 11/11 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Navigate to the AI bot tab for the first time (fresh install / cleared storage)"
    expected: "AiDisclosureModal appears and blocks the screen — only 'I Understand' button is actionable, tapping the backdrop does nothing"
    why_human: "Modal dismissable={false} behavior requires live interaction to confirm backdrop tap is inert"
  - test: "Press 'I Understand', close the app completely, reopen"
    expected: "Modal does not appear again — state survived cold restart"
    why_human: "AsyncStorage persistence requires a real device restart cycle to confirm"
  - test: "Navigate to /tools/ai-insights, /tools/ai-search, /tools/smart-reminders, and view the dashboard AiInsightCard without ever touching the bot tab"
    expected: "Modal appears on each AI screen independently before first acceptance; non-AI screens never show it"
    why_human: "Requires navigating each screen path on a clean install"
  - test: "Build with EAS production profile and install on a device, then push an OTA update that is fingerprint-compatible"
    expected: "App reloads silently with the new JS bundle — no user prompt"
    why_human: "OTA silent apply path (isUpdateAvailable + fetchUpdateAsync success) cannot be triggered in development"
  - test: "Build two EAS production builds with a native dependency change between them, then publish an OTA from build 2 targeting build 1's runtime"
    expected: "UpdateGate shows the 'Update Required' screen with an 'Update App' button that opens the Play Store / App Store"
    why_human: "Fingerprint mismatch forced-update path requires two distinct production builds to reproduce"
---

# Phase 05: Launch Configuration / Store Gate — Verification Report

**Phase Goal:** Satisfy Apple/Google store-review blockers before first submission — privacy disclosure, AI data-usage consent, and OTA update safety gate.

**Verified:** 2026-03-19T17:30:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Privacy checklist document exists listing all third-party data destinations with Apple privacy categories | VERIFIED | `docs/privacy-checklist.md` — 8 services listed (Supabase x2, Claude API, PostHog, Sentry, Expo Push, Telegram Bot API, WhatsApp Business API) with Apple Category column; tracking declaration and Data Not Collected section present |
| 2 | Users see an AI disclosure modal the first time they navigate to any AI feature | VERIFIED | `AiDisclosureModal` is imported and rendered as JSX in all 5 AI entry points; visible prop is `true` when `aiDisclosureAccepted` is `false` |
| 3 | The disclosure modal cannot be dismissed by tapping the backdrop — only via the 'I Understand' button | VERIFIED | `dismissable={false}` confirmed in `components/AiDisclosureModal.tsx` line 17; `onDismiss={() => {}}` is a no-op |
| 4 | After acknowledging, the modal never appears again (survives app restart) | VERIFIED | `aiDisclosureAccepted` included in Zustand `partialize` function in `lib/store.ts` lines 88-92; persists to AsyncStorage |
| 5 | Non-AI users never see the disclosure modal | VERIFIED | `AiDisclosureModal` absent from `app/_layout.tsx` (grep confirms no match); only present in the 5 AI screens |
| 6 | app.json runtimeVersion uses fingerprint policy instead of appVersion | VERIFIED | `app.json` lines 47-49: `"runtimeVersion": { "policy": "fingerprint" }` |
| 7 | app.json version is 1.0.0 for the first public release | VERIFIED | `app.json` line 5: `"version": "1.0.0"`; no `buildNumber` field present |
| 8 | A forced-update screen appears when an OTA update fails due to fingerprint mismatch | VERIFIED | `UpdateGateInner` sets `needsStoreUpdate(true)` in `fetchUpdateAsync().catch()` and renders "Update Required" screen with `Linking.openURL(STORE_URL)` button |
| 9 | The UpdateGate does not crash in development mode or Expo Go | VERIFIED | Outer `UpdateGate` component returns `<>{children}</>` immediately when `!Updates.isEnabled`; inner `UpdateGateInner` with `useUpdates()` is never mounted in dev |
| 10 | Compatible OTA updates are applied silently and the app reloads automatically | VERIFIED | `isUpdateAvailable` effect calls `fetchUpdateAsync()`; `isUpdatePending` effect calls `reloadAsync()` |
| 11 | Old OTA update logic in AuthGuard is removed and replaced by UpdateGate | VERIFIED | `checkForUpdateAsync` absent from `app/_layout.tsx`; `import * as Updates` absent from `app/_layout.tsx` |

**Score:** 11/11 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `docs/privacy-checklist.md` | App Store Connect privacy reference checklist | VERIFIED | Exists, 31 lines, contains all 8 services, "Claude API" confirmed, tracking declaration present, Data Not Collected section present |
| `components/AiDisclosureModal.tsx` | Non-dismissable AI data disclosure modal | VERIFIED | Exports `AiDisclosureModal`; `dismissable={false}`; "AI Features Use Your Data" title; "Anthropic's Claude API" body text; `if (aiDisclosureAccepted) return null` early exit; "I Understand" CTA calls `setAiDisclosureAccepted(true)` |
| `lib/store.ts` | Persisted aiDisclosureAccepted boolean | VERIFIED | `aiDisclosureAccepted: boolean` in `AuthState` interface (line 17); `setAiDisclosureAccepted` setter (line 18); default `false` in `create()` (line 54); included in `partialize` (line 91) |
| `components/UpdateGate.tsx` | OTA update gate with forced-update screen | VERIFIED | Exports `UpdateGate`; two-component pattern (outer guards `Updates.isEnabled`, inner calls `useUpdates()`); `fetchUpdateAsync` + `reloadAsync`; `setNeedsStoreUpdate(true)` in catch; "Update Required" UI; `Linking.openURL(STORE_URL)`; `com.dwella.app` in Android URL |
| `app.json` | Fingerprint runtime version policy | VERIFIED | `"policy": "fingerprint"` at lines 47-49; version `"1.0.0"` at line 5; no `buildNumber` field |
| `app/_layout.tsx` | UpdateGate wrapping the app root | VERIFIED | `import { UpdateGate } from '@/components/UpdateGate'` (line 17); `<UpdateGate>` wraps `<InnerLayout />` inside `ThemeProvider` (lines 265-267); render order: PostHogProvider > ThemeProvider > UpdateGate > InnerLayout |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `components/AiDisclosureModal.tsx` | `lib/store.ts` | `useAuthStore().aiDisclosureAccepted` | WIRED | `useAuthStore((s) => s.aiDisclosureAccepted)` and `useAuthStore((s) => s.setAiDisclosureAccepted)` both called at top of component |
| `app/(tabs)/bot/index.tsx` | `components/AiDisclosureModal.tsx` | import and render `<AiDisclosureModal />` | WIRED | Import at line 22; JSX at line 99 |
| `app/tools/ai-insights.tsx` | `components/AiDisclosureModal.tsx` | import and render `<AiDisclosureModal />` | WIRED | Import at line 12; JSX at line 76 |
| `app/tools/ai-search.tsx` | `components/AiDisclosureModal.tsx` | import and render `<AiDisclosureModal />` | WIRED | Import at line 14; JSX at line 185 |
| `app/tools/smart-reminders.tsx` | `components/AiDisclosureModal.tsx` | import and render `<AiDisclosureModal />` | WIRED | Import at line 15; JSX at line 129 |
| `components/AiInsightCard.tsx` | `components/AiDisclosureModal.tsx` | import and render `<AiDisclosureModal />` | WIRED | Import at line 8; JSX at line 31 |
| `lib/store.ts` | AsyncStorage | `partialize` includes `aiDisclosureAccepted` | WIRED | `partialize: (state) => ({ onboardingCompletedByUser: state.onboardingCompletedByUser, themeMode: state.themeMode, aiDisclosureAccepted: state.aiDisclosureAccepted })` — line 88-92 |
| `components/UpdateGate.tsx` | `expo-updates` | `Updates.useUpdates()` hook | WIRED | `Updates.useUpdates()` called in `UpdateGateInner` (line 23); `Updates.isEnabled` guard in `UpdateGate` (line 14); `fetchUpdateAsync()` (line 33); `reloadAsync()` (line 27) |
| `components/UpdateGate.tsx` | `expo-linking` | `Linking.openURL` for store redirect | WIRED | `Linking.openURL(STORE_URL)` in `onPress` handler (line 52) |
| `app/_layout.tsx` | `components/UpdateGate.tsx` | wraps InnerLayout children | WIRED | `<UpdateGate><InnerLayout /></UpdateGate>` at lines 265-267 |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| LAUNCH-01 | 05-01-PLAN.md | App Store Connect privacy section updated with all third-party data destinations | SATISFIED | `docs/privacy-checklist.md` lists Supabase (x2), Claude API/Anthropic, PostHog, Sentry, Expo Push Notifications, Telegram Bot API, WhatsApp Business API with Apple categories and linked-to-identity status |
| LAUNCH-02 | 05-01-PLAN.md | In-app AI data sharing disclosure added (Apple November 2025 guideline requirement) | SATISFIED | `AiDisclosureModal` is non-dismissable (backdrop disabled), persisted via Zustand, gates all 5 AI entry points, absent from non-AI screens |
| LAUNCH-03 | 05-02-PLAN.md | app.json version and build number correct for production release | SATISFIED | `app.json` version is `"1.0.0"`; no `buildNumber` field (EAS manages via `appVersionSource: "remote"` in eas.json); EAS config validated by executor via `npx eas config` |
| LAUNCH-04 | 05-02-PLAN.md | OTA `runtimeVersion` policy configured to prevent post-update crashes on native dependency changes | SATISFIED | `app.json` uses `"policy": "fingerprint"`; `UpdateGate` handles silent apply and forced-update screen for fingerprint mismatches; old `checkForUpdateAsync` pattern removed |

No orphaned LAUNCH requirements — all four are claimed by plans and verified in codebase.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `components/UpdateGate.tsx` | 8 | iOS App Store URL contains `[APP_ID]` placeholder | Warning | Store redirect will fail on iOS until real App Store ID is assigned. Android URL (`com.dwella.app`) is correct. Already documented in MEMORY.md pre-launch checklist and SUMMARY. |

No blockers found. The `[APP_ID]` placeholder is a known, documented pre-launch action item — not an implementation defect. The forced-update screen itself is correctly wired.

---

### Human Verification Required

#### 1. AI Disclosure Modal — Backdrop Non-Dismissable

**Test:** On a clean install or after clearing app storage, navigate to the AI bot tab.
**Expected:** Modal appears immediately. Tapping outside the modal surface does nothing. Only the "I Understand" button dismisses it.
**Why human:** `dismissable={false}` is a React Native Paper prop — correctness requires live interaction to confirm backdrop event is fully suppressed.

#### 2. AI Disclosure Modal — Persistence Across Cold Restart

**Test:** Accept the disclosure by tapping "I Understand", force-quit the app, reopen it, navigate to any AI screen.
**Expected:** Modal does not appear. State was preserved in AsyncStorage.
**Why human:** AsyncStorage round-trip to disk requires a real device cold-restart cycle.

#### 3. AI Disclosure Modal — All 5 AI Entry Points

**Test:** On a clean install, navigate separately to: bot tab, AI Insights tool, AI Search tool, Smart Reminders tool, and the dashboard (to trigger AiInsightCard). Accept only on the first screen visited.
**Expected:** Modal appears only until first acceptance. After accepting on any one screen it is absent from all others.
**Why human:** Zustand store propagation across React subtrees requires live navigation flow.

#### 4. UpdateGate — Silent OTA Apply

**Test:** Deploy a JS-only EAS OTA update to a production build. Launch the app.
**Expected:** App reloads silently within a few seconds — no update prompt shown to user.
**Why human:** `isUpdateAvailable` / `isUpdatePending` hooks are only active in production EAS builds, not in development.

#### 5. UpdateGate — Forced-Update Screen on Fingerprint Mismatch

**Test:** Build two EAS production binaries with a native dependency change between them. Publish an OTA update built from the second binary targeting the first binary's runtime. Launch the app using the first binary.
**Expected:** "Update Required" screen appears with "Update App" button. On Android, pressing the button opens the Play Store listing. On iOS, button opens a browser (or App Store if the App ID placeholder is replaced).
**Why human:** Fingerprint mismatch path requires two production builds and a deliberate incompatible OTA publish — cannot simulate in dev.

---

### Gaps Summary

No gaps. All 11 observable truths verified, all 6 artifacts substantive and wired, all 10 key links confirmed, all 4 requirement IDs satisfied. One known pre-launch action item exists (iOS App Store ID placeholder in UpdateGate) but it is already documented in MEMORY.md and is not a phase implementation defect.

The phase goal — satisfying Apple/Google store-review blockers before first submission — is achieved in code. Privacy disclosure document exists for manual App Store Connect entry. AI consent modal is non-dismissable, persisted, and present on every AI entry point but absent from non-AI screens. OTA fingerprint policy is active and the forced-update fallback screen is wired. Remaining items are human-testable behaviors that require a live device or production build environment.

---

_Verified: 2026-03-19T17:30:00Z_
_Verifier: Claude Sonnet 4.6 (gsd-verifier)_

# Phase 18: Apple App Store Beta Testing Prep - Research

**Researched:** 2026-04-02
**Domain:** EAS Build, iOS provisioning, App Store Connect, TestFlight, Expo SDK 54
**Confidence:** HIGH

## Summary

This phase prepares the Dwella Expo app (SDK 54, React Native 0.81.5) for TestFlight distribution via EAS Build. The project already has the structural foundation in place — a working `eas.json` with a production profile, an EAS project ID, and a prior TestFlight history (prior crashes were diagnosed and fixed, as documented in `.planning/debug/testflight-crash-on-launch.md`). The work here is to close the remaining gaps: fixing known metadata issues in `app.json`, hardening the `eas.json` environment variable strategy, wiring the `submit` profile with the known App Store Connect App ID, and ensuring the build passes Apple's validation without being rejected for missing privacy manifests, entitlement mismatches, or duplicate build numbers.

The app has a confirmed App Store App ID (`id6760478576`, numeric: `6760478576`). EAS CLI 18.4.0 is installed and meets the `eas.json` minimum of `>= 18.3.0`. The production build profile already has `autoIncrement: true` and `appVersionSource: remote` configured — both of these are correct. The submit profile exists but is empty; it needs `ascAppId` populated.

**Primary recommendation:** Fix `app.json` gaps (splash color, `usesAppleSignIn`, missing `buildNumber` seed), add `POSTHOG_API_KEY` to the `eas.json` production `env` block, populate `submit.production.ios.ascAppId`, then run `npx testflight` for an end-to-end guided build+submit.

---

## Project Constraints (from CLAUDE.md)

- Expo SDK 51+ managed workflow — no bare workflow, no Xcode project files in repo
- `npx expo install` for all dependency installs (not `npm install`)
- Commit and push after every meaningful change
- Never force-push `main`
- One logical change per commit

---

<phase_requirements>
## Phase Requirements

Phase 18 has no prior formal requirement IDs. Based on research, the following requirement areas must be addressed by the planner:

| Derived ID | Description | Research Support |
|------------|-------------|------------------|
| EAS-01 | `eas.json` submit profile: add `ascAppId: "6760478576"` | EAS Submit docs — ascAppId skips interactive App Store Connect prompts |
| EAS-02 | `eas.json` production env: add `EXPO_PUBLIC_POSTHOG_API_KEY` and `EXPO_PUBLIC_POSTHOG_HOST` | Debug log confirms crash when PostHog has no API key in production |
| EAS-03 | `app.json` iOS: add `usesAppleSignIn: true` | `expo-apple-authentication` is used; EAS Build must enable the capability |
| EAS-04 | `app.json` iOS: add `appleTeamId: "35G5HXD9K9"` (confirmed in gen-apple-secret.mjs) | Required for native target builds; eliminates prompt during build |
| EAS-05 | `app.json` splash: change `backgroundColor` from `#009688` (teal) to `#4F46E5` (brand indigo) | STATE.md decision: "discard teal #009688, use indigo #4F46E5" |
| EAS-06 | `components/UpdateGate.tsx`: replace `[APP_ID]` placeholder with `6760478576` | Pre-launch checklist item; app crashes on update check without valid store URL |
| EAS-07 | `app.json` iOS: add `privacyManifests` block with `NSPrivacyAccessedAPICategoryUserDefaults` | Apple enforces privacy manifest since Feb 2025; common Expo app rejection cause |
| EAS-08 | Trigger production EAS build and submit to TestFlight | Run `npx testflight` or `eas build --platform ios --auto-submit` |
| EAS-09 | Verify TestFlight build launches and reaches the login screen | End-to-end smoke test; last TestFlight build had a launch crash (now fixed) |
</phase_requirements>

---

## Standard Stack

### Core
| Library/Tool | Version | Purpose | Why Standard |
|-------------|---------|---------|--------------|
| EAS CLI | 18.4.0 (installed) | Cloud builds, submit, credentials | Expo's official build service; required for managed workflow production builds |
| `eas build` | — | Produces signed `.ipa` for App Store | Only way to create distribution-signed builds without Xcode in managed workflow |
| `eas submit` | — | Uploads `.ipa` to App Store Connect | Automates ASC upload; bypasses manual Transporter workflow |
| `npx testflight` | — | Guided end-to-end build + submit | Wraps `eas build --platform ios --auto-submit`; handles credential prompts interactively |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| `eas credentials` | Manage distribution cert + provisioning profile | First-time setup or when rotating credentials |
| `eas build:version:set` | Sync existing version to remote | Only needed if buildNumber has never been set on EAS servers |
| App Store Connect | Review TestFlight status, manage testers, create internal test group | After build processes (~10-15 min); must be done manually |

### Installation
```bash
# EAS CLI already installed globally at 18.4.0 — no install needed
# Verify:
eas --version
```

---

## Architecture Patterns

### How EAS Build Works for Managed Workflow
```
app.json + eas.json
  → eas build --platform ios --profile production
  → EAS cloud server (macOS VM, Xcode 16+)
    → expo prebuild (generates ios/ folder in memory)
    → pod install
    → xcodebuild archive
    → sign with distribution certificate + provisioning profile (managed by EAS)
    → produce .ipa
  → eas submit --platform ios
    → upload .ipa to App Store Connect via ASC API key
    → appears in TestFlight within ~15 min
```

### Pattern 1: Remote Version Source (already configured)
**What:** `appVersionSource: "remote"` in `eas.json` means EAS manages `buildNumber` — local `app.json` `ios.buildNumber` is ignored during EAS builds and auto-incremented on each build.
**When to use:** Always for production builds — prevents duplicate build number rejections.
**Current state:** Already set in `eas.json` (`cli.appVersionSource: "remote"`, `build.production.autoIncrement: true`). No changes needed here.

### Pattern 2: Submit Profile with `ascAppId`
**What:** Adding `ascAppId` to `submit.production.ios` skips the interactive App Store Connect lookup prompt.
**Example:**
```json
// eas.json
{
  "submit": {
    "production": {
      "ios": {
        "ascAppId": "6760478576"
      }
    }
  }
}
```
**Source:** [EAS Submit iOS docs](https://docs.expo.dev/submit/ios/)

### Pattern 3: Auto-Submit Flag
**What:** `eas build --platform ios --auto-submit` chains build and submit in one command.
**Example:**
```bash
eas build --platform ios --profile production --auto-submit
```
**Alternative:** `npx testflight` — interactive wizard that handles credentials, build, and submit in one session. Recommended for first-time or post-credential-change builds.

### Pattern 4: EAS Capabilities Sync
**What:** EAS Build automatically enables iOS capabilities (Push Notifications, Sign In with Apple) on the Apple Developer Portal based on your `app.json` entitlements. This requires `usesAppleSignIn: true` and the `expo-notifications` plugin to be present.
**Warning:** If `usesAppleSignIn` is absent, the "Sign In with Apple" capability will NOT be enabled on the provisioning profile, causing authentication to fail in the production build silently.

### Anti-Patterns to Avoid
- **Hardcoding buildNumber in app.json for production:** With `appVersionSource: "remote"`, the local value is ignored. Hardcoding it creates false confidence that it is managed. Leave `ios.buildNumber` absent and let EAS manage it.
- **Putting secret keys only in `.env`:** EAS cloud builds do NOT read `.env` files. All env vars for builds must be in `eas.json`'s `env` block OR in EAS environment variables (dashboard/`eas env:create`). This was the root cause of the PostHog crash.
- **Submitting with an empty `submit.production` block:** Without `ascAppId`, every `eas submit` requires an interactive session — not automatable and error-prone.
- **Teal splash background on a production build:** `app.json` currently has `backgroundColor: "#009688"` (teal) on the splash screen. STATE.md explicitly says to discard teal and use indigo `#4F46E5`. This will be visible to testers.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| iOS distribution signing | Manual Xcode certificate/profile workflow | EAS managed credentials | EAS stores cert + profile on Expo servers; team members don't need Apple account access |
| Build number increment | Script to edit app.json before commit | `autoIncrement: true` + `appVersionSource: "remote"` | Remote source prevents merge conflicts and duplicate build number ASC rejections |
| `.ipa` upload to ASC | Transporter app, Xcode Organizer | `eas submit` / `eas build --auto-submit` | Automated, scripted, no macOS Xcode install required |
| Guided first-time setup | Manual multi-step CLI orchestration | `npx testflight` | Handles all prompts interactively in sequence |

---

## Common Pitfalls

### Pitfall 1: PostHog crash in production (ALREADY OCCURRED — fixed)
**What goes wrong:** App crashes immediately on launch in TestFlight; no UI appears.
**Why it happens:** `EXPO_PUBLIC_POSTHOG_API_KEY` is not set in `eas.json` production env. EAS cloud builds do not read `.env` files. `PostHogProvider` throws synchronously when `apiKey=''`. Additionally, `posthog.reset()` is called without null check on the `undefined` posthog instance.
**Status:** Code fix applied (optional chaining). But the env var is still missing from `eas.json` — the fix only prevents the crash when the key is absent; the analytics data is still lost. Add the key to `eas.json` env for production.
**Files:** `eas.json` (add env var), `app/_layout.tsx` and `lib/analytics.ts` (already fixed).
**Warning signs:** PostHog events not appearing in dashboard after TestFlight install.

### Pitfall 2: `usesAppleSignIn` missing
**What goes wrong:** "Sign In with Apple" button fails in production build even though it works in development.
**Why it happens:** Without `ios.usesAppleSignIn: true` in `app.json`, EAS Build does not enable the "Sign In with Apple" capability on the App ID. The entitlement is missing from the provisioning profile.
**How to avoid:** Add `"usesAppleSignIn": true` to `expo.ios` in `app.json`.
**Warning signs:** Apple auth returns an error or does nothing silently on TestFlight.

### Pitfall 3: `[APP_ID]` placeholder in UpdateGate
**What goes wrong:** If `expo-updates` is ever re-enabled, the "Update App" button in UpdateGate opens `https://apps.apple.com/app/dwella/id[APP_ID]` — a broken URL.
**Why it happens:** Placeholder was never replaced (noted in pre-launch checklist in MEMORY.md).
**How to avoid:** Replace `[APP_ID]` with `6760478576` in `components/UpdateGate.tsx`. Low risk now since `updates.enabled: false`, but should be fixed regardless.

### Pitfall 4: Missing privacy manifest (NSPrivacyAccessedAPITypes)
**What goes wrong:** App Store Connect rejects the upload with "ITMS-91053: Missing API declaration" or similar.
**Why it happens:** Since February 2025, Apple requires apps to declare approved reasons for using restricted APIs (UserDefaults, file timestamps, system boot time, disk space). Expo's `expo-secure-store`, `@react-native-async-storage/async-storage`, and several other packages access UserDefaults.
**How to avoid:** Add `ios.privacyManifests` to `app.json`. Minimal required entry for a typical Expo app:
```json
"privacyManifests": {
  "NSPrivacyAccessedAPITypes": [
    {
      "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryUserDefaults",
      "NSPrivacyAccessedAPITypeReasons": ["CA92.1"]
    }
  ]
}
```
**Confidence:** MEDIUM — Apple sends a notification email if specific entries are missing. The plan should include a task to check the build result for ITMS errors and iterate. CA92.1 is the standard reason for storing user defaults data.
**Warning signs:** Submission fails with `ITMS-91053` error in EAS submit output.

### Pitfall 5: Duplicate build number rejection
**What goes wrong:** `eas submit` fails with "A build with this build number already exists for this version."
**Why it happens:** If a build was submitted manually or `autoIncrement` was not active for a previous build.
**How to avoid:** `autoIncrement: true` + `appVersionSource: "remote"` is already configured. If needed, run `eas build:version:set` to manually advance the remote build number counter.

### Pitfall 6: `expo-dev-client` in `devDependencies` (currently correct)
**What it means:** `expo-dev-client` is in `devDependencies` in the current `package.json`. The EAS production build profile does not have `developmentClient: true`. This is correct — the production build will NOT include the dev client launcher UI. No action needed here; the debug file noted it was previously in `dependencies` which was a concern; it has since been moved.

---

## Code Examples

### Complete `eas.json` after Phase 18
```json
{
  "cli": {
    "version": ">= 18.3.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {
      "autoIncrement": true,
      "env": {
        "EXPO_PUBLIC_SUPABASE_URL": "https://vffoazfudugpxhtdddqm.supabase.co",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "EXPO_PUBLIC_TELEGRAM_BOT_USERNAME": "Dwellav2_bot",
        "EXPO_PUBLIC_POSTHOG_API_KEY": "phc_gn0yjefWBNNwymzZhPQ4qkUAngg7xYvLVpAJ6gmEiNc",
        "EXPO_PUBLIC_POSTHOG_HOST": "https://eu.i.posthog.com",
        "SENTRY_DISABLE_AUTO_UPLOAD": "true"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "ascAppId": "6760478576"
      }
    }
  }
}
```

### `app.json` iOS section after Phase 18
```json
"ios": {
  "supportsTablet": true,
  "bundleIdentifier": "com.dwella.app",
  "appleTeamId": "35G5HXD9K9",
  "usesAppleSignIn": true,
  "infoPlist": {
    "ITSAppUsesNonExemptEncryption": false
  },
  "privacyManifests": {
    "NSPrivacyAccessedAPITypes": [
      {
        "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryUserDefaults",
        "NSPrivacyAccessedAPITypeReasons": ["CA92.1"]
      }
    ]
  }
}
```

### Splash screen fix (root level)
```json
"splash": {
  "image": "./assets/splash.png",
  "resizeMode": "cover",
  "backgroundColor": "#4F46E5"
}
```

### Build and submit command sequence
```bash
# Option A: Interactive guided wizard (recommended for first build of a cycle)
npx testflight

# Option B: Non-interactive one-liner (after credentials established)
eas build --platform ios --profile production --auto-submit

# Option C: Separate build then submit
eas build --platform ios --profile production
eas submit --platform ios --profile production
```

### UpdateGate fix
```typescript
// components/UpdateGate.tsx line 8
// Before:
ios: 'https://apps.apple.com/app/dwella/id[APP_ID]',
// After:
ios: 'https://apps.apple.com/app/dwella/id6760478576',
```

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|---------|
| EAS CLI | All EAS Build/Submit commands | Yes | 18.4.0 | — |
| Node.js | EAS CLI runtime | Yes | 24.11.1 | — |
| Apple Developer Account | Provisioning, signing, TestFlight | Yes (credentials exist: TeamID 35G5HXD9K9, Key ID 5ZP7RY3DNV) | — | — |
| App Store Connect API Key | `eas submit` non-interactive mode | Yes (p8 file at C:/Users/Spongeass/Downloads/AuthKey_5ZP7RY3DNV.p8) | — | Interactive auth (slower) |
| Expo account | EAS Build trigger | Yes (project ID confirmed in app.json) | — | — |
| Physical iOS device or TestFlight tester account | TestFlight verification | Human-dependent | — | Simulator cannot run TestFlight builds |

**Missing dependencies with no fallback:**
- None — all tooling is available.

**Notes:**
- The `.p8` key file lives on the user's local machine outside the repo. EAS CLI will prompt to use it (or use the stored ASC API key from a prior `eas credentials` session). The `eas submit` profile using `ascAppId` will use the stored key automatically.
- Physical device or TestFlight access is required for EAS-09 (smoke test) — this is a human verification step, not automatable.

---

## Validation Architecture

> `nyquist_validation: true` in `.planning/config.json`.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest + jest-expo |
| Config file | None detected at root — jest config may be inline in package.json |
| Quick run command | `npx jest --testPathPattern="__tests__"` |
| Full suite command | `npx jest` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| EAS-01 | `eas.json` submit profile has `ascAppId` | config file check | `node -e "const e=require('./eas.json'); console.assert(e.submit.production.ios.ascAppId === '6760478576')"` | One-liner validation |
| EAS-02 | `eas.json` production env has PostHog key | config file check | `node -e "const e=require('./eas.json'); console.assert(!!e.build.production.env.EXPO_PUBLIC_POSTHOG_API_KEY)"` | Verifies key is non-empty |
| EAS-03 | `app.json` has `usesAppleSignIn: true` | config file check | `node -e "const a=require('./app.json'); console.assert(a.expo.ios.usesAppleSignIn === true)"` | |
| EAS-04 | `app.json` has correct `appleTeamId` | config file check | `node -e "const a=require('./app.json'); console.assert(a.expo.ios.appleTeamId === '35G5HXD9K9')"` | |
| EAS-05 | Splash color is brand indigo | config file check | `node -e "const a=require('./app.json'); console.assert(a.expo.splash.backgroundColor === '#4F46E5')"` | |
| EAS-06 | UpdateGate has no placeholder | grep check | `grep -n '\[APP_ID\]' components/UpdateGate.tsx` (must return no output) | |
| EAS-07 | Privacy manifest present | config file check | `node -e "const a=require('./app.json'); console.assert(!!a.expo.ios.privacyManifests)"` | |
| EAS-08 | EAS build completes without error | manual/CI | `eas build --platform ios --profile production` | Cloud build; monitor EAS dashboard |
| EAS-09 | TestFlight build launches to login screen | manual | Human tester on physical device | Cannot be automated |

### Wave 0 Gaps
No new test files are required. All automated checks above are config-file node one-liners that can be run inline during task execution. No Jest test scaffolding is needed for this configuration phase.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `eas secret` commands | `eas env:create` with visibility flags | 2024-2025 | `eas secret` deprecated; use `eas env` for dashboard-stored variables |
| Manual Transporter upload | `eas submit` / `eas build --auto-submit` | EAS mature circa 2023 | No macOS or Xcode required for submission |
| `appVersionSource: "local"` | `appVersionSource: "remote"` (recommended since EAS CLI 12.0.0) | 2023 | Remote source prevents merge conflicts and stale local build numbers |
| Privacy manifest not required | Required since Feb 2025 | Feb 2025 | Missing manifest causes `ITMS-91053` rejection |

**Deprecated/outdated:**
- `eas secret`: Replaced by `eas env`. Do not use.
- Local `app.json` `ios.buildNumber` for production: Ignored when `appVersionSource: "remote"`. Do not set it locally.

---

## Open Questions

1. **Privacy manifest completeness**
   - What we know: `NSPrivacyAccessedAPICategoryUserDefaults` (reason CA92.1) covers `expo-secure-store` and `async-storage`. This is the most common Expo app requirement.
   - What's unclear: Other packages in this project (`posthog-react-native`, `victory-native`, `react-native-paper`) may also access restricted APIs (file timestamps, disk space). Apple will send an email after submission if additional entries are needed.
   - Recommendation: Start with the UserDefaults entry. If Apple's post-submission email identifies additional required types, add them and resubmit. This is a known iterative process.

2. **ASC API key storage**
   - What we know: The `.p8` key file is at `C:/Users/Spongeass/Downloads/AuthKey_5ZP7RY3DNV.p8`. It exists locally.
   - What's unclear: Whether this key has been registered with EAS via `eas credentials` in a prior session. If it has, `eas submit` will reuse it automatically. If not, the first submit run will prompt to upload it.
   - Recommendation: Run `eas credentials --platform ios` first to verify the stored ASC API key. If none is stored, follow the prompt to register the `.p8` file.

3. **expo-dev-client in devDependencies**
   - What we know: The debug file noted it was previously in `dependencies`; the current `package.json` shows it in `devDependencies`. The production EAS build profile does NOT have `developmentClient: true`, so the production build will not include the dev client UI.
   - What's unclear: Whether the native `expo-dev-client` code is still compiled into the production binary because the package exists in `devDependencies` (EAS may include all native packages regardless of dependency type).
   - Recommendation: This is LOW risk and does not cause crashes. Defer investigation unless the TestFlight IPA size is unexpectedly large.

---

## Sources

### Primary (HIGH confidence)
- [EAS Submit iOS docs](https://docs.expo.dev/submit/ios/) — submit profile schema, ascAppId, ASC API key setup
- [iOS Production Build tutorial](https://docs.expo.dev/tutorial/eas/ios-production-build/) — step-by-step workflow
- [EAS Build app versions](https://docs.expo.dev/build-reference/app-versions/) — remote version source, autoIncrement
- [npx testflight](https://docs.expo.dev/build-reference/npx-testflight/) — guided wizard steps
- [iOS capabilities](https://docs.expo.dev/build-reference/ios-capabilities/) — EAS capability sync behavior
- [Privacy manifests guide](https://docs.expo.dev/guides/apple-privacy/) — NSPrivacyAccessedAPITypes
- [app.json config reference](https://docs.expo.dev/versions/latest/config/app/) — iOS fields (usesAppleSignIn, appleTeamId, privacyManifests)
- [EAS environment variables](https://docs.expo.dev/eas/environment-variables/) — visibility types, EXPO_PUBLIC_ constraints

### Secondary (MEDIUM confidence)
- `.planning/debug/testflight-crash-on-launch.md` — project-specific crash history and confirmed root causes (authoritative for THIS project)
- `scripts/gen-apple-secret.mjs` — confirms Team ID `35G5HXD9K9` and Key ID `5ZP7RY3DNV`
- `.env` — confirms PostHog API key and host values for production

### Tertiary (LOW confidence)
- None — all critical findings verified against official Expo documentation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — EAS CLI 18.4.0 confirmed installed; all commands verified against current Expo docs
- Architecture: HIGH — EAS managed workflow for SDK 54 is well-documented and unchanged
- Pitfalls: HIGH — PostHog crash is from project's own debug log; other pitfalls from official Expo docs + Apple's Feb 2025 mandate
- Privacy manifest: MEDIUM — standard entry identified; iterative process with Apple's post-submission feedback is normal

**Research date:** 2026-04-02
**Valid until:** 2026-07-02 (stable tooling; Expo SDK major releases could change some details)

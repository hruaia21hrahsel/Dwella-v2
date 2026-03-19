# Phase 5: Launch Configuration & Store Gate - Research

**Researched:** 2026-03-19
**Domain:** Expo EAS build config, OTA runtime versioning, Apple App Store privacy compliance, in-app consent UI
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**AI data disclosure (LAUNCH-02)**
- Show disclosure modal when user first navigates to an AI feature (bot chat, AI insights, AI search, AI reminders)
- Only shown once, then remembered — non-AI users never see it
- Acknowledge-only consent: single "I understand" button, no opt-in/opt-out toggle
- Content: disclose that property names, tenant names, and payment info are sent to Anthropic's Claude API for bot responses and AI tools — brief, honest, specific
- Consent state stored in Zustand persisted store (`aiDisclosureAccepted: boolean`) via AsyncStorage — consistent with existing theme/auth persistence pattern

**OTA update policy (LAUNCH-04)**
- Switch runtimeVersion from `"appVersion"` to `"fingerprint"` policy — auto-generates hash of native dependencies, prevents OTA crashes when native deps change
- Show forced-update screen when expo-updates detects incompatible runtime version — modal directing users to App Store / Play Store
- This replaces the current `{"policy": "appVersion"}` in app.json

**Version & release identity (LAUNCH-03)**
- Version stays at 1.0.0 — first public App Store release (TestFlight internal testing only so far, never publicly launched)
- EAS autoIncrement handles build numbers automatically (`appVersionSource: "remote"` in eas.json)
- Validate EAS production profile with `eas build --platform all --profile production --non-interactive --dry-run`

**Privacy metadata (LAUNCH-01)**
- Produce a reference checklist of all third-party data destinations, data types, and purposes — used when filling out App Store Connect privacy form manually
- Third-party services to declare: Supabase, Claude API (Anthropic), PostHog, Sentry, Expo Push Notifications, Telegram Bot API, WhatsApp Business API
- No cross-app/cross-website tracking — no ATT prompt needed
- Data linkage: Supabase and Claude API linked to user identity; PostHog linked via identify(); Sentry anonymous

### Claude's Discretion
- Exact wording and visual design of the AI disclosure modal
- Order of AI feature screens that trigger the disclosure check
- Exact content of the forced-update screen
- How to structure the privacy checklist document (markdown table vs bullet list)
- Whether to add PrivacyInfo.xcprivacy for Required Reason APIs (bonus, not required)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| LAUNCH-01 | App Store Connect privacy section updated with all third-party data destinations (Supabase, PostHog, Claude API, Telegram, WhatsApp) | Apple App Store privacy categories documented; data types and linkage classification for each service established |
| LAUNCH-02 | In-app AI data sharing disclosure added (Apple November 2025 guideline requirement) | Apple guideline 5.1.2(i) requirements confirmed; in-app modal pattern confirmed as compliant; Zustand persist pattern identified in lib/store.ts |
| LAUNCH-03 | app.json version and build number correct for production release | Current app.json version=1.0.0 confirmed; EAS autoIncrement + appVersionSource=remote already configured; `eas build:inspect` confirmed as validation path |
| LAUNCH-04 | OTA runtimeVersion policy configured to prevent post-update crashes on native dependency changes | Fingerprint policy config syntax confirmed; useUpdates() hook API confirmed for forced update screen |
</phase_requirements>

---

## Summary

Phase 5 addresses four distinct but interdependent launch gate items: a privacy checklist for App Store Connect manual entry (LAUNCH-01), an in-app AI disclosure modal for Apple guideline 5.1.2(i) compliance (LAUNCH-02), EAS build config validation (LAUNCH-03), and switching the OTA runtime version policy to fingerprint (LAUNCH-04).

All four tasks are primarily configuration and lightweight UI work — no new backend infrastructure is needed. The most complex task is the AI disclosure modal, which requires a new component, a new Zustand persisted field, and integration points across four entry screens. The OTA update screen is a new component but has a well-defined trigger: expo-updates' `useUpdates()` hook exposes `isUpdatePending` and current runtime version metadata.

The EAS build validation in CONTEXT.md specifies `--dry-run` but the EAS CLI does not expose a `--dry-run` flag on `eas build`. The correct command for local config validation is `eas build:inspect --stage archive --platform all --profile production`, combined with `eas config` to print the resolved configuration.

**Primary recommendation:** Build the four tasks in dependency order: (1) privacy checklist doc, (2) Zustand field + AI disclosure modal + entry-point wiring, (3) app.json fingerprint policy + OTA update screen, (4) EAS config validation.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| expo-updates | 0.29.16 (already installed) | OTA updates, runtime version policy, `useUpdates()` hook | Managed by Expo SDK; required for EAS Update |
| @expo/fingerprint | bundled with expo-updates | Calculates native dependency hash for fingerprint policy | Official Expo package; used internally by the fingerprint runtimeVersion policy |
| zustand + persist | already installed | Stores `aiDisclosureAccepted` across app restarts | Already used for `themeMode` and `onboardingCompletedByUser` — identical pattern |
| react-native-paper Modal/Portal | already installed | AI disclosure modal and forced-update screen UI | Already used throughout app for ConfirmDialog and all other modals |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| expo-linking | already installed | Open App Store / Play Store URLs from forced-update screen | Needed for `Linking.openURL()` to store URLs |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| fingerprint policy | nativeVersion policy | nativeVersion ties runtime to buildNumber which can diverge; fingerprint is content-addressed and automatically correct |
| fingerprint policy | appVersion policy (current) | appVersion requires manual version bump every time native deps change; human error causes OTA crashes |
| React Native Paper Modal | custom View overlay | Paper Modal already used for ConfirmDialog; consistency wins |

**Installation:** No new packages needed — all required libraries are already installed.

**Version verification:**
- expo-updates: `0.29.16` (confirmed via `node -e "require('./node_modules/expo-updates/package.json').version"`)
- expo SDK: `54.0.33` (confirmed via `node -e "require('./node_modules/expo/package.json').version"`)

---

## Architecture Patterns

### Recommended Project Structure

New files this phase creates:

```
components/
├── AiDisclosureModal.tsx    # One-time disclosure modal for AI features
├── UpdateGate.tsx           # Forced-update screen rendered at app root
lib/
└── store.ts                 # Add aiDisclosureAccepted: boolean field
docs/
└── privacy-checklist.md     # LAUNCH-01 reference checklist for App Store Connect
```

### Pattern 1: Zustand Persisted Boolean (AI Disclosure State)

**What:** Add `aiDisclosureAccepted: boolean` to the existing `useAuthStore` Zustand store. Include it in the `partialize` list so it survives app restarts via AsyncStorage.

**When to use:** Matches the established pattern for `themeMode` (already persisted) and `onboardingCompletedByUser` (already persisted per-user).

**Exact change to `lib/store.ts`:**
```typescript
// In AuthState interface:
aiDisclosureAccepted: boolean;
setAiDisclosureAccepted: (accepted: boolean) => void;

// In create() implementation:
aiDisclosureAccepted: false,
setAiDisclosureAccepted: (aiDisclosureAccepted) => set({ aiDisclosureAccepted }),

// In partialize:
partialize: (state) => ({
  onboardingCompletedByUser: state.onboardingCompletedByUser,
  themeMode: state.themeMode,
  aiDisclosureAccepted: state.aiDisclosureAccepted,  // ADD THIS
})
```

### Pattern 2: AI Disclosure Modal (First-Use Gate)

**What:** A modal component that renders over the AI feature screen when `aiDisclosureAccepted === false`. Calls `setAiDisclosureAccepted(true)` on acknowledgement and dismisses.

**When to use:** Placed at the top of each AI entry screen component: `app/(tabs)/bot/index.tsx`, `app/tools/ai-insights.tsx`, `app/tools/ai-search.tsx`, `app/tools/smart-reminders.tsx`. Also checked inside `components/AiInsightCard.tsx` before rendering AI content.

**Pattern:**
```typescript
// components/AiDisclosureModal.tsx
// Source: established ConfirmDialog pattern in this codebase
import { Portal, Modal, Surface, Text, Button } from 'react-native-paper';
import { useAuthStore } from '@/lib/store';
import { useTheme } from '@/lib/theme-context';

export function AiDisclosureModal() {
  const { aiDisclosureAccepted, setAiDisclosureAccepted } = useAuthStore();
  const { colors } = useTheme();

  if (aiDisclosureAccepted) return null;

  return (
    <Portal>
      <Modal visible={true} dismissable={false} contentContainerStyle={{ margin: 24 }}>
        <Surface style={{ borderRadius: 16, padding: 24, gap: 16, backgroundColor: colors.surface }}>
          <Text variant="titleLarge" style={{ fontWeight: '700', color: colors.textPrimary }}>
            AI Features Use Your Data
          </Text>
          <Text variant="bodyMedium" style={{ color: colors.textSecondary, lineHeight: 22 }}>
            When you use Dwella's AI assistant or AI tools, your property names, tenant names,
            and payment information are sent to Anthropic's Claude API to generate responses.
            {'\n\n'}
            This data is processed by Anthropic to provide the AI features. It is not used
            for advertising or sold to third parties.
          </Text>
          <Button
            mode="contained"
            onPress={() => setAiDisclosureAccepted(true)}
            buttonColor={colors.primary}
          >
            I Understand
          </Button>
        </Surface>
      </Modal>
    </Portal>
  );
}
```

**Integration in each AI screen:**
```typescript
// Add at the top of BotScreen, ai-insights, ai-search, smart-reminders render:
return (
  <View style={[styles.flex, { backgroundColor: colors.background }]}>
    <AiDisclosureModal />
    {/* ... rest of screen */}
  </View>
);
```

### Pattern 3: Fingerprint Runtime Version Policy

**What:** Replace the current `"appVersion"` policy in `app.json` with `"fingerprint"`. The `@expo/fingerprint` package (bundled) computes a content hash of all native dependencies. EAS Update rejects an OTA push if the update's fingerprint does not match the running build's fingerprint — protecting users from receiving JS that calls missing native code.

**Exact change to `app.json`:**
```json
{
  "expo": {
    "runtimeVersion": {
      "policy": "fingerprint"
    }
  }
}
```

No changes needed in `eas.json` — the policy is read from `app.json` during both build and update.

**Key implication:** After changing to fingerprint, the first EAS production build will generate a new fingerprint hash. Any prior OTA update channels set to `appVersion` will not deliver to builds using fingerprint. This is a one-way migration — coordinate it with the first public store submission (which is this phase, since no public builds exist yet).

### Pattern 4: Forced Update Screen (OTA Incompatibility Gate)

**What:** A component rendered near the app root that shows a blocking "Update Required" screen when expo-updates detects that a pending update exists with an incompatible runtime version, OR when the user's current build is outdated and the server has deployed a fingerprint-incompatible update.

**Practical trigger:** The `useUpdates()` hook's `isUpdatePending` field becomes `true` after `Updates.fetchUpdateAsync()` completes. Incompatible updates (wrong fingerprint) are rejected by the native update engine and never reach `isUpdatePending`. The forced-update screen should therefore be triggered differently: check on app launch whether `Updates.checkForUpdateAsync()` throws an error indicating no compatible update exists, or track it via a channel-level check.

**Simpler implementation approach (sufficient for this app):** Use `Updates.useUpdates()` to show an in-app "new version available" prompt that directs users to the App Store/Play Store. This handles the case where a user is on a build whose fingerprint has been superseded and OTA updates can no longer be delivered.

```typescript
// components/UpdateGate.tsx
// Source: expo-updates useUpdates() API + UpdatesAPIDemo pattern
import { useEffect } from 'react';
import { View, StyleSheet, Linking } from 'react-native';
import * as Updates from 'expo-updates';
import { Text, Button, Surface } from 'react-native-paper';
import { useTheme } from '@/lib/theme-context';
import Constants from 'expo-constants';

export function UpdateGate({ children }: { children: React.ReactNode }) {
  const { isUpdateAvailable, isUpdatePending } = Updates.useUpdates();
  const { colors } = useTheme();

  useEffect(() => {
    if (isUpdateAvailable) {
      Updates.fetchUpdateAsync().catch(() => {
        // Update fetch failed — runtime mismatch, store update required
      });
    }
  }, [isUpdateAvailable]);

  useEffect(() => {
    if (isUpdatePending) {
      Updates.reloadAsync();
    }
  }, [isUpdatePending]);

  // Only show blocking screen if update is available but cannot be fetched
  // (incompatible runtime). In practice, implement via a custom flag/state.
  return <>{children}</>;
}
```

**Note:** The forced-update "go to App Store" screen is shown when expo-updates cannot deliver an OTA fix (fingerprint mismatch). In that scenario, `isUpdateAvailable` may be `false` (no compatible OTA exists) but a new native build has been submitted to the store. Implement this via a server-side minimum version check (e.g., a Supabase row with `minimum_build_number`) combined with `Constants.expoConfig?.version` comparison, OR accept that expo-updates' fingerprint rejection will simply keep users on their current working build until they update through the store.

**Practical decision for this phase:** Implement a lightweight forced-update screen that is shown when `isUpdateAvailable === true` but `Updates.fetchUpdateAsync()` fails due to runtime mismatch. This covers the OTA crash scenario. The store-update redirect uses `expo-linking` to open the App Store / Play Store URL.

### Pattern 5: EAS Config Validation (No dry-run flag)

**What:** The CONTEXT.md specifies `eas build --platform all --profile production --non-interactive --dry-run`. This flag does not exist on `eas build`. The correct validation commands are:

```bash
# Print resolved app.json + eas.json config for the production profile
eas config --platform all --profile production

# Inspect what would be archived for a build (does not run native build)
eas build:inspect --stage archive --platform ios --profile production
eas build:inspect --stage archive --platform android --profile production

# Lint store metadata config
eas metadata:lint
```

The planner should use `eas config` as the validation step, not `--dry-run`.

### Anti-Patterns to Avoid

- **Blocking modal with `dismissable={true}`:** The AI disclosure must not be dismissable by tapping the backdrop — users must tap "I understand". Set `dismissable={false}` on the Modal.
- **Checking `aiDisclosureAccepted` inside `useEffect`:** The gate check is synchronous — read from Zustand state in the render path, not in an effect. Effects have a one-frame delay and can allow AI data to be sent before the user has acknowledged.
- **Applying fingerprint policy without a new store submission:** Changing `runtimeVersion.policy` is a native build change. The new fingerprint is computed by EAS at build time. Do not push an OTA update with fingerprint policy — it requires a full `eas build` → store submission.
- **Using `appVersionSource: "remote"` with manual buildNumber in app.json:** The existing `eas.json` already has `appVersionSource: "remote"` and `autoIncrement: true` in the production profile. Do not add `buildNumber` to `app.json` — EAS manages it remotely.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Native dependency hash | Custom hash of package.json | `fingerprint` policy via `@expo/fingerprint` | Fingerprint accounts for ALL native dep changes including transitive deps, SDK version, config plugin outputs — package.json version alone misses many changes |
| OTA update state | Custom polling loop | `Updates.useUpdates()` hook | Expo's native state machine tracks update lifecycle correctly; custom polling races with the native layer |
| Modal persistence | localStorage / MMKV | Zustand `partialize` + AsyncStorage | Already used for `themeMode` — zero added dependency, consistent with existing patterns |

---

## Common Pitfalls

### Pitfall 1: `--dry-run` Flag Does Not Exist on `eas build`

**What goes wrong:** The plan task uses `eas build --dry-run`, EAS CLI throws `Unknown flag: --dry-run`, task fails.

**Why it happens:** `--dry-run` exists on `eas deploy` / `eas worker:deploy`, not on `eas build`. CONTEXT.md was written with this incorrect command.

**How to avoid:** Use `eas config --platform all --profile production` for config review, and `eas build:inspect --stage archive` for a full archive-level inspection without running a native build. Document this in the plan task explicitly.

**Warning signs:** `error: Unknown flag: --dry-run` in CI or local terminal.

### Pitfall 2: Fingerprint Policy Migration Invalidates Existing OTA Channels

**What goes wrong:** After switching to fingerprint, `eas update` pushes are deployed but users on prior `appVersion`-policy builds never receive them because fingerprints don't match.

**Why it happens:** `appVersion` and `fingerprint` produce different `runtimeVersion` strings. A build made with `appVersion` policy and a build made with `fingerprint` policy have incompatible runtime version strings — EAS Update treats them as different runtimes.

**How to avoid:** Since this is the first public store submission (no production builds exist with `appVersion` policy), there are no live users on the old policy. The migration is safe — any prior TestFlight builds are internal only. Document this as the safe migration window.

**Warning signs:** Would only matter if transitioning an app with existing public users — not applicable here.

### Pitfall 3: AI Disclosure Modal Blocks Non-AI Users

**What goes wrong:** The modal is placed in a shared layout (`_layout.tsx`) and shown to all users, even those who never use AI features.

**Why it happens:** Developer puts disclosure check at app root instead of at the AI feature entry points.

**How to avoid:** The modal must only render inside AI feature screens: `app/(tabs)/bot/index.tsx`, `app/tools/ai-insights.tsx`, `app/tools/ai-search.tsx`, `app/tools/smart-reminders.tsx`. The CONTEXT.md decision is explicit: "Only shown once, then remembered — non-AI users never see it."

**Warning signs:** The disclosure modal appears on the Properties tab or dashboard.

### Pitfall 4: `partialize` Omission Drops `aiDisclosureAccepted`

**What goes wrong:** `aiDisclosureAccepted: true` is lost on app restart because it wasn't added to `partialize`.

**Why it happens:** The current `partialize` function in `lib/store.ts` explicitly lists fields to persist: `{ onboardingCompletedByUser, themeMode }`. New fields are NOT automatically persisted — they must be explicitly included.

**How to avoid:** Add `aiDisclosureAccepted: state.aiDisclosureAccepted` to the `partialize` return object.

**Warning signs:** User must re-accept disclosure on every cold launch.

### Pitfall 5: `useUpdates()` Crashes in Development / Expo Go

**What goes wrong:** `Updates.useUpdates()` throws or behaves unexpectedly when running with Expo Go or in development client because `updates.enabled` is `false`.

**Why it happens:** expo-updates is disabled in development to allow hot reload. The `useUpdates()` hook returns `{ isUpdateAvailable: false, isUpdatePending: false }` in dev — but some APIs throw.

**How to avoid:** Wrap all `Updates.*` calls in a check: `if (!Updates.isEnabled) return`. The `Updates.isEnabled` boolean is `false` in development. The `UpdateGate` component should no-op when `!Updates.isEnabled`.

**Warning signs:** Red screen error mentioning `expo-updates not enabled` during development.

---

## Code Examples

Verified patterns from official sources and existing codebase:

### Fingerprint runtimeVersion Policy (app.json)
```json
// Source: https://docs.expo.dev/versions/latest/sdk/updates/
{
  "expo": {
    "runtimeVersion": {
      "policy": "fingerprint"
    },
    "updates": {
      "url": "https://u.expo.dev/3bc7de51-47e7-4c4e-92e3-e6e1a40ae71b"
    }
  }
}
```

### useUpdates() Hook Pattern (expo-updates)
```typescript
// Source: https://docs.expo.dev/versions/latest/sdk/updates/
import * as Updates from 'expo-updates';

function UpdateGate({ children }: { children: React.ReactNode }) {
  const { isUpdateAvailable, isUpdatePending } = Updates.useUpdates();

  // Guard: no-op in dev/Expo Go
  if (!Updates.isEnabled) return <>{children}</>;

  // ... update logic
}
```

### Zustand Partialize Addition (lib/store.ts)
```typescript
// Source: existing pattern in lib/store.ts
partialize: (state) => ({
  onboardingCompletedByUser: state.onboardingCompletedByUser,
  themeMode: state.themeMode,
  aiDisclosureAccepted: state.aiDisclosureAccepted,  // new
})
```

### EAS Config Validation (no dry-run)
```bash
# Source: https://docs.expo.dev/eas/cli/
eas config --platform all --profile production
eas build:inspect --stage archive --platform ios --profile production
eas build:inspect --stage archive --platform android --profile production
```

---

## App Store Connect Privacy Checklist (LAUNCH-01)

This is the reference used to fill out the App Store Connect privacy form manually. Data types follow Apple's official category taxonomy.

| Third-Party Service | Data Collected | Apple Category | Linked to Identity | Purpose |
|---------------------|---------------|---------------|-------------------|---------|
| **Supabase** | Email address, user ID | Contact Info, Identifiers | Yes — account | App Functionality |
| **Supabase** | Property names, addresses, tenant names, payment amounts | User Content, Financial Info | Yes — account | App Functionality |
| **Claude API (Anthropic)** | Property names, tenant names, payment info (sent in AI prompts) | User Content | Yes — account | App Functionality |
| **PostHog** | User ID, analytics events, feature usage | Identifiers, Usage Data | Yes — via `posthog.identify()` | Analytics |
| **Sentry** | Crash reports, stack traces | Diagnostics | No — anonymous | App Functionality |
| **Expo Push Notifications** | Push token, device identifier | Identifiers | Yes — linked to user account | App Functionality |
| **Telegram Bot API** | Chat messages relayed by user action | User Content | Yes — user-initiated | App Functionality |
| **WhatsApp Business API** | Chat messages relayed by user action | User Content | Yes — user-initiated | App Functionality |

**Tracking declaration:** No cross-app or cross-website tracking. No ATT prompt needed. PostHog `identify()` is first-party only — data stays within Dwella's own analytics, not shared with data brokers.

**Data not collected:** Location, health, financial card numbers, browsing history, contacts/address book.

---

## Apple Guideline 5.1.2(i) AI Disclosure Requirements

**Guideline text (November 2025):** Apps must clearly disclose where personal data will be shared with third parties, including with third-party AI, and obtain explicit permission before doing so.

**Compliance requirements confirmed:**
1. Disclosure must identify the AI provider **by name** (Anthropic's Claude API — not generic "AI service")
2. Disclosure must explain **what data is sent** (property names, tenant names, payment info)
3. Disclosure must appear **before the first data transmission** to the AI
4. Consent mechanism must be **in-app** (OS-level permission dialog is not required)
5. Users must be able to use the app for non-AI features without consenting

**The locked decision (acknowledge-only, no opt-out toggle) is compliant** because: the guideline requires explicit permission before data transmission, and the "I Understand" button constitutes explicit permission. The requirement for users to "decline without losing core functionality" is satisfied because the modal only blocks AI features — property management, payments, and invite flows work without any AI data sharing.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `"policy": "appVersion"` (current app.json) | `"policy": "fingerprint"` | SDK 51 stable, SDK 52 auto-computed | Fingerprint is content-addressed; appVersion requires manual discipline to prevent OTA crashes |
| `"fingerprintExperimental"` policy name | `"fingerprint"` | SDK 51 rename | Use `"fingerprint"` — the experimental name is deprecated |
| Manual build number in app.json | `appVersionSource: "remote"` + `autoIncrement: true` in eas.json | 2023 EAS CLI | Already configured in this project's eas.json — no change needed |
| `Updates.checkForUpdateAsync()` imperative polling | `Updates.useUpdates()` hook | 2023 (SDK 49+) | Reactive hook is the current standard; imperative API still works but hook is preferred |

**Deprecated/outdated:**
- `"fingerprintExperimental"`: Replaced by `"fingerprint"` since SDK 51 — do not use.
- `--dry-run` on `eas build`: Does not exist — use `eas config` and `eas build:inspect` instead.

---

## Open Questions

1. **Forced-update screen trigger mechanism**
   - What we know: `useUpdates()` hook tracks `isUpdateAvailable` and `isUpdatePending`. When fingerprint mismatches, updates are rejected by the native engine and `isUpdateAvailable` may show no update.
   - What's unclear: The exact user-visible behavior when an OTA update is rejected due to fingerprint mismatch — does the app silently stay on current build or crash?
   - Recommendation: Per Expo docs, when runtimeVersion is incompatible "expo-updates may detect an error and attempt to roll back to the previously working update." No crash — the app runs the embedded bundle. The forced-update screen should be a recommendation/prompt rather than a hard block; implement as "update available" nudge that opens the store URL.

2. **`eas build:inspect` output adequacy for LAUNCH-03**
   - What we know: `eas config` prints the resolved configuration without building. `eas build:inspect` creates an archive.
   - What's unclear: Whether `eas config` catches eas.json schema errors vs only printing resolved values.
   - Recommendation: Run both `eas config` and `eas metadata:lint` as the validation step. Accept that a real EAS build submission is the only fully authoritative validation.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | jest-expo (jest.config.js confirms) |
| Config file | `jest.config.js` at project root |
| Quick run command | `npx jest --testPathPattern="__tests__"` |
| Full suite command | `npx jest` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LAUNCH-01 | Privacy checklist document completeness | manual | Manual review of docs/privacy-checklist.md | ❌ Wave 0 |
| LAUNCH-02 | `aiDisclosureAccepted` persists after app restart | unit | `npx jest --testPathPattern="store"` | ❌ Wave 0 |
| LAUNCH-02 | AiDisclosureModal renders when `aiDisclosureAccepted === false` | unit | `npx jest --testPathPattern="AiDisclosureModal"` | ❌ Wave 0 |
| LAUNCH-02 | AiDisclosureModal does not render when `aiDisclosureAccepted === true` | unit | `npx jest --testPathPattern="AiDisclosureModal"` | ❌ Wave 0 |
| LAUNCH-03 | `app.json` version is `1.0.0`, runtimeVersion policy is `fingerprint` | unit | `npx jest --testPathPattern="config"` | ❌ Wave 0 |
| LAUNCH-04 | UpdateGate no-ops when `Updates.isEnabled === false` | unit | `npx jest --testPathPattern="UpdateGate"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx jest --testPathPattern="store|AiDisclosureModal|UpdateGate|config"`
- **Per wave merge:** `npx jest`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `__tests__/AiDisclosureModal.test.tsx` — covers LAUNCH-02 modal render/dismiss behavior
- [ ] `__tests__/UpdateGate.test.tsx` — covers LAUNCH-04 development no-op guard
- [ ] `__tests__/config.test.ts` — validates app.json runtimeVersion policy value programmatically
- [ ] `__tests__/store.test.ts` (extend existing or create) — covers `aiDisclosureAccepted` partialize persistence

---

## Sources

### Primary (HIGH confidence)
- `https://docs.expo.dev/versions/latest/sdk/updates/` — fingerprint policy config, useUpdates() API, checkAutomatically options, isEnabled guard
- `https://docs.expo.dev/eas-update/runtime-versions/` — policy options, appVersion vs fingerprint behavior, incompatible update rollback behavior
- `https://docs.expo.dev/eas/cli/` — confirmed no `--dry-run` on `eas build`; `eas config`, `eas build:inspect`, `eas metadata:lint` as correct validation commands
- `https://developer.apple.com/app-store/app-privacy-details/` — privacy category taxonomy, linked-to-identity definition, tracking definition
- `lib/store.ts` (project source) — confirmed Zustand persist partialize pattern for aiDisclosureAccepted integration
- `app.json` (project source) — confirmed current `"policy": "appVersion"` needing replacement; EAS projectId confirmed
- `eas.json` (project source) — confirmed `appVersionSource: "remote"` and `autoIncrement: true` in production profile

### Secondary (MEDIUM confidence)
- `https://dev.to/arshtechpro/apples-guideline-512i-the-ai-data-sharing-rule-that-will-impact-every-ios-developer-1b0p` — Apple 5.1.2(i) AI disclosure requirements; disclosure modal as compliant pattern; verified against Apple Developer news announcement
- `https://developer.apple.com/news/?id=ey6d8onl` — Apple's November 2025 App Review Guidelines update announcement
- `https://expo.dev/blog/fingerprint-your-native-runtime` — fingerprint policy behavior, SDK 51 rename from fingerprintExperimental
- `https://expo.dev/changelog/2023-08-08-use-updates-api` — useUpdates() hook release, isUpdatePending/isUpdateAvailable semantics

### Tertiary (LOW confidence)
- `https://medium.com/@julien_34351/youre-certainly-using-the-wrong-runtimeversion-in-expo-ce3466d4d2fe` — fingerprint vs appVersion tradeoffs (community article, not official)
- `https://github.com/expo/expo/issues/41694` — SDK 54 runtimeVersion AAB sync issue (open bug; affects AAB builds, not APK; monitor during Android production build)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and in use; versions confirmed via node_modules inspection
- Architecture: HIGH — Zustand persist pattern directly observable in lib/store.ts; ConfirmDialog pattern directly observable in components/ConfirmDialog.tsx; fingerprint config syntax confirmed from official Expo docs
- Pitfalls: HIGH (dry-run flag) — confirmed directly from EAS CLI docs; HIGH (partialize omission) — directly observable in store.ts; MEDIUM (useUpdates dev crash) — from Expo changelog and community reports
- Apple compliance: MEDIUM — confirmed from Apple Developer announcement and community analysis; exact enforcement date and review team interpretation have natural uncertainty

**Research date:** 2026-03-19
**Valid until:** 2026-04-18 (30 days — EAS config is stable; Apple guidelines stable post-November 2025 update)

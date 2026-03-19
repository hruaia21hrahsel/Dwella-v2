# Phase 5: Launch Configuration & Store Gate - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

The app is ready for App Store and Play Store submission — metadata is correct, AI data sharing is disclosed per Apple November 2025 guidelines, EAS build config is validated, and OTA runtime version policy prevents existing users from crashing after a native dependency update.

Requirements: LAUNCH-01, LAUNCH-02, LAUNCH-03, LAUNCH-04

</domain>

<decisions>
## Implementation Decisions

### AI data disclosure (LAUNCH-02)
- Show disclosure modal when user first navigates to an AI feature (bot chat, AI insights, AI search, AI reminders)
- Only shown once, then remembered — non-AI users never see it
- Acknowledge-only consent: single "I understand" button, no opt-in/opt-out toggle
- Content: disclose that property names, tenant names, and payment info are sent to Anthropic's Claude API for bot responses and AI tools — brief, honest, specific
- Consent state stored in Zustand persisted store (`aiDisclosureAccepted: boolean`) via AsyncStorage — consistent with existing theme/auth persistence pattern

### OTA update policy (LAUNCH-04)
- Switch runtimeVersion from `"appVersion"` to `"fingerprint"` policy — auto-generates hash of native dependencies, prevents OTA crashes when native deps change
- Show forced-update screen when expo-updates detects incompatible runtime version — modal directing users to App Store / Play Store
- This replaces the current `{"policy": "appVersion"}` in app.json

### Version & release identity (LAUNCH-03)
- Version stays at 1.0.0 — first public App Store release (TestFlight internal testing only so far, never publicly launched)
- EAS autoIncrement handles build numbers automatically (`appVersionSource: "remote"` in eas.json)
- Validate EAS production profile with `eas build --platform all --profile production --non-interactive --dry-run`

### Privacy metadata (LAUNCH-01)
- Produce a reference checklist of all third-party data destinations, data types, and purposes — used when filling out App Store Connect privacy form manually
- Third-party services to declare:
  - **Supabase**: User accounts (email, auth), property/tenant/payment data — linked to identity, App Functionality
  - **Claude API (Anthropic)**: Property names, tenant names, payment info sent for AI processing — linked to identity, App Functionality
  - **PostHog**: Analytics events with user identity (`posthog.identify()`) — linked to identity, Analytics. First-party analytics only, no cross-app tracking
  - **Sentry**: Crash reports — not linked to identity, App Functionality
  - **Expo Push Notifications**: Push tokens — linked to identity, App Functionality
  - **Telegram Bot API**: Chat messages relayed — user-initiated, App Functionality
  - **WhatsApp Business API**: Chat messages relayed — user-initiated, App Functionality
- No cross-app/cross-website tracking — no ATT prompt needed
- Data linkage: Supabase and Claude API linked to user identity; PostHog linked via identify(); Sentry anonymous

### Claude's Discretion
- Exact wording and visual design of the AI disclosure modal
- Order of AI feature screens that trigger the disclosure check
- Exact content of the forced-update screen
- How to structure the privacy checklist document (markdown table vs bullet list)
- Whether to add PrivacyInfo.xcprivacy for Required Reason APIs (bonus, not required)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### App configuration
- `app.json` — Current Expo config: version, runtimeVersion, plugins, EAS projectId
- `eas.json` — EAS build profiles: development, preview, production (autoIncrement, env vars)

### AI features (disclosure trigger points)
- `app/(tabs)/bot/index.tsx` — Bot chat screen (AI disclosure trigger)
- `app/tools/` — AI tools screens: insights, search, reminders (AI disclosure triggers)
- `components/AiInsightCard.tsx` — Dashboard AI insight card (AI disclosure trigger)

### State management
- `lib/store.ts` — Zustand store with persist middleware (add `aiDisclosureAccepted` here)

### Analytics & monitoring
- `lib/posthog.ts` — PostHog config (first-party analytics, identify() linked)
- `lib/analytics.ts` — Analytics hook with PostHog capture
- `lib/sentry.ts` — Sentry crash monitoring (anonymous, crash-only)

### Prior phase context
- `.planning/phases/04-client-code-ux/04-CONTEXT.md` — Client hardening decisions (env validation, auth errors)
- `.planning/phases/01-compilation-tooling-baseline/01-CONTEXT.md` — Sentry integration decisions

### Requirements
- `.planning/REQUIREMENTS.md` — LAUNCH-01, LAUNCH-02, LAUNCH-03, LAUNCH-04 acceptance criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/store.ts` (Zustand + persist): Add `aiDisclosureAccepted` boolean alongside existing `themeMode` — same persistence pattern
- `components/ConfirmDialog.tsx`: Existing modal dialog component — could be adapted or used as reference for AI disclosure modal
- `lib/toast.ts` + `components/ToastProvider.tsx`: Toast system for non-blocking messages (not for disclosure, but available)

### Established Patterns
- Zustand persisted state: `themeMode`, auth state — `aiDisclosureAccepted` follows same pattern
- Expo Router file-based routing: AI screens are under `app/(tabs)/bot/` and `app/tools/`
- React Native Paper modals: used throughout the app for confirmations

### Integration Points
- AI disclosure check wraps navigation to: bot chat, AI insights, AI search, AI reminders, AiInsightCard
- `app.json` runtimeVersion change affects all OTA update behavior
- `eas.json` production profile is the build config target for dry-run validation

</code_context>

<specifics>
## Specific Ideas

- User has done TestFlight internal testing only — this is the first public store submission
- PostHog tracking classification: confirmed no cross-app tracking via code inspection — `posthog.identify()` links to user but stays first-party
- EAS `appVersionSource: "remote"` means build numbers are managed by EAS servers — no manual buildNumber in app.json needed

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 05-launch-configuration-store-gate*
*Context gathered: 2026-03-19*

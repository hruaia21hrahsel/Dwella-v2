# Codebase Concerns

**Analysis Date:** 2026-04-05
**Scope:** Pre-v1-launch legal/compliance audit for Dwella v2 (React Native + Expo + Supabase)
**Tone:** Blunt. This feeds a legal audit — downplaying risks is counterproductive.

---

## 1. Known Bugs / Crash History

The `.planning/debug/` folder contains evidence of a sustained, still-not-fully-resolved TestFlight crash campaign. Summary:

### 1.1 Build 36 — iOS 26 Hermes PAC crash (UNRESOLVED, upstream-blocked)
- **File:** `.planning/debug/testflight_crash_build36/SESSION.md`
- **Symptom:** `SIGSEGV EXC_BAD_ACCESS KERN_INVALID_ADDRESS` ~0.3s after launch on iPhone 17,3 / iOS 26.3 / arm64e, 100% reproduction.
- **Crash site:** Hermes VM internal `DictPropertyMap::findOrAdd → HiddenClass::initializeMissingPropertyMap → HiddenClass::findProperty` (Thread 7 JS thread).
- **Root cause (per audit):** iOS 26 ARM64 Pointer Authentication Code (PAC) enforcement rejects raw pointer arithmetic Hermes performs in property-map management. Tracked upstream as `expo/expo#44356` and `facebook/hermes#1966`. No code-level fix possible.
- **Status:** Session marked `status: fixing`. "Resolution" section says fix requires Expo SDK 56 (Q2 2026). **As of 2026-04-05, `package.json` still pins `expo: ~54.0.0`** — i.e., this crash will still affect any iOS 26 physical device on launch day if not addressed.
- **Legal implication:** App Review uses recent-model iPhones running current iOS. If Apple reviews on iOS 26, the app will crash on launch and be rejected. This is a hard ship-blocker for App Store submission, not just a UX concern.

### 1.2 Multiple TestFlight crash folders (test-user feedback)
`.planning/debug/` contains EIGHT distinct crash sessions plus three "feedback" folders, all from the same test device (iPhone17,3 / iOS 26.3 / tester `hruaia21hrahsel@gmail.com`, based on feedback JSON):

| Folder | Build | Status |
|---|---|---|
| `testflight_crash/` | — | crash dump + feedback |
| `testflight_crash4/` through `testflight_crash8/` | up to build 32 | crash dumps + feedback |
| `testflight_crash_build36/` | 36 | the SDK 55/PAC investigation |
| `testflight_crash_testflight_feedback_(1..3)/` | 27 | all from same tester saying "Bsh" / "Again" |
| `testflight-crash-on-launch.md` | earlier | PostHog undefined crash (resolved 2026-03-24, files: `app/_layout.tsx`, `lib/analytics.ts`) |

The cadence (8+ crash sessions in roughly two weeks) implies the app is not yet stable in the hands of a single test user. **PostHog and `lib/analytics.ts` referenced in the resolved doc no longer exist in the tree** — they were stripped during the Sentry/PostHog removal noted in memory, meaning the diagnostics for those crashes are now lost and cannot be cross-verified.

### 1.3 Post-login-broken (RESOLVED)
- **File:** `.planning/debug/post-login-broken/SESSION.md`
- **Symptom:** After Google OAuth on first launch: no data loads, sign-out unresponsive, log-payment button dead. Works after force-quit + relaunch.
- **Root cause:** Double-navigation race in `components/SocialAuthButtons.tsx` vs `AuthGuard` in `app/_layout.tsx`. Both called `router.replace()` — the second call corrupted expo-router's navigation state.
- **Fix:** Commit `90a53b8` — removed navigation from `SocialAuthButtons.tsx`; `AuthGuard` is now sole router.
- **Status:** Verified fixed.

### 1.4 Splash-screen-stuck (RESOLVED)
- **File:** `.planning/debug/resolved/splash-screen-stuck/SESSION.md`
- **Symptom:** App stuck forever on in-app teal splash with "The AI that runs your rentals." tagline.
- **Root cause:** `AuthGuard`'s `onAuthStateChange` handler had no `try/finally` around `setLoading(false)`, and `app/index.tsx` blindly trusted `isLoading` with no escape hatch. A throw mid-handler left the store permanently stuck.
- **Fix:** Defense-in-depth — `try/finally` in AuthGuard + 4s force-unlock in `app/index.tsx`.
- **Status:** User-verified on device 2026-04-05.

### 1.5 Pattern — auth/loading state is persistently fragile
The post-login and splash-stuck sessions together show **six consecutive auth-related fixes** landed in 24 hours (`6cd7303, 1c53091, 6b6a357, 58e826f, 675cb23, 90a53b8`). Each fix created a new symptom. The auth flow is stable for now but has been rewritten enough times that regression risk is high. Expect more TestFlight reports against `app/_layout.tsx` AuthGuard under unusual network/oauth conditions.

---

## 2. Pre-Launch Checklist Gaps

Memory (`MEMORY.md`) lists four pre-launch blockers. Verified against current tree:

### 2.1 `[APP_ID]` placeholder in `components/UpdateGate.tsx` — **STALE** (file deleted)
- `components/UpdateGate.tsx` **no longer exists**. `expo-updates` is not in `package.json` dependencies. This concern is obsolete.
- **New concern introduced by this removal:** The app has no in-app update gate anymore. Users on old builds cannot be force-updated. Any future critical fix (e.g., the iOS 26 Hermes crash) requires them to manually update from the App Store. For a pre-v1 product with a live crash bug on current-iOS hardware, this is a real operational risk.

### 2.2 Placeholder store URLs in `supabase/functions/invite-redirect/index.ts` — **PARTIALLY RESOLVED**
- `supabase/functions/invite-redirect/index.ts:20-21`:
  ```
  const APP_STORE_URL  = 'https://apps.apple.com/app/id6760478576';
  const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.dwella.app';
  ```
- Apple ID `6760478576` is real (matches `appAppleId` in TestFlight feedback JSONs). Play Store URL is the expected `com.dwella.app` package.
- **BUT** the file-top comment at line 17 still reads `TODO before launch: replace the placeholder store URLs below with real ones.` — either a stale comment or the Play URL is still a placeholder (Play Store listing may not exist yet). Needs human verification before launch.
- **Hard-coded in source**, not env-driven. Per memory note these were supposed to move to `APPLE_APP_STORE_URL` / `GOOGLE_PLAY_STORE_URL` env vars. They did not.

### 2.3 Sentry DSN not configured — **STILL TRUE, and worse: Sentry removed entirely**
- Per memory (`project_sentry_upgrade.md`): Sentry native plugin was removed because it was crashing. It has not been re-enabled.
- Current `package.json` has **no `@sentry/*` dependency at all** and no `EXPO_PUBLIC_SENTRY_DSN` referenced anywhere.
- **Impact:** The app ships to production with **no crash reporting, no error aggregation, and no telemetry**. The only visibility into production failures is TestFlight's built-in crash dumps (which has produced 8+ sessions already) and user-initiated feedback. PostHog was also removed. **Zero observability in production** is a compliance and operational risk: if a privacy incident or data-leak bug occurred post-launch, there is no audit trail.

### 2.4 pg_cron schedule verification — **UNVERIFIED**
- Edge functions `auto-confirm-payments`, `mark-overdue`, `send-reminders` exist in `supabase/functions/`.
- No migration in `supabase/migrations/` schedules them with `pg_cron`. No record in the tree that the schedules have been registered in the Supabase dashboard.
- **Impact:** Payment state machine transitions (`paid → confirmed` after 48h, `pending → overdue` at midnight) may not fire in production. This affects user-facing financial state and any privacy-policy or terms-of-service claim about "automatic" payment confirmation.

---

## 3. Security Concerns

### 3.1 `verify_jwt = false` on THREE public edge functions
- `supabase/config.toml:382-401` disables JWT verification on:
  - `telegram-webhook` (line 385)
  - `process-bot-message` (line 390)
  - `invite-redirect` (line 401 — also redundantly set in `supabase/functions/invite-redirect/config.toml:1`)
- Justification in the config.toml comment: the recent Supabase `sb_publishable/sb_secret` key rollout broke auto-injection of `SUPABASE_SERVICE_ROLE_KEY` into edge function headers, so JWT verification fails. A shared secret `BOT_INTERNAL_SECRET` is used instead.
- **Risks:**
  - `telegram-webhook` is publicly reachable. It has **no HMAC verification of the Telegram `X-Telegram-Bot-Api-Secret-Token` header** anywhere in `supabase/functions/telegram-webhook/index.ts`. Anyone who knows the function URL can POST crafted Telegram update payloads and drive the bot as any linked user. Telegram does support a secret-token mechanism for webhooks; it is not used.
  - `process-bot-message` is gated by `BOT_INTERNAL_SECRET` (`supabase/functions/process-bot-message/index.ts:998-1002`). This is fine **if and only if** `BOT_INTERNAL_SECRET` is set in the Supabase env AND is high-entropy. No guarantee of either in source.
  - `invite-redirect` is pure HTML and echoes the `token` query param into the rendered page via template interpolation (`supabase/functions/invite-redirect/index.ts:187, 193`). The token is escaped only by virtue of being inside a `<code>` element and a JS string literal. **A token containing `</script>` or `"; alert(1); //` would inject into the page.** This is a stored-reflected XSS sink. Tokens are server-generated UUIDs today, but there is no validation in this function that `token` is a UUID before interpolation. Fix: regex-validate the token before rendering.

### 3.2 `SUPABASE_SERVICE_ROLE_KEY` used in edge functions
- Used in: `ai-draft-reminders`, `ai-insights`, `ai-search`, `auto-confirm-payments`, `mark-overdue`, `process-bot-message`, `send-reminders`, `telegram-webhook` (8 functions).
- This key bypasses RLS entirely. Any bug in any of these functions that lets user input influence a query parameter = full cross-tenant data leak.
- `process-bot-message` passes `tenant_name` from Claude-parsed user input directly into Supabase queries (`supabase/functions/process-bot-message/index.ts:132` — `.ilike('tenant_name', \`%${tenantName}%\`)`). Because the client is created with the service role, this ilike **matches across all landlords, not just the calling user's tenants**. The subsequent `findTenantByName` does scope by ownership later, but the initial fuzzy search broadens the attack surface if the scoping logic is ever bypassed. Worth a defensive code review.

### 3.3 Secrets in source tree / git history
- `.env` is gitignored (`.gitignore` line 13). Not in the working tree.
- `git log --all --full-history -- .env` returns empty — `.env` has never been committed. Good.
- Only `.env.example` is tracked.
- No hard-coded API keys found in application source. All keys (`ANTHROPIC_API_KEY`, `TELEGRAM_BOT_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, `BOT_INTERNAL_SECRET`) are read from `Deno.env.get()` at function startup.
- **Risk surface that remains:** these secrets live in the Supabase edge-function environment. Compromise of the Supabase project = total compromise (Claude API billing, Telegram bot hijack, full DB read/write). Standard risk, but should be noted for the legal audit.

### 3.4 RLS coverage — mostly good, one recent bug
- `supabase/migrations/001_initial_schema.sql:155-218` enables RLS on all public tables and defines sane per-role policies.
- Notable: `properties_tenant_read` (line 170) was broken and had to be fixed on 2026-04-05 in commit `450a49c` (`028_fix_properties_tenant_read_policy.sql`). This suggests RLS policies are not systematically tested.
- **Gap:** no RLS test suite in the repo. The only way a regression in an RLS policy would surface is via a user report.
- `bot_conversations` is RLS-scoped to `auth.uid() = user_id`, so the chat transcript (which contains the user's unfiltered natural-language queries about their tenants) is scoped correctly. But because `process-bot-message` uses the service role, it can read any user's conversation history regardless of RLS.

### 3.5 Storage bucket policies
- `supabase/migrations/002_storage.sql` defines RLS on the `payment-proofs` bucket using path-based scoping `{property_id}/{tenant_id}/{year-month}.jpg`.
- The split_part-based path parsing is fragile. If a tenant ever uploads with a non-standard path (e.g., leading slash, double slash, uppercase UUID, extra segment) the ownership check fails-open or fails-closed unpredictably.
- `landlord_read_proof` allows the landlord to read all proofs for their property — fine.
- **Missing:** no UPDATE policy on this bucket. Uploads with `upsert: true` from the client would fail unless migration `006_storage_update_policy.sql` or `007_fix_storage_policies.sql` adds one. Needs audit.
- `avatars` bucket (migration `014_avatars_storage.sql`) and `receipts` bucket (migration `027_receipts_storage.sql`) should be similarly audited — not read in this pass.

---

## 4. Privacy / Compliance Concerns

This is the heaviest section for the legal audit. Dwella handles PII about people who are not the user (tenants), some of whom have never opened the app and have never consented to anything. Under GDPR (if any user is in the EU), CCPA (if any user is in California), and India's DPDP Act 2023 (primary jurisdiction based on locale `en-IN` and `Asia/Kolkata` in feedback JSONs), this creates obligations the app does not currently meet.

### 4.1 PII inventory (what is stored)
From `supabase/migrations/001_initial_schema.sql` and subsequent migrations:

**Users table (`public.users`):**
- `email` (from auth provider — Google OAuth, Apple, email/password)
- `full_name`
- `phone`
- `avatar_url` (points to `avatars` Supabase Storage bucket, migration 014)
- Telegram link metadata (migration `011_bot_metadata.sql`)
- Push tokens (migration `010_push_tokens.sql`)

**Tenants table (`public.tenants`):**
- `tenant_name` — often of a real person who has never used the app
- `flat_no`, `monthly_rent`, `security_deposit`, `lease_start`, `lease_end`
- `invite_token` — UUID, becomes part of a deep link sent via out-of-band channel
- `user_id` — nullable, linked only after invite acceptance

**Properties table (`public.properties`):**
- `name`, `address`, `city` — precise rental addresses of real properties

**Payments table (`public.payments`):**
- `amount_due`, `amount_paid`, `status`, `due_date`, `paid_at`
- `proof_url` — **photo of a payment receipt uploaded by a tenant**, stored in `payment-proofs` bucket. Images can contain bank account numbers, UPI IDs, partial card numbers, handwritten notes, faces, and anything else a user photographs.
- `notes` — free-form text

**Bot conversations table (`public.bot_conversations`):**
- `role, content` — **full natural-language chat history** with Claude, including every question a landlord asks about a tenant.

**Tenant photo notes (migration `012_tenant_photo_notes.sql`):** free-form photos attached to tenants. Could include anything.

**Expenses (migration `004_expenses.sql`):** not inspected in this pass but likely adds more financial PII.

### 4.2 Third-party data sharing

**Anthropic (Claude API) — US-based processor:**
- `supabase/functions/process-bot-message/index.ts:784-834` builds a context string per message containing: every property name + full address + city, every active tenant's name, flat number, monthly rent, due day, plus the current month's payment status/amount for every tenant. This is sent on **every** bot message as the system prompt context.
- The last 10 messages of chat history also go to Claude (`getHistory`, line 852).
- Model: `claude-sonnet-4-20250514`. Destination: `https://api.anthropic.com/v1/messages`.
- **Compliance implications:**
  - Tenants have not consented to their names, rent amounts, and addresses being transmitted to Anthropic. Under DPDP Act 2023 § 6 ("consent-based processing") and GDPR Art. 6(1), the landlord cannot lawfully delegate this consent.
  - No Data Processing Agreement (DPA) with Anthropic is referenced anywhere in the repo.
  - Anthropic's default retention policy (30 days for abuse monitoring) means tenant data sits on US servers outside the landlord's or tenant's control.
  - Cross-border data transfer: India → US. DPDP § 16 requires notified countries; pending notification, transfers are in a gray zone.

**Telegram (Telegram LLC — Dubai/UAE, servers global):**
- `supabase/functions/telegram-webhook/index.ts` forwards every bot message via `https://api.telegram.org/bot{TOKEN}/sendMessage`.
- Telegram sees: the user's Telegram username/ID, the user's messages (which may quote tenant names and financial details), bot responses (which always contain tenant names and amounts).
- Bot linking is opt-in per user (via `lib/bot.ts` `generateTelegramLinkToken`), **but the tenants whose data is discussed have not opted in to having their data routed through Telegram.**

**Supabase (database + storage + edge functions):**
- Region not declared in repo. Default Supabase region for Indian users is typically `ap-south-1` (Mumbai) but this needs to be confirmed in the Supabase dashboard and disclosed in the privacy policy.
- Supabase itself is a US company (Supabase Inc., Delaware). Even with an Indian region, the control plane is US-subject.

**Google / Apple (OAuth providers):**
- `lib/social-auth.ts` + `expo-apple-authentication` plugin. Standard OAuth flows. Users receive Google's/Apple's own consent screens — lowest compliance risk of the four third parties.

### 4.3 Data retention — "soft-delete" is a misnomer
- `lib/payments.ts` and the entire archiving mechanism set `is_archived = TRUE` rather than deleting rows. Per `CLAUDE.md`:
  > Properties and tenants are never hard-deleted. [...] Payment rows use `ON DELETE RESTRICT` — they are permanent.
- **Compliance impact:**
  - Under GDPR Art. 17 ("right to erasure") and DPDP § 12 ("right to erasure"), a data subject can demand deletion. Dwella currently has **no mechanism to honor this request**. The soft-delete pattern is a retention strategy, not a deletion strategy.
  - Tenants who never signed up (only got an invite link) are data subjects. They have rights over their `tenants` row and any `payments` rows referencing them. The app has no way to find, export, or erase data for such a person.
  - `ON DELETE RESTRICT` on `payments.tenant_id` and `payments.property_id` means even the cascade path is blocked — deletion would fail at the DB level.
  - Payment proof images in Supabase Storage have no retention policy or TTL.
  - `bot_conversations` grows unboundedly; every chat message is kept forever.

### 4.4 Account deletion — **NOT IMPLEMENTED**
- Apple App Store Guideline 5.1.1(v) (effective June 30, 2022) **requires in-app account deletion** for any app that supports account creation.
- `app/(tabs)/profile/index.tsx` (559 lines) was grepped for `delete`, `privacy`, `terms`, `legal`, `gdpr`, `export`. The only `delete` matches are for profile-photo deletion (`deletePhoto`, line 64, 130). **There is no "Delete Account" flow, no data-export flow, no privacy-policy link, and no terms-of-service link in the profile screen.**
- The `auth.users → public.users` cascade (`ON DELETE CASCADE` on `users.id`) means deleting the auth row would cascade to properties, tenants (via `owner_id`), notifications, and bot_conversations. But `payments.tenant_id ON DELETE RESTRICT` would block the cascade and raise an FK violation, leaving users unable to delete.
- **This is a hard App Store rejection reason.** Any iOS submission without an in-app account-deletion flow that actually completes will be rejected.

### 4.5 Privacy policy & data safety declarations — **MISSING**
- No `PRIVACY.md`, `TERMS.md`, or equivalent in the repo root.
- `app.json` has no `privacyPolicyUrl` or equivalent metadata.
- No profile-screen link to a hosted privacy policy.
- **App Store Connect** requires a Privacy Policy URL before submission — must be live before first build can be reviewed.
- **Apple Privacy Nutrition Label / Play Data Safety form** requires disclosure of every category of collected data. Based on this audit the disclosure should cover at minimum: Contact Info (email, phone, name), Financial Info (payment history, receipts), User Content (photos/proofs, chat), Identifiers (user ID, device ID, push token, Telegram ID), Usage Data (app interactions — though PostHog is now removed), Diagnostics (none — Sentry removed). None of this has been drafted.
- **DPDP Act 2023 § 5** requires a notice in the user's language explaining purpose, data types, and rights. No such notice is shown at signup.

### 4.6 Consent flows — **MISSING**
- `app/(auth)/signup.tsx` likely does not show any "I agree to the Privacy Policy and Terms" checkbox or equivalent (not read in this pass, but grep found no terms/privacy references in `app/(auth)/`).
- OAuth signup (Google/Apple) skips the app's own consent capture entirely.
- No age-gate. If any user is under 13 (COPPA) or under 16 (GDPR child threshold), the app is non-compliant. Rental management is adult-oriented but there is no verification.
- No granular consent for marketing vs. functional use (GDPR Art. 7, DPDP § 6).

### 4.7 Data export — **NOT IMPLEMENTED**
- GDPR Art. 20 and DPDP § 11 grant a right to data portability. The app has no "Export my data" flow anywhere.

### 4.8 PII in logs
- Multiple `console.warn` / `console.log` calls in `supabase/functions/` will capture payloads that include PII (tenant names, amounts). Supabase function logs are retained and visible in the dashboard. If the dashboard is ever shared with a contractor, PII is exposed. Example: `telegram-webhook/index.ts:77` warns on `editMessageText failed` with the full error body.

---

## 5. IP / Trademark Concerns

### 5.1 "Dwella" name — **unverified trademark status**
- No evidence in the repo of a trademark search or USPTO / WIPO / Indian Trade Marks Registry filing.
- Bundle identifier `com.dwella.app` and scheme `dwella://` assume exclusive ownership of the name.
- Legal audit should verify: (a) no conflicting mark in "Class 9 software" or "Class 36 real estate" in the target jurisdictions (US, EU, India), (b) dwella.com or dwella.app domain ownership, (c) App Store / Play Store app-name availability.

### 5.2 **`dwella-nobroker-teal.jsx` — red flag**
- File exists at repo root. Filename references "NoBroker" — **NoBroker Technologies Solutions Pvt Ltd** is a well-known Indian proptech with registered trademarks in Class 36 and Class 42. The file is a color-theme mockup, not production code, but **committing a file whose name implies design inspiration from a competitor** is discoverable and could be used in any future trademark-infringement or trade-dress dispute. Recommend: delete from the tree and rewrite git history if launch is imminent, or at minimum rename.

### 5.3 Logo origin — **uncertain provenance**
- `Logo final.jsx` and `Real final logo.jsx` at repo root contain inline SVG using "Georgia" serif typeface for the wordmark. Georgia is a Microsoft-bundled font — commercial-use OK, no attribution required.
- The "sparkle" AI accent is original SVG geometry. Should be safe.
- Icon assets `assets/icon.png`, `assets/adaptive-icon.png`, `assets/splash.png`, `assets/favicon.png` — binary files, origin not documented anywhere. No attribution file.
- **Action item for legal:** require the founder to attest in writing that all logo/icon assets are either (a) self-made, (b) commissioned work-for-hire with a signed agreement, or (c) licensed with documentation. Missing attestation = IP exposure.

### 5.4 Third-party code licenses — **no bundled LICENSE file**
- Repo has **no `LICENSE`, `LICENSE.md`, `NOTICE`, or `THIRD_PARTY_NOTICES`** file.
- Production dependencies include MIT-licensed packages (`zustand`, `react-native-paper`, `@supabase/supabase-js`) whose licenses require attribution in the distributed binary.
- Apple App Store does not strictly enforce this, but Play Store and FDroid do, and a trademark/IP plaintiff can use missing attributions as leverage. Add a generated third-party licenses screen (common pattern: an in-app "Open Source Licenses" viewer in the profile screen). `npx license-checker` can generate the list.

### 5.5 Font licenses
- `app.json` uses `expo-font` plugin but the plugins array does not list any specific font files. `assets/` contains no `*.ttf` or `*.otf`. The app appears to ship with system fonts only (React Native Paper default). Low risk.

### 5.6 "Powered by Claude" / Anthropic attribution
- Anthropic's API terms require customers to clearly indicate AI-generated content. The bot reply text is not prefixed or labeled as AI-generated anywhere in `supabase/functions/process-bot-message/index.ts` or `app/(tabs)/bot/`. Minor but worth noting — Anthropic's usage policy compliance.

---

## 6. Missing App-Store Requirements

Consolidated list of concrete blockers for iOS App Store + Google Play submission:

| # | Requirement | Status | File/Action |
|---|---|---|---|
| 1 | In-app account deletion (Apple 5.1.1(v)) | **MISSING** | `app/(tabs)/profile/index.tsx` |
| 2 | Live privacy policy URL | **MISSING** | None; needs hosting |
| 3 | Live terms of service URL | **MISSING** | None; needs hosting |
| 4 | Privacy Nutrition Label draft | **MISSING** | App Store Connect |
| 5 | Play Store Data Safety form | **MISSING** | Play Console |
| 6 | Consent screen at signup | **MISSING** | `app/(auth)/signup.tsx` |
| 7 | Age rating questionnaire | Unverified | Needs review: bot can discuss financial matters — may affect 4+/12+ rating |
| 8 | Data deletion request endpoint (Play 2024 req.) | **MISSING** | Must be reachable via a URL even for uninstalled users |
| 9 | Push notification permissions prompt wording | Default | `expo-notifications` plugin, no custom copy |
| 10 | Face ID usage description (`NSFaceIDUsageDescription`) | Missing from `app.json` | `expo-local-authentication` not listed in plugins despite being a dep |
| 11 | Camera / photo library usage strings | Unverified | `expo-image-picker` used in `profile/index.tsx` and `ProofUploader.tsx`; not listed in `app.json` plugins |
| 12 | Crash reporting (for post-launch support) | **MISSING** | Sentry removed; no replacement |
| 13 | In-app update gate | **MISSING** | `UpdateGate.tsx` deleted |
| 14 | iOS 26 launch crash | **UNFIXED** | Blocks App Review on current hardware |
| 15 | ITSAppUsesNonExemptEncryption | Set to `false` in `app.json:22` | Correct (no custom crypto, only standard HTTPS) |
| 16 | Export compliance declaration | Covered by #15 | OK |
| 17 | App Store app name uniqueness | Unverified | "Dwella" may collide with existing apps |
| 18 | Bot-chat-history moderation | **MISSING** | Users can enter any text; no profanity/PII filter before it goes to Claude or Telegram — could trigger Guideline 1.2 (user-generated content moderation) for public-facing features |

Items #10 and #11 are particularly concerning: iOS will crash the app at runtime the first time any unlisted permission is requested, because the `Info.plist` has no usage description. This has been flagged in the TestFlight-crash investigation (`testflight-crash-on-launch.md` lines 73-81) but it's unclear whether the `app.json` plugins array has been updated. As of this audit, **`app.json:52-66` lists only: `expo-router`, `expo-font`, `expo-apple-authentication`, `@react-native-community/datetimepicker`, `expo-notifications`**. Missing: `expo-image-picker`, `expo-local-authentication`, `expo-secure-store`. This will crash the app on first photo pick or first Face ID attempt.

---

## 7. Fragile / Brittle Areas

### 7.1 AuthGuard in `app/_layout.tsx`
- Rewritten 6 times in 24 hours (commits `6cd7303, 1c53091, 6b6a357, 58e826f, 675cb23, 90a53b8`).
- Current state works but has layered defenses (try/finally, 3s fallback, 4s index.tsx escape hatch) that suggest the happy path is not fully trusted.
- Any future change to this file should be accompanied by manual cold-launch testing on both OAuth and email flows.

### 7.2 `process-bot-message/index.ts` — 1108 lines
- Single file, 10 intent handlers, global Claude API call, context builder, history fetcher, auth gate, PDF generator (`pdf.ts` sibling). No unit tests found.
- Fuzzy tenant-name matching via `.ilike('%...%')` is intent-ambiguous and can match wrong tenants when two tenants have similar names (e.g., "Raj" vs "Rajesh"). The confirmation flow mitigates financial actions but not read actions (`get_rent_receipt`, which is marked `needs_confirmation: false`). A landlord asking "send Raj's receipt" could receive the wrong tenant's PDF, which is a data leak inside the landlord's own account.

### 7.3 Scheduled job dependence on pg_cron
- Three scheduled functions (`auto-confirm-payments`, `mark-overdue`, `send-reminders`) have no migration registering them. If the Supabase project is ever migrated, restored from backup, or cloned to a staging environment, the schedules will not come with it.

### 7.4 Zustand persist + hydration
- `lib/store.ts` uses Zustand persist with AsyncStorage. The splash-stuck bug shows that a corrupt or slow hydration leaves the app in an indeterminate loading state. The 4s force-unlock in `app/index.tsx` is a band-aid. Under memory pressure or iOS background-kill + cold-relaunch, this can recur.

### 7.5 Real-time subscriptions
- Hooks use Supabase Realtime for live payment/notification updates. Realtime is known to drop silently on network transitions. No reconnect indicator in the UI. Users with flaky connections will see stale data with no warning.

### 7.6 Invite deep link
- `app/invite/[token].tsx` is the entry point for tenant invite acceptance. `dwella://invite/{token}` deep link works only if the scheme is registered and the app is installed. The `invite-redirect` edge function handles the non-installed case for iOS and Android, but:
  - iOS fallback uses a `setTimeout` trick (`invite-redirect/index.ts:204-210`) that is unreliable on iOS 17+ Safari.
  - Android uses `intent://` which requires Chrome — broken on Samsung Internet, Firefox, etc.

---

## 8. Tech Debt

### 8.1 Stale TODOs
- Only one TODO comment in the entire tree: `supabase/functions/invite-redirect/index.ts:17` — "TODO before launch: replace the placeholder store URLs below with real ones." Comment is arguably stale now but should be removed if URLs are finalized.

### 8.2 Orphaned files at repo root
- `dwella-nobroker-teal.jsx`, `Logo final.jsx`, `Real final logo.jsx`, `Claude IG Marketing.md`, `Dwella v2-PRD.md` — design/marketing scratch files committed to the app repo. Not imported by any source file. Adds noise to PR diffs and creates IP exposure (see §5.2). Should be moved to a separate design repo or `.gitignore`d.

### 8.3 `scripts/gen-apple-secret.mjs` — untracked
- New untracked file (per git status). Likely generates the Apple Sign In client secret JWT. Needs review to ensure it doesn't write secrets to a tracked path.

### 8.4 Stale memory notes
- `MEMORY.md` claims Phase 15 / v1.4 / SDK 56 upgrade context that contradicts the actual `package.json` (still SDK 54). This is not a code issue but it means any Claude session starting from memory will make wrong assumptions about the environment.

### 8.5 No test suite
- No `__tests__` directories. No `jest.config.*` or `vitest.config.*`. No CI configuration in the repo (no `.github/workflows/`). Every change ships untested except by manual TestFlight runs, which have produced 8+ crash sessions in two weeks.

### 8.6 Migration numbering gap
- Migrations jump from `014_avatars_storage.sql` directly to `027_receipts_storage.sql` then `028_fix_properties_tenant_read_policy.sql`. Missing migrations 015–026 suggest either unpushed work or deleted migrations from a branch reconciliation. Needs audit: a missing migration in production = broken schema.

### 8.7 Two separate profile screens with 559 lines
- `app/(tabs)/profile/index.tsx` is 559 lines doing photo upload, theme switching, PIN management, Telegram linking, and sign-out in one component. High churn risk when account-deletion + privacy-policy links are added.

### 8.8 `react-native-vector-icons` dead dependency
- `package.json:45` includes `react-native-vector-icons: ^10.1.0` but all source files import from `@expo/vector-icons`. The `react-native-vector-icons` package is compiled into the binary but never called. Adds binary size and is flagged in `testflight-crash-on-launch.md` as a potential symbol-conflict risk.

---

## 9. Top-Priority Items for Legal Audit

Ranked by severity for a pre-v1 legal review:

1. **No in-app account deletion** (`app/(tabs)/profile/index.tsx`) — App Store hard blocker + GDPR/DPDP Art. 17 violation.
2. **No privacy policy or terms of service** — App Store + Play Store hard blocker.
3. **Tenant PII sent to Anthropic/US without tenant consent** (`supabase/functions/process-bot-message/index.ts:784`) — GDPR Art. 6 + DPDP § 6 violation risk.
4. **iOS 26 Hermes crash unfixed** (`.planning/debug/testflight_crash_build36/SESSION.md`) — App Review rejection risk.
5. **Payment rows permanent** (`ON DELETE RESTRICT`) — makes data-subject erasure requests technically impossible.
6. **`verify_jwt = false` on three public edge functions** with no Telegram webhook secret-token verification — data integrity risk.
7. **Missing iOS Info.plist usage descriptions** for image picker, local auth, secure store — runtime crash on first permission request.
8. **`dwella-nobroker-teal.jsx`** at repo root — trademark/trade-dress discovery risk.
9. **Zero crash reporting in production** (Sentry and PostHog both removed, no replacement) — forensic/audit-trail gap.
10. **Bot conversation history retained indefinitely** — no retention policy in `bot_conversations` table.

---

*Audit completed 2026-04-05. All file paths verified against working tree. This document is an engineering-side input to the legal review — it does not replace counsel.*

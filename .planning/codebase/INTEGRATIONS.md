# External Integrations

**Analysis Date:** 2026-04-05

## APIs & External Services

**AI / LLM:**
- **Anthropic Claude API** — primary intelligence layer for the Telegram bot and in-app AI features.
  - Endpoint: `https://api.anthropic.com/v1/messages` (direct REST, no SDK).
  - Model: `claude-sonnet-4-20250514` — hard-coded in `constants/config.ts` as `BOT_MODEL` and in four Edge Functions.
  - Header: `anthropic-version: 2023-06-01` on every call.
  - Auth: `x-api-key: $ANTHROPIC_API_KEY` (Deno env var, server-side only; never reaches the client).
  - Call sites:
    - `supabase/functions/process-bot-message/index.ts` line 926 — primary bot intent parser, returns structured JSON with `intent`, `entities`, `action_description`, `needs_confirmation`, `reply`.
    - `supabase/functions/ai-insights/index.ts` line 125 — landlord insights feed.
    - `supabase/functions/ai-search/index.ts` line 60 — natural-language search over properties/tenants/payments.
    - `supabase/functions/ai-draft-reminders/index.ts` line 110 — draft polite reminder text.
  - Context injection: `process-bot-message` receives the user's full properties/tenants list as context with each message (5-minute cache per CLAUDE.md architecture notes).

**Messaging:**
- **Telegram Bot API** — primary out-of-app interface (the user's landlord assistant lives in Telegram).
  - Base URL: `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/...`
  - Bot username: `Dwellav2_bot` (injected into the app via `EXPO_PUBLIC_TELEGRAM_BOT_USERNAME` in `eas.json` production profile).
  - Auth: `TELEGRAM_BOT_TOKEN` Deno env var, read in `supabase/functions/telegram-webhook/index.ts` line 4.
  - Methods used (all in `supabase/functions/telegram-webhook/index.ts`):
    - `sendMessage` — replies with `parse_mode: Markdown` and optional `reply_markup.inline_keyboard`.
    - `answerCallbackQuery` — dismisses inline button loading spinner after a tap.
    - `editMessageText` — drives the multi-step interactive receipt picker (tenant → month → PDF) without spamming new messages.
    - `sendChatAction` with `action: "typing"` — invoked every 4s while `process-bot-message` runs, per MEMORY notes.
    - `sendDocument` — delivers PDF receipts as file attachments.
  - Incoming webhook: Telegram POSTs updates directly to `https://{project}.supabase.co/functions/v1/telegram-webhook`. `supabase/config.toml` line 384 sets `[functions.telegram-webhook] verify_jwt = false` because Telegram cannot send a Supabase JWT.
  - Inline keyboards: destructive intents (`log_payment`, `add_property`, `add_tenant`, `archive_property`, `archive_tenant`, `update_tenant`, `bulk_send_reminder`, `confirm_payment`, `send_reminder`, `get_rent_receipt`) render a `[✓ Confirm] [✗ Cancel]` row. See `CONFIRM_KEYBOARD` constant in `supabase/functions/process-bot-message/index.ts` line 50.

**Push Notifications:**
- **Expo Push Notification Service** — delivery channel for background notifications to installed app instances.
  - Endpoint: `https://exp.host/--/api/v2/push/send` (called from `supabase/functions/send-push/index.ts` line 10).
  - Tokens: obtained via `Notifications.getExpoPushTokenAsync()` in `lib/notifications.ts` line 21, stored on the `users.push_token` column (migration `supabase/migrations/010_push_tokens.sql`).
  - Android channel: `default` with `AndroidImportance.MAX` (set in `lib/notifications.ts`, channel also declared in `app.json` expo-notifications plugin config with color `#4F46E5`).
  - Permissions: requested at runtime in `registerPushToken()`; physical device check via `expo-device` (emulators are skipped).
  - No APNs/FCM keys are managed directly — Expo brokers delivery.

## Data Storage

**Database:**
- **Supabase Postgres 17** — single source of truth.
  - Connection: via `@supabase/supabase-js` client in `lib/supabase.ts`; Edge Functions use the same SDK via URL import.
  - Auth: anon key for client (`EXPO_PUBLIC_SUPABASE_ANON_KEY`), service-role key for functions (`SUPABASE_SERVICE_ROLE_KEY`).
  - Schema surface: `users`, `properties`, `tenants`, `payments`, `notifications`, `bot_conversations`, plus tables for push tokens, photo notes, expenses (see `supabase/migrations/001_initial_schema.sql` and follow-ons through `028_fix_properties_tenant_read_policy.sql`).
  - RLS enabled on all app tables; scheduled functions use service role to bypass.

**Realtime:**
- **Supabase Realtime** — enabled in `supabase/config.toml [realtime] enabled = true`. Used in hooks to keep payment/notification state live (per CLAUDE.md architectural notes); subscriptions are set up inside `hooks/` files that call `supabase.channel(...)`.

**Object Storage (Supabase Storage):**
Four buckets, all private unless noted:

| Bucket | Purpose | Path pattern | Migration |
|---|---|---|---|
| `payment-proofs` | Tenant-uploaded payment receipts (JPG/PNG) | `{property_id}/{tenant_id}/{year}-{month}.jpg` | `supabase/migrations/002_storage.sql`, policies refined in `006_storage_update_policy.sql` and `007_fix_storage_policies.sql` |
| `tenant-photos` | Photo notes attached to tenants | (see `supabase/migrations/012_tenant_photo_notes.sql`) | `012_tenant_photo_notes.sql` |
| `avatars` | User profile avatars (public read) | `{user_id}/...` | `supabase/migrations/014_avatars_storage.sql` |
| `receipts` | Cached rent-payment receipt PDFs generated by the app or Edge Function | `{payment_id}.pdf` | `supabase/migrations/027_receipts_storage.sql` |

- Access from client: signed URLs via `supabase.storage.from('payment-proofs').createSignedUrl(...)` (see `lib/payments.ts` line 50).
- Access from bot: `supabase/functions/process-bot-message/index.ts` reads from `receipts` bucket by `{payment_id}.pdf` key, generates with `pdf-lib` in `supabase/functions/process-bot-message/pdf.ts` on cache miss, and uploads so the next request is cache-hit.
- Bucket file size ceiling: `50MiB` (`supabase/config.toml [storage] file_size_limit`).

**Caching:**
- In-process 5-minute cache on the Claude context window inside `process-bot-message` (architectural note from CLAUDE.md).
- No Redis, no external cache layer.

## Authentication & Identity

**Provider:** Supabase Auth.

**Methods enabled:**
- **Email + password** — `supabase/config.toml [auth.email] enable_signup = true`, `minimum_password_length = 6`, `enable_confirmations = false` (no email verification gate).
- **Google OAuth** — `[auth.external.google] enabled = true`, client ID committed at line 308 of `supabase/config.toml` (`112003223904-c8185a1jvosme5h4161p4rfbmt9lqbos.apps.googleusercontent.com`), secret via `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`. Flow: `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: 'dwella://auth/callback' } })` in `lib/social-auth.ts` line 82.
- **Apple Sign In** — native identity-token flow. `expo-apple-authentication` produces a credential (`lib/social-auth.ts` line 52), passed to `supabase.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken })` at line 63. `config.toml` sets `skip_nonce_check = true` for this native flow.
- Availability check: `AppleAuthentication.isAvailableAsync()` gates the Apple button (iOS only).

**Session storage:**
- Native: `@react-native-async-storage/async-storage` (`lib/supabase.ts`).
- Web: `window.localStorage` if available, else undefined (SSR-safe).
- Flow type: `implicit` (explicitly NOT PKCE — the PKCE code verifier can be lost when the JS thread is suspended during the in-app browser session in RN).

**Redirect URIs registered in Supabase:**
- `dwella://auth/callback` — configured in `supabase/config.toml [auth] additional_redirect_urls`.
- Generated in-app via `makeRedirectUri({ scheme: 'dwella', path: 'auth/callback' })` in `lib/social-auth.ts` line 9.

**Biometric unlock:**
- `expo-local-authentication` — app-level re-auth gate (post-login face/touch ID).

## Monitoring & Observability

**Error tracking:**
- **Sentry** — currently **disabled** on `main`. Per MEMORY notes (`project_sentry_upgrade.md`): the Sentry native plugin was removed, and re-enablement requires setting `EXPO_PUBLIC_SENTRY_DSN`. No `@sentry/react-native` dependency is present in `package.json` as of 2026-04-05. There is a `SENTRY_DISABLE_AUTO_UPLOAD` env key referenced in `.planning/debug/testflight-crash-on-launch.md` but no active integration code.

**Analytics:**
- None on `main`. A past experiment used PostHog (`EXPO_PUBLIC_POSTHOG_API_KEY`) but that code path is gone — referenced only in old debug notes.

**Logs:**
- `console.log` / `console.error` in client and Edge Functions. Supabase Dashboard shows Edge Function logs (stdout/stderr); no structured log shipping.

**Analytics DB (Supabase internal):**
- `supabase/config.toml [analytics] enabled = true, backend = "postgres"` — for the Supabase dashboard, not app-level tracking.

## CI/CD & Deployment

**Mobile builds:**
- **EAS Build** — profiles defined in `eas.json`:
  - `development` → dev client, internal distribution.
  - `preview` → internal distribution.
  - `production` → `autoIncrement = true`, injects `EXPO_PUBLIC_TELEGRAM_BOT_USERNAME=Dwellav2_bot`.
- `cli.version: ">= 18.3.0"`, `appVersionSource: "remote"` (version numbers managed by EAS, not `app.json`).
- EAS project ID: `3bc7de51-47e7-4c4e-92e3-e6e1a40ae71b`.

**Edge Function deployment:**
- Manual via Supabase CLI: `supabase functions deploy <name>` (see CLAUDE.md commands block). No GitHub Actions workflow is committed.

**Database migrations:**
- Applied via `supabase db push` / `supabase db reset`. Migrations live in `supabase/migrations/` and are auto-applied on reset per `config.toml [db.migrations] enabled = true`.

**CI pipeline:**
- Not detected. No `.github/workflows/`, no `.gitlab-ci.yml`. Local-only workflow + `npx tsc --noEmit` as the sole automated check.

## Environment Configuration

**Client (required at build time, prefixed `EXPO_PUBLIC_`):**
- `EXPO_PUBLIC_SUPABASE_URL` — Supabase project URL.
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key.
- `EXPO_PUBLIC_TELEGRAM_BOT_USERNAME` — used to render the "Open in Telegram" deep link (`https://t.me/{username}?start={user_id}`).

**Server (Supabase Edge Function secrets):**
- `ANTHROPIC_API_KEY` — Claude API bearer.
- `TELEGRAM_BOT_TOKEN` — `telegram-webhook` only.
- `BOT_INTERNAL_SECRET` — shared secret between `telegram-webhook` and `process-bot-message`.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — auto-injected by platform (flaky since new API key format rollout, per `config.toml` line 395 comment).
- `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`, `SUPABASE_AUTH_EXTERNAL_APPLE_CLIENT_ID`, `SUPABASE_AUTH_EXTERNAL_APPLE_SECRET` — for Supabase Auth OAuth providers.

**Secrets location:**
- Local dev: `.env` at project root (git-ignored, not read by this audit).
- EAS builds: EAS environment variables (per commit `c9f58e2`, Supabase URL/anon key were recently moved off `eas.json` into EAS env).
- Edge Functions: Supabase Dashboard → Functions → Secrets (`supabase secrets set ...`).

## Webhooks & Callbacks

**Incoming (public, `verify_jwt = false`):**
- `POST https://{project}.supabase.co/functions/v1/telegram-webhook` — receives Telegram `Update` payloads (messages + `callback_query` from inline keyboard taps). Registered with Telegram via `setWebhook` (out-of-band, not in repo).
- `GET https://{project}.supabase.co/functions/v1/invite-redirect?token={token}` — public HTML landing page that attempts to open `dwella://invite/{token}` (iOS) or an `intent://` URL (Android) and falls back to App Store / Play Store. Hard-coded URLs in `supabase/functions/invite-redirect/index.ts`:
  - iOS: `https://apps.apple.com/app/id6760478576` (line 20)
  - Android: `https://play.google.com/store/apps/details?id=com.dwella.app` (line 21)

**Server-to-server (authenticated via `BOT_INTERNAL_SECRET` header, `verify_jwt = false`):**
- `POST https://{project}.supabase.co/functions/v1/process-bot-message` — called only from `telegram-webhook`. Also called from the mobile app via `lib/bot.ts` (`FUNCTION_URL = ${EXPO_PUBLIC_SUPABASE_URL}/functions/v1/process-bot-message`) for the in-app AI chat; client calls still send the user JWT and the function trusts either the bearer JWT or the `x-bot-internal-secret` header.

**Outgoing (Edge Functions → external):**
- Claude: `POST https://api.anthropic.com/v1/messages`.
- Telegram: `POST https://api.telegram.org/bot{TOKEN}/{method}`.
- Expo Push: `POST https://exp.host/--/api/v2/push/send`.
- No Stripe, no Twilio, no SendGrid, no AWS services.

## Scheduled Edge Functions

Registered via pg_cron (schedules configured in Supabase dashboard, not in repo files):

| Function | File | Schedule | Action |
|---|---|---|---|
| `auto-confirm-payments` | `supabase/functions/auto-confirm-payments/index.ts` | hourly | Promote `paid` → `confirmed` after 48h (`AUTO_CONFIRM_HOURS` in `constants/config.ts`) with `auto_confirmed = TRUE` |
| `mark-overdue` | `supabase/functions/mark-overdue/index.ts` | daily midnight | Mark pending payments past `due_day` as `overdue` |
| `send-reminders` | `supabase/functions/send-reminders/index.ts` | daily 9 AM | Remind tenants 3 days before / on / 3 days after due_day (`REMINDER_DAYS_BEFORE`/`REMINDER_DAYS_AFTER` in `constants/config.ts`) |

## Deep Links & URL Schemes

- **Scheme:** `dwella://` (declared in `app.json`, Android intent filter registered for `VIEW` + `BROWSABLE`).
- **Auth callback:** `dwella://auth/callback` → `app/auth/callback.tsx`.
- **Tenant invite:** `dwella://invite/{token}` → `app/invite/[token].tsx`. Token is the UUID stored on `tenants.invite_token`; acceptance sets `tenants.user_id` and `invite_status = 'accepted'`. See `lib/invite.ts` for link generation and `components/TenantCard.tsx` line 21 for the share UI.
- **Universal URL (shareable via SMS / WhatsApp / email):** `https://{project}.supabase.co/functions/v1/invite-redirect?token={token}` — HTML page that attempts custom scheme then falls back to stores.

## Payment Proof Storage Contract

- Bucket: `payment-proofs`.
- Path: `{property_id}/{tenant_id}/{year}-{month}.jpg`.
- Upload: from `lib/payments.ts` via `supabase.storage.from('payment-proofs').upload(...)`.
- Read: signed URLs, generated on demand per session.
- Policies: authenticated insert, owner-scoped select/update/delete (see `supabase/migrations/007_fix_storage_policies.sql`).

## Receipt PDF Contract

- Bucket: `receipts` (private).
- Path: `{payment_id}.pdf`.
- Writers:
  - Client: `lib/pdf.ts` (`RECEIPTS_BUCKET = 'receipts'`) — generated via `expo-print` and uploaded on share/confirm.
  - Server: `supabase/functions/process-bot-message/pdf.ts` using `pdf-lib@1.17.1` — generated on cache miss when the bot is asked for a receipt, then uploaded so subsequent requests are cache hits.
- Reader: bot function returns signed URL to Telegram as a `sendDocument` attachment.

---

*Integration audit: 2026-04-05*

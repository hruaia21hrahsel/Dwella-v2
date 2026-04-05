# Architecture

**Analysis Date:** 2026-04-05

## Pattern Overview

**Overall:** Client/server SaaS architecture. Expo Router mobile client (React Native) talks directly to a Supabase backend (Postgres + Auth + Storage + Realtime + Edge Functions). Business logic lives in three layers: the Expo client, Postgres (RLS + triggers), and Deno Edge Functions (scheduled jobs, bot pipeline, server-side PDF).

**Key Characteristics:**
- File-based routing via Expo Router v3 (`app/` directory).
- No dedicated API tier — the client uses the Supabase JS SDK directly; RLS policies are the sole server-side access boundary.
- Edge Functions are used only for work that can't run on the client: Telegram webhook, Claude API calls, scheduled cron jobs, push notifications, server-side PDF generation, invite deep-link redirect.
- Auth state flows from Supabase Auth → Zustand store (`lib/store.ts`) → `AuthGuard` in `app/_layout.tsx` → route redirects.
- Realtime subscriptions in hooks keep UI in sync with DB mutations that originate outside the current client.
- Soft-delete (`is_archived`) is enforced by convention in every query; payment rows are permanent via `ON DELETE RESTRICT`.

## Layers

**Presentation (Expo Router screens):**
- Purpose: Render UI, handle user input, dispatch intents.
- Location: `app/`
- Contains: Screens grouped by route. `(auth)/` for unauthenticated flows, `(tabs)/` for the main app shell, feature directories (`property/`, `expenses/`, `tools/`, `invite/`, `notifications/`, `reminders/`, `payments/`) for modal/stack destinations.
- Depends on: `hooks/`, `components/`, `lib/`, `constants/`.
- Used by: Expo Router itself (file-based).

**Data hooks:**
- Purpose: Fetch + subscribe to a single resource, expose `{data, isLoading, error, refresh}`.
- Location: `hooks/`
- Contains: `useProperties.ts`, `useTenants.ts`, `usePayments.ts`, `useNotifications.ts`, `useExpenses.ts`, `useAllExpenses.ts`, `useDashboard.ts`, `useBotConversations.ts`.
- Depends on: `lib/supabase.ts`, `lib/store.ts` (for `user.id`), `lib/types.ts`.
- Used by: Screens under `app/`.

**Client services (`lib/`):**
- Purpose: Stateless helpers, typed DB glue, auth store, domain logic.
- Location: `lib/`
- Contains: `supabase.ts` (client init), `store.ts` (Zustand auth store with persist), `types.ts` (DB row interfaces), `payments.ts` (status colors/labels + transition predicates + proof path helpers), `invite.ts` (invite link + accept flow), `pdf.ts` (client-side HTML→PDF + Storage upload cache), `notifications.ts` (push token registration), `biometric-auth.ts` (PIN lock), `expenses.ts`, `bot.ts`, `toast.ts`, `haptics.ts`, `social-auth.ts`, `theme-context.tsx`, `tour.ts`, `utils.ts`.
- Depends on: `@supabase/supabase-js`, `expo-*`, `zustand`.
- Used by: Hooks and screens.

**Supabase backend:**
- Purpose: Single source of truth. Auth, Postgres, Storage, Realtime, Edge runtime.
- Location: `supabase/migrations/` (schema) + `supabase/functions/` (Deno Edge code).
- Contains: Tables `users`, `properties`, `tenants`, `payments`, `notifications`, `bot_conversations`, `expenses`; Storage buckets `payment-proofs`, `receipts`, `avatars`; RLS policies scoped to `auth.uid()`; `updated_at` triggers; `on_auth_user_created` trigger.
- Used by: Client (via SDK + Realtime) and Edge Functions (via service-role client).

**Edge Functions (Deno):**
- Purpose: Server-side work that can't happen on-device.
- Location: `supabase/functions/`
- Functions: `telegram-webhook`, `process-bot-message` (also vendored `pdf.ts`), `auto-confirm-payments`, `mark-overdue`, `send-reminders`, `send-push`, `ai-draft-reminders`, `ai-insights`, `ai-search`, `invite-redirect`.

## Data Flow

**Read flow (UI rendering a list):**

1. Screen under `app/` mounts (e.g. `app/(tabs)/properties/index.tsx`).
2. Calls a hook (e.g. `useProperties()` in `hooks/useProperties.ts`).
3. Hook reads `user` from `useAuthStore()`, then runs `supabase.from('properties').select(...).eq('owner_id', user.id).eq('is_archived', false)`.
4. Postgres enforces RLS on top of the predicate.
5. Result stored in hook's `useState`; hook also subscribes to a Realtime channel on the same table so external mutations re-trigger `fetch()`.
6. Screen re-renders.

**Write flow (mutation from app):**

1. Screen dispatches `supabase.from(...).insert/update/delete(...)` directly (no server action layer).
2. RLS policy checks `auth.uid()` against ownership column.
3. Postgres `updated_at` trigger stamps the row.
4. Realtime broadcasts the change; subscribed hooks refetch and UI updates.
5. For destructive ops on properties/tenants: mutation sets `is_archived = TRUE` rather than deleting.

**Bot message flow:**

1. Telegram user sends a message → Telegram POSTs to `supabase/functions/telegram-webhook/index.ts` (public, `verify_jwt = false`).
2. `telegram-webhook` resolves `telegram_chat_id` → `users.id`, handles `/menu`/`/start`/callback-query buttons directly, or forwards message text to `process-bot-message` with the `x-bot-internal-secret` header.
3. `supabase/functions/process-bot-message/index.ts` fetches the user's full properties + tenants context, calls the Claude API (`claude-sonnet-4-20250514` — see `constants/config.ts` `BOT_MODEL`), receives structured JSON `{ intent, entities, action_description, needs_confirmation, reply }`.
4. If `needs_confirmation`, replies with an inline `✓ Confirm / ✗ Cancel` keyboard and stores the pending action.
5. On confirm, dispatches to one of the action handlers (log_payment, confirm_payment, add_property, add_tenant, send_reminder, get_rent_receipt, archive_property, archive_tenant, update_tenant, bulk_send_reminder).
6. Receipt requests hit Storage bucket `receipts/{payment_id}.pdf` first; on cache miss, `supabase/functions/process-bot-message/pdf.ts` (pdf-lib) generates the receipt, uploads it to Storage, returns a signed URL.
7. Reply (and optional document) is returned to `telegram-webhook`, which sends it to the Telegram chat. Typing indicators are refreshed every 4s while the backend works.
8. Every turn is appended to `bot_conversations` for future context.

## Auth Flow

**Email / password + social:**
- Client: `lib/supabase.ts` creates the Supabase client with `flowType: 'implicit'` and AsyncStorage persistence (web uses `localStorage`).
- `supabase.auth.onAuthStateChange` is subscribed once inside `AuthGuard` (`app/_layout.tsx`). The callback is synchronous-only — it sets session/user in the Zustand store but never calls the DB (avoids auth-event deadlocks). A separate `useEffect` fetches the full user row from `public.users`.
- A 3-second fallback `setTimeout` unblocks the splash screen if `onAuthStateChange` never fires.
- Route gating happens in `AuthGuard`'s effect: `!session → /(auth)/login`; `pinEnabled && isLocked → /(auth)/lock`; `!onboardingCompleted → /onboarding`; otherwise `/(tabs)/dashboard`.
- `isLocked` is in-memory only, resets to `true` on every cold launch (never persisted). PIN unlock only clears the flag.
- OAuth callback: `app/auth/callback.tsx`.

**Invite deep-link flow:**
- Landlord creates a tenant → `tenants.invite_token` is auto-generated by the DB (`001_initial_schema.sql`).
- Landlord shares `{SUPABASE_URL}/functions/v1/invite-redirect?token={token}` (see `lib/invite.ts` `getInviteLink`).
- `supabase/functions/invite-redirect/index.ts` serves a smart redirect HTML: opens `dwella://invite/{token}` if the app is installed, otherwise sends to App Store / Play Store.
- Deep link hits `app/invite/[token].tsx`. If no session → redirect to `/(auth)/login`. Once logged in, the screen calls `getInviteDetails(token)` then `acceptInvite(token, user.id)` which sets `tenants.user_id = auth.uid()` and `invite_status = 'accepted'`.

**Telegram link:**
- `users.telegram_link_token` (added in `003_phase_c.sql`) ties a Telegram chat to a Supabase user. Linked via the bot's `/start <token>` command, resolved inside `telegram-webhook`.

## Key Abstractions

**Payment state machine:**
- States: `pending → partial → paid → confirmed` with `pending → overdue` side branch.
- Transition predicates: `canMarkAsPaid` and `canConfirm` in `lib/payments.ts`.
- Status values are CHECK-constrained in `supabase/migrations/001_initial_schema.sql` (`status TEXT CHECK (status IN ('pending', 'partial', 'paid', 'confirmed', 'overdue'))`).
- `auto-confirm-payments` Edge Function promotes `paid → confirmed` after 48h (`AUTO_CONFIRM_HOURS` in `constants/config.ts`), setting `auto_confirmed = true`.
- `mark-overdue` promotes `pending → overdue` when `due_date < today`.
- Deletion: payments use `ON DELETE RESTRICT` on both `tenant_id` and `property_id` FKs (see `001_initial_schema.sql` lines 64-65) — they are permanent.

**Soft-delete pattern:**
- `properties` and `tenants` have `is_archived BOOLEAN NOT NULL DEFAULT FALSE` and `archived_at TIMESTAMPTZ`.
- Every client query must include `.eq('is_archived', false)` — this is the convention (no partial index or RLS filter enforces it).
- Archiving a property cascades: code path archives all child tenants in the same transaction.
- Never hard-delete; payment history must remain intact.

**Dual-role system:**
- A user row can simultaneously own properties (`properties.owner_id = user.id`) and be a tenant (`tenants.user_id = user.id`).
- `useProperties()` in `hooks/useProperties.ts` runs two parallel queries and returns `{ownedProperties, tenantProperties}` — the Properties tab renders two sections.
- No profile flag; role is derived from data.

**Realtime subscriptions:**
- Every list hook opens a channel after its initial fetch. Example in `hooks/usePayments.ts`:
  ```
  supabase.channel(`payments-${tenant.id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'payments', filter: `tenant_id=eq.${tenant.id}` }, () => fetch())
    .subscribe()
  ```
- Channels are torn down in the `useEffect` cleanup with `supabase.removeChannel(channel)`.
- `useProperties` uses an unfiltered channel (`properties-realtime`) because both owned and tenant-linked rows need to refresh.

**Zustand auth store:**
- `lib/store.ts` exposes `useAuthStore` with `persist` middleware but only `onboardingCompletedByUser` and `themeMode` are persisted (`partialize`).
- `isLocked` intentionally resets on every cold launch.
- `onboardingCompletedByUser` is keyed by user id so onboarding state is per-account, not per-device.

## Entry Points

**Mobile app:**
- Location: `app/_layout.tsx`
- Triggers: Expo Router on app launch.
- Responsibilities: Splash screen management, asset preload (`assets/icon.png`), `ThemeProvider`, `PaperProvider`, `AuthGuard`, stack screen registration, notification tap handler.

**Root redirect:**
- Location: `app/index.tsx`
- Responsibilities: Thin landing shim — `AuthGuard` does the actual redirect work.

**Tab shell:**
- Location: `app/(tabs)/_layout.tsx`
- Tabs: `dashboard`, `properties`, `bot`, `tools`, `profile`.

**Telegram webhook:**
- Location: `supabase/functions/telegram-webhook/index.ts`
- Triggers: Telegram Bot API POSTs.

**Invite redirect:**
- Location: `supabase/functions/invite-redirect/index.ts`
- Triggers: HTTP GET from an invite link.

## Error Handling

**Strategy:** Local try/catch inside hooks and screens, surfaced to the UI via `error` state + `components/ErrorBanner.tsx` / toast (`components/ToastProvider.tsx`). Edge Functions log to `console.error` and return `{error: message}` with 4xx/5xx.

**Patterns:**
- Hooks always expose `{isLoading, error, refresh}` so screens can render skeleton / error / retry uniformly.
- `AuthGuard` wraps the whole `onAuthStateChange` handler in try/finally so `setLoading(false)` always runs — essential to prevent a stuck splash.
- Best-effort caching operations (receipt PDF upload in `lib/pdf.ts`) swallow errors and only `console.warn` so foreground flows never break.
- `requireEnv()` in `constants/config.ts` throws at import time if critical env vars are missing (documented in project memory).

## Cross-Cutting Concerns

**Logging:** `console.log/warn/error` with `[component]` prefix; no external logger on main. Sentry is planned but the native plugin is currently disabled (see `project_sentry_upgrade.md`).

**Validation:** Client-side via controlled inputs; server-side via Postgres CHECK constraints (`status`, `due_day`, `invite_status`, `month`) and FK/NOT NULL constraints.

**Authentication:** Supabase Auth (JWT). All client queries run under `auth.uid()`; Edge Functions use the service-role key for privileged operations plus the `BOT_INTERNAL_SECRET` shared secret for inter-function calls.

**Theming:** `lib/theme-context.tsx` provides dark/light colors to both the app and React Native Paper (`usePaperTheme` in `app/_layout.tsx`).

**Push notifications:** `lib/notifications.ts` registers Expo push tokens into `users.push_token`; `supabase/functions/send-push/index.ts` delivers via Expo's push service; triggered by `auto-confirm-payments`, `send-reminders`, and app actions.

## Scheduled Edge Functions

| Function | Schedule | Action |
|---|---|---|
| `supabase/functions/auto-confirm-payments/index.ts` | Hourly | Promotes `status = 'paid'` rows with `paid_at < now - 48h` to `confirmed`, sets `auto_confirmed = true`, pushes to landlord. |
| `supabase/functions/mark-overdue/index.ts` | Daily midnight | Promotes `status = 'pending'` rows with `due_date < today` to `overdue`. |
| `supabase/functions/send-reminders/index.ts` | Daily 9 AM | Sends reminders 3 days before, on, and 3 days after due day (`REMINDER_DAYS_BEFORE`/`REMINDER_DAYS_AFTER` in `constants/config.ts`). |

Schedules are configured via `pg_cron` in the Supabase dashboard — verify registration on new environments (see `.planning/` pre-launch checklist in project memory).

## PDF Generation Pipeline

**Client-side (in-app sharing):**
- `lib/pdf.ts` `sharePaymentReceipt()` builds an HTML template, uses `expo-print` `printToFileAsync` to render a PDF, then `expo-sharing` to present the share sheet.
- Simultaneously, `uploadReceiptPdf()` fire-and-forget uploads the same bytes to Storage bucket `receipts/{payment_id}.pdf` (upsert). This warms the cache for the Telegram bot.
- `cachePaymentReceipt()` is called silently on payment confirmation to seed the cache without a share sheet.
- Annual summary: `shareAnnualSummary()` uses the same pipeline but never uploads.

**Server-side (bot delivery):**
- `supabase/functions/process-bot-message/pdf.ts` uses `pdf-lib` (Deno-compatible, no headless browser) to render a receipt from scratch when the cache misses.
- Flow: bot handler checks `receipts/{payment_id}.pdf` → if present, return signed URL; if missing, generate via `pdf-lib` → upload → return signed URL.
- Text fallback only runs if `pdf-lib` itself throws.

**Storage buckets (from `supabase/migrations/002_storage.sql`, `014_avatars_storage.sql`, `027_receipts_storage.sql`):**
- `payment-proofs` — tenant-uploaded proof images at `{property_id}/{tenant_id}/{year}-{month}.jpg` (see `getProofStoragePath` in `lib/payments.ts`).
- `receipts` — cached rent-receipt PDFs at `{payment_id}.pdf`.
- `avatars` — user profile photos.

---

*Architecture analysis: 2026-04-05*

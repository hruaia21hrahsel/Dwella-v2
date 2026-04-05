# Codebase Structure

**Analysis Date:** 2026-04-05

## Directory Layout

```
Dwella v2/
├── app/                        # Expo Router screens (file-based routes)
│   ├── _layout.tsx             # Root layout + AuthGuard + providers
│   ├── index.tsx               # Landing shim
│   ├── +not-found.tsx          # 404 fallback
│   ├── (auth)/                 # Unauthenticated stack (grouped, no URL segment)
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   ├── signup.tsx
│   │   ├── forgot-password.tsx
│   │   ├── phone-verify.tsx
│   │   └── lock.tsx            # PIN / biometric lock screen
│   ├── (tabs)/                 # Main tab shell
│   │   ├── _layout.tsx         # Tab bar config
│   │   ├── dashboard/index.tsx
│   │   ├── properties/
│   │   │   ├── _layout.tsx
│   │   │   ├── index.tsx       # Properties list (owned + tenant sections)
│   │   │   └── [id].tsx        # Property detail
│   │   ├── bot/index.tsx       # In-app AI chat
│   │   ├── tools/index.tsx     # Tools shell (child screens deleted 2026-04-05)
│   │   └── profile/index.tsx
│   ├── auth/callback.tsx       # OAuth redirect landing
│   ├── onboarding/index.tsx    # First-run welcome + tour
│   ├── pin-setup.tsx           # Post-login PIN setup
│   ├── invite/[token].tsx      # Tenant invite acceptance deep link
│   ├── log-payment.tsx         # Modal payment entry
│   ├── notifications/index.tsx # Modal notifications list
│   ├── reminders/index.tsx     # Modal reminders list
│   ├── payments/index.tsx      # All-payments list
│   ├── expenses/index.tsx      # All-expenses list
│   ├── tools/                  # Out-of-tab tool screens
│   │   ├── emi-calculator.tsx
│   │   └── rental-yield.tsx
│   └── property/               # Nested property sub-routes
│       ├── create.tsx
│       └── [id]/
│           ├── expenses/
│           │   ├── index.tsx
│           │   ├── add.tsx
│           │   └── [expenseId].tsx
│           └── tenant/
│               ├── create.tsx
│               └── [tenantId]/
│                   ├── index.tsx
│                   ├── edit.tsx
│                   └── payment/
│                       ├── mark-paid.tsx
│                       └── [paymentId].tsx
├── components/                 # Reusable presentation components
├── hooks/                      # Data-fetch + realtime hooks
├── lib/                        # Client services, types, store, domain helpers
├── constants/                  # Colors, spacing, typography, theme, config
├── supabase/
│   ├── migrations/             # Postgres schema in numeric order
│   └── functions/              # Deno Edge Functions (one dir per function)
├── assets/                     # Icons, images, fonts
├── android/                    # Native Android project
├── scripts/                    # Dev utilities (e.g. gen-apple-secret.mjs)
├── .planning/                  # Planning docs, milestones, codebase maps, debug notes
├── app.json                    # Expo config
├── eas.json                    # EAS Build profiles
├── babel.config.js
├── tsconfig.json
├── package.json
└── CLAUDE.md                   # Project-wide Claude instructions
```

## Directory Purposes

**`app/`:**
- Purpose: Every screen and route in the mobile app. Expo Router maps file paths to URLs.
- Contains: `.tsx` screens, `_layout.tsx` layout wrappers, route groups `(auth)` and `(tabs)`.
- Key files: `app/_layout.tsx` (root providers + `AuthGuard`), `app/(tabs)/_layout.tsx` (tab shell), `app/invite/[token].tsx` (deep-link target).

**`app/(auth)/`:**
- Purpose: Pre-authenticated flows. The `(auth)` group is a segment-less wrapper used by `AuthGuard` to detect "inside auth" state via `segments[0] === '(auth)'`.
- Key files: `app/(auth)/login.tsx`, `app/(auth)/signup.tsx`, `app/(auth)/lock.tsx`.

**`app/(tabs)/`:**
- Purpose: Authenticated tab shell. Contains the five tabs: dashboard, properties, bot, tools, profile.
- Key files: `app/(tabs)/_layout.tsx`, `app/(tabs)/dashboard/index.tsx`, `app/(tabs)/properties/index.tsx`, `app/(tabs)/bot/index.tsx`.

**`app/property/[id]/...`:**
- Purpose: Nested property sub-routes outside the tab shell (detail, tenant CRUD, payments, expenses). Rendered as pushed stack screens from the Properties tab.

**`components/`:**
- Purpose: Reusable presentation components. No data fetching — props in, JSX out.
- Contains: `PropertyCard.tsx`, `TenantCard.tsx`, `PaymentLedger.tsx`, `PaymentStatusBadge.tsx`, `ProofUploader.tsx`, `ChatBubble.tsx`, `DwellaHeader.tsx`, `DwellaLogo.tsx`, `GlassCard.tsx`, `GradientButton.tsx`, `EmptyState.tsx`, `ErrorBanner.tsx`, `Skeleton.tsx` / `ListSkeleton.tsx` / `DashboardSkeleton.tsx`, `AnimatedCard.tsx`, `CustomTabBar.tsx`, `TabHeader.tsx`, `AssistantHeaderButton.tsx`, `NotificationsHeaderButton.tsx`, `ProfileHeaderButton.tsx`, `LogPaymentTabButton.tsx`, `ConfirmDialog.tsx`, `ToastProvider.tsx`, `TourGuideCard.tsx`, `PinReminderDialog.tsx`, `TelegramLinkReminderDialog.tsx`, `SocialAuthButtons.tsx`, `DwellaHeaderTitle.tsx`.

**`hooks/`:**
- Purpose: One hook per resource. Fetches + subscribes to Realtime; returns `{data, isLoading, error, refresh}`.
- Files:
  - `hooks/useProperties.ts` — owned + tenant-linked properties (dual-role aware)
  - `hooks/useTenants.ts` — tenants for a property
  - `hooks/usePayments.ts` — payments for a tenant (with Realtime)
  - `hooks/useNotifications.ts` — user notifications
  - `hooks/useExpenses.ts` — expenses for a property
  - `hooks/useAllExpenses.ts` — expenses across all properties
  - `hooks/useDashboard.ts` — dashboard aggregates
  - `hooks/useBotConversations.ts` — in-app chat history

**`lib/`:**
- Purpose: Non-UI client code. Supabase glue, types, store, domain helpers.
- Files:
  - `lib/supabase.ts` — Supabase client init (`flowType: 'implicit'`, AsyncStorage persistence, web fallback to `localStorage`)
  - `lib/types.ts` — TypeScript interfaces for every DB row (`User`, `Property`, `Tenant`, `Payment`, `Notification`, `Expense`, `BotConversation`) plus `PaymentStatus` and `InviteStatus` enums
  - `lib/store.ts` — Zustand auth store with `persist` middleware (only `onboardingCompletedByUser` and `themeMode` persisted)
  - `lib/payments.ts` — Status colors/labels, `canMarkAsPaid`/`canConfirm` predicates, `getDueDate`, `getProofStoragePath`, `getProofSignedUrl`
  - `lib/invite.ts` — `getInviteLink`, `getInviteDetails`, `acceptInvite`
  - `lib/pdf.ts` — HTML→PDF receipt generation via `expo-print`, Storage upload to `receipts/{payment_id}.pdf`, annual summary
  - `lib/notifications.ts` — Expo push token registration
  - `lib/biometric-auth.ts` — PIN / biometric lock helpers
  - `lib/theme-context.tsx` — React context for theme colors (wraps the app)
  - `lib/toast.ts` — Toast API (consumed by `components/ToastProvider.tsx`)
  - `lib/haptics.ts` — Haptic feedback shortcuts
  - `lib/social-auth.ts` — Apple/Google sign-in helpers
  - `lib/expenses.ts` — Expense helpers
  - `lib/bot.ts` — In-app bot client helpers
  - `lib/tour.ts` — Onboarding tour step definitions
  - `lib/utils.ts` — `formatCurrency`, `formatDate`, `getMonthName`, `getOrdinal`, misc

**`constants/`:**
- Purpose: Design tokens + static config.
- Files:
  - `constants/colors.ts` — Brand + status colors (see `statusPending`, `statusPartial`, `statusPaid`, `statusConfirmed`, `statusOverdue`, `primary`)
  - `constants/spacing.ts` — Spacing scale
  - `constants/typography.ts` — Font sizes/weights
  - `constants/theme.ts` — Combined theme object
  - `constants/config.ts` — Env var accessors (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `STORAGE_BUCKET`, `TELEGRAM_BOT_USERNAME`), `BOT_MODEL = 'claude-sonnet-4-20250514'`, `AUTO_CONFIRM_HOURS = 48`, `REMINDER_DAYS_BEFORE/AFTER = 3`

**`supabase/migrations/`:**
- Purpose: Canonical Postgres schema. Applied in numeric order.
- Files:
  - `001_initial_schema.sql` — `users`, `properties`, `tenants`, `payments`, `notifications`, `bot_conversations`; `updated_at` triggers; `on_auth_user_created` trigger; payment status CHECK constraint
  - `002_storage.sql` — `payment-proofs` bucket + policies
  - `003_phase_c.sql` — `telegram_chat_id` + `telegram_link_token` columns on `users`
  - `004_expenses.sql` — `expenses` table
  - `005_fix_rls_recursion.sql` — RLS policy fix
  - `006_storage_update_policy.sql`, `007_fix_storage_policies.sql` — Storage RLS fixes
  - `008_auto_confirm_email.sql` — Auto-confirm-email trigger on auth user creation
  - `009_nullable_lease_start.sql` — Relax `lease_start NOT NULL`
  - `010_push_tokens.sql` — `users.push_token`
  - `011_bot_metadata.sql` — `bot_conversations.metadata` JSONB
  - `012_tenant_photo_notes.sql` — `tenants.photo_url` + `notes`
  - `013_property_color.sql` — `properties.color`
  - `014_avatars_storage.sql` — `avatars` bucket
  - `027_receipts_storage.sql` — `receipts` bucket for cached bot-delivered PDFs
  - `028_fix_properties_tenant_read_policy.sql` — RLS join fix so tenants can read their linked property
- Migration numbering note: there is a jump from `014` to `027` — intermediate numbers were used on branches that are not merged to `main`.

**`supabase/functions/`:**
- Purpose: Deno Edge Functions. Each directory contains at minimum an `index.ts`.
- Functions on main:
  - `supabase/functions/telegram-webhook/index.ts` — Telegram Bot API webhook receiver; `verify_jwt = false`
  - `supabase/functions/process-bot-message/index.ts` — Claude API call + action dispatcher
  - `supabase/functions/process-bot-message/pdf.ts` — Server-side `pdf-lib` receipt generator (vendored alongside the function)
  - `supabase/functions/auto-confirm-payments/index.ts` — Hourly cron: promote `paid → confirmed` after 48h
  - `supabase/functions/mark-overdue/index.ts` — Daily cron: promote `pending → overdue` past due
  - `supabase/functions/send-reminders/index.ts` — Daily 9 AM cron: reminders 3d before / on / 3d after due
  - `supabase/functions/send-push/index.ts` — Expo push delivery helper
  - `supabase/functions/invite-redirect/index.ts` — Smart HTML redirect for invite links (opens app or store)
  - `supabase/functions/ai-draft-reminders/index.ts` — AI-drafted reminder text
  - `supabase/functions/ai-insights/index.ts` — AI portfolio insights
  - `supabase/functions/ai-search/index.ts` — AI search

**`.planning/`:**
- Purpose: Planning docs, phase plans, milestone archives, codebase maps, debug notes. Not shipped.
- Contains: `.planning/codebase/` (this directory), `.planning/debug/`, `.planning/milestones/`.

**`scripts/`:**
- Purpose: Node dev utilities (e.g. `scripts/gen-apple-secret.mjs` for Sign-in-with-Apple JWT generation).
- Generated: No. Committed: Yes.

**`android/`:**
- Purpose: Prebuilt native Android project output from Expo.
- Generated: Yes (via `expo prebuild`). Committed: Yes.

**`dist/`:**
- Purpose: Build output from `expo export`.
- Generated: Yes. Committed: Typically no (check `.gitignore`).

## Key File Locations

**Entry points:**
- `app/_layout.tsx` — Root layout, `AuthGuard`, stack screen registration
- `app/(tabs)/_layout.tsx` — Tab shell
- `supabase/functions/telegram-webhook/index.ts` — Bot HTTP entry

**Supabase client + types:**
- `lib/supabase.ts`
- `lib/types.ts`

**Auth + routing gate:**
- `app/_layout.tsx` (`AuthGuard` function)
- `lib/store.ts`
- `lib/biometric-auth.ts`

**Payment domain:**
- `lib/payments.ts` — Transition predicates + storage paths
- `supabase/migrations/001_initial_schema.sql` — CHECK constraint + unique `(tenant_id, month, year)`
- `supabase/functions/auto-confirm-payments/index.ts`
- `supabase/functions/mark-overdue/index.ts`
- `app/log-payment.tsx`
- `app/property/[id]/tenant/[tenantId]/payment/mark-paid.tsx`

**Invite domain:**
- `lib/invite.ts`
- `app/invite/[token].tsx`
- `supabase/functions/invite-redirect/index.ts`

**Bot pipeline:**
- `supabase/functions/telegram-webhook/index.ts`
- `supabase/functions/process-bot-message/index.ts`
- `supabase/functions/process-bot-message/pdf.ts`
- `app/(tabs)/bot/index.tsx` (in-app chat mirror)
- `lib/bot.ts`
- `hooks/useBotConversations.ts`

**PDF:**
- `lib/pdf.ts` (client, `expo-print`)
- `supabase/functions/process-bot-message/pdf.ts` (server, `pdf-lib`)

**Configuration:**
- `constants/config.ts` — Env + domain constants
- `app.json` — Expo config
- `eas.json` — Build profiles
- `babel.config.js`, `tsconfig.json`
- `supabase/config.toml` — Function `verify_jwt` settings

## Naming Conventions

**Files:**
- Screen files: lowercase with hyphens (`forgot-password.tsx`, `phone-verify.tsx`, `mark-paid.tsx`, `log-payment.tsx`).
- Dynamic route segments: square brackets (`[id].tsx`, `[token].tsx`, `[tenantId]/`).
- Layouts: `_layout.tsx` (underscore prefix = Expo Router convention).
- Route groups: `(name)/` parentheses, no URL segment contributed (`(auth)`, `(tabs)`).
- Components: PascalCase (`PropertyCard.tsx`, `PaymentStatusBadge.tsx`).
- Hooks: `useThing.ts` camelCase with `use` prefix.
- Lib modules: lowercase with hyphens or single word (`biometric-auth.ts`, `theme-context.tsx`, `payments.ts`, `pdf.ts`).
- Migrations: `NNN_description.sql` zero-padded 3-digit prefix + snake_case description.
- Edge Functions: directory per function, snake-cased kebab name (`auto-confirm-payments`, `telegram-webhook`).

**Directories:**
- App feature folders: lowercase kebab or single word (`property/`, `expenses/`, `tools/`, `notifications/`).
- Migrations/functions directories under `supabase/` — flat.

**Imports:**
- Path alias `@/...` is configured (see `tsconfig.json` and `babel.config.js`). Example: `import { supabase } from '@/lib/supabase';`.
- Edge Functions CANNOT import from `/lib` — they run in Deno and inline any shared helpers (see the "Inline helpers" section of `supabase/functions/process-bot-message/index.ts`).

## Where to Add New Code

**New screen:**
- Under a tab: `app/(tabs)/<tab>/<screen>.tsx` (and ensure parent `_layout.tsx` allows it).
- Modal or out-of-tab: `app/<feature>/<screen>.tsx`, then register in `app/_layout.tsx` Stack with `presentation: 'modal'` if modal.
- Nested under a resource: `app/property/[id]/<sub>/...`.

**New resource hook:**
- `hooks/use<Resource>.ts` — follow the `usePayments.ts` pattern: initial fetch + Realtime channel subscription + `{data, isLoading, error, refresh}` return shape.

**New reusable component:**
- `components/<PascalCase>.tsx`. Keep it presentational; never fetch data inside.

**New domain helper:**
- `lib/<module>.ts` — stateless functions, no React, no JSX.

**New DB migration:**
- `supabase/migrations/NNN_description.sql` with the next unused number. Include `CREATE TRIGGER` for `updated_at` if adding a new mutable table.
- Update `lib/types.ts` with the new TypeScript interface.

**New Edge Function:**
- `supabase/functions/<kebab-name>/index.ts`. Deno runtime — use `https://esm.sh/@supabase/supabase-js@2` and `Deno.env.get(...)`. Deploy with `supabase functions deploy <name>`. If invoked by another function, gate with a shared secret (see `BOT_INTERNAL_SECRET` pattern) — don't rely on `SUPABASE_SERVICE_ROLE_KEY` auto-injection.

**New constant / color:**
- `constants/colors.ts` for palette, `constants/config.ts` for env or runtime config.

## Special Directories

**`.planning/`:**
- Purpose: Planning artifacts (codebase maps, phase plans, debug notes, milestone archives).
- Generated: No.
- Committed: Yes.

**`android/`:**
- Purpose: Expo prebuild output for native Android.
- Generated: Yes (regeneratable). Committed: Yes on this project.

**`dist/`:**
- Purpose: `expo export` output.
- Generated: Yes. Committed: No (build artifact).

**`assets/`:**
- Purpose: Static images, icons, fonts loaded via `require()`. Preloaded in `app/_layout.tsx` (see `Asset.loadAsync([require('@/assets/icon.png')])`).

**`node_modules/`:**
- Managed by `npx expo install`. Not committed.

---

*Structure analysis: 2026-04-05*

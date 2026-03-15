# Dwella v2 Architecture

## Overview

Dwella is a cross-platform mobile app (React Native + Expo) for landlords and tenants to manage rental properties, track payments, and communicate via an AI-powered bot. The app uses Expo Router for file-based routing, Supabase for backend services (Auth, Postgres, Realtime, Storage, Edge Functions), and Zustand for state management.

## Architectural Patterns

### 1. Soft-Delete Pattern
- Properties and tenants are never hard-deleted; deleting sets `is_archived = TRUE`
- All queries must filter `WHERE is_archived = FALSE`
- Archiving a property cascades to archive all its tenants
- Payment rows use `ON DELETE RESTRICT`—they are permanent once created

### 2. Dual-Role System
- A single user can simultaneously be a landlord (owns properties) and a tenant (linked via invite)
- Role is contextual, determined by data, not a flag on the user profile
- The Properties tab renders two separate sections: "My Properties" (landlord) and "Invited Properties" (tenant)

### 3. Payment State Machine
```
pending → partial → paid → confirmed
        ↓
      overdue (from pending)

- pending: awaiting payment
- partial: some payment received
- paid: full payment received but unconfirmed
- confirmed: payment manually confirmed or auto-confirmed (>48h)
- overdue: pending payment past due_day
```

Auto-confirm runs hourly via Edge Function, promoting `paid` to `confirmed` after 48 hours with `auto_confirmed = TRUE`.

### 4. Bot Context & AI
- Claude API receives user's full properties/tenants list as context (cached 5 minutes)
- Claude returns structured JSON with `intent`, `entities`, `action_description`, `needs_confirmation`, and `reply`
- Edge Function executes DB action after optional user confirmation
- Supports multiple sources: in-app chat, Telegram, WhatsApp

### 5. Invite Flow
- Tenant invite generates a UUID token stored on the `tenants` row
- Deep link: `dwella://invite/{token}` opens `app/invite/[token].tsx`
- Accepting user's `id` is linked to `tenants.user_id` and `invite_status = 'accepted'`

### 6. Real-Time Subscriptions
- Supabase Realtime subscriptions in hooks keep payment and notification state live
- No manual refresh needed—data updates automatically when changes occur in the database

## Data Flow

### Frontend Data Flow
```
app/ (Expo Router screens)
  ↓
hooks/ (useProperties, useTenants, usePayments, useNotifications)
  ↓
lib/supabase.ts (Supabase client + Realtime subscriptions)
  ↓
lib/store.ts (Zustand auth + theme state)
  ↓
Supabase Postgres (with RLS policies)
```

### Bot Message Flow
```
User message (app, Telegram, or WhatsApp)
  ↓
supabase/functions/telegram-webhook/ or in-app UI
  ↓
supabase/functions/process-bot-message/
  ↓
Claude API (with user context + cached properties/tenants)
  ↓
Edge Function executes structured action (log_payment, confirm_payment, add_property, etc.)
  ↓
DB update via Supabase client
  ↓
Reply sent back to user
```

### Scheduled Background Tasks
```
| Function | Schedule | Action |
|---|---|---|
| auto-confirm-payments | Every hour | Confirm payments >48h old |
| mark-overdue | Daily midnight | Mark pending payments past due_day |
| send-reminders | Daily 9 AM | Remind tenants 3 days before/on/after due_day |
```

## Layers & Responsibilities

### Entry Point
- **`app/_layout.tsx`** — Root layout with auth guard, theme provider, PostHog analytics, notification handlers
- Orchestrates: theme setup, auth state, deep link routing, push notifications

### Authentication & State
- **`lib/store.ts`** (Zustand) — Auth state (session, user, loading), theme mode, onboarding status, UI lock state
- **`lib/supabase.ts`** — Supabase client config with implicit flow (avoids PKCE code-verifier issues in React Native)
- **`lib/theme-context.tsx`** — Theme provider + hooks (useTheme, useThemeToggle)

### Data Hooks
- **`hooks/useProperties.ts`** — Fetch user's owned + tenant-linked properties with Realtime fallback
- **`hooks/useTenants.ts`** — Fetch user's own tenants (landlord view) with Realtime updates
- **`hooks/usePayments.ts`** — Fetch + auto-generate payment rows, subscribe to changes
- **`hooks/useNotifications.ts`** — Fetch + subscribe to notifications
- **`hooks/useExpenses.ts`**, **`useAllExpenses.ts`** — Expense tracking
- **`hooks/useBotConversations.ts`** — Bot message history
- **`hooks/useAiNudge.ts`** — AI nudge cache with 6-hour TTL

### Business Logic & Utils
- **`lib/types.ts`** — TypeScript interfaces (User, Property, Tenant, Payment, Notification, Expense, etc.)
- **`lib/utils.ts`** — Format currency, date parsing, theme color adjustments
- **`lib/payments.ts`** — Payment status colors, labels, transitions, due date calculation, storage path helpers
- **`lib/invite.ts`** — Invite link generation, token validation, acceptance
- **`lib/notifications.ts`** — Push token registration (Expo Notifications)
- **`lib/bot.ts`** — Bot message sending, Telegram link token generation, WhatsApp account linking
- **`lib/expenses.ts`** — Expense helpers (category labels, validation)
- **`lib/pdf.ts`** — PDF generation (receipts, summaries)
- **`lib/biometric-auth.ts`** — PIN/biometric setup and verification
- **`lib/social-auth.ts`** — Google, Apple OAuth flows
- **`lib/analytics.ts`** — PostHog event tracking helpers
- **`lib/tour.ts`** — Tour guide step definitions
- **`lib/toast.ts`** — Toast notification helpers

### Components
- **UI Building Blocks**: `Skeleton.tsx`, `ListSkeleton.tsx`, `DashboardSkeleton.tsx`
- **Headers**: `DwellaHeader.tsx`, `DwellaHeaderTitle.tsx`, `TabHeader.tsx`
- **Navigation**: `CustomTabBar.tsx`, header buttons (LogPaymentTabButton, NotificationsHeaderButton, ProfileHeaderButton)
- **Cards**: `PropertyCard.tsx`, `TenantCard.tsx`, `GlassCard.tsx` (glassmorphism), `AnimatedCard.tsx`
- **Payment UI**: `PaymentStatusBadge.tsx`, `PaymentLedger.tsx`, `ProofUploader.tsx`
- **Forms & Dialogs**: `ConfirmDialog.tsx`
- **AI**: `AiInsightCard.tsx` (on dashboard)
- **Auth**: `SocialAuthButtons.tsx`
- **Chat**: `ChatBubble.tsx`
- **Other**: `EmptyState.tsx`, `ErrorBanner.tsx`, `ToastProvider.tsx`, `TourGuideCard.tsx`, `DwellaLogo.tsx`, `GradientButton.tsx`, `AssistantHeaderButton.tsx`

### Routing (Expo Router v3)
- **`app/(auth)/`** — Login, signup, phone verify, forgot password, lock screen (PIN entry)
- **`app/(tabs)/`** — Main tab navigation: dashboard, properties, bot, tools, profile
- **`app/property/`** — Property detail, create, tenant management, expenses, payments
- **`app/invite/[token].tsx`** — Deep link invite acceptance
- **`app/onboarding/index.tsx`** — User onboarding flow
- **`app/notifications/index.tsx`** — Push notification center
- **`app/tools/`** — AI tools (ai-insights, ai-search, smart-reminders)
- **`app/log-payment.tsx`** — Modal to log payment
- **`app/pin-setup.tsx`** — PIN setup screen
- **`app/payments/index.tsx`** — Aggregated payment ledger (landlord + tenant views)
- **`app/expenses/index.tsx`** — Expense overview
- **`app/reminders/index.tsx`** — Reminder management

### Theme System
- **`constants/theme.ts`** — Light & Dark theme definitions (colors, gradients, shadows)
- **`constants/typography.ts`** — Font sizes, weights, line heights
- **`constants/spacing.ts`** — Margin, padding, gap values
- **`constants/colors.ts`** — Re-exports from LightTheme for backward compatibility
- **`constants/config.ts`** — App configuration (Supabase URLs, API keys from env)

### Database & Backend
- **`supabase/migrations/`** — Schema migrations (001–015)
  - 001: Initial schema (users, properties, tenants, payments, notifications, bot_conversations)
  - 002: Storage bucket for payment-proofs
  - 003: Phase C (bot metadata, expense tracking)
  - 004–015: Iterative fixes, additions (push tokens, avatars, WhatsApp, etc.)

- **`supabase/functions/`** — Edge Functions (Deno + TypeScript)
  - `process-bot-message/` — Claude API integration, action execution
  - `telegram-webhook/` — Telegram bot webhook handler
  - `whatsapp-webhook/`, `whatsapp-send-code/` — WhatsApp integration
  - `auto-confirm-payments/` — Hourly auto-confirm logic
  - `mark-overdue/` — Daily overdue detection
  - `send-reminders/` — Daily reminder dispatch
  - `ai-insights/`, `ai-search/`, `ai-draft-reminders/` — AI tools
  - `invite-redirect/` — Smart link redirect (app → store)
  - `send-push/` — Push notification dispatcher

## Abstraction Layers

### Level 1: Database Access
- Raw Supabase client calls in hooks and Edge Functions
- No ORM; direct SQL-like queries via Supabase JS SDK

### Level 2: Data Fetching (Hooks)
- Encapsulate queries + state management
- Handle loading, error, subscription lifecycle
- Return typed results (e.g., `{ ownedProperties, tenantProperties, isLoading, error, refresh }`)

### Level 3: Business Logic (lib/)
- Pure functions: `getDueDate()`, `getStatusColor()`, `getInviteLink()`
- API helpers: `sendBotMessage()`, `acceptInvite()`, `registerPushToken()`
- No side effects beyond Supabase calls

### Level 4: Components
- Use hooks and lib functions
- Presentational; minimal business logic
- Reusable across screens

### Level 5: Screens (app/)
- Orchestrate multiple hooks
- Route-aware logic (e.g., invitation acceptance)
- Side effects (analytics, navigation)

## Key Dependencies

- **React Native 0.81.5** — Cross-platform mobile framework
- **Expo 54** — Managed workflow, native modules
- **Expo Router 6** — File-based routing
- **React Native Paper 5.12** — Material Design 3 UI components
- **Zustand 4.5** — Lightweight state management
- **Supabase JS 2.45** — Backend client (Auth, DB, Storage, Functions)
- **PostHog 4.37** — Product analytics (custom events)
- **Anthropic SDK** — Claude API (via Edge Functions)
- **TypeScript 5.3** — Static type checking

## Environment & Configuration

- **`.env.example`** — Template with required keys:
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  - `ANTHROPIC_API_KEY` (for Edge Functions)
  - Bot tokens (Telegram, WhatsApp)

- **`app.json`** — Expo config (app name, version, plugins, permissions)
- **`babel.config.js`** — Babel setup for Expo Router
- **`tsconfig.json`** — TypeScript strict mode
- **`.env`** — Local (git-ignored) overrides

## Testing & Type Safety

- **`npx tsc --noEmit`** — Full codebase type check
- No unit tests at time of writing; integration tests via Supabase
- RLS policies enforce data access at the database level

## Security & Access Control

### Row-Level Security (RLS)
- `users` table: own row only
- `properties` table: owned by user (owner_id) or tenant-linked
- `tenants` table: visible to property owner or linked user
- `payments` table: visible to property owner or linked tenant
- `notifications` table: own rows only
- `bot_conversations` table: own rows only

### Auth Flow
- Email/password (Supabase Auth)
- Google OAuth (via expo-auth-session)
- Apple OAuth (via expo-apple-authentication)
- Optional PIN/biometric lock (in-memory, not persisted to backend)

### Invite Tokens
- UUID-based, unique per tenant
- Verify `invite_status = 'pending'` before accepting
- One-time use; setting `user_id` is idempotent

## Caching Strategy

- **Auth state**: Zustand persist (AsyncStorage)
- **Theme mode**: Zustand persist (AsyncStorage)
- **Onboarding status**: Zustand persist (per-user ID)
- **Bot context**: 5-minute client-side cache (in Edge Function response)
- **AI nudges**: 6-hour TTL in `useAiNudge` hook
- **Property data**: Realtime subscriptions + manual refresh trigger via `bumpPropertyRefresh()`

## Error Handling

- Network errors: Caught at hook level, stored in `error` state
- Auth errors: Redirect to login via `AuthGuard` in `_layout.tsx`
- DB errors: RLS violations return 403; logged and shown to user
- Bot errors: Caught in `process-bot-message` and returned as reply
- Validation: TypeScript interfaces enforce shape at compile time

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Dwella is a cross-platform mobile app (React Native + Expo) for landlords and tenants to manage rental properties, track payments, and communicate via an AI-powered Telegram bot. Both user roles use the same app — role is contextual based on property ownership.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React Native, Expo SDK 51+ (managed workflow) |
| Routing | Expo Router (file-based) |
| Backend | Supabase (Auth, Postgres, Realtime, Storage, Edge Functions) |
| State | Zustand with persist middleware |
| AI Bot | Telegram Bot API + Claude API (`claude-sonnet-4-20250514`) |
| PDF | `react-native-html-to-pdf` or server-side Edge Function |

## Commands

```bash
# Install dependencies
npx expo install

# Start dev server
npx expo start

# Run on iOS/Android
npx expo run:ios
npx expo run:android

# Run Supabase locally
supabase start
supabase db reset          # Reset and apply all migrations
supabase functions serve   # Serve Edge Functions locally

# Deploy Edge Functions
supabase functions deploy telegram-webhook
supabase functions deploy process-bot-message
supabase functions deploy auto-confirm-payments
supabase functions deploy mark-overdue
supabase functions deploy send-reminders
supabase functions deploy generate-pdf

# Type checking
npx tsc --noEmit
```

## Architecture

### Data Flow

```
app/ (Expo Router screens)
  → hooks/ (useProperties, useTenants, usePayments)
  → lib/supabase.ts (Supabase client + Realtime subscriptions)
  → Supabase Postgres (with RLS)
```

```
Bot message (Telegram or in-app)
  → supabase/functions/telegram-webhook/
  → supabase/functions/process-bot-message/ (calls Claude API)
  → DB action via Supabase client
  → Reply sent back
```

### Key Architectural Decisions

**Soft-delete pattern:** Properties and tenants are never hard-deleted. Deleting sets `is_archived = TRUE`. All queries must filter `WHERE is_archived = FALSE`. Archiving a property cascades to archive all its tenants. Payment rows use `ON DELETE RESTRICT` — they are permanent.

**Dual-role system:** A user can be a landlord (owns properties) and a tenant (linked via invite) simultaneously. The Properties tab renders two separate sections for each role. Role is determined by data, not a profile flag.

**Payment state machine:** `pending → partial → paid → confirmed` (or `overdue` from `pending`). Auto-confirm runs hourly via Edge Function — promotes `paid` to `confirmed` after 48 hours with `auto_confirmed = TRUE`. Overdue detection runs daily at midnight.

**Bot context:** Claude API receives the user's full properties/tenants list as context with each message (cached 5 minutes). Claude returns structured JSON with `intent`, `entities`, `action_description`, and `needs_confirmation`. The Edge Function then executes the DB action.

**Invite flow:** Tenant invite generates a UUID token stored on the `tenants` row. The deep link `dwella://invite/{token}` opens `app/invite/[token].tsx`, which links the accepting user's `id` to `tenants.user_id` and sets `invite_status = 'accepted'`.

**Real-time:** Supabase Realtime subscriptions in hooks keep payment and notification state live without manual refresh.

### Database Tables

`users` → `properties` (owner_id) → `tenants` (property_id, user_id) → `payments` (tenant_id)

`notifications` references `users`, optionally `tenants` and `payments`.

`bot_conversations` logs all AI chat messages per user (used for context window in future turns).

### File Responsibilities

- `lib/supabase.ts` — Supabase client init
- `lib/types.ts` — TypeScript interfaces for all DB tables
- `lib/store.ts` — Zustand store (auth state, cached properties/tenants)
- `lib/payments.ts` — Payment status logic and transitions
- `lib/invite.ts` — Invite token generation and deep link handling
- `lib/pdf.ts` — PDF receipt and annual summary generation
- `constants/colors.ts` — Brand and status colors (see below)
- `supabase/migrations/` — All schema SQL in order

### Status Colors

```typescript
statusPending: '#94A3B8'   // Gray
statusPartial: '#F59E0B'   // Amber
statusPaid:    '#3B82F6'   // Blue (unconfirmed)
statusConfirmed: '#10B981' // Green
statusOverdue: '#EF4444'   // Red
primary: '#4F46E5'         // Indigo (brand)
```

### Supabase Storage

Payment proof images go to bucket `payment-proofs` at path: `{property_id}/{tenant_id}/{year}-{month}.jpg`. Access via signed URLs.

### Scheduled Edge Functions

| Function | Schedule | Action |
|---|---|---|
| `auto-confirm-payments` | Every hour | Confirm payments marked >48h ago |
| `mark-overdue` | Daily midnight | Mark pending payments past due_day as overdue |
| `send-reminders` | Daily 9 AM | Remind tenants 3 days before/on/3 days after due_day |

## Git Workflow

After every meaningful unit of work, commit and push to GitHub immediately. Never leave work uncommitted.

```bash
git add <specific-files>
git commit -m "type: short summary

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git push
```

Commit types: `feat`, `fix`, `refactor`, `chore`, `style`, `docs`. One logical change per commit — do not batch unrelated changes. Never force-push `main`.

**When to commit:** after adding a screen or component, after wiring up a Supabase query, after writing a migration, after implementing an Edge Function, after any bug fix or refactor, before and after large structural changes.

## Implementation Phases

The PRD defines 4 phases: A (Core + Auth + CRUD), B (Payments + Invites), C (AI Bot + PDFs + Notifications), D (Testing + Launch). Start from Phase A when building from scratch.

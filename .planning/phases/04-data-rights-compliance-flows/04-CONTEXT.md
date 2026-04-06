# Phase 4: Data Rights & Compliance Flows - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Make GDPR/DPDP/CCPA data-subject rights technically executable — erasure, access, portability, retention — end to end. This phase implements the database migrations, Edge Functions, and in-app flows that the privacy policy (Phase 2) promises and the in-app legal surfaces (Phase 5) will link to.

**In scope:** Account deletion flow, data export flow, erasure migration (ON DELETE RESTRICT removal), retention enforcement job, Telegram bot data gating (COMP-07).

**Out of scope:** In-app consent UI (Phase 5), store submission forms (Phase 6), security hardening (Phase 3 — already scoped), privacy policy text changes (Phase 2 — already drafted).

</domain>

<decisions>
## Implementation Decisions

### Erasure Strategy (COMP-02)
- **D-01:** Anonymize payment rows in place when a user requests deletion. `SET tenant_name = '[deleted]'`, NULL out all personal fields (notes, proof_url), keep amount_due, amount_paid, status, month, year, due_date intact. Satisfies Indian Income Tax Act 7-year financial record retention AND GDPR erasure simultaneously.
- **D-02:** Migration changes `payments.tenant_id` and `payments.property_id` from `ON DELETE RESTRICT` to `ON DELETE SET NULL` with a trigger that anonymizes personal fields before the NULL propagates.
- **D-03:** Same anonymization pattern for expenses table: NULL out user_id and description, keep amount, category, expense_date. Migration changes `expenses.property_id` from `ON DELETE RESTRICT` to `ON DELETE SET NULL`.
- **D-04:** Delete ALL Storage bucket files on account deletion: `payment-proofs/{property_id}/{tenant_id}/*`, `receipts/{payment_id}.pdf`, `avatars/{user_id}/*`. Payment rows retain anonymized amounts but proof images are permanently removed.
- **D-05:** Erase both roles — when a user deletes their account, cascade covers both their landlord data (owned properties, their tenants) AND their tenant linkages (where they accepted invites). Landlords who had this user as a tenant see anonymized `[deleted]` entries with payment history intact.

### Account Deletion UX (COMP-01)
- **D-06:** 30-day grace period. Mark account for deletion (`deletion_scheduled_at` timestamp on users table), disable login immediately, execute actual erasure after 30 days via the retention enforcement job. User can email the developer to cancel within the window.
- **D-07:** Confirmation UX: user must type the word "DELETE" in a text input before the delete button activates. Standard destructive-action pattern (GitHub, AWS).
- **D-08:** Button placement: bottom of existing profile screen (`app/(tabs)/profile/index.tsx`) in a "Danger Zone" section. Red text, clearly labeled "Delete Account". Discoverable but not prominent.
- **D-09:** Telegram bot cleanup: send a final Telegram message ("Your Dwella account has been scheduled for deletion. Your data will be permanently erased in 30 days.") then clear `telegram_chat_id` on the users row. Bot stops responding to this user immediately.
- **D-10:** On deletion request, sign the user out of all sessions (invalidate Supabase auth session). The 30-day grace period runs server-side only — user cannot log back in.

### Data Export (COMP-04)
- **D-11:** JSON format. Single JSON file with sections per table: profile, properties, tenants, payments, expenses, notifications, bot_conversations. Machine-readable, satisfies GDPR Art 20 portability ("structured, commonly used, machine-readable format").
- **D-12:** Delivery: new Edge Function (`export-user-data`) assembles the JSON, uploads to Supabase Storage (temporary bucket or path), returns a signed URL. App opens the URL in browser for download. URL expires in 1 hour.
- **D-13:** Export includes structured data only — no Storage files (payment proof images, receipt PDFs, avatars). JSON includes `proof_url` and `avatar_url` fields so user knows what files existed, but the actual binary files are not bundled. This meets Art 15 (right of access) without creating unwieldy bundles.
- **D-14:** Export button placement: same profile screen, above the Danger Zone section. "Export My Data" with a brief explanation ("Download a copy of all your data in JSON format").

### Retention Enforcement (COMP-03)
- **D-15:** New Edge Function `enforce-retention` called daily by pg_cron (alongside existing `mark-overdue` at midnight). All retention logic in one function.
- **D-16:** Retention windows (confirmed from Phase 2 D-08):
  - Archived properties/tenants: hard-delete after 30 days past `archived_at`
  - Bot conversations: hard-delete after 90 days past `created_at`
  - Notifications: hard-delete after 90 days past `created_at`
  - Payment rows: anonymize (same pattern as D-01) after 7 years past `created_at`
  - Push tokens: deleted on logout/account deletion only (not time-based)
  - Accounts marked for deletion (`deletion_scheduled_at`): execute full erasure cascade after 30 days
- **D-17:** Rate limit entries (from Phase 3 `rate_limit_entries` table): delete entries older than 1 hour. Piggyback on the daily retention job to keep the table small.

### Telegram Bot Data Gating (COMP-07)
- **D-18:** Users who have never linked a Telegram chat (`telegram_chat_id IS NULL` on users table) must have zero data sent to Telegram. Verify this is already true by reading `telegram-webhook` and `process-bot-message` entry gates — both functions key off `telegram_chat_id` to identify the user, so unlinked users are naturally excluded.
- **D-19:** Document this gating explicitly in the phase verification — it's likely already working by design, but COMP-07 requires explicit confirmation, not assumption.

### Claude's Discretion
- Exact anonymization trigger SQL (BEFORE DELETE vs AFTER DELETE, trigger function naming)
- Migration numbering (next available after 029)
- Edge Function error handling and logging patterns for export-user-data and enforce-retention
- Whether to add a `deletion_scheduled_at` column to existing users table or create a separate `account_deletions` table
- Exact JSON schema for the data export bundle
- Rate limit cleanup SQL (simple DELETE WHERE timestamp < NOW() - INTERVAL '1 hour')

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Database schema (erasure migration targets)
- `supabase/migrations/001_initial_schema.sql` lines 62-80 — `payments` table with `ON DELETE RESTRICT` on tenant_id (line 64) and property_id (line 65)
- `supabase/migrations/004_expenses.sql` line 3 — `expenses` table with `ON DELETE RESTRICT` on property_id
- `supabase/migrations/029_rate_limit_table.sql` — rate limit table (cleanup target)
- `lib/types.ts` — TypeScript interfaces for all DB tables (User, Property, Tenant, Payment, Expense, BotConversation, Notification)

### Existing cascade behavior (reference for erasure design)
- `supabase/migrations/001_initial_schema.sql` line 11 — `users.id REFERENCES auth.users(id) ON DELETE CASCADE`
- `supabase/migrations/001_initial_schema.sql` line 25 — `properties.owner_id ON DELETE CASCADE`
- `supabase/migrations/001_initial_schema.sql` line 42 — `tenants.property_id ON DELETE CASCADE`
- `supabase/migrations/001_initial_schema.sql` lines 87, 102 — notifications and bot_conversations `ON DELETE CASCADE`

### Profile screen (deletion + export button placement)
- `app/(tabs)/profile/index.tsx` — existing profile screen, sign-out at bottom; deletion and export buttons go here

### Telegram bot data flow (COMP-07 verification)
- `supabase/functions/telegram-webhook/index.ts` — entry point, keyed on telegram_chat_id
- `supabase/functions/process-bot-message/index.ts` — processes bot messages, builds tenant context

### Prior phase outputs
- `.planning/phases/02-legal-artifact-drafting/02-CONTEXT.md` D-07, D-08 — data categories and retention periods (this phase implements what Phase 2 documented)
- `.planning/legal/cross-border-transfers.md` — transfer analysis (informs export function jurisdiction)
- `.planning/legal/dpa-register.md` — sub-processor list

### Project-level
- `.planning/PROJECT.md` — critical blockers list, data flows, infrastructure
- `.planning/REQUIREMENTS.md` sections COMP-01, COMP-02, COMP-03, COMP-04, COMP-07
- `.planning/ROADMAP.md` Phase 4 section — goal + success criteria
- `.planning/codebase/CONCERNS.md` section 2 — GDPR erasure impossible due to ON DELETE RESTRICT

### External regulatory references (not in repo)
- GDPR Article 17 (right to erasure) — legal basis for account deletion
- GDPR Article 15 (right of access) — legal basis for data export
- GDPR Article 20 (right to data portability) — requires "structured, commonly used, machine-readable format"
- Indian Income Tax Act — 7-year financial record retention requirement
- Apple App Store Review Guidelines 5.1.1(v) — apps must offer account deletion

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `supabase/functions/process-bot-message/index.ts` lines 998-1002 — BOT_INTERNAL_SECRET auth pattern, reusable for internal Edge Function auth
- `lib/bot.ts` (`unlinkTelegram`) — existing Telegram unlink function, can be extended for deletion notification
- Existing Edge Function patterns (`auto-confirm-payments`, `mark-overdue`, `send-reminders`) — reference for new `enforce-retention` and `export-user-data` function structure
- `supabase/migrations/029_rate_limit_table.sql` — most recent migration, next migration number is 030

### Established Patterns
- Soft-delete via `is_archived = TRUE` with `archived_at` timestamp — retention job keys off `archived_at`
- Edge Functions use `Deno.env.get()` for secrets, `createClient` with service role key for admin operations
- Profile screen uses React Native Paper components, `GlassCard`, `GradientButton` — deletion UI should match
- `useAuthStore` Zustand store manages auth state — sign-out on deletion uses existing `signOut` pattern

### Integration Points
- `app/(tabs)/profile/index.tsx` — add "Export My Data" and "Delete Account" buttons
- `supabase/config.toml` — register new Edge Functions (`export-user-data`, `enforce-retention`)
- pg_cron — register `enforce-retention` daily schedule (alongside existing `mark-overdue` and `send-reminders`)
- `lib/types.ts` — may need `deletion_scheduled_at` field on User interface

</code_context>

<specifics>
## Specific Ideas

- The "type DELETE to confirm" pattern should use a case-insensitive match and show the button greyed out until the text matches
- The 30-day grace period message in Telegram should be clear that the user needs to email to cancel — provide the developer's email in the message
- Data export JSON should use ISO 8601 timestamps and include a `exported_at` metadata field at the top level
- Retention job should log what it deleted (count per category) for the solo developer's operational awareness

</specifics>

<deferred>
## Deferred Ideas

- **Email notification on deletion request** — requires email sending infrastructure not currently set up; Telegram notification + in-app confirmation is sufficient for v1.0
- **Self-service deletion cancellation via app** — user emails to cancel during grace period; in-app cancellation flow is a future enhancement
- **Data export including Storage files (ZIP bundle)** — deferred for complexity; JSON-only meets legal requirements
- **Granular data deletion (delete specific records vs whole account)** — GDPR doesn't require this level of granularity; whole-account deletion satisfies the right to erasure
- **Automated DSAR (Data Subject Access Request) tracking** — solo developer handles manually via email for v1.0

### Reviewed Todos (not folded)
None — no pending todos matched Phase 4.

</deferred>

---

*Phase: 04-data-rights-compliance-flows*
*Context gathered: 2026-04-06*

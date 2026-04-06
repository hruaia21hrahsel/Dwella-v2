# Phase 4: Data Rights & Compliance Flows - Research

**Researched:** 2026-04-06
**Domain:** GDPR/DPDP/CCPA data-subject rights implementation (erasure, access, portability, retention)
**Confidence:** HIGH

## Summary

This phase implements the technical backbone of data-subject rights: account deletion with anonymization, data export, retention enforcement, and Telegram bot data gating. The primary complexity lies in the database migration that replaces `ON DELETE RESTRICT` with an anonymization-on-delete pattern for payments and expenses, and the Edge Function that orchestrates cascading erasure across tables + Storage buckets when the 30-day grace period expires.

The existing Supabase infrastructure provides all needed primitives: `auth.admin.deleteUser()` for auth-level deletion, service-role Storage API for bulk file cleanup, and Deno Edge Functions for the export and retention jobs. PostgreSQL BEFORE DELETE triggers provide the anonymization mechanism. The codebase already uses the soft-delete pattern (`is_archived`) and has existing Edge Function patterns (`mark-overdue`, `send-reminders`) that serve as templates for the new `enforce-retention` and `export-user-data` functions.

**Primary recommendation:** Build the migration first (it unblocks everything else), then the `enforce-retention` Edge Function (it handles both retention cleanup AND deferred account deletion), then the app-side deletion and export UIs last.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Anonymize payment rows in place: `SET tenant_name = '[deleted]'`, NULL out personal fields, keep financial fields
- **D-02:** Migration changes `payments.tenant_id` and `payments.property_id` from `ON DELETE RESTRICT` to `ON DELETE SET NULL` with anonymization trigger
- **D-03:** Same anonymization pattern for expenses: NULL out user_id and description, keep amount/category/date. `expenses.property_id` from `ON DELETE RESTRICT` to `ON DELETE SET NULL`
- **D-04:** Delete ALL Storage bucket files on account deletion (payment-proofs, receipts, avatars)
- **D-05:** Erase both roles (landlord data + tenant linkages)
- **D-06:** 30-day grace period with `deletion_scheduled_at` timestamp, disable login immediately, execute erasure after 30 days
- **D-07:** Type "DELETE" confirmation pattern (case-insensitive)
- **D-08:** Button placement: bottom of profile screen in "Danger Zone" section
- **D-09:** Telegram bot cleanup: send final message, clear `telegram_chat_id`, bot stops responding immediately
- **D-10:** Sign out all sessions on deletion request (30-day grace runs server-side only)
- **D-11:** JSON format for data export with sections per table
- **D-12:** New Edge Function `export-user-data`, uploads to Storage, returns signed URL (1 hour expiry)
- **D-13:** Export includes structured data only, no Storage files (binary)
- **D-14:** Export button placement: profile screen above Danger Zone
- **D-15:** New Edge Function `enforce-retention` called daily by pg_cron
- **D-16:** Retention windows: archived 30d, bot/notifications 90d, payments 7y, push tokens on logout only, accounts 30d post-deletion-request
- **D-17:** Rate limit entries: delete older than 1 hour (piggyback on retention job)
- **D-18:** Telegram data gating: unlinked users (`telegram_chat_id IS NULL`) must have zero data sent to Telegram
- **D-19:** Document COMP-07 gating explicitly in verification

### Claude's Discretion
- Exact anonymization trigger SQL (BEFORE DELETE vs AFTER DELETE, function naming)
- Migration numbering (next available after 029)
- Edge Function error handling and logging patterns
- Whether `deletion_scheduled_at` goes on users table or separate table
- Exact JSON schema for data export bundle
- Rate limit cleanup SQL

### Deferred Ideas (OUT OF SCOPE)
- Email notification on deletion request
- Self-service deletion cancellation via app
- Data export including Storage files (ZIP bundle)
- Granular data deletion (specific records vs whole account)
- Automated DSAR tracking
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COMP-01 | User-initiated account deletion flow | Supabase `auth.admin.deleteUser()` API verified, 30-day grace period pattern documented, profile screen integration point identified |
| COMP-02 | Database migration removes `ON DELETE RESTRICT` on payments | PostgreSQL BEFORE DELETE trigger anonymization pattern verified, FK constraints mapped, UNIQUE constraint NULL behavior confirmed |
| COMP-03 | Data retention policy enforced via scheduled job | `enforce-retention` Edge Function pattern based on existing `mark-overdue`; retention windows locked in CONTEXT.md D-16 |
| COMP-04 | User data export as JSON bundle | `export-user-data` Edge Function pattern, Supabase Storage signed URL for delivery, table inventory for export |
| COMP-07 | Telegram bot data gating for unlinked users | Verified: `telegram-webhook` keys off `telegram_chat_id` to identify users -- unlinked users naturally excluded; needs explicit documentation |
</phase_requirements>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | 2.x | Client + admin API for auth deletion, storage ops | Already used throughout project [VERIFIED: codebase] |
| PostgreSQL 17 | 17 | BEFORE DELETE triggers, anonymization, retention queries | Already configured in supabase/config.toml [VERIFIED: config.toml major_version = 17] |
| Deno (Edge Functions) | std@0.177.0 | Runtime for export-user-data and enforce-retention | Already used by all existing Edge Functions [VERIFIED: codebase] |
| React Native Paper | existing | UI components for deletion/export buttons | Already used in profile screen [VERIFIED: codebase] |

### Supporting (already in project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| expo-router | existing | Navigation for any new screens (none expected) | N/A -- all UI goes on existing profile screen |
| zustand | existing | Auth state management (signOut on deletion) | Deletion flow uses existing `clearAuth()` |

### No New Dependencies Required
This phase requires zero new npm packages or Deno imports. Everything needed is already available via Supabase client APIs and PostgreSQL built-in trigger functionality.

## Architecture Patterns

### Recommended Implementation Order
```
1. Migration 030: Anonymization triggers + FK changes
2. Migration 031: Add deletion_scheduled_at to users table
3. Edge Function: enforce-retention (handles both retention + deferred deletion)
4. Edge Function: export-user-data
5. Profile screen: Export My Data button + flow
6. Profile screen: Delete Account Danger Zone + flow
7. COMP-07 verification (read-only audit of telegram-webhook)
```

### Pattern 1: BEFORE DELETE Trigger for Anonymization
**What:** A PostgreSQL trigger that intercepts DELETE on the `tenants` table, anonymizes linked payment and expense rows, then allows the cascade to proceed. [VERIFIED: PostgreSQL docs]
**When to use:** When rows must be retained for legal reasons but personal data must be erased.
**Critical detail:** The trigger fires on `tenants` (not payments), because the cascade path is `users -> properties -> tenants -> payments`. When a tenant row is about to be deleted (via cascade from property deletion), the trigger anonymizes all linked payment rows first, then the FK `ON DELETE SET NULL` nullifies the `tenant_id` on those payment rows.

**Example:**
```sql
-- Source: PostgreSQL trigger docs + CONTEXT.md D-01/D-02
CREATE OR REPLACE FUNCTION anonymize_tenant_payments()
RETURNS TRIGGER AS $$
BEGIN
  -- Anonymize all payment rows linked to this tenant
  UPDATE payments
  SET notes = NULL,
      proof_url = NULL
  WHERE tenant_id = OLD.id;
  
  -- Anonymize all expense rows linked to this tenant's property
  -- (handled separately by property-level trigger)
  
  RETURN OLD; -- Allow the DELETE to proceed
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_anonymize_tenant_payments
  BEFORE DELETE ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION anonymize_tenant_payments();
```

**Important:** `tenant_name` lives on the `tenants` row itself (which will be deleted in cascade), NOT on the payments row. The payments table has no `tenant_name` column -- it references tenant via `tenant_id` FK. So payment rows only need `notes` and `proof_url` nullified; the tenant name disappears when the tenant row is deleted and `tenant_id` becomes NULL. [VERIFIED: 001_initial_schema.sql lines 62-80]

### Pattern 2: Property-Level Anonymization Trigger
**What:** A BEFORE DELETE trigger on `properties` that anonymizes expense rows before the property is deleted.
**Why separate:** Expenses reference `property_id` directly (not through tenants), so the property deletion cascade needs its own trigger.

```sql
-- Source: CONTEXT.md D-03 + 004_expenses.sql
CREATE OR REPLACE FUNCTION anonymize_property_expenses()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE expenses
  SET description = NULL,
      user_id = NULL
  WHERE property_id = OLD.id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_anonymize_property_expenses
  BEFORE DELETE ON properties
  FOR EACH ROW
  EXECUTE FUNCTION anonymize_property_expenses();
```

### Pattern 3: Deferred Deletion via Retention Job
**What:** The `enforce-retention` Edge Function checks for `deletion_scheduled_at` that is 30+ days old, then triggers the full cascade by deleting the user from `auth.users` (which cascades through `public.users -> properties -> tenants -> payments`).
**Why:** The 30-day grace period runs entirely server-side. The user is signed out immediately but data persists for 30 days.

```typescript
// Source: Supabase docs + existing mark-overdue pattern
// Pseudocode for enforce-retention
const { data: expiredUsers } = await supabase
  .from('users')
  .select('id')
  .not('deletion_scheduled_at', 'is', null)
  .lt('deletion_scheduled_at', thirtyDaysAgo.toISOString());

for (const user of expiredUsers) {
  // 1. Delete Storage files (payment-proofs, receipts, avatars)
  // 2. Delete from auth.users (cascades through public.users)
  await supabaseAdmin.auth.admin.deleteUser(user.id);
  // Cascade: auth.users -> public.users (ON DELETE CASCADE)
  //          -> properties (ON DELETE CASCADE)
  //          -> tenants (ON DELETE CASCADE, triggers anonymize payments)
  //          -> payments (ON DELETE SET NULL, already anonymized by trigger)
}
```

### Pattern 4: Edge Function for Data Export
**What:** `export-user-data` collects all user data across tables, assembles JSON, uploads to Storage, returns signed URL.
**Auth:** Uses the user's JWT (from app) to identify who is requesting, but uses service_role to read across all tables (RLS would limit visibility).

### Anti-Patterns to Avoid
- **Hard-deleting payments:** Financial records must be retained for 7 years per Indian Income Tax Act. Anonymize, never delete.
- **Client-side deletion cascade:** Never orchestrate multi-table deletion from the app. The Edge Function + database triggers handle everything server-side.
- **Storing deletion state in app:** The 30-day grace period is server-side only. The app just calls the Edge Function and signs out.
- **Using `ON DELETE CASCADE` for payments:** This would destroy financial records. `ON DELETE SET NULL` + anonymization trigger is the correct pattern.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auth user deletion | Custom auth table cleanup | `supabase.auth.admin.deleteUser(id)` | Handles auth.users, sessions, MFA factors automatically [CITED: supabase.com/docs/reference/javascript/auth-admin-deleteuser] |
| Session invalidation | Manual token revocation | `supabase.auth.admin.deleteUser()` or `signOut({ scope: 'global' })` | Revokes all refresh tokens across devices [CITED: supabase.com/docs/guides/auth/signout] |
| Storage file listing | Manual path construction | `supabase.storage.from(bucket).list(prefix)` | Handles pagination, returns proper file objects [CITED: supabase.com/docs/reference/javascript/storage-from-list] |
| Storage file deletion | One-by-one removal | `supabase.storage.from(bucket).remove(paths[])` | Batch delete up to 1000 files per call [CITED: supabase.com/docs/reference/javascript/storage-from-remove] |
| Cron scheduling | Custom timer logic | pg_cron (already in use for mark-overdue) | Reliable, managed, already proven in this project [VERIFIED: codebase] |

## Common Pitfalls

### Pitfall 1: FK Cascade Order and Trigger Timing
**What goes wrong:** The BEFORE DELETE trigger on `tenants` must fire BEFORE the FK `ON DELETE SET NULL` nullifies `tenant_id` on payments. If the trigger fires too late, `tenant_id` is already NULL and the trigger can't find which payments to anonymize.
**Why it happens:** Confusion about trigger timing vs FK action timing.
**How to avoid:** BEFORE DELETE triggers fire before FK actions. This is correct by design. The trigger uses `OLD.id` to find payments, anonymizes them, then returns OLD to allow the delete. The FK SET NULL then fires, nullifying `tenant_id`. [VERIFIED: PostgreSQL docs on trigger timing]
**Warning signs:** Payment rows with NULL `tenant_id` but non-NULL `notes`/`proof_url` after a deletion test.

### Pitfall 2: expenses.user_id Has No ON DELETE Clause
**What goes wrong:** `expenses.user_id` references `users(id)` with no explicit `ON DELETE` clause, which defaults to `NO ACTION` (equivalent to RESTRICT). This will block user deletion.
**Why it happens:** Migration 004 forgot to specify ON DELETE behavior for `user_id`.
**How to avoid:** The migration must ALTER `expenses.user_id` to `ON DELETE SET NULL` alongside the `property_id` change. [VERIFIED: 004_expenses.sql line 4]
**Warning signs:** `violates foreign key constraint "expenses_user_id_fkey"` error during deletion.

### Pitfall 3: Storage Cleanup Must Happen Before Auth Deletion
**What goes wrong:** After `auth.admin.deleteUser()` cascades and deletes properties/tenants, the property_id and tenant_id values needed to construct Storage paths are gone.
**Why it happens:** The cascade destroys the lookup data needed for Storage path construction.
**How to avoid:** Query all property_ids, tenant_ids, and payment_ids BEFORE triggering the cascade. Build Storage paths first, delete files, THEN delete the auth user.
**Warning signs:** Orphaned files in Storage buckets after account deletion.

### Pitfall 4: UNIQUE Constraint on Payments After SET NULL
**What goes wrong:** Concern that `UNIQUE (tenant_id, month, year)` might conflict when multiple payments have `tenant_id = NULL`.
**Why it happens:** Misunderstanding of SQL NULL uniqueness semantics.
**How to avoid:** PostgreSQL treats NULL as distinct in UNIQUE constraints. Multiple rows with `(NULL, 1, 2024)` are allowed. No migration change needed for this constraint. [VERIFIED: PostgreSQL docs -- NULLs are not considered equal in unique constraints]
**Warning signs:** None -- this is a non-issue but worth documenting to prevent unnecessary work.

### Pitfall 5: Notifications and Bot Conversations Already Cascade
**What goes wrong:** Writing redundant cleanup code for notifications and bot_conversations.
**Why it happens:** Not checking existing FK behavior.
**How to avoid:** Both tables already have `ON DELETE CASCADE` from `users(id)`. When the user is deleted from `auth.users` -> cascades to `public.users` -> cascades to notifications and bot_conversations. No additional cleanup needed for these tables. [VERIFIED: 001_initial_schema.sql lines 86-88, 100-102]
**Warning signs:** Spending time on code that does nothing.

### Pitfall 6: Tenant Photo Storage Cleanup
**What goes wrong:** Tenant photos (stored via `photo_url` field on tenants table) may be orphaned in Storage.
**Why it happens:** Tenant photos were added in migration 012 and may use a Storage bucket or external URL.
**How to avoid:** Check where `photo_url` files are stored and include them in the cleanup list.
**Warning signs:** Orphaned tenant photo files after deletion.

## Code Examples

### Account Deletion Request (Client-Side)
```typescript
// Source: CONTEXT.md D-06, D-07, D-10 + existing profile screen patterns
async function handleDeleteAccount(userId: string) {
  // 1. Call Edge Function to mark for deletion
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/request-account-deletion`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ user_id: userId }),
  });
  
  // 2. Sign out locally
  await supabase.auth.signOut();
  useAuthStore.getState().clearAuth();
}
```

### Enforce-Retention Edge Function Structure
```typescript
// Source: existing mark-overdue pattern + CONTEXT.md D-15, D-16
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (_req) => {
  const results = {
    archived_deleted: 0,
    bot_conversations_deleted: 0,
    notifications_deleted: 0,
    rate_limits_cleaned: 0,
    accounts_erased: 0,
  };

  // 1. Archived properties/tenants > 30 days
  // 2. Bot conversations > 90 days
  // 3. Notifications > 90 days  
  // 4. Rate limit entries > 1 hour
  // 5. Accounts with deletion_scheduled_at > 30 days ago
  //    -> Delete Storage files first, then auth.admin.deleteUser()

  console.log('enforce-retention results:', results);
  return new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

### Storage Cleanup Helper
```typescript
// Source: Supabase Storage docs
async function cleanupUserStorage(
  supabase: SupabaseClient,
  propertyIds: string[],
  tenantIds: string[],
  paymentIds: string[],
  userId: string,
) {
  // Payment proofs: payment-proofs/{property_id}/{tenant_id}/*
  for (const propId of propertyIds) {
    for (const tenId of tenantIds) {
      const { data: files } = await supabase.storage
        .from('payment-proofs')
        .list(`${propId}/${tenId}`);
      if (files?.length) {
        const paths = files.map(f => `${propId}/${tenId}/${f.name}`);
        await supabase.storage.from('payment-proofs').remove(paths);
      }
    }
  }

  // Receipts: receipts/{payment_id}.pdf
  if (paymentIds.length) {
    const receiptPaths = paymentIds.map(id => `${id}.pdf`);
    await supabase.storage.from('receipts').remove(receiptPaths);
  }

  // Avatars: avatars/{user_id}/*
  const { data: avatarFiles } = await supabase.storage
    .from('avatars')
    .list(userId);
  if (avatarFiles?.length) {
    const avatarPaths = avatarFiles.map(f => `${userId}/${f.name}`);
    await supabase.storage.from('avatars').remove(avatarPaths);
  }
}
```

### Data Export JSON Schema
```typescript
// Source: CONTEXT.md D-11
interface DataExportBundle {
  exported_at: string; // ISO 8601
  user: {
    id: string;
    email: string;
    full_name: string | null;
    phone: string | null;
    avatar_url: string | null;
    created_at: string;
  };
  properties: Array<{/* all fields */}>;
  tenants: Array<{/* all fields */}>;
  payments: Array<{/* all fields */}>;
  expenses: Array<{/* all fields */}>;
  notifications: Array<{/* all fields */}>;
  bot_conversations: Array<{/* all fields */}>;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hard-delete user data | Anonymize + retain financial records | GDPR 2018 + India IT Act | Must keep payment amounts 7 years |
| Immediate deletion | 30-day grace period | Apple App Store 2022 | Users can request cancellation |
| `ON DELETE RESTRICT` | `ON DELETE SET NULL` + trigger | This migration | Unblocks GDPR erasure |
| Manual DSAR response | In-app self-service export | GDPR Art 15/20 | Reduces manual work for solo dev |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `supabase.auth.admin.deleteUser()` cascades to `auth.users` which cascades to `public.users` via the `ON DELETE CASCADE` FK | Architecture Patterns | If admin delete doesn't trigger cascade, entire erasure flow breaks -- needs testing |
| A2 | pg_cron is available on the production Supabase instance (not just local) | Architecture Patterns | If pg_cron unavailable, need alternative scheduling (e.g., external cron hitting the Edge Function URL) |
| A3 | `storage.from(bucket).list(prefix)` works with service_role key to list all files under a path | Code Examples | If listing requires different API, Storage cleanup code changes |
| A4 | Tenant `photo_url` uses an external URL or the avatars bucket, not a separate bucket | Pitfall 6 | May miss cleaning up tenant photos if stored in an undiscovered bucket |

## Open Questions

1. **Does `auth.admin.deleteUser()` trigger the `ON DELETE CASCADE` on `public.users`?**
   - What we know: The FK `public.users.id REFERENCES auth.users(id) ON DELETE CASCADE` exists in migration 001. Supabase docs confirm admin delete removes from `auth.users`.
   - What's unclear: Whether the admin API uses a direct `DELETE` that triggers the FK cascade, or a separate mechanism.
   - Recommendation: Test locally with `supabase db reset` + a test user deletion before relying on this in production. HIGH confidence this works based on standard PostgreSQL FK behavior, but must verify. [ASSUMED]

2. **Where are tenant photos stored?**
   - What we know: `tenants.photo_url` was added in migration 012. The profile screen uses the `avatars` bucket for user photos.
   - What's unclear: Whether tenant photos use the same `avatars` bucket, a different bucket, or external URLs.
   - Recommendation: Grep for `photo_url` upload code to determine Storage path. Include in cleanup if applicable.

3. **pg_cron availability in production Supabase**
   - What we know: CLAUDE.md references pg_cron schedules for existing functions. OPS-02 in REQUIREMENTS.md says to verify pg_cron registration.
   - What's unclear: Whether pg_cron is actually enabled on the production Supabase project.
   - Recommendation: Plan assumes pg_cron is available (it is on Supabase Pro plan). Fallback: call `enforce-retention` via an external scheduler hitting the Edge Function URL.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None -- zero test infrastructure exists per `.planning/codebase/TESTING.md` |
| Config file | None |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COMP-01 | Account deletion marks user for deletion, signs out | manual | `supabase db reset` + manual app test | N/A |
| COMP-02 | ON DELETE SET NULL + trigger anonymizes payments | manual | `supabase db reset` + SQL test script | N/A |
| COMP-03 | Retention job deletes/anonymizes expired data | manual | `supabase functions serve enforce-retention` + invoke | N/A |
| COMP-04 | Export produces valid JSON with all user data | manual | `supabase functions serve export-user-data` + invoke | N/A |
| COMP-07 | Unlinked users have zero data sent to Telegram | manual | Code review of telegram-webhook entry gates | N/A |

### Sampling Rate
- **Per task commit:** Manual verification via `supabase db reset` and local Edge Function invocation
- **Per wave merge:** Full manual walkthrough of deletion + export flows
- **Phase gate:** All 5 COMP requirements verified manually before `/gsd-verify-work`

### Wave 0 Gaps
- No test infrastructure exists. All verification is manual for this phase.
- A SQL test script for the anonymization trigger would be valuable but is not a blocker.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `auth.admin.deleteUser()` for auth cleanup; `signOut({ scope: 'global' })` for session invalidation |
| V3 Session Management | yes | All sessions invalidated on deletion request via Supabase auth |
| V4 Access Control | yes | Export Edge Function must verify requesting user matches export target; deletion must verify user identity |
| V5 Input Validation | yes | "DELETE" confirmation text validated client-side; Edge Functions validate user_id parameter |
| V6 Cryptography | no | No custom crypto -- Supabase handles signed URLs |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR on export (user A exports user B's data) | Information Disclosure | Edge Function extracts user_id from JWT, not from request body |
| IDOR on deletion (user A deletes user B) | Tampering | Edge Function extracts user_id from JWT, not from request body |
| Incomplete erasure (PII remains in backups) | Information Disclosure | Document that Supabase backups are outside app control; anonymization covers live data |
| Race condition: user logs in during 30-day window | Elevation of Privilege | `deletion_scheduled_at` check in auth middleware or RLS policy blocks login |
| Orphaned Storage files | Information Disclosure | Storage cleanup runs BEFORE auth cascade; logged for audit |

## Sources

### Primary (HIGH confidence)
- Migration files 001, 004, 010, 014, 027, 029 -- verified FK constraints, table structures, Storage buckets
- `app/(tabs)/profile/index.tsx` -- verified existing UI structure, component patterns
- `supabase/functions/telegram-webhook/index.ts` -- verified Telegram data gating (telegram_chat_id lookup)
- `supabase/functions/mark-overdue/index.ts` -- verified Edge Function pattern for scheduled jobs
- `lib/types.ts` -- verified TypeScript interfaces for all tables
- `lib/bot.ts` -- verified existing `unlinkTelegram` function

### Secondary (MEDIUM confidence)
- [Supabase auth.admin.deleteUser() docs](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser) -- API signature verified
- [Supabase signOut docs](https://supabase.com/docs/guides/auth/signout) -- global scope behavior verified
- [Supabase Storage remove docs](https://supabase.com/docs/reference/javascript/storage-from-remove) -- batch delete up to 1000 files
- [PostgreSQL BEFORE DELETE trigger docs](https://www.postgresql.org/docs/current/plpgsql-trigger.html) -- trigger timing verified

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing Supabase primitives
- Architecture: HIGH -- PostgreSQL trigger + Edge Function patterns are well-documented and already proven in this codebase
- Pitfalls: HIGH -- FK constraints verified directly in migration files, cascade behavior confirmed from schema

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stable domain, no fast-moving dependencies)

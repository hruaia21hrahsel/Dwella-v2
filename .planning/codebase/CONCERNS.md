# Codebase Concerns & Technical Debt

Last Updated: March 15, 2026
Status: Phase A + B + AI Overhaul + Premium UI Redesign (Complete)

---

## Critical Issues

### 1. TypeScript Compilation Error
**Severity:** HIGH
**File:** `app/_layout.tsx` (line 243)
**Issue:** PostHog autocapture configuration uses invalid property `captureLifecycleEvents`
```typescript
autocapture={{ captureTouches: true, captureLifecycleEvents: true, captureScreens: true }}
// Error: Object literal may only specify known properties, and 'captureLifecycleEvents' does not exist
```
**Impact:** App will not compile. TypeScript validation fails with `npx tsc --noEmit`.
**Fix:** Remove `captureLifecycleEvents` or use correct property name from PostHog v4.37.3 API.

---

## Security Concerns

### 2. Weak UUID Token Generation (WhatsApp Verification)
**Severity:** MEDIUM
**File:** `lib/bot.ts` (lines 39-44)
**Issue:** Uses `Math.random()` instead of cryptographically secure random for GUID generation:
```typescript
function randomUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;  // ← WEAK
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
```
**Impact:** Generated tokens for Telegram linking are predictable. An attacker could forge valid tokens.
**Fix:** Use `expo-crypto` or native cryptographic APIs instead:
```typescript
import * as Crypto from 'expo-crypto';
const uuid = Crypto.randomUUID();
```

### 3. Weak Verification Code Generation (WhatsApp)
**Severity:** MEDIUM
**File:** `lib/bot.ts` (line 79)
**Issue:** 6-digit WhatsApp verification code uses `Math.random()`:
```typescript
const code = String(Math.floor(100000 + Math.random() * 900000));
```
**Impact:** Codes are predictable, reducing brute-force attack difficulty.
**Fix:** Use a cryptographically secure random source.

### 4. Deep Link Token Leakage in Logs
**Severity:** MEDIUM
**File:** `supabase/functions/invite-redirect/index.ts` (line 25)
**Issue:** Token is extracted from query params but displayed in HTML hint (line 187):
```html
<code>${token}</code>
```
**Impact:** If a user shares the page (screenshot, cache), the token is visible. Also, server logs may contain full URLs with tokens.
**Mitigation:** The token is already in the URL they're visiting, so this is acceptable. However, consider warning users about sharing.

### 5. Type Casting with `as any` in Supabase Auth
**Severity:** LOW
**File:** `lib/supabase.ts` (line 24)
**Issue:** Storage config uses `as any` to bypass type checks:
```typescript
auth: {
  storage: authStorage as any,  // ← TYPE BYPASS
  // ...
}
```
**Impact:** Reduces type safety. Storage object may not match expected interface.
**Fix:** Use proper typing for AsyncStorage or localStorage based on platform.

---

## Data Integrity Issues

### 6. Payment Deletion Prevention Not Enforced Everywhere
**Severity:** MEDIUM
**File:** `supabase/migrations/001_initial_schema.sql` (lines 64-65)
**Issue:** Payments have `ON DELETE RESTRICT` but no explicit check that ensures property/tenant deletion cannot cascade to archived state without handling payments.
```sql
tenant_id  UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE RESTRICT,
```
**Impact:** Archiving a property tries to cascade to tenants, but payment references will block the operation if not handled. Users may get confusing "cannot delete tenant" errors.
**Fix:** Before deleting/archiving tenant, app should verify no unpaid/pending payments exist. Document this constraint.

### 7. Soft Delete Pattern Not Consistently Applied
**Severity:** MEDIUM
**Files:** Multiple screens and Edge Functions
**Issue:** Soft-delete checks (`is_archived = FALSE`) are scattered throughout. No centralized query builder or view to enforce this.
**Examples:**
- `app/(tabs)/properties/index.tsx` does manual `.eq('is_archived', false)`
- `supabase/functions/send-reminders/index.ts` manually filters archived tenants
- Some screens may not filter archived data in all queries

**Impact:** Risk of accidentally including archived records in aggregations, reports, or suggestions.
**Fix:** Create a database view or Postgres function to safely query active records:
```sql
CREATE VIEW public.active_tenants AS
  SELECT * FROM tenants WHERE is_archived = FALSE;
```

### 8. Payment State Machine Not Enforced at DB Level
**Severity:** MEDIUM
**File:** Database schema
**Issue:** Payment state transitions (`pending → partial → paid → confirmed → overdue`) are enforced only in application logic, not at the database level.
```sql
status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid', 'confirmed', 'overdue'))
```
**Impact:** Invalid transitions could be inserted via direct DB access or malicious Edge Functions.
**Fix:** Add a trigger that validates transitions:
```sql
CREATE TRIGGER validate_payment_transition
BEFORE UPDATE ON payments
FOR EACH ROW EXECUTE validate_state_transition();
```

---

## Performance & Scalability

### 9. N+1 Query Problem in Dashboard
**Severity:** MEDIUM
**File:** `hooks/useDashboard.ts` (implied from pattern in other hooks)
**Issue:** Dashboard loads all properties, then for each property loads all tenants, then for each tenant loads all payments. Multiple sequential queries.
**Impact:** Dashboard slow to load for users with many properties/tenants.
**Fix:** Use Postgres joins in a single query:
```typescript
.from('payments')
.select('*, tenants(*, properties(*))')
.eq('year', selectedYear)
.order('month', { ascending: false })
```

### 10. Realtime Subscriptions Not Cleaned Up Properly
**Severity:** LOW
**File:** `hooks/useProperties.ts` (line 77), `hooks/usePayments.ts` (line 64)
**Issue:** Cleanup function removes channel but doesn't explicitly unsubscribe before removal:
```typescript
return () => { supabase.removeChannel(channel); };
```
**Impact:** Memory leak if channel unsubscribe fails silently.
**Fix:** Ensure subscription is destroyed:
```typescript
return () => {
  supabase.removeChannel(channel);
  // or explicitly: channel.unsubscribe();
};
```

### 11. PostHog Autocapture May Impact Performance
**Severity:** LOW
**File:** `app/_layout.tsx` (line 243)
**Issue:** PostHog is configured with aggressive autocapture:
```typescript
autocapture={{ captureTouches: true, captureScreens: true }}
```
**Impact:** Every touch and screen change is captured, which can slow down rendering on low-end devices.
**Fix:** Disable aggressive autocapture in production or use sampling.

---

## Error Handling & Resilience

### 12. Incomplete Error Handling in Edge Functions
**Severity:** MEDIUM
**Files:** Multiple Edge Functions
**Issue:** Many Edge Functions catch errors but return generic 500 responses without distinguishing error types:
```typescript
} catch (err) {
  console.error('...', err);
  return new Response(JSON.stringify({ error: error.message }), { status: 500 });
}
```
**Impact:** Clients cannot determine if error is transient (retry) or fatal (user error).
**Fix:** Return appropriate HTTP status codes:
- 400 for invalid input
- 404 for not found
- 500 for server error
- 503 for service unavailable (transient)

### 13. Silent Failures in Auth State Initialization
**Severity:** MEDIUM
**File:** `app/_layout.tsx` (lines 94-114)
**Issue:** If Supabase user upsert or fetch fails, app falls back to minimal `fallbackUser`:
```typescript
try {
  await supabase.from('users').upsert(...);
  const { data } = await supabase.from('users').select('*').single();
  resolvedUser = data ?? fallbackUser;
} catch {
  // If DB queries fail, still provide a minimal user so hooks don't stall
  setUser(fallbackUser as any);
}
```
**Impact:** User state may be incomplete, missing Telegram/WhatsApp linking data. User won't know their data failed to sync.
**Fix:** Show a banner or toast if user profile sync fails. Allow retry.

### 14. No Retry Logic for Transient Network Failures
**Severity:** MEDIUM
**Files:** All API calls
**Issue:** All fetch calls assume success or throw immediately. No exponential backoff or retry.
**Example:** `lib/bot.ts` - `sendBotMessage()` has no retry.
**Impact:** Single network hiccup causes user-facing errors.
**Fix:** Implement exponential backoff with max retries (3-5 times) for transient errors.

### 15. Insufficient Logging in Production
**Severity:** LOW
**Files:** Scattered throughout
**Issue:** Only `console.error()` statements in a few places (`lib/supabase.ts`, `app/reminders/index.tsx`). No structured logging or error tracking.
**Impact:** Hard to debug production issues without user reports.
**Fix:** Integrate Sentry or similar error tracking to capture all errors.

---

## Type Safety

### 16. Unsafe Type Assertions in Templates
**Severity:** LOW
**File:** `supabase/functions/send-reminders/index.ts` (line 35, 47)
**Issue:** Uses `as any` to cast typed query results:
```typescript
const daysUntilDue = (tenant as any).due_day - todayDay;
const propertyName = (tenant as any).properties?.name ?? 'your property';
```
**Impact:** No type checking for nested properties.
**Fix:** Define proper TypeScript interfaces for query results.

### 17. Generic `Record<string, unknown>` Metadata
**Severity:** LOW
**File:** `lib/types.ts` (line 109)
**Issue:** Bot conversation metadata is completely untyped:
```typescript
metadata?: Record<string, unknown> | null;
```
**Impact:** No structure for storing action details. Inconsistent serialization.
**Fix:** Define specific metadata schema.

---

## API & Integration

### 18. Placeholder App Store URLs
**Severity:** HIGH (Pre-Launch)
**File:** `supabase/functions/invite-redirect/index.ts` (lines 20-21)
**Issue:** App Store and Play Store URLs are hardcoded placeholders:
```typescript
const APP_STORE_URL  = 'https://apps.apple.com/app/id6760478576';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.dwella.app';
```
**Impact:** Invite flow redirects to wrong store URLs in production.
**Fix:** Replace with real app IDs before launch. Store in environment variables.
**BLOCKER:** This must be done before any production release.

### 19. Bot Model Hardcoded
**Severity:** LOW
**File:** `constants/config.ts` (line 10)
**Issue:** Claude model version is hardcoded:
```typescript
export const BOT_MODEL = 'claude-sonnet-4-20250514';
```
**Impact:** Difficult to upgrade model across the app.
**Fix:** Consider environment variable to allow A/B testing different model versions.

### 20. WhatsApp Send Code Function May Leak Code in Logs
**Severity:** MEDIUM
**File:** `lib/bot.ts` (lines 76-110)
**Issue:** Verification code is sent via Edge Function but may be logged:
```typescript
body: JSON.stringify({ phone, code })
```
**Impact:** If Edge Function or network logs are captured, code is exposed.
**Fix:** Never log sensitive codes. Log only hash or masked code (`123***`).

---

## Configuration & Environment

### 21. Missing .env Validation
**Severity:** MEDIUM
**File:** `lib/supabase.ts` (lines 6-11)
**Issue:** Missing env vars only log an error, don't block app startup:
```typescript
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('[Dwella] ... Auth and data will not work.');
}
```
**Impact:** App boots but all queries fail silently.
**Fix:** Throw an error on app load if critical vars are missing. Use a startup check.

### 22. PostHog API Key May Be Exposed in Logs
**Severity:** LOW
**File:** `lib/posthog.ts` (lines 7-8)
**Issue:** PostHog API key is read from env and passed to provider:
```typescript
export const POSTHOG_API_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY ?? '';
```
**Impact:** API key is public (EXPO_PUBLIC_* is embedded in bundle), which is intended. No issue.
**Note:** Public API keys are acceptable for analytics SDKs.

---

## Code Quality & Maintenance

### 23. Monolithic Dashboard Component
**Severity:** LOW
**File:** `app/(tabs)/dashboard/index.tsx`
**Issue:** Dashboard is a single large file with mixed concerns (rendering, state management, calculations). No clear separation of components.
**Impact:** Hard to maintain and test individual UI sections.
**Fix:** Break into smaller components: `<OverviewCard>`, `<MonthlyBreakdown>`, `<RecentTransactions>`, etc.

### 24. No Unit Tests
**Severity:** LOW
**Files:** All
**Issue:** No test files (*.test.ts, *.spec.ts) found in the codebase.
**Impact:** No safety net for refactoring. Regressions may not be caught.
**Fix:** Add Jest + React Native Testing Library. Start with critical paths (auth, payments, bot).

### 25. TODO Comment Not Addressed
**Severity:** LOW
**File:** `supabase/functions/invite-redirect/index.ts` (line 17)
**Issue:** Pre-launch TODO has been in codebase but not yet resolved:
```
* TODO before launch: replace the placeholder store URLs below with real ones.
```
**Impact:** Tracked in this concerns document (see #18 above).

---

## Documentation & Knowledge Gaps

### 26. No Runbook for Edge Function Deployment
**Severity:** LOW
**Issue:** No documentation on deploying individual Edge Functions or handling deployment errors.
**Fix:** Create a deployment guide in `/docs` or project wiki.

### 27. Missing Data Retention Policy
**Severity:** MEDIUM
**Issue:** No documented policy for how long to retain payment proofs, bot conversations, or audit logs.
**Impact:** GDPR/privacy compliance unclear.
**Fix:** Define and document data retention per table.

### 28. No Disaster Recovery Plan
**Severity:** MEDIUM
**Issue:** No documentation for restoring from backups or handling database corruption.
**Impact:** Team is unprepared if production data is lost.
**Fix:** Document backup strategy and recovery steps.

---

## Summary by Priority

| Severity | Count | Examples |
|----------|-------|----------|
| **Critical** | 1 | TypeScript compilation error |
| **High** | 1 | Placeholder App Store URLs (pre-launch blocker) |
| **Medium** | 11 | Weak UUID generation, N+1 queries, error handling, soft deletes, auth sync |
| **Low** | 11 | Type casting, logging, code organization, tests |

---

## Recommended Next Steps

1. **Immediately Fix** (Blocking Launch)
   - [ ] Resolve TypeScript error in PostHog config
   - [ ] Replace placeholder App Store/Play Store URLs

2. **Before Production** (Security)
   - [ ] Replace Math.random() UUID with crypto
   - [ ] Add retry logic for transient network failures
   - [ ] Improve error handling in Edge Functions

3. **After Launch** (Scaling & Resilience)
   - [ ] Optimize N+1 queries in dashboard
   - [ ] Add structured logging & error tracking (Sentry)
   - [ ] Break down monolithic dashboard component
   - [ ] Add unit tests for critical paths

4. **Documentation** (Knowledge)
   - [ ] Create data retention policy
   - [ ] Document Edge Function deployment process
   - [ ] Create disaster recovery runbook

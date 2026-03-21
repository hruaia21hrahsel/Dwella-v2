---
phase: 14-intents-outbound-notifications
verified: 2026-03-21T17:00:00Z
status: passed
score: 11/11 must-haves verified
re_verification: false
---

# Phase 14: Intents & Outbound Notifications Verification Report

**Phase Goal:** Users can ask the bot about maintenance status, upcoming payments, and property summary in natural language, and tenants and landlords receive proactive WhatsApp notifications for reminders, payment confirmations, and maintenance updates
**Verified:** 2026-03-21T17:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | User asks bot about maintenance status and receives structured response with status, history, and action buttons | ✓ VERIFIED | `handleQueryMaintenanceStatus` at line 642 of process-bot-message, returns emoji-formatted string with status/history; action buttons `sub_maint_submit` and `sub_maint_update` added in button path at line 325 |
| 2  | User asks bot about upcoming payments and receives amounts, due dates, and Log Payment / Send Reminder buttons | ✓ VERIFIED | `handleQueryUpcomingPayments` at line 708, returns `Upcoming Payments` formatted string with amounts; action buttons `sub_payments_log` and `sub_payments_remind` at line 328 |
| 3  | Landlord asks bot for property summary and receives occupancy count, collection rate, and overdue count | ✓ VERIFIED | `handleQueryPropertySummary` at line 771, returns strings containing `occupied` and `collected`; line 859 shows total with overdue count |
| 4  | Sub-menu buttons sub_maint_status, sub_payments_upcoming, sub_properties_summary execute real DB queries instead of returning instructional text | ✓ VERIFIED | `handleButtonPress` intercept at lines 315-340 catches all three IDs before `handleSubAction`, creates inline supabase client, calls real handlers; none of the three keys appear in `handleSubAction.actions` Record |
| 5  | All three intent responses re-show the main menu after the answer via additional_messages | ✓ VERIFIED | Button path: `buildMainMenu()` called at line 335, spread into return at line 338. Freeform path: `additional_messages: menuMessages` at both line 1187 (handler branch) and line 1196 (else branch) |
| 6  | Tenant receives WhatsApp rent reminder via dwella_rent_reminder template 3 days before, on, and 3 days after due date | ✓ VERIFIED | `send-reminders/index.ts` lines 159-169: `dwella_rent_reminder` template sent via `WHATSAPP_SEND_URL`; timing logic at lines 79/90/101 unchanged |
| 7  | Tenant receives Telegram rent reminder at the same timing as WhatsApp | ✓ VERIFIED | `send-reminders/index.ts` lines 182-212: Telegram block fetches `telegram_chat_id`, sends via `api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage` for each notification |
| 8  | Tenant receives WhatsApp payment confirmation receipt when payment is auto-confirmed | ✓ VERIFIED | `auto-confirm-payments/index.ts` lines 106-138: `dwella_payment_confirmed` template sent to tenant's `whatsapp_phone` after payment auto-confirm update |
| 9  | Both tenant and landlord receive WhatsApp and Telegram notification when maintenance request status changes | ✓ VERIFIED | `notify-whatsapp/index.ts` lines 122-127 collects both `tenant.user_id` and `property.owner_id`; sends WA template + Telegram to both via loop at lines 144-179 |
| 10 | If WhatsApp template send fails, system falls back to push notification and logs the failure | ✓ VERIFIED | `notify-whatsapp/index.ts` line 177: `if (!waSuccess && !user.telegram_chat_id)` guard calls `sendPushFallback`; sendPushFallback at lines 57-81 looks up push_token then invokes send-push; console.error logged on failure |
| 11 | Notification DB row is always created regardless of delivery channel | ✓ VERIFIED | `notify-whatsapp/index.ts` lines 146-152: `supabase.from('notifications').insert(...)` called inside user loop before any delivery attempts |

**Score:** 11/11 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/functions/process-bot-message/index.ts` | Three new ACTION_HANDLERS + sub-menu button rewires + extended buildContext | ✓ VERIFIED | 1215 lines; ACTION_HANDLERS at lines 872-874 register all three; buildContext maintenance block at lines 960-978; handleButtonPress intercept at lines 315-340 |
| `supabase/functions/notify-whatsapp/index.ts` | Edge Function for maintenance status change notifications | ✓ VERIFIED | 193 lines; sendWhatsAppTemplate, sendTelegramDirect, sendPushFallback functions present; notifications insert before delivery |
| `supabase/migrations/026_maintenance_notify_trigger.sql` | AFTER UPDATE trigger on maintenance_requests using pg_net | ✓ VERIFIED | CREATE OR REPLACE FUNCTION notify_maintenance_status_change with SECURITY DEFINER; AFTER UPDATE trigger with WHEN guard on status change; net.http_post call present |
| `supabase/functions/send-reminders/index.ts` | WhatsApp template + Telegram sends; graph.facebook.com removed | ✓ VERIFIED | dwella_rent_reminder template at line 159; TELEGRAM_BOT_TOKEN + Telegram block at lines 182-212; no graph.facebook.com or WHATSAPP_ACCESS_TOKEN present; monthly_rent in TenantWithProperty interface and select |
| `supabase/functions/auto-confirm-payments/index.ts` | dwella_payment_confirmed template + Telegram to tenant on auto-confirm | ✓ VERIFIED | dwella_payment_confirmed at line 118; TELEGRAM_BOT_TOKEN at line 10; Telegram send at lines 141-154; select extended to include month, year, amount_paid, tenants user_id |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| handleButtonPress (sub_maint_status) | handleQueryMaintenanceStatus | async call with inline supabase client | ✓ WIRED | `createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)` at line 319; `await handleQueryMaintenanceStatus(supabase, userId, {})` at line 324 |
| ACTION_HANDLERS | handleQueryMaintenanceStatus, handleQueryUpcomingPayments, handleQueryPropertySummary | Record entries | ✓ WIRED | Lines 872-874 in ACTION_HANDLERS object; freeform dispatch at line 1173 resolves handler and calls at line 1180 |
| migration 026 | notify-whatsapp Edge Function | pg_net.http_post from AFTER UPDATE trigger | ✓ WIRED | `net.http_post` at line 9 of migration with URL `current_setting('app.settings.supabase_url') || '/functions/v1/notify-whatsapp'` |
| send-reminders | whatsapp-send Edge Function | fetch to WHATSAPP_SEND_URL with template payload | ✓ WIRED | `WHATSAPP_SEND_URL` constant at line 28; fetch at line 149 with `dwella_rent_reminder` template body |
| auto-confirm-payments | whatsapp-send Edge Function | fetch to WHATSAPP_SEND_URL with dwella_payment_confirmed template | ✓ WIRED | `WHATSAPP_SEND_URL` at line 8; fetch at line 108 with `dwella_payment_confirmed` template name |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| INTENT-01 | 14-01-PLAN | User can ask bot about maintenance request status and history | ✓ SATISFIED | handleQueryMaintenanceStatus registered in ACTION_HANDLERS; sub_maint_status button intercept; maintenance_status_logs join in query at line 661 |
| INTENT-02 | 14-01-PLAN | User can ask bot about upcoming payments (what's due, when, how much) | ✓ SATISFIED | handleQueryUpcomingPayments registered in ACTION_HANDLERS; sub_payments_upcoming button intercept; returns amounts and due months |
| INTENT-03 | 14-01-PLAN | User can ask bot for property summary (occupancy, vacancy, rent collection status) | ✓ SATISFIED | handleQueryPropertySummary registered in ACTION_HANDLERS; sub_properties_summary button intercept; dual-role — landlord sees per-property stats, tenant sees own payment status |
| OUT-01 | 14-02-PLAN | Tenant receives rent reminder via WhatsApp 3 days before, on due date, 3 days after | ✓ SATISFIED | send-reminders uses dwella_rent_reminder template; timing guards at lines 79/90/101 unchanged; Telegram parity added |
| OUT-02 | 14-02-PLAN | Tenant receives payment confirmation receipt via WhatsApp when payment is confirmed | ✓ SATISFIED | auto-confirm-payments sends dwella_payment_confirmed to tenant user_id only; Telegram parity added |
| OUT-03 | 14-02-PLAN | Tenant and landlord receive maintenance status change notifications via WhatsApp | ✓ SATISFIED | notify-whatsapp sends to both tenant.user_id and property.owner_id; DB trigger fires automatically on any status change |

**Orphaned requirements:** None. All 6 requirement IDs claimed in plans (INTENT-01/02/03, OUT-01/02/03) are mapped and verified. REQUIREMENTS.md shows all 6 checked and mapped to Phase 14.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | — |

No TODOs, FIXMEs, placeholder returns, or stub implementations found across any of the 5 modified files.

**Notable design observation:** `send-reminders` sends push notifications to ALL users with push tokens simultaneously with WhatsApp/Telegram sends (not as a conditional fallback). This is a superset of the "fallback" truth — it provides multi-channel redundancy rather than exclusive fallback. `notify-whatsapp` correctly implements conditional fallback (`!waSuccess && !user.telegram_chat_id`). This difference does not block any requirement.

---

### Human Verification Required

These items pass automated checks but require live bot testing to fully confirm:

#### 1. Freeform intent dispatch to query handlers

**Test:** Send "check my maintenance status" as a WhatsApp or Telegram message to the bot
**Expected:** Bot calls Claude, Claude returns intent `query_maintenance_status`, process-bot-message calls `handleQueryMaintenanceStatus`, reply contains emoji-formatted maintenance list plus main menu re-shown
**Why human:** Claude's intent classification is probabilistic — cannot verify the LLM will reliably classify freeform queries to the three new intents without live testing

#### 2. WhatsApp template delivery (dwella_rent_reminder)

**Test:** Manually trigger send-reminders via curl or Supabase dashboard; ensure a tenant's due_day matches today+3; verify WhatsApp message received on linked phone
**Expected:** Structured template message with tenant name, rent amount, and due date received (not free-form text)
**Why human:** Template delivery requires approved Meta template and live WhatsApp API; cannot verify from code alone

#### 3. DB trigger fires on maintenance status change

**Test:** Update a `maintenance_requests.status` row in Supabase dashboard (e.g., open → acknowledged); verify notify-whatsapp Edge Function is called and both tenant and landlord receive notifications
**Expected:** WhatsApp template (or Telegram, or push fallback) received within seconds of status change
**Why human:** pg_net trigger invocation requires production Supabase with net extension enabled; cannot verify from migration SQL alone

#### 4. Payment auto-confirm receipt

**Test:** Set a payment to `status='paid'` with `paid_at` 49 hours in the past, trigger auto-confirm-payments; verify tenant receives dwella_payment_confirmed WhatsApp message
**Expected:** Receipt message with tenant name, amount paid, and month label received on tenant's WhatsApp
**Why human:** Requires live WhatsApp delivery and correct template variable mapping to verify end-to-end

---

### Commit Verification

All 5 task commits documented in SUMMARYs confirmed present in git history:

| Commit | Description |
|--------|-------------|
| `8e5709b` | feat(14-01): add three query ACTION_HANDLERS and extend buildContext |
| `cb27d76` | feat(14-01): rewire sub-menu buttons to execute real DB queries per D-04 |
| `c24b42c` | feat(14-02): add notify-whatsapp Edge Function and migration 026 trigger |
| `754ea52` | feat(14-02): update send-reminders to use WhatsApp template and Telegram |
| `4b43a77` | feat(14-02): add WhatsApp template and Telegram to auto-confirm-payments |

---

### Gaps Summary

No gaps found. All 11 must-haves are verified with substantive implementations wired to live DB queries and real delivery channels. All 6 requirement IDs are satisfied with evidence.

---

_Verified: 2026-03-21T17:00:00Z_
_Verifier: Claude (gsd-verifier)_

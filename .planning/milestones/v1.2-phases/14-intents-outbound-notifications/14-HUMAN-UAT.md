---
status: partial
phase: 14-intents-outbound-notifications
source: [14-VERIFICATION.md]
started: 2026-03-21
updated: 2026-03-21
---

## Current Test

[awaiting human testing]

## Tests

### 1. Freeform intent dispatch to query handlers
expected: Send "check my maintenance status" via WhatsApp/Telegram. Bot calls Claude, Claude returns intent `query_maintenance_status`, reply contains emoji-formatted maintenance list plus main menu re-shown.
result: [pending]

### 2. WhatsApp template delivery (dwella_rent_reminder)
expected: Manually trigger send-reminders via curl. Tenant with due_day matching today+3 receives structured template message with name, rent amount, and due date (not free-form text).
result: [pending]

### 3. DB trigger fires on maintenance status change
expected: Update maintenance_requests.status in Supabase dashboard (e.g., open -> acknowledged). Both tenant and landlord receive WhatsApp template (or Telegram/push fallback) within seconds.
result: [pending]

### 4. Payment auto-confirm receipt
expected: Set payment to status='paid' with paid_at 49 hours ago, trigger auto-confirm-payments. Tenant receives dwella_payment_confirmed WhatsApp message with name, amount, and month label.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps

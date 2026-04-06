---
status: partial
phase: 03-security-hardening
source: [03-VERIFICATION.md]
started: 2026-04-06T00:00:00Z
updated: 2026-04-06T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Register TELEGRAM_WEBHOOK_SECRET with Telegram
expected: Generate secret, set as Supabase secret, redeploy, call setWebhook API — bot messages continue working
result: [pending]

### 2. Verify webhook rejects unauthenticated requests
expected: curl -X POST <webhook-url> -d '{}' returns HTTP 401
result: [pending]

### 3. Verify rate limiting enforces thresholds
expected: After threshold requests in one minute, endpoint returns 429 (10/min invite-redirect, 60/min webhook+bot)
result: [pending]

### 4. Sentry project setup and error capture verification
expected: Create Sentry project, set EXPO_PUBLIC_SENTRY_DSN + SENTRY_DSN, trigger test error, confirm in dashboard, enable email alerts
result: [pending]

### 5. Mobile app launches without crashing
expected: App opens on device/simulator without crash after Sentry SDK installation
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps

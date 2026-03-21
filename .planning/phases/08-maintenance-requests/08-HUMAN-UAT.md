---
status: partial
phase: 08-maintenance-requests
source: [08-VERIFICATION.md]
started: 2026-03-21T10:00:00Z
updated: 2026-03-21T10:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Submit a maintenance request as a tenant with photos
expected: Request appears in list immediately, landlord receives push notification
result: [pending]

### 2. Advance request through all status steps as landlord
expected: Each step updates the timeline, tenant receives push notification at each transition
result: [pending]

### 3. Mark request resolved with a cost amount
expected: Expense row created in property expenses, linked to request via maintenance_request_id
result: [pending]

### 4. Close a request via the ConfirmDialog
expected: ConfirmDialog appears, confirming executes the close transition and shows success toast
result: [pending]

### 5. Photo upload, thumbnail display, and full-screen viewer
expected: Photos appear as thumbnails in detail screen, tapping opens full-screen pinch-zoom modal
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps

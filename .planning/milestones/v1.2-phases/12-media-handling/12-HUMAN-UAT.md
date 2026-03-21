---
status: partial
phase: 12-media-handling
source: [12-VERIFICATION.md]
started: 2026-03-21T14:45:00Z
updated: 2026-03-21T14:45:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Payment proof photo via WhatsApp
expected: Payment proof appears on the correct tenant/month, bot sends confirmation reply
result: [pending]

### 2. Document sharing via WhatsApp
expected: Document row inserted in DB, file in Supabase Storage, bot sends confirmation reply
result: [pending]

### 3. Unsupported media rejection (video)
expected: Bot replies: "I can only accept photos (payment proofs) and documents (PDFs, Word files). For other requests, just type your message."
result: [pending]

### 4. Classification failure handling
expected: Bot replies: "I couldn't tell if this photo is a payment receipt. If it is, add a caption..."
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps

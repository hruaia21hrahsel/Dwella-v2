---
phase: 03-edge-functions-backend
plan: 02
subsystem: edge-functions
tags: [validation, security, claude-api, bot, ai-tools]
dependency_graph:
  requires: []
  provides: [EDGE-01-partial, EDGE-03]
  affects: [process-bot-message, ai-insights, ai-draft-reminders, ai-search]
tech_stack:
  added: []
  patterns: [runtime-type-guard, safe-json-parse, graceful-degradation]
key_files:
  created: []
  modified:
    - supabase/functions/process-bot-message/index.ts
    - supabase/functions/ai-insights/index.ts
    - supabase/functions/ai-draft-reminders/index.ts
    - supabase/functions/ai-search/index.ts
decisions:
  - "isValidClaudeIntent() type guard placed after ClaudeIntent interface — validates all 5 required fields before action dispatch"
  - "ai-draft-reminders uses drafts=[] fallback (not 502) on parse failure — graceful degradation, default messages still sent"
  - "ai-search falls back to properties search on invalid type — safest branch (only reads user-owned non-archived rows)"
  - "telegram-webhook and whatsapp-webhook verified correct from Phase 2 — no changes needed"
metrics:
  duration_minutes: 2
  completed_date: "2026-03-19"
  tasks_completed: 2
  files_modified: 4
---

# Phase 03 Plan 02: Claude Response Validation Summary

**One-liner:** Runtime validation guards added to all 4 Claude-consuming Edge Functions — malformed AI output falls back to safe defaults instead of crashing or executing DB actions.

## What Was Built

Four Edge Functions now validate Claude API response JSON before acting on it:

1. **process-bot-message** — `isValidClaudeIntent()` type guard validates all 5 required fields (`intent`, `entities`, `action_description`, `needs_confirmation`, `reply`) before action dispatch. Invalid shapes fall back to `general_chat` instead of reaching action handlers where `result.entities` could be undefined.

2. **ai-insights** — `JSON.parse` of Claude response wrapped in inner try/catch. Parse failure returns 502 with `{ error: 'Failed to parse AI response' }` instead of propagating to the outer 500 handler.

3. **ai-draft-reminders** — `JSON.parse` wrapped in try/catch with `Array.isArray()` check. Non-array or parse failure sets `drafts = []`, which triggers the existing fallback message logic so tenants still receive default reminders.

4. **ai-search** — `JSON.parse` wrapped in try/catch with `validTypes` validation of `filters.type`. Invalid type falls back to `properties` search (safest branch). JSON parse error returns 502.

**Webhook verification (read-only):**
- `telegram-webhook`: Correctly validates `X-Telegram-Bot-Api-Secret-Token`, returns 200 on all paths. No changes needed.
- `whatsapp-webhook`: Correctly reads raw body before parse, computes HMAC-SHA256, validates `X-Hub-Signature-256`. No changes needed.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add isValidClaudeIntent guard to process-bot-message | 5e2ec44 | supabase/functions/process-bot-message/index.ts |
| 2 | Harden AI tool functions (ai-insights, ai-draft-reminders, ai-search) | a5a37ff | 3 AI tool function files |

## Deviations from Plan

None — plan executed exactly as written.

## Requirements Closed

- **EDGE-03**: Full bot flow (webhook → Claude → JSON validation → DB action → reply) now has no unguarded paths. `isValidClaudeIntent` closes the validation gap.
- **EDGE-01** (remaining): ai-insights, ai-draft-reminders, ai-search now return 502 for malformed Claude responses instead of generic 500.

## Self-Check: PASSED

All modified files exist on disk. Both task commits (5e2ec44, a5a37ff) verified in git log.

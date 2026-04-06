---
phase: 03-security-hardening
plan: 03
subsystem: edge-functions
tags: [security, rate-limiting, dos-prevention]
dependency_graph:
  requires: [xss-fix-invite-redirect, webhook-auth-config-docs]
  provides: [rate-limiting-infrastructure, rate-limited-endpoints]
  affects: [telegram-webhook, invite-redirect, process-bot-message]
tech_stack:
  added: []
  patterns: [fixed-window-rate-limit, fail-open-on-error, postgres-rpc-counter]
key_files:
  created:
    - supabase/migrations/029_rate_limit_table.sql
    - supabase/functions/_shared/rate-limit.ts
  modified:
    - supabase/functions/telegram-webhook/index.ts
    - supabase/functions/invite-redirect/index.ts
    - supabase/functions/process-bot-message/index.ts
decisions:
  - "Fail-open on DB errors: rate limit check returns true (allows request) if RPC call fails, preventing availability impact from rate-limit infrastructure issues"
  - "Fixed-window counter using Postgres table with atomic upsert via ON CONFLICT, no external dependencies"
metrics:
  status: checkpoint-pending
  completed_date: null
  tasks_completed: 2
  tasks_total: 3
  checkpoint_task: 3
  checkpoint_type: human-action
---

# Phase 03 Plan 03: Rate Limiting Summary

**Status: CHECKPOINT PENDING (Task 3: human-action)**

IP-based fixed-window rate limiting on all 3 public edge functions using a Postgres table as counter with atomic upsert RPC.

## What Was Done

### Task 1: Rate limit migration and shared utility (df5f0b6)

Created the database infrastructure for rate limiting:

- **`supabase/migrations/029_rate_limit_table.sql`**: Creates `rate_limits` table with `(ip_address, function_name, window_start)` unique constraint, `check_rate_limit` RPC function (SECURITY DEFINER, atomic increment-or-insert returning boolean), and `cleanup_rate_limits` function for periodic maintenance.
- **`supabase/functions/_shared/rate-limit.ts`**: Shared utility exporting `checkRateLimit()` (calls the RPC, fails open on errors) and `getClientIp()` (extracts IP from x-forwarded-for/x-real-ip headers).

### Task 2: Integrate rate limiting into edge functions (6c75e80)

Added rate limit checks to all 3 public edge functions:

- **telegram-webhook**: 60 req/min per IP, after secret-token check, before body parsing. Returns empty 429.
- **invite-redirect**: 10 req/min per IP, after UUID validation, before isAndroid check. Returns HTML 429 page.
- **process-bot-message**: 60 req/min per IP, after BOT_INTERNAL_SECRET check, before req.json(). Returns JSON 429.

## What Remains

### Task 3: Push rate limit migration to Supabase (CHECKPOINT)

The migration file exists locally but has not been applied to the remote Supabase database. The user must run `supabase db push` to create the `rate_limits` table and RPC functions.

## Deviations from Plan

None - plan executed exactly as written for Tasks 1 and 2.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | df5f0b6 | Rate limit migration + shared utility |
| 2 | 6c75e80 | Integrate rate limiting into 3 edge functions |

## Self-Check: PASSED

- [x] supabase/migrations/029_rate_limit_table.sql exists
- [x] supabase/functions/_shared/rate-limit.ts exists
- [x] All 3 edge functions contain checkRateLimit import and usage
- [x] Commits df5f0b6 and 6c75e80 exist in git log

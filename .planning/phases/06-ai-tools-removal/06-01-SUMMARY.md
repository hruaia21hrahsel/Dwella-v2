---
phase: 06-ai-tools-removal
plan: "01"
subsystem: navigation/tools
tags: [cleanup, ai-removal, tools-menu, dashboard]
dependency_graph:
  requires: []
  provides: [clean-tools-menu, clean-dashboard]
  affects: [app/(tabs)/tools/index.tsx, app/(tabs)/dashboard/index.tsx]
tech_stack:
  added: []
  patterns: [coming-soon-card-pattern, toast-on-press]
key_files:
  created: []
  modified:
    - app/(tabs)/tools/index.tsx
  deleted:
    - app/tools/ai-insights.tsx
    - app/tools/ai-search.tsx
    - app/tools/smart-reminders.tsx
    - app/tools/_layout.tsx
    - components/AiInsightCard.tsx
    - hooks/useAiNudge.ts
    - supabase/functions/ai-insights/index.ts
    - supabase/functions/ai-search/index.ts
    - supabase/functions/ai-draft-reminders/index.ts
decisions:
  - "Coming Soon cards use opacity 0.5 + COMING SOON badge + toast-on-press pattern for clear affordance"
  - "Deployed Edge Functions (ai-insights, ai-search, ai-draft-reminders) must be manually removed from Supabase dashboard — cannot be automated via code"
metrics:
  duration: "~2 min"
  completed: "2026-03-20"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
  files_deleted: 9
---

# Phase 06 Plan 01: AI Tools Removal Summary

**One-liner:** Deleted all AI tool screens, components, hooks, and Edge Function directories; replaced with Documents/Maintenance/Analytics Coming Soon cards in the tools menu and removed AiInsightCard from dashboard.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Delete AI screen files, components, hooks, and Edge Functions | 5f2aff2 | 9 files deleted |
| 2 | Update tools menu and dashboard to remove AI references | 45db920 | 2 files modified |

## What Was Built

The tools navigation now shows two active items (Payment History, Expenses) followed by three Coming Soon placeholders (Documents, Maintenance, Analytics). Coming Soon cards are visually muted at 50% opacity, display a small "COMING SOON" badge next to the title, hide the chevron-right arrow, and show a toast message on tap instead of navigating. The dashboard renders cleanly without any AI component imports or usage.

## Deviations from Plan

None — plan executed exactly as written.

## Manual Post-Plan Step Required

Deployed Edge Functions must be removed from the Supabase dashboard manually:
- `ai-insights`
- `ai-search`
- `ai-draft-reminders`

These cannot be removed via code — they require access to the Supabase project dashboard or CLI with deployment credentials.

## Verification Results

1. `npx tsc --noEmit` — zero errors (exit 0)
2. `grep -r "ai-insights|ai-search|ai-draft-reminders|AiInsightCard|useAiNudge" app/ components/ hooks/` — no results
3. `ls supabase/functions/ | grep ai` — no results
4. `grep -c "comingSoon" app/(tabs)/tools/index.tsx` — 10 occurrences (type definition + 3 items + render logic)

## Self-Check: PASSED

- app/(tabs)/tools/index.tsx — FOUND
- app/(tabs)/dashboard/index.tsx — FOUND
- commit 5f2aff2 (Task 1) — FOUND
- commit 45db920 (Task 2) — FOUND

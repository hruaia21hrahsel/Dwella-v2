# Phase 6: AI Tools Removal - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Delete all deprecated AI tool screens, their supporting components/hooks, corresponding Edge Functions, and menu references. Free navigation slots in the tools menu. This is a pure deletion + cleanup phase — no new capabilities are added.

</domain>

<decisions>
## Implementation Decisions

### Tools menu after removal
- Remove the 3 AI tool entries (AI Insights, Smart Reminders, AI Search)
- Add 3 "Coming Soon" placeholder cards for upcoming features: Documents, Maintenance, Analytics
- Coming Soon cards are tappable — show a brief toast ("Coming soon!") on tap
- Cards should be visually muted (grayed out / reduced opacity) to distinguish from active items
- Payment History and Expenses remain as active items at the top

### Dashboard AI references
- Remove `AiInsightCard` component usage and `useAiNudge` hook from dashboard
- Remove silently — no replacement content needed (dashboard already has property/payment data)

### AiDisclosureModal
- Keep `AiDisclosureModal` — the bot feature still uses Claude API and needs the AI disclosure
- Only remove AI-tool-specific disclosure triggers if any exist

### Edge Function cleanup
- Delete source files for: `ai-insights/`, `ai-search/`, `ai-draft-reminders/`
- Note in plan that deployed versions should be removed from Supabase dashboard (manual step, not automatable via code)

### Files to delete
- `app/tools/ai-insights.tsx` — AI insights screen
- `app/tools/ai-search.tsx` — AI search screen
- `app/tools/smart-reminders.tsx` — Smart reminders screen
- `components/AiInsightCard.tsx` — Dashboard AI card component
- `hooks/useAiNudge.ts` — AI nudge hook
- `supabase/functions/ai-insights/index.ts` — Edge Function
- `supabase/functions/ai-search/index.ts` — Edge Function
- `supabase/functions/ai-draft-reminders/index.ts` — Edge Function

### Files to modify
- `app/(tabs)/tools/index.tsx` — Remove AI entries, add Coming Soon placeholders
- `app/(tabs)/dashboard/index.tsx` — Remove AiInsightCard/useAiNudge imports and usage

### Claude's Discretion
- Coming Soon card styling (icon choices, opacity level, color scheme)
- Toast implementation (React Native Paper Snackbar vs custom)
- Whether to keep or remove `app/tools/_layout.tsx` (depends on if non-AI tool routes still use it)
- Ordering of Coming Soon cards relative to active items

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — CLEAN-01 (menu removal), CLEAN-02 (backend removal)

### Roadmap
- `.planning/ROADMAP.md` — Phase 6 success criteria (4 conditions to verify)

### Existing code
- `app/(tabs)/tools/index.tsx` — Current tools menu with AI entries (lines 28-47)
- `app/(tabs)/dashboard/index.tsx` — Dashboard with AI component imports
- `supabase/functions/process-bot-message/index.ts` — Bot function (confirmed: NO references to removed AI tool definitions)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Tools menu card pattern in `app/(tabs)/tools/index.tsx` — same card layout can be reused for Coming Soon cards with opacity/disabled styling
- `useTheme()` hook provides `colors` and `shadows` — use for consistent styling of muted cards
- `MaterialCommunityIcons` already imported — use for Coming Soon card icons

### Established Patterns
- Tools menu uses a `TOOLS` array of objects with `{label, description, icon, route, color}` — extend this pattern with a `comingSoon` boolean flag
- Expo Router `Stack` layout in `app/tools/_layout.tsx` — may become empty after AI screen deletion

### Integration Points
- `app/(tabs)/tools/index.tsx` is the tools tab entry point — primary modification target
- `app/(tabs)/dashboard/index.tsx` imports from `components/AiInsightCard` and `hooks/useAiNudge` — these imports must be removed cleanly
- `supabase/functions/` directory — 3 function directories to delete entirely

</code_context>

<specifics>
## Specific Ideas

- User wants "Analytics" label (not "Reports") for the Phase 9 Coming Soon card
- Coming Soon cards: Documents, Maintenance, Analytics — in that order

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-ai-tools-removal*
*Context gathered: 2026-03-20*

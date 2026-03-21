---
phase: 13-rich-messaging
plan: 01
subsystem: api
tags: [telegram, bot, interactive-buttons, inline-keyboard, session-detection, menu-routing]

# Dependency graph
requires:
  - phase: 12-media-handling
    provides: process-bot-message with structured bot responses
  - phase: 11-setup-infrastructure
    provides: whatsapp-send interactive type, Telegram webhook base
provides:
  - BUTTON_LOOKUP dispatch in process-bot-message (handleButtonPress)
  - Main menu builder (buildMainMenu) and sub-menu builders (buildSubMenu)
  - Sub-action instructional text handlers (handleSubAction)
  - Month/year picker for PDF flow (buildMonthPickerMessages)
  - button_id field in BotRequest, buttons/additional_messages in BotResponse
  - "menu"/"help" text triggers for on-demand menu
  - Telegram callback_query handling with answerCallbackQuery
  - Telegram inline keyboard support via replyMarkup parameter
  - sendBotResponse and toTelegramKeyboard helpers
  - sendTelegramDocument for PDF delivery (Plan 13-03)
  - Welcome message with menu on Telegram /start linking (RICH-01)
  - Session detection with 1-hour gap triggering menu (RICH-02)
  - last_bot_message_at updates on every interaction
affects: [13-02-whatsapp-menus, 13-03-pdf-reports]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - BUTTON_LOOKUP dispatch pattern (prefix-based routing, bypasses Claude for button taps)
    - Multi-message response pattern (additional_messages array in BotResponse)
    - Telegram inline_keyboard via optional replyMarkup parameter on sendTelegram
    - Session detection via last_bot_message_at column (1-hour gap = new session)
    - answerCallbackQuery must fire before any async work to dismiss loading spinner

key-files:
  created:
    - supabase/migrations/025_last_bot_message_at.sql (was already provided by 13-02 agent as 025_rich_messaging.sql)
  modified:
    - supabase/functions/process-bot-message/index.ts
    - supabase/functions/telegram-webhook/index.ts

key-decisions:
  - "BUTTON_LOOKUP bypass: button_id check happens before Claude dispatch — no LLM call for menu taps"
  - "Multi-message pattern: additional_messages array in BotResponse carries secondary menu messages"
  - "Menu re-shows after every Claude response via additional_messages: buildMainMenu() (per D-07)"
  - "toTelegramKeyboard maps btn.title directly to text — no btn.text fallback (dead code prevention)"
  - "Telegram supabase createClient moved before callback_query block so both branches share it"
  - "answerCallbackQuery fires first in callback_query handler — before any async work (Telegram UX requirement)"

patterns-established:
  - "Pattern 1: Button dispatch before LLM — handleButtonPress() checked first, Claude only for freeform text"
  - "Pattern 2: Multi-message responses — BotResponse.additional_messages array, sent in sequence"
  - "Pattern 3: Session detection — query last_bot_message_at, show menu if gap > 1 hour"

requirements-completed: [RICH-01, RICH-02, RICH-03, RICH-04, RICH-05]

# Metrics
duration: 6min
completed: 2026-03-21
---

# Phase 13 Plan 01: Menu Routing Infrastructure Summary

**BUTTON_LOOKUP dispatch with Telegram inline keyboard support, callback_query handling, welcome message on linking, and 1-hour session detection**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-03-21T15:14:08Z
- **Completed:** 2026-03-21T15:20:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added BUTTON_LOOKUP dispatch to process-bot-message — button taps bypass Claude entirely and route to prefix-matched handlers returning structured button arrays
- Added full Telegram callback_query handling with answerCallbackQuery, inline keyboard support, sendBotResponse for multi-message rendering, and sendTelegramDocument for PDF delivery
- Added welcome message with main menu on Telegram /start token linking (RICH-01) and session detection with 1-hour gap triggering menu before message (RICH-02)

## Task Commits

Each task was committed atomically:

1. **Task 1: BUTTON_LOOKUP dispatch and menu response builders** - `24301bc` (feat, committed by parallel 13-02 agent as part of docs commit)
2. **Task 2: callback_query handling, inline keyboards, welcome message, session detection** - `7a7ea0b` (feat)

Note: Task 1 content (process-bot-message changes) was committed by the parallel 13-02 agent during its execution. The 13-02 agent committed the full BUTTON_LOOKUP infrastructure to process-bot-message in its final docs commit. This plan's Task 2 (telegram-webhook) was committed independently.

## Files Created/Modified

- `supabase/functions/process-bot-message/index.ts` - Added BUTTON_LOOKUP dispatch, buildMainMenu, buildSubMenu, handleSubAction, buildMonthPickerMessages, handleButtonPress; extended BotRequest with button_id and BotResponse with buttons/additional_messages
- `supabase/functions/telegram-webhook/index.ts` - Added callback_query handling, answerCallbackQuery, toTelegramKeyboard, sendBotResponse, sendTelegramDocument, extended sendTelegram with replyMarkup; welcome message on linking, session detection
- `supabase/migrations/025_rich_messaging.sql` - last_bot_message_at column on users (created by 13-02 agent)

## Decisions Made

- Used prefix-based BUTTON_LOOKUP (not a Map or switch): `if (buttonId.startsWith('menu_'))` pattern is readable and easily extensible without a dispatch table data structure
- Multi-message responses encoded as `additional_messages` array in BotResponse — telegram-webhook and whatsapp-webhook both iterate and send each in sequence
- Menu always re-shows after every Claude response (additional_messages: buildMainMenu()) — user never needs to remember "type menu"
- `toTelegramKeyboard` maps `btn.title` directly to `text` — no fallback to `btn.text` which would be dead code since ButtonResponse only has `title`

## Deviations from Plan

### Auto-fixed Issues

**1. [Parallel Agent Coordination] Task 1 content already committed by 13-02 agent**
- **Found during:** Task 1 staging
- **Issue:** The parallel 13-02 agent (WhatsApp routing plan) committed the BUTTON_LOOKUP infrastructure to process-bot-message in its final docs commit (24301bc). Git showed nothing to stage for process-bot-message.
- **Fix:** Verified the committed content matched the plan spec exactly. Removed a redundant migration file (025_last_bot_message_at.sql) that would have conflicted with 025_rich_messaging.sql already committed by 13-02. Proceeded directly to Task 2.
- **Files modified:** Removed duplicate migration, proceeded with telegram-webhook as Task 2
- **Verification:** grep confirmed all acceptance criteria present in process-bot-message/index.ts

---

**Total deviations:** 1 (parallel agent coordination — no code regression)
**Impact on plan:** The 13-02 parallel agent implemented the process-bot-message changes as part of its scope. This plan focused on the Telegram webhook changes. All success criteria met.

## Issues Encountered

None beyond parallel agent coordination documented above.

## User Setup Required

None - no external service configuration required beyond what 13-02 covered.

## Known Stubs

- `pdf_month_` button handler in process-bot-message returns "PDF report generation is not yet available" — intentional placeholder, will be wired in Plan 13-03.

## Next Phase Readiness

- Telegram button menu routing fully operational — callback_query handled, buttons render with inline keyboards
- process-bot-message BUTTON_LOOKUP ready for both Telegram and WhatsApp webhooks
- sendTelegramDocument function ready for Plan 13-03 PDF delivery
- Session detection active — last_bot_message_at updated on every Telegram interaction
- WhatsApp interactive button routing handled by Plan 13-02 (parallel agent)
- Next: Plan 13-03 (PDF report generation via HTML-to-PDF API, month picker completion)

---
*Phase: 13-rich-messaging*
*Completed: 2026-03-21*

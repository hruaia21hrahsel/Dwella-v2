# Phase 11: Setup & Infrastructure - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

WhatsApp Business API is fully operational, users can link their WhatsApp account to Dwella, and the shared outbound messaging helper is in place for all future phases. This phase also submits all 4 Meta notification templates so they can begin the 2-7 day approval process before Phase 14 needs them.

</domain>

<decisions>
## Implementation Decisions

### Setup documentation (SETUP-01)
- **D-01:** Full walkthrough guide covering: create Meta Business app, register phone number, configure webhooks, create System User, generate permanent token, set all env vars
- **D-02:** Guide lives in `docs/meta-setup.md` (Claude's discretion on location)
- **D-03:** System User token approach (long-lived, no 24-hour expiry) — required for production reliability

### WhatsApp linking flow (SETUP-02, SETUP-03)
- **D-04:** Existing linking flow (6-digit code, realtime detection, profile UI) is already built — Phase 11 verifies it works end-to-end and fixes any bugs found
- **D-05:** Add "Open WhatsApp" deep link button (`wa.me/<WHATSAPP_BOT_PHONE>`) on the profile screen after successful linking (SETUP-03)

### whatsapp-send Edge Function
- **D-06:** Standalone Edge Function at `/functions/v1/whatsapp-send` — other functions call via `fetch()`. Centralized logging and single deploy point
- **D-07:** Supports all 4 message types from day one: `text`, `template`, `interactive` (buttons), `document`
- **D-08:** Simple retry on transient failures — retry once on 429/5xx with 1-second delay, fail after second attempt
- **D-09:** Replaces the inline `sendWhatsApp()` in `whatsapp-webhook` so there's a single source of truth (Claude's discretion on refactor timing)
- **D-10:** Also replaces `whatsapp-send-code` functionality — the new `whatsapp-send` handles template messages generically, making `whatsapp-send-code` redundant

### Meta notification templates
- **D-11:** Submit 3 new templates (verification template already exists):
  1. `dwella_rent_reminder` — variables: `{{name}}`, `{{amount}}`, `{{due_date}}`
  2. `dwella_payment_confirmed` — variables: `{{name}}`, `{{amount}}`, `{{month}}`
  3. `dwella_maintenance_update` — variables: `{{name}}`, `{{description}}`, `{{status}}`
- **D-12:** Professional-friendly tone: "Hi {{name}}, your rent of ₹{{amount}} is due on {{due_date}}. Pay via the Dwella app to avoid late fees."
- **D-13:** Each template includes a CTA button ("Open Dwella") linking to the app via deep link or app store URL
- **D-14:** English only — Hindi can be added later if needed
- **D-15:** Template content documented in the setup guide with exact wording for manual submission in Meta Business Manager

### Claude's Discretion
- Exact file location for setup guide (suggested `docs/meta-setup.md`)
- Whether to refactor `whatsapp-webhook`'s inline `sendWhatsApp()` in Phase 11 or defer to a later phase
- Whether to keep `whatsapp-send-code` as a thin wrapper or fully merge into `whatsapp-send`
- Error response format and logging detail level in `whatsapp-send`

</decisions>

<specifics>
## Specific Ideas

- System User token is critical — the temporary developer token expires every 24 hours and will break production
- Templates must be submitted early because Meta approval takes 2-7 days — Phase 14 is blocked without them
- The `whatsapp-send` function is the foundation for Phases 12-14; it needs to be solid and well-tested

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing WhatsApp infrastructure
- `supabase/functions/whatsapp-webhook/index.ts` — Current webhook handler with inline `sendWhatsApp()`, HMAC validation, 6-digit code linking flow
- `supabase/functions/whatsapp-send-code/index.ts` — Current template-only sender (sends `dwella_verification` template)
- `supabase/functions/process-bot-message/index.ts` — Shared bot brain with `buildContext()`, Claude API call, action handlers
- `lib/bot.ts` — Client-side `initiateWhatsAppLink()`, `unlinkWhatsApp()`, E.164 normalization
- `app/(tabs)/profile/index.tsx` — WhatsApp link/unlink UI with realtime channel detection

### Database schema
- `supabase/migrations/015_whatsapp.sql` — `whatsapp_phone` (unique, indexed) and `whatsapp_verify_code` columns on `users`

### Telegram reference (parallel implementation)
- `supabase/functions/telegram-webhook/index.ts` — Account linking via `/start <token>`, inline `sendTelegram()` — follow same patterns for WhatsApp

### Project context
- `.planning/ROADMAP.md` — Phase 11 success criteria and plan breakdown
- `.planning/REQUIREMENTS.md` — SETUP-01, SETUP-02, SETUP-03 requirement definitions
- `constants/config.ts` — `WHATSAPP_BOT_PHONE` env var already exported

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `whatsapp-webhook/index.ts:validateMetaSignature()` — HMAC-SHA256 validation, reuse pattern for any new Meta API calls
- `whatsapp-webhook/index.ts:normalizePhone()` — E.164 normalization, already duplicated in `lib/bot.ts`
- `lib/bot.ts:secureRandomDigits()` — Crypto-secure code generation using expo-crypto
- Profile screen WhatsApp section — complete link/unlink UI with realtime subscription

### Established Patterns
- Edge Functions use `serve()` from Deno std, `createClient()` from Supabase JS, env vars via `Deno.env.get()`
- Webhook authentication: HMAC for WhatsApp (X-Hub-Signature-256), secret token header for Telegram
- Account linking: generate token/code → store on user row → external platform sends it back → match and link
- Bot message flow: webhook → lookup user → `fetch(PROCESS_BOT_URL)` → send reply back

### Integration Points
- `whatsapp-send` will be called by: `whatsapp-webhook` (reply), `send-reminders` (Phase 14), `auto-confirm-payments` (Phase 14), future maintenance notification hooks
- The "Open WhatsApp" button needs `WHATSAPP_BOT_PHONE` from `constants/config.ts` to construct `wa.me/` URL
- Template names must match exactly between the Meta Business Manager submission and the `whatsapp-send` function code

</code_context>

<deferred>
## Deferred Ideas

- WhatsApp opt-in tracking for cold outbound (Phase 14 concern — users who never initiated need documented consent)
- Hindi/multilingual template support — add in future if user base needs it
- Rate limiting on `whatsapp-send` — monitor usage first, add if Meta throttles become an issue

</deferred>

---

*Phase: 11-setup-infrastructure*
*Context gathered: 2026-03-21*

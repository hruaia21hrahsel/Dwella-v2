# Phase 11: Setup & Infrastructure - Research

**Researched:** 2026-03-21
**Domain:** Meta WhatsApp Cloud API — infrastructure setup, System User tokens, outbound message helper, template submission
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Full walkthrough guide covering: create Meta Business app, register phone number, configure webhooks, create System User, generate permanent token, set all env vars
- **D-02:** Guide lives in `docs/meta-setup.md`
- **D-03:** System User token approach (long-lived, no 24-hour expiry) — required for production reliability
- **D-04:** Existing linking flow (6-digit code, realtime detection, profile UI) is already built — Phase 11 verifies it works end-to-end and fixes any bugs found
- **D-05:** Add "Open WhatsApp" deep link button (`wa.me/<WHATSAPP_BOT_PHONE>`) on the profile screen after successful linking (SETUP-03)
- **D-06:** Standalone Edge Function at `/functions/v1/whatsapp-send` — other functions call via `fetch()`. Centralized logging and single deploy point
- **D-07:** Supports all 4 message types from day one: `text`, `template`, `interactive` (buttons), `document`
- **D-08:** Simple retry on transient failures — retry once on 429/5xx with 1-second delay, fail after second attempt
- **D-09:** Replaces the inline `sendWhatsApp()` in `whatsapp-webhook` so there's a single source of truth (Claude's discretion on refactor timing)
- **D-10:** Also replaces `whatsapp-send-code` functionality — the new `whatsapp-send` handles template messages generically, making `whatsapp-send-code` redundant
- **D-11:** Submit 3 new templates (verification template already exists):
  1. `dwella_rent_reminder` — variables: `{{name}}`, `{{amount}}`, `{{due_date}}`
  2. `dwella_payment_confirmed` — variables: `{{name}}`, `{{amount}}`, `{{month}}`
  3. `dwella_maintenance_update` — variables: `{{name}}`, `{{description}}`, `{{status}}`
- **D-12:** Professional-friendly tone: "Hi {{name}}, your rent of ₹{{amount}} is due on {{due_date}}. Pay via the Dwella app to avoid late fees."
- **D-13:** Each template includes a CTA button ("Open Dwella") linking to the app via deep link or app store URL
- **D-14:** English only
- **D-15:** Template content documented in the setup guide with exact wording for manual submission in Meta Business Manager

### Claude's Discretion

- Exact file location for setup guide (suggested `docs/meta-setup.md`)
- Whether to refactor `whatsapp-webhook`'s inline `sendWhatsApp()` in Phase 11 or defer to a later phase
- Whether to keep `whatsapp-send-code` as a thin wrapper or fully merge into `whatsapp-send`
- Error response format and logging detail level in `whatsapp-send`

### Deferred Ideas (OUT OF SCOPE)

- WhatsApp opt-in tracking for cold outbound (Phase 14 concern)
- Hindi/multilingual template support
- Rate limiting on `whatsapp-send`
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SETUP-01 | Meta Business API setup guide with step-by-step instructions for WhatsApp Business Account, phone registration, and access token configuration | System User token flow documented; exact env vars identified from existing code |
| SETUP-02 | User can link WhatsApp account via verification code flow (env vars configured, Edge Function deployed, end-to-end working) | Existing code audit reveals complete flow already implemented; gaps identified for verification |
| SETUP-03 | User can tap "Open WhatsApp" button to jump directly to Dwella bot conversation after linking | wa.me deep link format confirmed; `WHATSAPP_BOT_PHONE` env var already exported in `constants/config.ts` |
</phase_requirements>

---

## Summary

Phase 11 is a foundation-laying phase with three workstreams: documentation, linking flow verification, and shared messaging infrastructure. The bulk of the coding work is creating the `whatsapp-send` Edge Function — a universal outbound message helper that all future phases will call. The linking flow (6-digit code, Supabase Realtime detection, profile UI) is already fully implemented and needs end-to-end smoke testing plus one additive change: an "Open WhatsApp" deep link button shown after linking.

The Meta WhatsApp Cloud API is well-understood based on the existing codebase. The current `whatsapp-webhook` already demonstrates the correct message-sending structure (`graph.facebook.com/v21.0/{PHONE_NUMBER_ID}/messages`), HMAC-SHA256 validation, and template invocation. The `whatsapp-send` Edge Function is a clean extraction and generalization of that inline `sendWhatsApp()` function, extended to cover interactive (reply buttons) and document types.

Template submission is a manual, time-sensitive step that must happen in Phase 11 because Meta approval takes 2-7 days and Phase 14 is blocked without approved templates. Templates are submitted via Meta Business Manager UI — no code required, just careful wording and category selection.

**Primary recommendation:** Build `whatsapp-send` first (other workstreams unblock from it), then wire `whatsapp-webhook` to call it, then add the "Open WhatsApp" button, then write the setup guide and submit templates. This ordering ensures the function is tested before it's in production call paths.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Deno std http/server | `0.177.0` | Edge Function HTTP server | Already used in all Supabase functions in this project |
| @supabase/supabase-js | `2` (via esm.sh) | DB access from Edge Functions | Project standard, already used everywhere |
| Meta Graph API | `v21.0` | WhatsApp Cloud API endpoint | Already used in `whatsapp-webhook` and `whatsapp-send-code` |
| React Native `Linking` | (React Native built-in) | Open `wa.me` deep link from app | Already used for Telegram deep link in profile screen |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `crypto.subtle` (Web Crypto) | Deno built-in | HMAC-SHA256 for Meta signature validation | Already used in `validateMetaSignature()` in webhook |

### No New Dependencies

This phase requires no new npm packages or Deno imports beyond what is already in the project. The `whatsapp-send` Edge Function uses only the same imports as existing functions.

**Version verification:** Existing functions already pin `deno.land/std@0.177.0` and `esm.sh/@supabase/supabase-js@2`. Keep the same pins.

---

## Architecture Patterns

### File Structure After Phase 11

```
supabase/functions/
├── whatsapp-send/          # NEW — universal outbound helper
│   └── index.ts
├── whatsapp-webhook/       # MODIFIED — replace inline sendWhatsApp() with fetch(WHATSAPP_SEND_URL)
│   └── index.ts
├── whatsapp-send-code/     # KEPT as thin wrapper OR deleted (Claude's discretion)
│   └── index.ts
└── [all other existing functions unchanged]

docs/
└── meta-setup.md           # NEW — full developer setup walkthrough

app/(tabs)/profile/
└── index.tsx               # MODIFIED — add "Open WhatsApp" button when whatsappLinked
```

### Pattern 1: whatsapp-send Edge Function Interface

The function receives a single JSON body with a discriminated union on `type`. Other Edge Functions call it via an internal `fetch()` using `SUPABASE_URL + '/functions/v1/whatsapp-send'` and the service role key as the Bearer token.

```typescript
// Request body schema
interface WhatsAppSendRequest {
  to: string;            // E.164 phone, e.g. "+919876543210"
  type: 'text' | 'template' | 'interactive' | 'document';

  // type === 'text'
  text?: string;

  // type === 'template'
  template?: {
    name: string;        // Must match approved template name exactly
    language?: string;   // Default: 'en' (ISO 639-1)
    components?: Array<{
      type: 'body' | 'header' | 'button';
      parameters: Array<{ type: 'text'; text: string }>;
    }>;
  };

  // type === 'interactive' (reply buttons — max 3 buttons)
  interactive?: {
    body: string;
    buttons: Array<{
      id: string;          // Max 256 chars, used in button_reply webhook payload
      title: string;       // Max 20 chars
    }>;
  };

  // type === 'document'
  document?: {
    link: string;          // Public HTTPS URL to the document
    filename?: string;     // Displayed filename in WhatsApp
    caption?: string;      // Optional text caption
  };
}
```

**Response:** `{ success: true }` on success, `{ error: string, status: number }` on failure. Always returns HTTP 200 to callers (internal function-to-function), with error info in the JSON body. This avoids callers needing to handle unexpected HTTP error codes from the helper.

### Pattern 2: Retry Logic

Based on D-08: retry once on 429 or 5xx with a 1-second delay. The retry is synchronous within the same request handler (not a queue).

```typescript
async function callMetaAPI(payload: object): Promise<Response> {
  const doFetch = () =>
    fetch(`https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

  let res = await doFetch();
  if ((res.status === 429 || res.status >= 500) && res.status !== 200) {
    await new Promise(r => setTimeout(r, 1000));
    res = await doFetch();
  }
  return res;
}
```

### Pattern 3: wa.me Deep Link Format

The "Open WhatsApp" button after linking opens the WhatsApp conversation directly:

```
URL format: https://wa.me/{E164_without_plus}
Example:    https://wa.me/919999999999

With pre-filled text (optional):
https://wa.me/919999999999?text=Hi%20Dwella%20bot
```

`WHATSAPP_BOT_PHONE` from `constants/config.ts` is already exported and available in `app/(tabs)/profile/index.tsx` (it's imported at line 8). The button construction is:

```typescript
const waUrl = `https://wa.me/${WHATSAPP_BOT_PHONE.replace(/^\+/, '')}`;
Linking.openURL(waUrl);
```

### Pattern 4: Meta API Payload Structures (Verified from existing codebase + official docs)

**Text message** (already in `whatsapp-webhook`):
```json
{
  "messaging_product": "whatsapp",
  "to": "+919876543210",
  "type": "text",
  "text": { "body": "Your message here" }
}
```

**Template message** (already in `whatsapp-send-code`):
```json
{
  "messaging_product": "whatsapp",
  "to": "+919876543210",
  "type": "template",
  "template": {
    "name": "dwella_rent_reminder",
    "language": { "code": "en" },
    "components": [
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "Ravi" },
          { "type": "text", "text": "15000" },
          { "type": "text", "text": "5th March" }
        ]
      }
    ]
  }
}
```

**Interactive reply buttons** (new in this phase):
```json
{
  "messaging_product": "whatsapp",
  "to": "+919876543210",
  "type": "interactive",
  "interactive": {
    "type": "button",
    "body": { "text": "Choose an option:" },
    "action": {
      "buttons": [
        { "type": "reply", "reply": { "id": "menu_payments", "title": "Payments" } },
        { "type": "reply", "reply": { "id": "menu_maintenance", "title": "Maintenance" } }
      ]
    }
  }
}
```

**Document message** (new in this phase):
```json
{
  "messaging_product": "whatsapp",
  "to": "+919876543210",
  "type": "document",
  "document": {
    "link": "https://example.com/lease.pdf",
    "filename": "lease-2024.pdf",
    "caption": "Your lease agreement"
  }
}
```

### Pattern 5: whatsapp-webhook Refactor

Replace the current inline `sendWhatsApp()` function (lines 19-41 of `whatsapp-webhook/index.ts`) with a call to the new Edge Function:

```typescript
const WHATSAPP_SEND_URL = `${SUPABASE_URL}/functions/v1/whatsapp-send`;

async function sendWhatsApp(to: string, text: string) {
  const res = await fetch(WHATSAPP_SEND_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify({ to, type: 'text', text }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('whatsapp-send error:', err);
  }
}
```

### Anti-Patterns to Avoid

- **Hardcoding PHONE_NUMBER_ID in whatsapp-send:** Always read from `Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')`. The env var is already set in all existing functions.
- **Throwing on Meta API failures:** The helper should log errors and return `{ error }` — callers handle gracefully. Never let a WhatsApp send failure crash the webhook response.
- **Sending template messages inside 24-hour session window thinking they're free:** Template messages bypass the 24-hour window but still consume template quota. This is the correct approach for scheduled notifications.
- **Button title > 20 characters:** WhatsApp rejects interactive messages with button titles over 20 chars. Keep button labels short.
- **Using personal developer token in production:** This expires every 24 hours and will silently break outbound sending. Must use System User permanent token (D-03).
- **Forgetting `messaging_product: 'whatsapp'`:** Required in every API request body — Meta returns 400 without it.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Phone E.164 normalization | Custom regex | `normalizePhone()` already in `whatsapp-webhook/index.ts` — extract to shared util OR duplicate (it's 3 lines) | Already battle-tested in production |
| HMAC validation | New implementation | `validateMetaSignature()` already in `whatsapp-webhook/index.ts` | Copy the pattern, don't reinvent |
| WhatsApp message sending | Custom fetch wrapper per function | The new `whatsapp-send` Edge Function | All callers use the same code path |
| Deep link URL construction | Custom library | `Linking.openURL()` (React Native built-in) already used for Telegram deep link | Project already uses this pattern |
| Realtime linking detection | Polling loop | Supabase Realtime channel already wired in profile screen (lines 310-337) | Already works — do not replace |

**Key insight:** The existing codebase has already implemented ~80% of what's needed. Phase 11 is primarily extraction, consolidation, and verification — not greenfield development.

---

## Common Pitfalls

### Pitfall 1: Template Name Mismatch
**What goes wrong:** `whatsapp-send` sends a template with name `dwella_rent_reminder` but the approved template in Meta Business Manager was submitted as `dwella-rent-reminder` (hyphens vs underscores). Meta returns error code 132001.
**Why it happens:** Meta template names must use only lowercase letters, numbers, and underscores. Submission typos cause silent mismatches.
**How to avoid:** Use underscores only. Document the exact names in `docs/meta-setup.md`. Cross-check submitted names against the names used in code before submission.
**Warning signs:** Meta API returns `{"error":{"code":132001,"message":"Template name does not exist"}}`.

### Pitfall 2: System User Token Not Assigned to WhatsApp Account
**What goes wrong:** System User token is generated but not assigned to the WhatsApp Business Account asset. API calls return 403 or "permission denied."
**Why it happens:** Meta Business Manager has two separate steps: (1) create System User, (2) assign WhatsApp Account asset to that user. Many guides only show step 1.
**How to avoid:** In Business Settings → Accounts → WhatsApp Accounts → select account → People → Add People → assign the System User with Full Control. Document both steps explicitly.
**Warning signs:** Token generates successfully but `/messages` calls return HTTP 403.

### Pitfall 3: Template Approval Category Rejection
**What goes wrong:** `dwella_rent_reminder` submitted as "Utility" but Meta recategorizes it as "Marketing" (or rejects it) because the phrasing "avoid late fees" is interpreted as a commercial incentive.
**Why it happens:** As of April 2025, Meta auto-recategorizes templates. Marketing templates have higher per-message cost.
**How to avoid:** Keep template language factual and transactional: state the amount, due date, and app action. Avoid words like "penalty," "discount," or "offer." If recategorized, accept it — the approval still works, just at a different billing rate.
**Warning signs:** Template moves to "In Review" for more than 48 hours or gets rejected with category mismatch error.

### Pitfall 4: wa.me URL includes "+" prefix
**What goes wrong:** `WHATSAPP_BOT_PHONE` is stored as `+919999999999`. Using it directly in `wa.me/+919999999999` may fail on some platforms.
**Why it happens:** `wa.me` format requires the number without the "+" prefix.
**How to avoid:** Strip leading `+` before constructing the URL: `WHATSAPP_BOT_PHONE.replace(/^\+/, '')`.
**Warning signs:** WhatsApp opens but goes to wrong number or shows "Invalid link."

### Pitfall 5: Inline sendWhatsApp() Left in whatsapp-webhook After Refactor
**What goes wrong:** `whatsapp-send` is deployed but `whatsapp-webhook` still uses its local `sendWhatsApp()`. Now there are two code paths — bugs fixed in `whatsapp-send` don't apply to webhook replies.
**Why it happens:** Partial refactor.
**How to avoid:** Remove the local `sendWhatsApp()` function from `whatsapp-webhook` when wiring in the new function. The old function is ~22 lines (lines 19-41) — confirm deletion.
**Warning signs:** `whatsapp-send` logs show no calls from webhook traffic.

### Pitfall 6: whatsapp-send-code Left Deployed as Duplicate
**What goes wrong:** Both `whatsapp-send-code` and `whatsapp-send` are deployed. `lib/bot.ts:initiateWhatsAppLink()` still calls `whatsapp-send-code`. If `whatsapp-send-code` is kept, it must be updated or removed.
**Why it happens:** Incomplete migration.
**How to avoid:** Update `lib/bot.ts:initiateWhatsAppLink()` to call `whatsapp-send` with `type: 'template'` instead of `whatsapp-send-code`. Then either delete `whatsapp-send-code` or convert it to a thin wrapper that calls `whatsapp-send`.

---

## Existing Code Audit: Linking Flow (SETUP-02)

The linking flow is fully implemented across these files. Phase 11 verifies end-to-end behavior and fixes discovered bugs.

| Component | File | Status | What to Verify |
|-----------|------|--------|----------------|
| Code generation | `lib/bot.ts:initiateWhatsAppLink()` | Built | `secureRandomDigits(6)` generates correct code; stores to `whatsapp_verify_code` column; calls `whatsapp-send-code` |
| Code sending | `supabase/functions/whatsapp-send-code/index.ts` | Built | Sends `dwella_verification` template with correct body parameter |
| Code verification | `supabase/functions/whatsapp-webhook/index.ts` (lines 128-166) | Built | Regex `/^\d{6}$/.test(text.trim())` matches correctly; updates `whatsapp_phone` and clears `whatsapp_verify_code` |
| Realtime detection | `app/(tabs)/profile/index.tsx` (lines 310-337) | Built | Supabase Realtime channel on `users` table UPDATE; triggers toast and `setUser()` |
| Profile UI | `app/(tabs)/profile/index.tsx` (lines 454-513) | Built | Phone input, "Send Verification Code" button, status chip, unlink button |
| DB schema | `supabase/migrations/015_whatsapp.sql` | Applied | `whatsapp_phone TEXT UNIQUE`, `whatsapp_verify_code TEXT`, index on `whatsapp_phone` |

**Known gap:** The "Open WhatsApp" button (SETUP-03) is NOT present in the current profile screen. Looking at lines 466-513, the `whatsappLinked` branch shows the phone number and an "Unlink WhatsApp" button but no "Open WhatsApp" CTA. This is the one UI change needed.

---

## Template Specification (SETUP-01 documentation content)

These are the exact templates to submit in Meta Business Manager. All are Utility category. All include a CTA button.

### Template: dwella_verification (ALREADY EXISTS — verify approval status)
- **Category:** Authentication
- **Body:** `Your Dwella verification code is {{1}}. This code expires in 10 minutes.`
- **Variables:** `{{1}}` = 6-digit code

### Template: dwella_rent_reminder (SUBMIT IN PHASE 11)
- **Category:** Utility
- **Body:** `Hi {{1}}, your rent of ₹{{2}} is due on {{3}}. Pay via the Dwella app to keep your account up to date.`
- **Variables:** `{{1}}` = tenant name, `{{2}}` = amount, `{{3}}` = due date
- **Button (CTA URL):** Text: "Open Dwella", URL: app store / deep link URL

### Template: dwella_payment_confirmed (SUBMIT IN PHASE 11)
- **Category:** Utility
- **Body:** `Hi {{1}}, your rent payment of ₹{{2}} for {{3}} has been confirmed. Thank you!`
- **Variables:** `{{1}}` = tenant name, `{{2}}` = amount, `{{3}}` = month (e.g., "March 2026")
- **Button (CTA URL):** Text: "Open Dwella", URL: app store / deep link URL

### Template: dwella_maintenance_update (SUBMIT IN PHASE 11)
- **Category:** Utility
- **Body:** `Hi {{1}}, your maintenance request "{{2}}" has been updated to: {{3}}. Open Dwella to view details.`
- **Variables:** `{{1}}` = user name, `{{2}}` = request description, `{{3}}` = new status
- **Button (CTA URL):** Text: "Open Dwella", URL: app store / deep link URL

**Note on button URL:** Use the Expo deep link `dwella://` if you want in-app navigation, or use the public app store URL as fallback for users without the app installed. For Phase 11, using the Play Store/App Store URL is acceptable since it always works. The placeholder URLs from `supabase/functions/invite-redirect/index.ts` env vars (`APPLE_APP_STORE_URL`, `GOOGLE_PLAY_STORE_URL`) are the right values to use.

---

## Meta Setup Guide Outline (docs/meta-setup.md content)

The guide must cover exactly these steps for SETUP-01 compliance:

1. **Prerequisites** — Meta Business Account, verified phone number not registered on WhatsApp
2. **Create Meta App** — developers.facebook.com → My Apps → Create App → Business type
3. **Add WhatsApp Product** — App Dashboard → Add Products → WhatsApp → Set Up
4. **Register Phone Number** — WhatsApp → Getting Started → Add Phone Number (or use test number)
5. **Get Phone Number ID** — shown in WhatsApp → Getting Started; save as `WHATSAPP_PHONE_NUMBER_ID`
6. **Create System User** — Business Settings → Users → System Users → Add (Admin role)
7. **Assign App to System User** — System User → Assign Assets → Apps → Full Control
8. **Assign WhatsApp Account to System User** — Business Settings → Accounts → WhatsApp Accounts → People → Add System User → Full Control
9. **Generate Permanent Token** — System User → Generate Token → select app → permissions: `whatsapp_business_messaging` + `whatsapp_business_management` → Generate; store as `WHATSAPP_ACCESS_TOKEN`
10. **Get App Secret** — App Dashboard → Settings → Basic → App Secret; store as `WHATSAPP_APP_SECRET`
11. **Set Verify Token** — choose any random string; store as `WHATSAPP_VERIFY_TOKEN`
12. **Configure Webhook** — WhatsApp → Configuration → Edit Webhook → URL: `{SUPABASE_URL}/functions/v1/whatsapp-webhook` → Verify Token → Subscribe to `messages` field
13. **Set Environment Variables** — table of all vars and where they go (Supabase Dashboard → Edge Functions → Secrets)
14. **Deploy Edge Functions** — `supabase functions deploy whatsapp-webhook whatsapp-send-code whatsapp-send`
15. **Submit Templates** — WhatsApp Manager → Message Templates → Create Template (exact wording per D-11 through D-15)
16. **Smoke Test** — send a message to the bot phone; confirm webhook receives it; confirm reply comes back

**Env vars table:**

| Variable | Where to Get | Where to Set |
|----------|-------------|--------------|
| `WHATSAPP_ACCESS_TOKEN` | System User → Generate Token | Supabase Edge Function Secrets |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp → Getting Started | Supabase Edge Function Secrets |
| `WHATSAPP_VERIFY_TOKEN` | Choose any random string | Supabase Edge Function Secrets |
| `WHATSAPP_APP_SECRET` | App Settings → Basic → App Secret | Supabase Edge Function Secrets |
| `EXPO_PUBLIC_WHATSAPP_BOT_PHONE` | Your registered WhatsApp number (E.164) | `.env` file |

---

## Validation Architecture

`nyquist_validation` is enabled in `.planning/config.json`.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest via `jest-expo` preset |
| Config file | `jest.config.js` (exists at project root) |
| Quick run command | `npx jest __tests__/whatsapp-send.test.ts --no-coverage` |
| Full suite command | `npx jest --no-coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SETUP-01 | `docs/meta-setup.md` exists and covers all required sections | manual | File presence check: `ls docs/meta-setup.md` | Wave 0 |
| SETUP-02 | `initiateWhatsAppLink()` stores code and calls send function | unit | `npx jest __tests__/bot.test.ts --no-coverage` | Partial (existing `__tests__/bot.test.ts` tests crypto, not linking) |
| SETUP-02 | `normalizePhone()` / E.164 normalization correct | unit | `npx jest __tests__/whatsapp-send.test.ts --no-coverage` | Wave 0 |
| SETUP-02 | Webhook 6-digit code matching logic | unit | `npx jest __tests__/whatsapp-send.test.ts --no-coverage` | Wave 0 |
| SETUP-03 | `wa.me` URL constructed correctly (no leading `+`) | unit | `npx jest __tests__/whatsapp-send.test.ts --no-coverage` | Wave 0 |

Note: Actual end-to-end WhatsApp verification (send code → receive on phone → send back → confirm linking) is manual-only — requires a live Meta account and phone.

### Sampling Rate
- **Per task commit:** `npx jest __tests__/whatsapp-send.test.ts --no-coverage`
- **Per wave merge:** `npx jest --no-coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `__tests__/whatsapp-send.test.ts` — covers E.164 normalization, wa.me URL construction, and mock-based tests for `whatsapp-send` request schema validation

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Temp developer token (24h) | System User permanent token | Meta requirement for production | Must follow D-03 — temp token will break production nightly |
| Inline send helpers per function | Centralized `whatsapp-send` Edge Function | Phase 11 (this phase) | Single deploy point, consistent logging, one retry policy |
| `whatsapp-send-code` as standalone function | Template sending handled by `whatsapp-send` | Phase 11 (this phase) | `whatsapp-send-code` becomes redundant |
| Template auto-recategorization opt-in | Meta auto-applies category changes (no opt-in) | April 2025 | `allow_category_change` field no longer supported; accept Meta's category decision |

**Current Meta Graph API version in use:** `v21.0` (from both `whatsapp-webhook` and `whatsapp-send-code`). Keep this version for `whatsapp-send` to maintain consistency.

---

## Open Questions

1. **dwella_verification template approval status**
   - What we know: The template name `dwella_verification` is hardcoded in `whatsapp-send-code/index.ts`. It was presumably submitted at some point.
   - What's unclear: Whether it was ever actually submitted and approved in Meta Business Manager, or if it exists only in code.
   - Recommendation: Verify in Meta Business Manager → WhatsApp Manager → Message Templates as the first task of Phase 11. If not submitted, submit it first before any end-to-end testing of the linking flow.

2. **whatsapp-send-code: delete or thin-wrapper?**
   - What we know: D-10 says `whatsapp-send-code` is made redundant; D-09 defers the refactor timing to Claude's discretion.
   - What's unclear: Whether `whatsapp-send-code` is referenced by any external systems (Supabase cron, other callers).
   - Recommendation: Check for callers → only `lib/bot.ts:initiateWhatsAppLink()` calls it. Update that call to `whatsapp-send`, then delete `whatsapp-send-code`. Deleting is cleaner than a thin wrapper.

3. **Template CTA button URL for app**
   - What we know: Templates require a URL for the CTA button. App store URLs are placeholder in current code.
   - What's unclear: Whether the Expo deep link `dwella://` works as a template button URL for users who have the app, or if Meta requires an HTTPS URL.
   - Recommendation: Use HTTPS app store URLs for template buttons (Meta requires HTTPS for CTA URLs, `dwella://` scheme will be rejected). Document in setup guide.

---

## Sources

### Primary (HIGH confidence)
- Existing project code (`whatsapp-webhook/index.ts`, `whatsapp-send-code/index.ts`, `lib/bot.ts`, `app/(tabs)/profile/index.tsx`) — direct inspection of working implementation
- `supabase/migrations/015_whatsapp.sql` — confirmed schema for `whatsapp_phone` and `whatsapp_verify_code`
- `constants/config.ts` — confirmed `WHATSAPP_BOT_PHONE` is already exported

### Secondary (MEDIUM confidence)
- [Meta WhatsApp Cloud API — Messages Reference](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages/) — message payload structures
- [Meta Interactive Reply Buttons](https://developers.facebook.com/docs/whatsapp/cloud-api/messages/interactive-reply-buttons-messages/) — interactive button payload format and constraints
- [Meta Auth Tokens Blog](https://developers.facebook.com/blog/post/2022/12/05/auth-tokens/) — System User permanent token requirement
- [Meta Template Approval Guide](https://support.wati.io/en/articles/12320234-understanding-meta-s-latest-updates-on-template-approval) — April 2025 auto-recategorization behavior

### Tertiary (LOW confidence)
- [wa.me deep link format](https://chatfuel.com/blog/create-whatsapp-link) — phone number format without `+` prefix (single source, but cross-verified with wa.me behavior)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all tools are already in production use in this codebase
- Architecture: HIGH — `whatsapp-send` is a clean extraction of existing inline code; Meta API payload structures verified from live project code and official docs
- Pitfalls: HIGH — token expiry, template naming, System User assignment steps verified from official Meta documentation and community sources
- Linking flow: HIGH — full source code audit confirms implementation exists; gap (missing "Open WhatsApp" button) identified by direct inspection

**Research date:** 2026-03-21
**Valid until:** 2026-06-21 (Meta API stable; Graph v21.0 in use since late 2024)

---
phase: 12-media-handling
verified: 2026-03-21T14:45:00Z
status: human_needed
score: 9/9 must-haves verified
human_verification:
  - test: "Send a real WhatsApp photo message and confirm bot attaches it as payment proof in the app"
    expected: "Payment proof appears on the correct tenant/month, bot sends confirmation reply"
    why_human: "Requires real WhatsApp round-trip — Meta CDN download, Claude vision API call, and Supabase Storage write can only be confirmed with live credentials"
  - test: "Send a PDF document via WhatsApp and confirm it appears under Documents in the app"
    expected: "Document row inserted in DB, file in Supabase Storage, bot sends confirmation reply"
    why_human: "Requires real WhatsApp message with a document attachment and live Supabase Storage bucket access"
  - test: "Send a video via WhatsApp and confirm the bot replies with the unsupported-type message"
    expected: "Bot replies: 'I can only accept photos (payment proofs) and documents (PDFs, Word files). For other requests, just type your message.'"
    why_human: "Requires real WhatsApp inbound message of type 'video'"
  - test: "Send a photo with no caption when classification fails"
    expected: "Bot replies: 'I couldn't tell if this photo is a payment receipt. If it is, add a caption...'"
    why_human: "Claude vision classification failure depends on real image content and live Anthropic API"
---

# Phase 12: Media Handling Verification Report

**Phase Goal:** Tenants can send a photo via WhatsApp and it attaches as payment proof, and users can exchange documents via the WhatsApp bot
**Verified:** 2026-03-21T14:45:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Tenant sends a photo in WhatsApp chat and bot attaches it as payment proof to the correct tenant and month without any app interaction | ? HUMAN NEEDED | All code paths present: `classifyPaymentProof` → `findTenantForUser` → `payment-proofs` upload → `payments` update. Functional correctness requires live WhatsApp + Anthropic API. |
| 2 | User sends a document (lease, receipt) via WhatsApp and bot stores and acknowledges it | ? HUMAN NEEDED | Code path present: `downloadMediaBinary` → `documents` Storage upload → `documents` table insert → `sendWhatsApp` reply. Functional correctness requires live WhatsApp + Supabase. |
| 3 | Bot responds with a confirmation message when media is successfully processed, or a clear error if classification fails | ✓ VERIFIED | All five reply strings implemented and match UI-SPEC copywriting contract exactly: success (line 406), classification failure (line 412), no tenant (lines 339, 448), processing error (lines 361, 468, 510), unsupported type (line 497). |
| 4 | Inbound media is downloaded from Meta CDN within 5 minutes of receipt and stored in Supabase Storage | ✓ VERIFIED (logic) / ? HUMAN NEEDED (timing) | Two-step CDN download is sequential and immediate in the handler (lines 306-307): `getMediaDownloadUrl` then `downloadMediaBinary` in the same invocation, no async gaps. Timing compliance requires production monitoring. |

**Score:** 4/4 truths verified at code level; 4 items flagged for human confirmation of live behavior.

---

### Derived Truths (from Plan must_haves)

#### Plan 12-01 Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | whatsapp-media Edge Function exists and accepts POST with user_id, phone, msg_type, media fields | ✓ VERIFIED | File exists at 521 lines. Validates all four required fields at lines 295-301. |
| 2 | Image messages are downloaded from Meta CDN via two-step fetch and classified by Claude vision | ✓ VERIFIED | `getMediaDownloadUrl` (line 50) → `downloadMediaBinary` (line 58) → `classifyPaymentProof` (line 144). Meta CDN pattern `graph.facebook.com/v21.0/` at line 51. Claude API `api.anthropic.com/v1/messages` at line 150. |
| 3 | Classified payment proof images are uploaded to payment-proofs bucket and payments.proof_url updated | ✓ VERIFIED | `from('payment-proofs').upload()` at line 354 with `upsert: true`. `payments.update({ proof_url: storagePath })` at line 381. Creates new row with `proof_url` if no existing payment at line 389-399. |
| 4 | Document messages are downloaded from Meta CDN, uploaded to documents bucket, and documents row inserted | ✓ VERIFIED | CDN download reused (lines 306-307). `from('documents').upload()` at line 461. `documents` table insert at line 474-483. |
| 5 | Confirmation or error reply is sent back via whatsapp-send for every media message | ✓ VERIFIED | Every branch ends with `sendWhatsApp()`. Outer try/catch at line 501-520 attempts best-effort reply even on unexpected errors. |

#### Plan 12-02 Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 6 | Image messages in WhatsApp are routed to whatsapp-media instead of being silently dropped | ✓ VERIFIED | `msgType === 'image' || msgType === 'document'` check at line 114 precedes the `!text.trim()` guard at line 174. `fetch(WHATSAPP_MEDIA_URL, ...)` at line 132. |
| 7 | Document messages in WhatsApp are routed to whatsapp-media instead of being silently dropped | ✓ VERIFIED | Same branch as above — `msgType === 'document'` included in the condition at line 114. `msg_type: msgType` and `media: msg[msgType]` passed at lines 141-142. |
| 8 | Unsupported media types (video, audio, sticker) receive an error reply telling user what is supported | ✓ VERIFIED | Array includes check `['video', 'audio', 'sticker', 'location', 'contacts'].includes(msgType)` at line 156. Reply sent at line 168 for linked users. |
| 9 | Text messages and verification codes continue to work exactly as before | ✓ VERIFIED | `whatsapp_verify_code` flow at lines 196, 210. `PROCESS_BOT_URL` forwarding at line 237-250. `validateMetaSignature` HMAC check at line 86. `normalizePhone` at line 13. All preserved unchanged. |

**Score:** 9/9 must-have truths verified at code level.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|---------|--------|---------|
| `supabase/functions/whatsapp-media/index.ts` | Complete media processing pipeline | ✓ VERIFIED | 521 lines. All required functions present: `getMediaDownloadUrl`, `downloadMediaBinary`, `getExtFromMimeType`, `findTenantForUser`, `sendWhatsApp`, `classifyPaymentProof`, `buildContext`, `sanitizeForContext`, `arrayBufferToBase64`. |
| `supabase/functions/whatsapp-webhook/index.ts` | Media type detection and routing | ✓ VERIFIED | Contains `WHATSAPP_MEDIA_URL` constant, `msgType === 'image'` branch, unsupported type guard, delegation payload. All existing behavior preserved. |

---

### Key Link Verification

#### Plan 12-01 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `whatsapp-media/index.ts` | `https://graph.facebook.com/v21.0/{mediaId}` | `fetch` with Bearer token | ✓ WIRED | Line 51: `fetch(\`https://graph.facebook.com/v21.0/${mediaId}\`, { headers: { Authorization: \`Bearer ${WHATSAPP_ACCESS_TOKEN}\` } })` |
| `whatsapp-media/index.ts` | `https://api.anthropic.com/v1/messages` | Claude vision API call with base64 image | ✓ WIRED | Line 150: `fetch('https://api.anthropic.com/v1/messages', ...)` with base64 image content block |
| `whatsapp-media/index.ts` | `supabase.storage.from('payment-proofs')` | upload ArrayBuffer | ✓ WIRED | Line 354: `.from('payment-proofs').upload(storagePath, buffer, { contentType: effectiveMime, upsert: true })` |
| `whatsapp-media/index.ts` | `supabase.storage.from('documents')` | upload ArrayBuffer | ✓ WIRED | Line 461: `.from('documents').upload(storagePath, buffer, { contentType: effectiveMime })` |
| `whatsapp-media/index.ts` | `whatsapp-send` Edge Function | fetch POST with text reply | ✓ WIRED | Line 9: `const WHATSAPP_SEND_URL = \`${SUPABASE_URL}/functions/v1/whatsapp-send\`` — used in every `sendWhatsApp()` call |

#### Plan 12-02 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `whatsapp-webhook/index.ts` | `whatsapp-media/index.ts` | fetch POST to `/functions/v1/whatsapp-media` | ✓ WIRED | Line 10: `const WHATSAPP_MEDIA_URL = \`${SUPABASE_URL}/functions/v1/whatsapp-media\`` used at line 132 |
| `whatsapp-webhook/index.ts` | `whatsapp-send/index.ts` | `sendWhatsApp()` for unsupported media error | ✓ WIRED | Line 168: `sendWhatsApp(senderPhone, 'I can only accept photos...')` inside the unsupported type branch |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| MEDIA-01 | 12-01-PLAN.md, 12-02-PLAN.md | Tenant can send a photo via WhatsApp and bot attaches it as payment proof to the correct tenant/month | ✓ SATISFIED | Complete image pipeline: Meta CDN download → Claude vision classify → `payment-proofs` upload → `payments.proof_url` update. Webhook routes image type to this pipeline. |
| MEDIA-02 | 12-01-PLAN.md, 12-02-PLAN.md | User can send/receive documents (leases, receipts) via WhatsApp bot | ✓ SATISFIED | Complete document pipeline: Meta CDN download → `documents` bucket upload → `documents` table insert. Webhook routes document type to this pipeline. |

No orphaned requirements — REQUIREMENTS.md maps only MEDIA-01 and MEDIA-02 to Phase 12, both accounted for.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | — |

No TODOs, FIXMEs, placeholders, stub return values, or empty implementations found in either modified file.

**Notes on design decisions that look like stubs but are not:**
- `findTenantForUser` always returns `tenants[0]` as final fallback (line 122) — this is an explicit plan decision documented in 12-01-SUMMARY.md ("Multi-tenancy heuristic: current-month pending/partial payment wins; first tenant is fallback"). The UI-SPEC's "Ambiguous tenant" copy entry is a listed state that was intentionally resolved by heuristic rather than a clarification prompt per plan design.
- The `whatsapp-media/index.ts` handler returns HTTP 200 on error (line 200, 363, 470, 516) — this is the correct pattern for Edge Functions acting as Meta webhook handlers (Meta requires 200 to suppress retries).

---

### Human Verification Required

#### 1. Payment Proof via WhatsApp Photo

**Test:** Send a real photo (e.g. a bank transfer screenshot) in WhatsApp to the configured Dwella bot number
**Expected:** Bot replies with "Got it! I've attached your payment photo as proof for {month} {year}. Your payment is now recorded as..." and the proof appears in the Dwella app under the tenant's payment for that month
**Why human:** Requires live WhatsApp credentials, real Meta CDN binary download, live Anthropic Claude vision API call, and live Supabase Storage write

#### 2. Document Sharing via WhatsApp

**Test:** Send a PDF or Word document in WhatsApp to the configured Dwella bot number
**Expected:** Bot replies with "Your document '{filename}' has been saved to your property files. You can view it in the Dwella app under Documents." and the document appears in the app
**Why human:** Requires real WhatsApp document message, live Meta CDN binary download, live Supabase Storage and DB write

#### 3. Unsupported Media Type Rejection

**Test:** Send a video or audio file in WhatsApp to the configured Dwella bot number
**Expected:** Bot replies with "I can only accept photos (payment proofs) and documents (PDFs, Word files). For other requests, just type your message."
**Why human:** Requires real WhatsApp inbound message of type 'video' or 'audio'

#### 4. Classification Failure Path

**Test:** Send an unrelated photo (e.g. a selfie) without a payment-related caption
**Expected:** Bot replies with "I couldn't tell if this photo is a payment receipt. If it is, add a caption like 'payment for March' and send again..."
**Why human:** Claude vision classification behavior depends on real image content and cannot be statically verified

---

### Gaps Summary

No gaps found. All 9 must-have truths are verified at the code level. Both MEDIA-01 and MEDIA-02 requirements are satisfied by the implementation. Both commits (`8502e06` for Plan 01, `07deed7` for Plan 02) are present in the git log. The phase goal is achieved in code — the only outstanding items are live end-to-end confirmations that require real WhatsApp credentials and the deployed Edge Functions.

---

_Verified: 2026-03-21T14:45:00Z_
_Verifier: Claude (gsd-verifier)_

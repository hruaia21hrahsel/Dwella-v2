# Phase 12: Media Handling - Research

**Researched:** 2026-03-21
**Domain:** WhatsApp Cloud API media download + Claude vision + Supabase Storage
**Confidence:** HIGH (core flow) / MEDIUM (webhook payload field names)

## Summary

Phase 12 wires up two capabilities that are currently silently broken: inbound photo messages and inbound document messages. The `whatsapp-webhook` currently extracts `msg.text` and returns early on empty text — so any image or document the user sends gets a 200 OK from Meta but no reply and no action taken.

The implementation involves three technical steps per inbound media message: (1) detect the media type in the webhook, (2) download the binary from Meta's CDN via a two-step API call, and (3) route based on type — images go through Claude vision for payment-proof classification and then into the existing `payment-proofs` Supabase Storage bucket; documents go directly into the existing `documents` Storage bucket with a DB row in the `documents` table. A confirmation text reply goes back via `whatsapp-send`.

The project already has all the infrastructure this phase needs: `payment-proofs` bucket (with RLS), `documents` bucket and table (with RLS), `payments.proof_url` column, the `whatsapp-send` Edge Function for replies, and `process-bot-message` for Claude API calls. Phase 12 adds no new DB migrations — it is purely a new Edge Function plus routing changes in the webhook.

**Primary recommendation:** Build a standalone `whatsapp-media` Edge Function that owns the entire download → classify → store → update DB pipeline. The webhook detects media type, delegates to `whatsapp-media`, then sends the reply. Keep concerns separated so each Edge Function is easy to test in isolation.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MEDIA-01 | Tenant can send a photo via WhatsApp and bot attaches it as payment proof to the correct tenant/month | Two-step CDN download confirmed; Claude vision for classification; `payment-proofs` bucket + `payments.proof_url` already exist |
| MEDIA-02 | User can send/receive documents (leases, receipts) via WhatsApp bot | Same two-step download; `documents` bucket + table already exist with full RLS; document type routed to `documents` table |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Meta Graph API | v21.0 | Two-step media download from CDN | Already used in `whatsapp-send` — same version, same auth token |
| Anthropic Messages API | `claude-sonnet-4-20250514` | Vision classification of payment-proof photos | Already used in `process-bot-message`; same API key |
| Supabase JS (`@supabase/supabase-js`) | `^2` | Storage upload + DB update | Already imported in all Edge Functions |
| Deno std `http/server.ts` | `0.177.0` | `serve()` entrypoint | Pinned version used across all project Edge Functions |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `crypto.randomUUID()` | Deno built-in | Generate unique file names for documents | No external dep needed |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Claude vision for payment classification | Hard-coded regex / keyword detection on caption | Claude handles ambiguous photos reliably; regex cannot analyze image content |
| Storing media in `payment-proofs` / `documents` buckets | Storing Meta CDN URL directly in DB | Meta CDN URLs expire — must download and store ourselves |

**Installation:** No new packages. All deps already in the project.

## Architecture Patterns

### Recommended Project Structure

```
supabase/functions/
├── whatsapp-webhook/index.ts    # Add media type detection + delegate to whatsapp-media
└── whatsapp-media/index.ts     # NEW: download → classify → store → reply pipeline
```

### Pattern 1: Two-Step Meta CDN Download

**What:** Meta does NOT embed the binary in the webhook. The `image.id` (or `document.id`) from the webhook payload must be resolved to a download URL via a separate Graph API call, then the binary fetched from that URL.

**When to use:** Any time `msg.type === 'image'` or `msg.type === 'document'` is detected in the webhook.

**Example (Deno):**
```typescript
// Source: Meta Graph API v21.0 + WhatsApp-JS-SDK pattern (verified via multiple sources)

const ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN')!;

// Step 1: Get download URL from media ID
async function getMediaDownloadUrl(mediaId: string): Promise<{ url: string; mime_type: string }> {
  const res = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Media metadata fetch failed: ${res.status}`);
  return await res.json(); // { url, mime_type, file_size, sha256, id, messaging_product }
}

// Step 2: Download the binary from the CDN URL
async function downloadMediaBinary(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Media binary download failed: ${res.status}`);
  return await res.arrayBuffer();
}
```

**Critical timing:** The CDN URL expires in approximately 5 minutes. Both steps must happen within the same Edge Function invocation — never store the CDN URL.

### Pattern 2: Webhook Message Type Detection

**What:** The current `whatsapp-webhook` only reads `msg['text']['body']`. Media messages have a different shape — `msg.type` is `'image'` or `'document'` and the content is in `msg['image']` or `msg['document']`, not `msg['text']`.

**Webhook payload structure** (MEDIUM confidence — confirmed across multiple third-party and official sources):

```typescript
// Image message
{
  "type": "image",
  "image": {
    "id": "592623615738103",      // media ID — use for two-step download
    "mime_type": "image/jpeg",
    "sha256": "LeRpQJq...",       // integrity hash
    "caption": "payment for March" // optional user-typed caption
  }
}

// Document message
{
  "type": "document",
  "document": {
    "id": "123456789",            // media ID
    "mime_type": "application/pdf",
    "filename": "lease.pdf",      // user's file name
    "caption": "my lease"         // optional
  }
}
```

**Integration point in existing webhook:**
```typescript
// Current code (line 109-113 of whatsapp-webhook/index.ts):
const text = (msg['text']?.['body'] as string) ?? '';
if (!text.trim()) {
  return new Response('OK', { status: 200 }); // <-- media messages silently dropped here
}

// New code replaces the early return:
const msgType = msg['type'] as string;
const text = (msg['text']?.['body'] as string) ?? '';

if (msgType === 'image' || msgType === 'document') {
  // delegate to whatsapp-media — do not fall through to process-bot-message
  await fetch(WHATSAPP_MEDIA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
    body: JSON.stringify({
      user_id: linkedUser.id,
      phone: senderPhone,
      msg_type: msgType,
      media: msg[msgType],   // passes the image or document object directly
    }),
  });
  return new Response('OK', { status: 200 });
}

if (!text.trim()) {
  return new Response('OK', { status: 200 });
}
```

### Pattern 3: Claude Vision for Payment Proof Classification

**What:** Pass the downloaded image as base64 to Claude with a structured prompt asking it to identify whether this is a payment screenshot, and extract the tenant's name hint (from caption or context) plus the amount if visible.

**When to use:** Only for `type === 'image'`. Documents skip classification.

**API call pattern (Deno, no SDK — matches existing `process-bot-message` style):**
```typescript
// Source: https://platform.claude.com/docs/en/build-with-claude/vision (confirmed HIGH confidence)

async function classifyPaymentProof(
  imageBase64: string,
  mimeType: string,
  caption: string,
  userContext: string, // tenant names and current month payment status from buildContext()
): Promise<{ is_payment_proof: boolean; tenant_name?: string; month?: number; year?: number; amount?: number }> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType, data: imageBase64 },
          },
          {
            type: 'text',
            text: `User context (their tenants and payment status):\n${userContext}\n\nUser caption: "${caption}"\n\nIs this a rent payment proof screenshot/photo? If yes, identify: tenant_name (match to context), month (1-12), year (4 digits), amount (number if visible). Reply ONLY with JSON: {"is_payment_proof": bool, "tenant_name": string|null, "month": number|null, "year": number|null, "amount": number|null}`,
          },
        ],
      }],
    }),
  });
  const data = await response.json();
  const raw = data.content?.[0]?.text ?? '{}';
  const json = raw.match(/\{[\s\S]*\}/)?.[0] ?? '{}';
  return JSON.parse(json);
}
```

**Supported image MIME types in Claude API:** `image/jpeg`, `image/png`, `image/gif`, `image/webp` (confirmed from official docs). The WhatsApp payment-proofs bucket already restricts to `image/jpeg`, `image/png`, `image/webp`.

**5 MB limit per image** (confirmed). WhatsApp compresses photos before sending — typical WhatsApp photo is 200KB-800KB. Well within limit.

### Pattern 4: Supabase Storage Upload from Edge Function

**What:** Upload an `ArrayBuffer` directly to a Supabase Storage bucket from a Deno Edge Function using the service role client.

**Storage paths (from existing migrations):**
- Payment proofs: `payment-proofs/{property_id}/{tenant_id}/{year}-{month}.jpg`
- Documents: `documents/{property_id}/{tenant_id}/{uuid}.{ext}` (tenant-specific) or `documents/{property_id}/property/{uuid}.{ext}` (property-wide)

```typescript
// Source: Supabase storage upload pattern (confirmed from official docs)
// Uses service-role client — bypasses RLS for server-side upload

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Payment proof upload
const storagePath = `${propertyId}/${tenantId}/${year}-${String(month).padStart(2,'0')}.jpg`;
const { error } = await supabase.storage
  .from('payment-proofs')
  .upload(storagePath, imageBuffer, {
    contentType: mimeType,
    upsert: true, // overwrite if tenant re-sends proof for same month
  });

// Update payment row with proof_url (storage path, not signed URL)
await supabase
  .from('payments')
  .update({ proof_url: storagePath, notes: 'Proof attached via WhatsApp' })
  .eq('tenant_id', tenantId)
  .eq('month', month)
  .eq('year', year);
```

**Document upload**
```typescript
const ext = getExtFromMimeType(mimeType); // pdf, jpeg, png, docx
const filename = `${crypto.randomUUID()}.${ext}`;
const storagePath = `${propertyId}/${tenantId}/${filename}`;

await supabase.storage
  .from('documents')
  .upload(storagePath, docBuffer, { contentType: mimeType });

await supabase.from('documents').insert({
  property_id: propertyId,
  tenant_id: tenantId,
  uploader_id: userId,
  name: originalFilename ?? filename,
  category: 'other',      // bot uploads default to 'other'; user can re-categorize in app
  storage_path: storagePath,
  mime_type: mimeType,
  file_size: docBuffer.byteLength,
});
```

### Pattern 5: Finding Tenant from Linked WhatsApp User

**What:** When a tenant sends a photo, we need to find their `tenant_id`, `property_id`, and current month's payment row. The sender is identified by `whatsapp_phone` → `users.id`, then `tenants` where `user_id = users.id`.

**Key insight:** A user might be a tenant in multiple properties. If there is exactly one active tenant row, use it automatically. If there are multiple, pick the one with a `pending`/`partial` payment for the current month, or ask the user to clarify.

```typescript
async function findTenantForUser(supabase, userId: string) {
  const { data: tenants } = await supabase
    .from('tenants')
    .select('id, property_id, tenant_name, properties(owner_id)')
    .eq('user_id', userId)
    .eq('is_archived', false);

  if (!tenants || tenants.length === 0) return null;
  if (tenants.length === 1) return tenants[0];

  // Multiple tenancies — prefer the one with an open payment this month
  const now = new Date();
  for (const t of tenants) {
    const { data: payment } = await supabase
      .from('payments')
      .select('id, status')
      .eq('tenant_id', t.id)
      .eq('month', now.getMonth() + 1)
      .eq('year', now.getFullYear())
      .in('status', ['pending', 'partial'])
      .single();
    if (payment) return t;
  }
  return tenants[0]; // fallback: first tenant
}
```

### Anti-Patterns to Avoid

- **Storing the Meta CDN URL in the DB:** The CDN URL expires in ~5 minutes. Always download and re-store in Supabase Storage immediately.
- **Calling `process-bot-message` for media:** The current bot brain is text-only (no vision). Media must be handled in `whatsapp-media` directly. Do not route through `process-bot-message`.
- **Blocking the webhook response with the full media pipeline:** Meta requires a reply within 15 seconds or retries the webhook. The webhook should fire `whatsapp-media` with `await` but the media function can do all processing before sending the reply — the webhook can return `200 OK` after `whatsapp-media` resolves since Edge Functions can handle the pipeline in ~5-8 seconds typically. If latency is a concern, fire-and-forget (no await), and let `whatsapp-media` call `whatsapp-send` for the reply itself.
- **Silently failing on unknown media types:** Respond with a text message telling the user what is supported (photos and documents).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tenant recognition from photo | Facial recognition, OCR tenant name | Claude vision + `buildContext()` context injection | Payment proofs are screenshots/transfer receipts — caption + context is sufficient; Claude handles ambiguity |
| File type validation | Custom MIME checker | WhatsApp restricts what it forwards; Supabase bucket `allowed_mime_types` enforces on upload | Defense in depth already in place |
| Signed URL generation for proof viewing | Custom URL builder | `supabase.storage.from('payment-proofs').createSignedUrl(path, 3600)` | Already used elsewhere in the app |

**Key insight:** Claude vision eliminates the need for any hand-rolled OCR or pattern matching to classify payment screenshots. A simple structured prompt with user context returns reliable JSON output.

## Common Pitfalls

### Pitfall 1: Meta Media URL 5-Minute Expiry
**What goes wrong:** Developer fetches the media URL in step 1, stores it, processes slowly, then step 2 download returns 403.
**Why it happens:** Meta CDN URLs are time-limited, not permanent.
**How to avoid:** Do step 1 and step 2 immediately in sequence within the same Edge Function invocation. No await gap of more than a few seconds between them.
**Warning signs:** 403 errors on the CDN URL fetch when processing is slow.

### Pitfall 2: Webhook Timeout on Heavy Processing
**What goes wrong:** The webhook handler awaits the full media pipeline (download + Claude API + Storage upload) and takes >15 seconds, causing Meta to retry.
**Why it happens:** Claude API call + large image download can take 3-8 seconds combined. Under load, this can exceed 15 seconds.
**How to avoid:** Two options: (a) call `whatsapp-media` without await and return 200 immediately — `whatsapp-media` sends the reply via `whatsapp-send`; or (b) keep await but ensure each step has a timeout. Option (a) is recommended per the roadmap plan structure.
**Warning signs:** Duplicate webhook invocations from Meta retry logic; duplicate processing.

### Pitfall 3: Multiple Tenancies Ambiguity
**What goes wrong:** A user linked to two tenancies sends a photo; bot attaches proof to the wrong tenant.
**Why it happens:** `whatsapp_phone` → `users.id` is 1:1, but `tenants.user_id` can have multiple rows.
**How to avoid:** Use the "current month open payment" heuristic first. If still ambiguous, send a clarification reply asking the user to specify ("Which property is this for — Sunrise Apt or Marina Heights?").
**Warning signs:** Wrong tenant gets proof_url updated.

### Pitfall 4: WhatsApp Document MIME Types
**What goes wrong:** WhatsApp sends `application/octet-stream` for some documents instead of `application/pdf`.
**Why it happens:** WhatsApp normalizes some MIME types inconsistently.
**How to avoid:** Fallback detection: if `mime_type === 'application/octet-stream'` and `filename` ends with `.pdf`, treat as `application/pdf`. The `documents` bucket allows `application/pdf` but not `application/octet-stream`.
**Warning signs:** Storage upload fails with MIME type mismatch error.

### Pitfall 5: RLS Bypass Required for Bot-Side Upload
**What goes wrong:** Using the anon client for storage upload fails RLS checks because the uploader is the bot, not the authenticated tenant user.
**Why it happens:** The `documents_storage_tenant_upload` policy checks `auth.uid()` matches the tenant's user_id. The Edge Function has no user session.
**How to avoid:** Always use the `SUPABASE_SERVICE_ROLE_KEY` client in `whatsapp-media` for storage uploads. The service role bypasses RLS. This is correct — the bot is acting on behalf of the authenticated user (identity already verified via `whatsapp_phone` lookup).
**Warning signs:** 403 from Supabase Storage with "new row violates row-level security policy."

## Code Examples

### Complete whatsapp-media Request Interface

```typescript
// POST /functions/v1/whatsapp-media (internal, called by whatsapp-webhook)
interface WhatsAppMediaRequest {
  user_id: string;         // users.id (from whatsapp_phone lookup)
  phone: string;           // E.164 sender phone (for reply via whatsapp-send)
  msg_type: 'image' | 'document';
  media: {
    id: string;            // Meta media ID — use for two-step download
    mime_type?: string;
    caption?: string;      // optional user text alongside the media
    filename?: string;     // document only
    sha256?: string;
  };
}
```

### MIME Type to Extension Helper

```typescript
function getExtFromMimeType(mime: string, filename?: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  };
  if (map[mime]) return map[mime];
  // Fallback: derive from filename extension
  if (filename) {
    const parts = filename.split('.');
    if (parts.length > 1) return parts[parts.length - 1].toLowerCase();
  }
  return 'bin';
}
```

### Confirmation Reply Messages

```typescript
// Payment proof attached successfully
`Got it! I've attached your payment photo as proof for ${monthName} ${year}. ` +
`Your payment is now recorded as "${newStatus}".`

// Document stored successfully
`Your document "${filename}" has been saved to your property files. ` +
`You can view it in the Dwella app under Documents.`

// Classification failed — image not recognized as payment proof
`I couldn't tell if this photo is a payment receipt. ` +
`If it is, please add a caption like "payment for March" and send again, ` +
`or log the payment via text: "Mark Ravi's March rent as paid"`

// Unknown media type
`I can only accept photos (payment proofs) and documents (PDFs, Word files). ` +
`For other requests, just type your message.`
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Download media with separate auth token | Same access token used for Graph API metadata + CDN download | Current (2022+) | Simpler auth — one token for everything |
| Meta media URLs lasted 24-48h | URLs expire in 5 minutes | 2023 change (privacy policy update) | Must download immediately in webhook handler |
| WhatsApp API v1.0 (on-premise) | Cloud API v21.0 (hosted by Meta) | 2022 | No self-hosted infrastructure needed |

**Deprecated/outdated:**
- On-premise WhatsApp Business API: Replaced by Cloud API. Irrelevant for this project (already using Cloud API).
- Storing Meta CDN URLs as permanent links: No longer valid due to 5-minute expiry.

## Open Questions

1. **What if Claude vision returns `is_payment_proof: false` for an actual payment photo?**
   - What we know: Claude vision is reliable for clear screenshots but may struggle with very blurry photos.
   - What's unclear: Failure rate in real usage.
   - Recommendation: On classification failure, send a clarification reply with instructions to add a caption. Do NOT auto-attach unclassified images to payments — incorrect proof attachment is worse than no attachment.

2. **Should `whatsapp-media` be fire-and-forget from the webhook?**
   - What we know: The roadmap plan structure separates routing (12-02) from the pipeline (12-01), suggesting the webhook delegates asynchronously.
   - What's unclear: Whether Supabase Edge Functions support true fire-and-forget (background processing after 200 response).
   - Recommendation: Await `whatsapp-media` within the webhook but rely on Edge Function timeout being >15 seconds. The webhook returns 200 after `whatsapp-media` resolves, which also sends the reply. If latency becomes an issue, revisit.

3. **WhatsApp document MIME type `application/octet-stream`**
   - What we know: Some WhatsApp clients send generic octet-stream for PDFs.
   - Recommendation: Add filename-based MIME fallback (Pitfall 4 section above). If still unresolvable, store with `category: 'other'` and note the original MIME in the `documents` table.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected — no test config files found in project |
| Config file | None — see Wave 0 |
| Quick run command | `npx tsc --noEmit` (TypeScript type check as proxy for unit correctness) |
| Full suite command | Manual smoke test: send photo in WhatsApp → verify DB update + Storage file |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MEDIA-01 | Image message in webhook triggers `whatsapp-media` call | smoke | Manual WhatsApp send + Supabase log check | No test file |
| MEDIA-01 | `classifyPaymentProof()` returns correct JSON for payment screenshot | unit | `npx tsc --noEmit` (type safety only) | No test file |
| MEDIA-01 | `payments.proof_url` is updated after image processed | smoke | Supabase dashboard query | No test file |
| MEDIA-02 | Document message creates `documents` row + Storage file | smoke | Manual WhatsApp send + Supabase dashboard | No test file |
| MEDIA-02 | Confirmation reply sent via `whatsapp-send` | smoke | WhatsApp chat observation | No test file |

### Sampling Rate

- **Per task commit:** `npx tsc --noEmit` (catch type errors early)
- **Per wave merge:** `npx tsc --noEmit` + manual end-to-end test in WhatsApp dev environment
- **Phase gate:** Both MEDIA-01 and MEDIA-02 manually verified before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] No automated test framework exists in this project — all validation is TypeScript check + manual smoke test
- [ ] Test: send actual WhatsApp image to bot, verify `payment-proofs` Storage bucket has file and `payments.proof_url` is set
- [ ] Test: send actual WhatsApp PDF to bot, verify `documents` table row created and Storage file exists

*(The project has zero test files. This is a pre-existing gap, not introduced by Phase 12.)*

## Sources

### Primary (HIGH confidence)

- Official Anthropic Claude vision docs (`platform.claude.com/docs/en/build-with-claude/vision`) — confirmed base64 image API format, 5 MB limit, supported MIME types, Deno-compatible raw fetch pattern
- WhatsApp-JS-SDK GitHub (`github.com/great-detail/WhatsApp-JS-SDK`) — confirmed two-step media download: GET `graph.facebook.com/v21.0/{media-id}` → GET CDN URL with bearer token
- Supabase Storage JS reference (`supabase.com/docs/reference/javascript/storage-from-upload`) — confirmed `upload(path, ArrayBuffer, { contentType, upsert })` interface
- `supabase/migrations/002_storage.sql` — `payment-proofs` bucket confirmed with path `{property_id}/{tenant_id}/{year}-{month}.jpg`
- `supabase/migrations/019_documents.sql` — `documents` bucket + table confirmed with full RLS
- `supabase/migrations/001_initial_schema.sql` — `payments.proof_url TEXT` column confirmed
- `supabase/functions/whatsapp-webhook/index.ts` — current code confirms media messages are silently dropped at line 111
- `supabase/functions/whatsapp-send/index.ts` — confirmed `document` type already supported for outbound

### Secondary (MEDIUM confidence)

- YCloud webhook examples (`docs.ycloud.com/reference/whatsapp-inbound-message-webhook-examples`) — image webhook payload fields `id`, `mime_type`, `sha256`, `caption`
- Multiple search sources confirming 5-minute CDN URL expiry (Medium article, hookdeck.com guide)
- Meta developer search results confirming Graph API v21.0 endpoint pattern for media retrieval

### Tertiary (LOW confidence)

- Document MIME type inconsistency (`application/octet-stream`) — based on community reports, not official documentation. Flag for validation during implementation.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all libraries already used in project, same versions
- Architecture patterns: HIGH — two-step download confirmed by SDK; Claude vision confirmed by official docs; Storage upload confirmed by official docs
- Pitfalls: MEDIUM — CDN expiry and RLS bypass are confirmed; webhook timeout and MIME inconsistency are based on community patterns, not official Meta documentation
- Webhook payload field names: MEDIUM — confirmed via third-party sources but Meta's own docs page returned CSS instead of content during research

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (30 days — Meta Graph API is stable; Claude vision API is stable)

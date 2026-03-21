# Pitfalls Research

**Domain:** WhatsApp Cloud API + Interactive Messaging + Media Handling — v1.2 WhatsApp Bot Expansion
**Researched:** 2026-03-21
**Confidence:** HIGH (findings cross-verified with Meta official docs, multiple credible third-party sources, and existing Dwella codebase patterns)

---

## Critical Pitfalls

### Pitfall 1: Sending Non-Template Messages Outside the 24-Hour Customer Service Window

**What goes wrong:**
The WhatsApp Cloud API enforces a strict 24-hour messaging window. Outside that window — when the user has not sent a message in the past 24 hours — you can only send pre-approved template messages. Sending a free-form text message, an interactive button message, or a media message outside the window fails with a 131047 error ("Re-engagement message"). Developers often discover this only after the feature is deployed when real users are inactive overnight.

**Why it happens:**
Developers test the bot by sending a message and immediately responding. The 24-hour window is always open during testing. Production use cases (reminders, outbound notifications, receipt confirmations) are sent hours or days after the last user message, which is outside the window.

**How to avoid:**
- All outbound Edge Functions (OUT-01 rent reminders, OUT-02 payment receipts, OUT-03 maintenance notifications) must use approved template messages — never free-form text.
- Interactive reply button messages (RICH-02, RICH-03 menus) cannot be sent as outbound notifications. They are only valid inside the 24-hour window. If you want to re-engage a user, use a template to open a new window, then follow up with the interactive menu.
- Design two code paths in the Edge Functions: one for inside-window (interactive buttons allowed) and one for outside-window (template only). Use the WhatsApp error response to detect the state, or track last-interaction time in the database.

**Warning signs:**
- Integration test passes but production reminders fail with error 131047.
- Reminders work in morning tests but fail for users who haven't chatted for a day.

**Phase to address:**
Setup & Outbound Messaging phase. Template design must happen before outbound Edge Functions are coded. Do not wire OUT-01, OUT-02, OUT-03 until approved templates exist for each.

---

### Pitfall 2: Interactive Button Messages Are Not Templates — Cannot Be Sent Outside the 24-Hour Window

**What goes wrong:**
Interactive reply button messages (type: `interactive`, buttons with 3 max) look like templates and feel like templates, but they are NOT template messages. Meta does not require approval for them, but they can only be sent within an active 24-hour conversation window. This makes interactive menus impossible to use as notification openers. The RICH-02 main menu is session-only.

**Why it happens:**
The Meta documentation separates "template messages" from "interactive messages" in different sections. Developers who build the menu first and the notification flow second often design menus as the notification entry point, which breaks outside the window.

**How to avoid:**
- Interactive menus (RICH-02, RICH-03) must only be triggered in response to an inbound user message.
- Outbound proactive messages (reminders, receipts, notifications) must use template messages, not interactive buttons. After the template is received and the user replies, the next response can include an interactive menu.
- The welcome message (RICH-01) sent after account linking should be a template message (the linking event constitutes the business-initiated open of a conversation window), then a follow-up interactive menu can be sent within that session.

**Warning signs:**
- Menu appears in manual testing but fails when triggered by a pg_cron scheduled Edge Function.
- Error 131047 or 132000 on any message type other than template in a scheduled function.

**Phase to address:**
Rich Messaging phase. The distinction between template and interactive must be encoded in the shared bot message dispatch utility before any menu work begins.

---

### Pitfall 3: Media URL Expiry — 5-Minute Window After Webhook Delivery

**What goes wrong:**
When a user sends a photo (e.g., payment proof via MEDIA-01), the WhatsApp webhook delivers a media object containing a media ID, not a direct URL. You must call the Graph API to retrieve a temporary download URL. That URL expires in approximately 5 minutes and requires an Authorization header with the access token to download. If the Edge Function processes the webhook asynchronously or queues it, the URL may already be expired before the download attempt.

**Why it happens:**
Developers familiar with Telegram (where `file_id` can be resolved at any time) assume WhatsApp behaves similarly. WhatsApp's CDN URLs are ephemeral and authenticated — they are not public.

**How to avoid:**
- The `whatsapp-webhook` Edge Function must download and transfer media to Supabase Storage synchronously as the first action after webhook receipt, before any other processing.
- Never pass the media ID to a downstream function for later resolution. Resolve and download immediately.
- The download request must include `Authorization: Bearer {WHATSAPP_TOKEN}` in the header.
- Store the Supabase Storage path (not the temporary CDN URL) on the payment or document record.

**Warning signs:**
- Media download succeeds during testing but fails intermittently in production (Edge Function cold starts, queue delays).
- HTTP 401 or 403 errors on media download — the token is correct but the URL has expired.

**Phase to address:**
Media Handling phase. The media download-and-store pipeline must be the first thing built and tested before MEDIA-01 or MEDIA-02 are considered complete.

---

### Pitfall 4: Template Rejection and Automatic Recategorization

**What goes wrong:**
Meta rejects or automatically recategorizes WhatsApp message templates without warning. A template submitted as "Utility" (rent reminder, payment receipt, maintenance notification) can be approved as "Marketing" instead, which costs more per send and is subject to stricter frequency limits. As of April 2025, Meta no longer gives 24-hour notice before recategorizing — the change is immediate.

**Why it happens:**
The line between Utility and Marketing is strict: Utility must be non-promotional, tied to a specific transaction or user action, and not contain any upsell language, discount framing, or persuasive phrasing. Words like "Don't miss your payment," "Stay on top of your finances," or any framing that could be construed as encouraging action rather than informing can trigger recategorization.

**How to avoid:**
- Write templates with pure transactional language. Example for rent reminder: "Your rent of {{1}} for {{2}} is due on {{3}}." No call to action, no urgency language, no recommendations.
- Avoid shortened URLs in template bodies — Meta blocks them. Use full branded domain URLs only.
- Variable format must be exact: `{{1}}`, `{{2}}` etc. — mismatched braces cause instant rejection.
- Template display name must not be "Agent", "Bot", "Assistant", or similar generic names. Use "Dwella" or a specific message type name.
- Build all required templates in the Setup phase before development of outbound functions begins. Account for a 24-72 hour approval window per template.
- Subscribe to Meta webhook notifications for `message_template_status_update` events to detect automatic recategorization.

**Warning signs:**
- Templates approved as Marketing instead of the submitted Utility category.
- Outbound function costs higher than expected (Marketing templates billed differently).
- Webhook event `message_template_status_update` with status `REJECTED` or category change.

**Phase to address:**
Setup phase. Templates should be submitted on Day 1 of the milestone, not when outbound functions are being coded. Build the template content as part of setup documentation (SETUP-01).

---

### Pitfall 5: Temporary Access Token Used in Production

**What goes wrong:**
During Meta app setup, the Developer Dashboard provides a temporary access token that expires in approximately 24 hours. Projects built with this token appear to work perfectly until the token silently expires, at which point all outbound messages fail with authentication errors. Since Supabase Edge Functions use environment variables, rotating the token requires a manual redeploy.

**Why it happens:**
The temporary token is the fastest path to a working integration. Developers reach the "it works" milestone and move on without reading the production deployment section of Meta's documentation.

**How to avoid:**
- Use a System User token from Meta Business Manager from the start. System User tokens do not expire unless manually revoked.
- Required permissions: `whatsapp_business_management` and `whatsapp_business_messaging`.
- Store as `WHATSAPP_TOKEN` in Supabase Edge Function secrets (not in `.env` or plaintext config).
- Never log the token value, even in debug mode.

**Warning signs:**
- Outbound messages work then suddenly all fail with HTTP 401.
- Error logs show token expiry or invalid token errors around the 24-hour mark after setup.

**Phase to address:**
Setup phase. The System User token must be configured before any Edge Function using the WhatsApp API is deployed.

---

### Pitfall 6: Phone Number Already Registered to WhatsApp App

**What goes wrong:**
A phone number that is active in WhatsApp (personal or WhatsApp Business app) cannot be registered with the WhatsApp Cloud API without first deleting the existing account from the WhatsApp app on that device. If Dwella's test or production phone number was previously used with the WhatsApp app, registration will fail or the existing account will be wiped unexpectedly.

**Why it happens:**
Developers try to use their own WhatsApp number or a shared business number for quick testing, not realizing the number must be "clean." The Meta registration flow does not warn clearly that existing data is erased.

**How to avoid:**
- Use a dedicated phone number (SIM or VoIP) that has never been registered to WhatsApp. Document this as a prerequisite in SETUP-01.
- Virtual numbers can work but some providers block WhatsApp verification calls. Prefer a physical SIM or a VoIP provider known to work with WhatsApp registration.
- Landlines with IVR systems cannot receive the verification call.

**Warning signs:**
- Registration appears to succeed but incoming messages never arrive.
- The WhatsApp app on the associated device gets logged out unexpectedly.

**Phase to address:**
Setup phase. Must be addressed in the SETUP-01 documentation as a hard prerequisite.

---

### Pitfall 7: Messaging Tier Limits Block Outbound Campaigns

**What goes wrong:**
New WhatsApp Business API accounts start at 250 business-initiated conversations per 24 hours. Outbound reminders (OUT-01) sent to all active tenants could hit this cap if there are more than 250 tenants in the system. The messages silently fail or queue — there is no automatic retry on the Supabase Edge Function side.

**Why it happens:**
Developers test with 5-10 fake tenants and do not simulate the 250-conversation limit. The limit escalates automatically over time, but only if quality rating stays High and 50%+ of the current limit is used within 7 days.

**How to avoid:**
- The `send-reminders` Edge Function must check the WhatsApp API response for HTTP 429 or error code 131056 (Too many messages) and implement exponential backoff.
- Log failed sends with recipient phone number and retry count to a `whatsapp_delivery_failures` table so missed notifications can be retried.
- For MVP, the 250-conversation limit is sufficient if the user base is small. Document the limit in SETUP-01 so the user is aware.
- Tier escalation to 1,000 then 10,000 then 100,000 conversations/day happens automatically over days/weeks of consistent, high-quality usage.

**Warning signs:**
- Some tenants receive reminders, others do not, with no apparent pattern.
- Edge Function logs show HTTP 429 responses from the WhatsApp API.

**Phase to address:**
Outbound Messaging phase. Error handling with backoff must be part of the Edge Function implementation, not a post-launch patch.

---

### Pitfall 8: Webhook Returns Slow — Meta Marks Delivery Failed and Retries

**What goes wrong:**
WhatsApp requires the webhook endpoint to return HTTP 200 within a few seconds. If the Edge Function processes the message synchronously (parsing the payload, calling Claude, writing to DB, sending a reply) before returning 200, it will time out on high-load or cold-start scenarios. Meta then retries the webhook, causing duplicate message processing.

**Why it happens:**
The existing Telegram webhook (`telegram-webhook`) likely processes synchronously, which works because Telegram is more lenient with timeouts. WhatsApp has a stricter timeout window and will retry aggressively.

**How to avoid:**
- The `whatsapp-webhook` Edge Function must return HTTP 200 immediately after HMAC signature validation.
- All message processing (Claude call, DB write, reply dispatch) must happen after the response is sent, or be handed off to a separate `process-bot-message` Edge Function via an async invoke pattern (Supabase `functions.invoke` without awaiting, or via a DB-based queue).
- Store the incoming webhook payload in a `whatsapp_inbox` table immediately, return 200, then let a separate function process it.
- Implement deduplication using `message_id` from the webhook payload to prevent duplicate processing on retries. Store processed message IDs with a TTL.

**Warning signs:**
- Users receive duplicate bot replies.
- Meta dashboard shows repeated webhook delivery failures despite the Edge Function appearing to work.
- Supabase Edge Function logs show timeouts.

**Phase to address:**
Setup phase — webhook architecture must be designed correctly from the start. Retrofitting async processing after the bot logic is written is a significant refactor.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Use temporary access token from Dev Dashboard | Faster first integration | Expires in 24h, silent outage | Never — use System User token from start |
| Process webhook synchronously (no async dispatch) | Simpler code, fewer components | Duplicate messages, Meta retry storms | Never for production |
| Hardcode template names instead of fetching from Meta API | Faster coding | Templates renamed/recategorized without notice, silent failures | Never |
| Skip HMAC verification in development | Faster local testing | Forgets to re-enable; security hole in production | Only local dev with env gate |
| Send free-form text to all users regardless of window state | Simpler code path | Error 131047 floods, no outbound delivery | Never |
| Download media lazily (not at webhook receipt time) | Decouples processing | 5-minute URL expiry causes silent media loss | Never |
| Submit templates as Utility without reviewing against policy | Faster setup | Auto-recategorized to Marketing, higher cost | Never |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| WhatsApp Cloud API | Using `link` parameter for media instead of uploading and using `id` | Upload media to Meta CDN first via `/media` endpoint, use returned `id` in message |
| WhatsApp Cloud API | Sending interactive button message as outbound notification | Templates only for outbound; interactive only inside 24h window |
| WhatsApp Cloud API | Logging full webhook payload including user phone numbers | Scrub PII (phone numbers, names) from logs — GDPR and Meta ToS |
| WhatsApp Cloud API | Using `allow_category_change: false` on template creation | Removed as of April 2025 — Meta recategorizes regardless |
| WhatsApp Cloud API | Using URL-shortened links in template bodies | Blocked by Meta — use full branded domain URLs only |
| Meta Graph API | Calling media download URL without Authorization header | Include `Authorization: Bearer {TOKEN}` — URLs are authenticated |
| Meta Graph API | Calling media download URL after 5 minutes | Download immediately on webhook receipt and persist to Supabase Storage |
| Supabase Edge Functions | Calling WhatsApp API with service role key exposed in response | WhatsApp token must live in Edge Function secrets only, never client-side |
| Supabase Edge Functions | Not handling `status` update webhooks (sent/delivered/read/failed) | WhatsApp sends status callbacks for every outbound message — must return 200 or retry storms begin |
| Telegram bot | Adding interactive inline keyboards and assuming WhatsApp has equivalent | Telegram supports unlimited inline buttons in grids; WhatsApp reply buttons max 3, max 20 chars each |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Synchronous webhook processing | Duplicate messages, Meta delivery failures | Return 200 immediately, process async | Every request under load or cold start |
| Resolving media ID to URL inside the same function that processes business logic | Intermittent media loss | Download media as the first step, before any other logic | When function execution takes >5 minutes end-to-end |
| Sending all tenant reminders in a single Edge Function iteration | Hits 250 conversation/day tier limit; partial delivery with no retry | Process in batches with backoff, log failures | >250 active tenants |
| Polling for template approval status in a loop | Rate limit errors on Meta Graph API | Subscribe to `message_template_status_update` webhooks | First time template approval takes longer than expected |
| Generating PDF in-memory and sending directly to WhatsApp | Memory limit on Edge Function runtime (~150MB) | Generate PDF to Supabase Storage, get signed URL, send URL as document message | PDF reports with many months of data |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Skipping HMAC-SHA256 verification on WhatsApp webhook | Any attacker can send fake messages, triggering bot actions | Always verify `X-Hub-Signature-256` header against raw request body before processing; use `timingSafeEqual` |
| Comparing HMAC signature after JSON parsing | Signature mismatch due to JSON re-serialization differences | Verify against the raw bytes before parsing |
| Storing WhatsApp token in `.env` committed to repo | Token exposed via git history | Store only in Supabase Edge Function secrets (`supabase secrets set WHATSAPP_TOKEN=...`) |
| Trusting `from` field in webhook payload without cross-referencing DB | Tenant impersonation — attacker sends message pretending to be a different phone number | Cross-reference `from` phone number against `users` table before any bot action |
| Logging phone numbers from webhook payload | PII exposure in Supabase logs (queryable by team members) | Hash or truncate phone numbers in all log statements |
| Processing message without checking for `message_id` deduplication | Replay attacks via resent webhooks | Store processed `message_id` values with TTL check before processing |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Sending the main menu (5 categories) as every reply | Bot feels spammy, WhatsApp conversation becomes cluttered | Send the menu only on session start (RICH-02); after a transaction, send a confirmation then offer "Need anything else?" |
| Button label text truncated at 20 characters | "Upcoming Payments" becomes "Upcoming Payments" but "Maintenance Status" becomes "Maintenance Stat..." | Review every button label at design time; keep all labels under 20 chars |
| WhatsApp bot sends Telegram Markdown formatting (`*bold*`, `_italic_`) | Raw asterisks and underscores visible to WhatsApp users | Build a platform-aware message formatter — WhatsApp uses its own bold/italic syntax or plain text |
| Freeform AI response sent without checking if interactive session is active | Long AI responses outside a session window fail silently | Always check window state; if outside window, send truncated summary via approved template |
| Welcome message sent every time user links/re-links account | Duplicate welcome messages confuse returning users | Track `welcome_sent` boolean on `users` table, send RICH-01 only on first link |
| Interactive menu with 5 buttons sent but WhatsApp only shows 3 maximum | User sees only first 3 buttons, last 2 categories invisible | WhatsApp reply buttons cap at 3. Use 3 buttons for primary actions + a "More..." button that triggers a follow-up menu |

---

## "Looks Done But Isn't" Checklist

- [ ] **WhatsApp account linking (SETUP-02):** Verification code flow tested but no test for already-registered phone number edge case — verify that re-linking an already-linked number is handled gracefully.
- [ ] **Media upload (MEDIA-01):** Photo sends correctly in happy path but no test for file size >5MB (header image limit) or >100MB (global limit) — verify rejection is user-friendly, not a silent 400 error.
- [ ] **Outbound reminders (OUT-01):** Reminder fires for all tenants in test but no test for user who has never initiated WhatsApp conversation — first outbound message to a cold number requires the user to have opted in; cannot message someone who has never messaged the business first.
- [ ] **Template messages (all OUT-* requirements):** Template approved in Meta dashboard but no test for what happens when variable count in the API call doesn't match the template definition — verify error handling.
- [ ] **Interactive menus (RICH-02, RICH-03):** Buttons render in WhatsApp Web but not tested on WhatsApp Desktop (Windows/Mac) or older Android versions — test across clients.
- [ ] **PDF delivery (History → download PDF):** PDF generates and sends in isolation but not tested after a large report — verify PDF file size stays under the 100MB document limit (in practice, keep under 10MB for usability).
- [ ] **Telegram menu parity (RICH-05):** WhatsApp menu built and working but Telegram inline keyboard not updated to match — verify both platforms serve the same menu structure before closing the phase.
- [ ] **Webhook deduplication:** Bot reply sent once in testing, but no test for Meta retrying the same webhook — verify `message_id` deduplication prevents double-processing.
- [ ] **Quality rating monitoring:** Messages send successfully at launch but no alert configured for when quality rating drops to Yellow — set up a monitoring webhook or periodic check before going live.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Temporary token expired, all outbound fails | LOW | Generate System User token, update Supabase secret, redeploy Edge Functions |
| Template rejected or recategorized | MEDIUM | Rewrite template copy to pure transactional language, resubmit (24-72h turnaround), update template name in Edge Function env var |
| Phone number quality rating drops to Red | HIGH | Stop all outbound campaigns immediately, audit message content and opt-in processes, wait 7 days for rating to recover, appeal to Meta if unjustified |
| Duplicate messages sent due to webhook retry | MEDIUM | Deploy deduplication logic, mark already-processed messages in DB, manually identify and notify affected users |
| Media loss due to delayed download | MEDIUM | Cannot recover expired CDN URLs — inform affected users to resend media; deploy synchronous download fix immediately |
| Interactive menu shows only 3 of 5 buttons | LOW | Redesign menu to use 3 primary buttons + "More" overflow pattern; redeploy |
| 24-hour window violation causing notification failure | LOW | Switch affected outbound function to approved template; retry failed sends with template |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Non-template messages outside 24h window | Setup & Outbound (Phase 1 or 2) | Every outbound Edge Function uses `type: template`; integration test with 25h gap between messages |
| Interactive buttons outside 24h window | Rich Messaging phase | Menu dispatch only fires on inbound message handler path, never from scheduled functions |
| Media URL 5-minute expiry | Media Handling phase | Media download is the first await in webhook handler; integration test with artificial 10s delay confirms failure |
| Template rejection/recategorization | Setup phase (Day 1) | All templates approved (not Pending) before any outbound function is deployed; webhook for status updates subscribed |
| Temporary access token used | Setup phase (Day 1) | `WHATSAPP_TOKEN` set via `supabase secrets set`, System User visible in Meta Business Manager |
| Phone number already registered | Setup phase (before registration) | SETUP-01 documentation includes clean-number prerequisite |
| Messaging tier 250 cap | Outbound Messaging phase | `send-reminders` logs HTTP 429 responses to a failures table; manual test with simulated 429 response |
| Webhook timeout / duplicate processing | Webhook architecture (Phase 1) | `whatsapp-webhook` returns 200 before Claude call; `message_id` deduplication in place before any testing |

---

## Sources

- [WhatsApp Business API: 24-Hour Messaging Window — smsmode](https://www.smsmode.com/en/whatsapp-business-api-customer-care-window-ou-templates-comment-les-utiliser/)
- [WhatsApp API Rate Limits: How They Work — Wati](https://www.wati.io/en/blog/whatsapp-business-api/whatsapp-api-rate-limits/)
- [Interactive Reply Buttons — Meta for Developers](https://developers.facebook.com/docs/whatsapp/cloud-api/messages/interactive-reply-buttons-messages/)
- [Interactive Reply Buttons Developer Docs — Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/interactive-reply-buttons-messages/)
- [Media — WhatsApp Cloud API — Meta for Developers](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media/)
- [Supported Media Types and Sizes — AWS End User Messaging (mirrors Meta specs)](https://docs.aws.amazon.com/social-messaging/latest/userguide/supported-media-types.html)
- [Downloading Media via WhatsApp Cloud API Webhook — Medium](https://medium.com/@shreyas.sreedhar/downloading-media-using-whatsapps-cloud-api-webhooks-and-uploading-it-to-aws-s3-bucket-via-nodejs-07c5cbae896f)
- [WhatsApp Template Approval: 27 Reasons Meta Rejects Messages — WUSeller](https://www.wuseller.com/blog/whatsapp-template-approval-checklist-27-reasons-meta-rejects-messages/)
- [Why Meta Rejects WhatsApp Templates — Fyno](https://www.fyno.io/blog/why-is-meta-rejecting-my-whatsapp-business-templates-cm2efjq2s0057m1jlzfh7olqz)
- [WhatsApp Template Recategorized from Utility to Marketing — msg91](https://msg91.com/guide/whatsapp-template-recategorized-from-utility-marketing-fix)
- [WhatsApp API Message Template Category Update July 2025 — YCloud](https://www.ycloud.com/blog/whatsapp-api-message-template-category-guidelines-update/)
- [Messaging Limits — Meta for Developers](https://developers.facebook.com/docs/whatsapp/messaging-limits/)
- [WhatsApp Rate Limits for Developers — Fyno](https://www.fyno.io/blog/whatsapp-rate-limits-for-developers-a-guide-to-smooth-sailing-clycvmek2006zuj1oof8uiktv)
- [WhatsApp Cloud API Webhook Setup — Pons Blog](https://pons.chat/blog/whatsapp-cloud-api-webhook-nextjs)
- [Guide to WhatsApp Webhooks — Hookdeck](https://hookdeck.com/webhooks/platforms/guide-to-whatsapp-webhooks-features-and-best-practices)
- [Shadow Delivery Mystery — Siri Prasad on Medium](https://medium.com/@siri.prasad/the-shadow-delivery-mystery-why-your-whatsapp-cloud-api-webhooks-silently-fail-and-how-to-fix-2c7383fec59f)
- [Permanent Access Token — Anjok Technologies](https://anjoktechnologies.in/blog/-whatsapp-cloud-api-permanent-access-token-step-by-step-system-user-2026-complete-correct-guide-by-anjok-technologies)
- [WhatsApp Business Registration Phone Pitfalls — Sobot](https://www.sobot.io/article/troubleshoot-new-number-for-whatsapp-business-registration-issues/)
- [WhatsApp Messaging Limits and Quality Ratings — PickyAssist](https://pickyassist.com/blog/whatsapps-messaging-limits-quality-ratings-on-2025/)
- [WhatsApp Cloud API PDF error 131053 bug report — Chatwoot GitHub](https://github.com/chatwoot/chatwoot/issues/13656)
- [Building a Scalable Webhook Architecture for WhatsApp — ChatArchitect](https://www.chatarchitect.com/news/building-a-scalable-webhook-architecture-for-custom-whatsapp-solutions)

---
*Pitfalls research for: Dwella v1.2 WhatsApp Bot Expansion*
*Researched: 2026-03-21*

# Meta WhatsApp Business API Setup Guide

This guide walks through the complete Meta Business API configuration for Dwella's WhatsApp bot. Follow every step in order. By the end, your Supabase Edge Functions will be sending and receiving WhatsApp messages.

## Prerequisites

- A **Meta Business Account** (business.facebook.com)
- A phone number **NOT currently registered on WhatsApp** (will be registered as the business number)
- A Supabase project with **Edge Functions enabled**
- The Supabase CLI installed and linked to your project (`supabase link`)

## 1. Create Meta App

1. Go to [developers.facebook.com](https://developers.facebook.com/) -> **My Apps** -> **Create App**
2. Select **"Business"** type
3. Enter app name (e.g., "Dwella WhatsApp Bot")
4. Select your Business Account from the dropdown
5. Click **Create App**

## 2. Add WhatsApp Product

1. In the App Dashboard, scroll to **Add Products**
2. Find **WhatsApp** and click **Set Up**
3. This creates a WhatsApp Business Account (WABA) linked to your app
4. You will be redirected to the WhatsApp Getting Started page

## 3. Register Phone Number

1. On the WhatsApp -> **Getting Started** page, click **Add Phone Number**
2. Enter your business phone number
3. Complete phone verification via SMS or voice call
4. Alternatively, use the **test phone number** provided by Meta for development (limited to 5 recipient numbers)

> **Note:** The test number is fine for development but cannot receive inbound messages. You need a real number for production.

## 4. Get Phone Number ID

1. Go to WhatsApp -> **Getting Started**
2. Your **Phone Number ID** is displayed on this page (a numeric string like `123456789012345`)
3. Copy and save this value — it becomes `WHATSAPP_PHONE_NUMBER_ID`

## 5. Create System User

> **IMPORTANT:** A temporary developer token expires every 24 hours. The System User token is **permanent** and required for production. Do NOT skip this step.

1. Go to **Business Settings** -> **Users** -> **System Users**
2. Click **Add** to create a new System User
3. Name: `Dwella Bot` (or any descriptive name)
4. Role: **Admin**
5. Click **Create System User**

## 6. Assign App to System User

1. On the System User page, click **Assign Assets**
2. Go to the **Apps** tab
3. Select your Dwella app
4. Grant **Full Control**
5. Click **Save Changes**

## 7. Assign WhatsApp Account to System User

> **CRITICAL:** Without this step, the token will generate successfully but API calls will return 403 Forbidden.

1. Go to **Business Settings** -> **Accounts** -> **WhatsApp Accounts**
2. Select your WhatsApp Business Account
3. Go to the **People** tab
4. Click **Add People**
5. Select the System User created in step 5
6. Grant **Full Control**
7. Click **Assign**

## 8. Generate Permanent Token

1. Go back to **System Users** page
2. Select your System User (`Dwella Bot`)
3. Click **Generate Token**
4. Select your Dwella app
5. Check these permissions:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
6. Click **Generate Token**
7. **Copy the token immediately** (it is only shown once)
8. Save as `WHATSAPP_ACCESS_TOKEN`

## 9. Get App Secret

1. Go to your App Dashboard -> **Settings** -> **Basic**
2. Find **App Secret** and click **Show**
3. Enter your Meta password to reveal it
4. Copy and save as `WHATSAPP_APP_SECRET`

## 10. Set Verify Token

1. Choose any random string for webhook verification. Generate one with:
   ```bash
   openssl rand -hex 32
   ```
2. Save this value as `WHATSAPP_VERIFY_TOKEN`
3. You will use this same value when configuring the webhook in step 11

## 11. Configure Webhook

1. Go to WhatsApp -> **Configuration** -> **Edit Webhook**
2. Set the fields:
   - **Callback URL:** `https://<YOUR_SUPABASE_URL>/functions/v1/whatsapp-webhook`
   - **Verify Token:** the value from step 10
3. Click **Verify and Save**
4. Under **Webhook Fields**, subscribe to: **`messages`**

> Replace `<YOUR_SUPABASE_URL>` with your actual Supabase project URL (e.g., `https://abcdefghij.supabase.co`).

## 12. Environment Variables

Set all of these in your Supabase project:

| Variable | Where to Get | Where to Set |
|----------|-------------|--------------|
| `WHATSAPP_ACCESS_TOKEN` | Step 8: System User token | Supabase Dashboard -> Edge Functions -> Secrets |
| `WHATSAPP_PHONE_NUMBER_ID` | Step 4: WhatsApp Getting Started page | Supabase Dashboard -> Edge Functions -> Secrets |
| `WHATSAPP_VERIFY_TOKEN` | Step 10: Your chosen random string | Supabase Dashboard -> Edge Functions -> Secrets |
| `WHATSAPP_APP_SECRET` | Step 9: App Settings -> Basic | Supabase Dashboard -> Edge Functions -> Secrets |
| `EXPO_PUBLIC_WHATSAPP_BOT_PHONE` | Your registered number in E.164 format (e.g., `+919999999999`) | `.env` file in project root |

**Setting secrets via CLI (alternative):**

```bash
supabase secrets set WHATSAPP_ACCESS_TOKEN=your_token_here
supabase secrets set WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
supabase secrets set WHATSAPP_VERIFY_TOKEN=your_verify_token
supabase secrets set WHATSAPP_APP_SECRET=your_app_secret
```

## 13. Deploy Edge Functions

Deploy the WhatsApp-related Edge Functions:

```bash
supabase functions deploy whatsapp-webhook
supabase functions deploy whatsapp-send
supabase functions deploy whatsapp-send-code
```

Verify the deployments are live:

```bash
supabase functions list
```

## 14. Submit Message Templates

Templates must be submitted via **Meta Business Manager** -> **WhatsApp Manager** -> **Message Templates** -> **Create Template**.

> **Approval timeline:** Meta template approval takes **2-7 business days**. Submit all 3 new templates immediately. Phase 14 (outbound notifications) is blocked until these are approved.

> **Naming rules:** Template names must use **underscores only**, all **lowercase**, no hyphens. Names in code MUST match submitted names exactly.

---

### Template: `dwella_verification` (already exists — verify it)

- **Category:** Authentication
- **Language:** English
- **Body:**
  ```
  Your Dwella verification code is {{1}}. This code expires in 10 minutes.
  ```
- **Variables:** `{{1}}` = 6-digit verification code

This template is used by the `whatsapp-send-code` Edge Function for account linking.

---

### Template: `dwella_rent_reminder` (NEW — submit now)

- **Category:** Utility
- **Language:** English
- **Body:**
  ```
  Hi {{1}}, your rent of {{2}} is due on {{3}}. Pay via the Dwella app to keep your account up to date.
  ```
- **Variables:**
  - `{{1}}` = tenant name
  - `{{2}}` = rent amount (e.g., "Rs.15,000")
  - `{{3}}` = due date (e.g., "March 25, 2026")
- **CTA Button:**
  - Type: Call to Action -> Visit Website
  - Button Text: `Open Dwella`
  - URL: Your app store URL (HTTPS required — do NOT use `dwella://` deep link scheme)

> **Important:** Avoid phrases like "late fees" or "penalty" in the body — Meta may recategorize the template as Marketing, which has stricter sending limits.

---

### Template: `dwella_payment_confirmed` (NEW — submit now)

- **Category:** Utility
- **Language:** English
- **Body:**
  ```
  Hi {{1}}, your rent payment of {{2}} for {{3}} has been confirmed. Thank you!
  ```
- **Variables:**
  - `{{1}}` = tenant name
  - `{{2}}` = payment amount (e.g., "Rs.15,000")
  - `{{3}}` = month (e.g., "March 2026")
- **CTA Button:**
  - Type: Call to Action -> Visit Website
  - Button Text: `Open Dwella`
  - URL: Your app store URL

---

### Template: `dwella_maintenance_update` (NEW — submit now)

- **Category:** Utility
- **Language:** English
- **Body:**
  ```
  Hi {{1}}, your maintenance request "{{2}}" has been updated to: {{3}}. Open Dwella to view details.
  ```
- **Variables:**
  - `{{1}}` = user name
  - `{{2}}` = request description (truncated to 100 chars)
  - `{{3}}` = new status (e.g., "In Progress", "Resolved")
- **CTA Button:**
  - Type: Call to Action -> Visit Website
  - Button Text: `Open Dwella`
  - URL: Your app store URL

---

## 15. Smoke Test

After deploying and configuring everything, verify the integration works:

1. **Send a WhatsApp message** to your bot phone number from a personal WhatsApp account
2. **Check Edge Function logs** in the Supabase Dashboard for webhook invocation:
   ```bash
   supabase functions logs whatsapp-webhook
   ```
3. **Confirm the bot replies** with the "unrecognized number" message (since no account is linked yet)
4. **Test account linking:**
   - Generate a verification code from the Dwella app (Profile -> Link WhatsApp)
   - Send the 6-digit code to the bot via WhatsApp
   - Confirm the "Linked!" response

**If no reply is received, check:**
- Is the webhook URL correct? (Step 11)
- Does the verify token match between Meta Dashboard and Supabase secrets? (Steps 10-11)
- Is the `messages` webhook field subscribed? (Step 11)
- Are all Edge Function secrets set? (Step 12)

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| **403 on API calls** | System User not assigned to WhatsApp Business Account | Complete step 7 — assign WABA to System User with Full Control |
| **Template error 132001** | Template name mismatch | Check for underscores vs hyphens; names are case-sensitive and must match exactly |
| **No webhook invocations** | Webhook URL or verify token misconfigured | Re-verify webhook in Meta Dashboard (step 11); check Supabase function is deployed |
| **Token expires after 24h** | Using the temporary developer token instead of System User token | Follow steps 5-8 to create a System User and generate a permanent token |
| **Message not delivered** | Recipient not in test number allowlist | If using test number, add recipient in WhatsApp -> Getting Started -> phone number section |
| **Rate limit (429)** | Sending too many messages per second | The `whatsapp-send` function retries once automatically; reduce send frequency if persistent |
| **Template pending approval** | Meta has not reviewed the template yet | Wait 2-7 business days; do not re-submit (creates duplicates) |
| **Template rejected** | Body contains prohibited content or is miscategorized | Review Meta's template guidelines; rewrite and submit a new template with a different name |

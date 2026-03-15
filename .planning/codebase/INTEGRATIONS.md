# External Integrations — Dwella v2

## Authentication & Identity

### Supabase Auth
- **Type**: Authentication-as-a-Service
- **Endpoints**:
  - Main: `https://{project}.supabase.co/auth/v1`
  - Configured in: `lib/supabase.ts`
- **Methods**:
  - Email/password signup & login
  - Email magic links
  - OAuth (Google, Apple)
  - Session persistence (AsyncStorage on mobile, localStorage on web)
- **Session Flow**:
  - JWT access token (1 hour expiry)
  - Refresh token rotation enabled
  - Auto-refresh on re-entry

### Google OAuth 2.0
- **Provider**: Google Cloud Console
- **Client ID**: Pre-configured in `supabase/config.toml` (line 308)
- **Secret**: Environment variable `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`
- **Redirect**: `dwella://auth/callback` (deep link)
- **Scopes**: Email, profile
- **Used By**: Auth tabs screen, sign-up/login flow
- **Credential Source**: `https://console.cloud.google.com/apis/credentials`

### Apple Sign-In
- **Provider**: Apple Developer Account
- **Client ID**: `com.dwella.app` (bundle ID)
- **Secret**: Environment variable `SUPABASE_AUTH_EXTERNAL_APPLE_SECRET`
- **Private Key**: Generated via Apple Developer, base64-encoded
- **Skip Nonce Check**: Enabled (native Sign-In flow)
- **Used By**: iOS auth, sign-up/login flow
- **Credential Source**: `https://developer.apple.com/account/resources/identifiers`

## Database & Real-time

### Supabase PostgreSQL
- **Type**: Managed PostgreSQL 17.x
- **Features**:
  - Row-Level Security (RLS) policies
  - Real-time subscriptions (WebSocket)
  - PostgREST API (auto-generated REST endpoints)
- **Buckets** (S3-compatible Storage):
  - `payment-proofs` — Payment receipt images
  - `avatars` — User & tenant profile pictures
- **Migrations**: 15 SQL files defining:
  - `users` table (auth.users linked)
  - `properties`, `tenants`, `payments`, `expenses`
  - `notifications`, `bot_conversations`
  - `push_notification_tokens`
- **Configuration**:
  - URL: `EXPO_PUBLIC_SUPABASE_URL` (e.g., `https://xxx.supabase.co`)
  - Anon Key: `EXPO_PUBLIC_SUPABASE_ANON_KEY` (public, read-only scoped)
  - Service Key: `SUPABASE_SERVICE_ROLE_KEY` (server-side only)

### Realtime Subscriptions
- **Library**: `@supabase/supabase-js` RealtimeClient
- **Used By**:
  - `hooks/usePayments.ts` — Payment status changes
  - `hooks/useProperties.ts` — Property updates
  - `hooks/useTenants.ts` — Tenant updates
  - `hooks/useNotifications.ts` — Notification delivery

## AI & NLP

### Anthropic Claude API
- **Type**: Large Language Model API
- **Model**: `claude-sonnet-4-20250514`
- **Key**: Environment variable `ANTHROPIC_API_KEY` (Edge Functions only)
- **Usage**:
  - Message processing: `supabase/functions/process-bot-message/index.ts`
    - Receives: user message + cached property/tenant context
    - Returns: JSON intent, entities, action_description, needs_confirmation
  - AI insights: `supabase/functions/ai-insights/index.ts`
    - Generates payment & tenant summaries
  - Reminder drafting: `supabase/functions/ai-draft-reminders/index.ts`
    - Composes personalized reminder messages
  - Search: `supabase/functions/ai-search/index.ts`
    - Semantic search over payments & tenants
- **Input Format**: Structured JSON with user context
- **Output Format**: Structured JSON with action directives
- **Context Caching**: 5-minute cache of user properties/tenants
- **Integration Flow**:
  1. User sends message via Telegram, WhatsApp, or in-app
  2. Webhook routes to `telegram-webhook` or `whatsapp-webhook`
  3. Message forwarded to `process-bot-message` Edge Function
  4. Edge Function calls Claude API with context
  5. Claude returns intent + action
  6. If needs_confirmation: store pending action, await user approval
  7. If confirmed: execute DB action (log payment, add property, etc.)

## Chat & Messaging

### Telegram Bot API
- **Type**: Webhook-based bot messaging
- **Endpoint**: `https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}`
- **Webhook Function**: `supabase/functions/telegram-webhook/index.ts`
- **Flow**:
  1. User sends message to Telegram bot
  2. Telegram sends JSON update to webhook
  3. Webhook extracts message text & chat_id
  4. Routes message to `process-bot-message` Edge Function (Claude)
  5. Claude processes intent
  6. Telegram webhook sends reply via `sendMessage` API
- **Account Linking**:
  - Link token via `/start {token}` command
  - Token stored in `bot_link_tokens` table
  - Links Telegram chat_id to Dwella user_id
- **Integration Point**: `lib/bot.ts` exposes `generateTelegramLinkToken()`
- **Configuration**:
  - Token: Environment variable `TELEGRAM_BOT_TOKEN`
  - Username: Environment variable `EXPO_PUBLIC_TELEGRAM_BOT_USERNAME`
  - BotFather: `https://t.me/botfather`

### WhatsApp Cloud API (Meta Business Platform)
- **Type**: RESTful messaging API (WhatsApp Business Account)
- **Endpoint**: `https://graph.facebook.com/v21.0/{WHATSAPP_PHONE_NUMBER_ID}/messages`
- **Webhook Function**: `supabase/functions/whatsapp-webhook/index.ts`
- **Flow**:
  1. User sends message to WhatsApp business number
  2. Meta sends POST to webhook with message data
  3. Webhook verifies token & processes message
  4. Routes to `process-bot-message` Edge Function (Claude)
  5. Claude processes intent
  6. WhatsApp webhook calls Cloud API to send reply
- **Verification**: Challenge-response on initial webhook setup
- **Account Linking**:
  - OTP sent via `whatsapp-send-code` Edge Function
  - User enters 6-digit code in app
  - Code validated, WhatsApp phone linked to Dwella user_id
- **Integration Points**:
  - `supabase/functions/whatsapp-send-code/index.ts` — OTP dispatch
  - `migrations/015_whatsapp.sql` — Tables for phone linking
- **Configuration**:
  - Access Token: Environment variable `WHATSAPP_ACCESS_TOKEN`
  - Phone Number ID: Environment variable `WHATSAPP_PHONE_NUMBER_ID`
  - Verify Token: Environment variable `WHATSAPP_VERIFY_TOKEN`
  - Credentials: Meta Business Platform → WhatsApp Manager

## Analytics & Behavior Tracking

### PostHog
- **Type**: Product analytics & event tracking
- **SDK**: `posthog-react-native` (4.37.3)
- **Endpoints**:
  - Ingestion: `https://us.i.posthog.com` (configurable)
  - API Key: Environment variable `EXPO_PUBLIC_POSTHOG_API_KEY`
- **Custom Events** (defined in `lib/analytics.ts`):
  - **Activation**: `signup_completed`, `onboarding_completed`, `pin_setup_completed`, `first_property_created`, `first_tenant_added`, `first_invite_sent`, `invite_accepted`
  - **Core Loop**: `payment_logged`, `payment_marked_paid`, `payment_proof_uploaded`, `payment_confirmed`, `payment_receipt_exported`
  - **AI & Bot**: `bot_message_sent`, `bot_action_confirmed`, `bot_action_cancelled`, `ai_insights_viewed`, `ai_reminders_drafted`, `ai_search_performed`, `ai_nudge_tapped`
  - **Properties & Tenants**: `property_created`, `property_archived`, `tenant_added`, `tenant_archived`, `expense_logged`
  - **Engagement**: `notification_tapped`, `theme_changed`, `settings_updated`
- **Usage**: Track user activation funnels, retention cohorts, and engagement patterns
- **Dashboard**: `https://us.posthog.com` → Project Settings

## Push Notifications

### Expo Notifications
- **Type**: Cross-platform push notification service
- **SDK**: `expo-notifications` (0.32.16)
- **Configuration** (`app.json`):
  - Icon: `./assets/icon.png`
  - Color: `#4F46E5` (brand indigo)
  - Default channel: "default"
- **Token Storage**: `push_notification_tokens` table (migration 010)
- **Dispatch Function**: `supabase/functions/send-push/index.ts`
- **Scheduled Reminders**: `supabase/functions/send-reminders/index.ts`
  - Runs daily at 9 AM (Supabase scheduled function)
  - Sends reminders 3 days before/on/3 days after payment due_day

## Storage & File Handling

### Supabase Storage (S3-compatible)
- **Buckets**:
  - `payment-proofs` — Payment receipt images
    - Path: `{property_id}/{tenant_id}/{year}-{month}.jpg`
    - Access: Signed URLs (client-side readable)
    - RLS: User can only access proofs for properties they own/are tenants in
  - `avatars` — User & tenant profile pictures
    - Path: `{user_id}/{filename}`
    - Access: Public URLs via CDN
    - RLS: User can upload/delete their own avatar
- **Image Upload**: `expo-image-picker` + `expo-file-system`
- **Proof Verification**: Landlord reviews before confirming payment

### File Export & Printing
- **Libraries**:
  - `expo-print` — Native print dialog, PDF generation
  - `expo-sharing` — Native share sheets
  - `expo-file-system` — File read/write to device storage
- **PDF Generation**: Server-side via Edge Function or client-side `react-native-html-to-pdf`
- **Exports**:
  - Payment receipts (single payment)
  - Annual summaries (all payments for tenant)
  - Content kits (marketing materials)

## Deep Linking & URL Schemes

### App Deep Linking
- **Scheme**: `dwella://`
- **Handlers** (via Expo Router):
  - `dwella://auth/callback` — OAuth redirect
  - `dwella://invite/{token}` — Tenant invite acceptance
- **Configuration**:
  - `app.json`: Intent filters + scheme
  - iOS: `com.dwella.app` bundle ID
  - Android: Package `com.dwella.app` + intent filters

### Invite-Redirect Function
- **Purpose**: Generate short shareable links for tenant invites
- **Function**: `supabase/functions/invite-redirect/index.ts`
- **Flow**:
  1. Tenant invite generates UUID token
  2. Deep link: `dwella://invite/{token}`
  3. Shareable short URL (redirect): `https://dwella.app/invite/{token}`
  4. Short URL function redirects to App Store / Play Store if app not installed
  5. If app installed: deep link opens invite screen

## External Dashboard Integrations (Potential)

### Mobile App Store Distribution
- **iOS**: Apple App Store (TestFlight for beta)
- **Android**: Google Play Store (Google Play Console)
- **Build Tool**: EAS Build (Expo Application Services)
  - Project ID: `3bc7de51-47e7-4c4e-92e3-e6e1a40ae71b`
  - Builds native APK/IPA via cloud

### Development Tools
- **Git/GitHub**: Version control (github.com)
- **Supabase Dashboard**: Real-time DB management, RLS policies, storage
- **Google Cloud Console**: OAuth credential management
- **Apple Developer**: Certificate signing, provisioning profiles
- **Meta Business Platform**: WhatsApp Business setup, webhooks
- **Telegram BotFather**: Bot token generation, webhook registration

## Integration Security Notes

1. **Never expose in client code**:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ANTHROPIC_API_KEY`
   - `TELEGRAM_BOT_TOKEN`
   - `WHATSAPP_ACCESS_TOKEN`
   - OAuth client secrets

2. **RLS policies** enforce user isolation:
   - Users can only see their own properties/tenants
   - Properties cascade-delete tenants & payments
   - Soft-delete pattern avoids data loss

3. **OAuth flows**:
   - Implicit flow used (avoids PKCE verifier storage issues)
   - Deep link callback: `dwella://auth/callback`

4. **Webhook verification**:
   - Telegram: Message signed with bot token
   - WhatsApp: Challenge-response token verification

5. **Signed URLs**:
   - Payment proofs: Time-limited signed URLs (default 1 hour)
   - Prevents unauthorized file access

## Integration Status Checklist

- [ ] Supabase project created & configured
- [ ] Google OAuth credentials set up (Client ID + Secret)
- [ ] Apple Sign-In team ID & private key generated
- [ ] Telegram bot created (BotFather) + token obtained
- [ ] Telegram webhook registered with Supabase URL
- [ ] WhatsApp Business Account created (Meta)
- [ ] WhatsApp Cloud API access token obtained
- [ ] WhatsApp webhook registered & verified
- [ ] PostHog project created & API key obtained
- [ ] Anthropic API key obtained (Claude)
- [ ] All environment variables in `.env` populated
- [ ] Database migrations applied (`supabase db push`)
- [ ] Edge Functions deployed (`supabase functions deploy <name>`)
- [ ] iOS bundle ID registered in Apple Developer
- [ ] Android package registered in Google Play Console

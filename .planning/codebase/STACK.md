# Technology Stack — Dwella v2

## Runtime & Language

| Component | Technology | Version |
|-----------|-----------|---------|
| **Language** | TypeScript | 5.3.0 |
| **Runtime (Mobile)** | React Native | 0.81.5 |
| **JS Runtime (Edge Functions)** | Deno | 2.x |
| **Package Manager** | NPM | (via Expo) |

## Frontend

### Core Framework
- **Expo** (Managed Workflow): ~54.0.0
- **React**: 19.1.0
- **React Native**: 0.81.5
- **React DOM**: 19.1.0 (web support)
- **React Native Web**: 0.21.0 (web bundler)

### Routing & Navigation
- **Expo Router**: ~6.0.23 (file-based routing)
  - Typed routes: `experiments.typedRoutes = true`
  - Deep linking: `dwella://` scheme

### UI & Styling
- **React Native Paper**: 5.12.0 (Material Design 3)
- **React Native Vector Icons**: 10.1.0
- **@expo/vector-icons**: 15.0.3 (icon fonts)
- **expo-linear-gradient**: 15.0.8 (gradient backgrounds)
- **react-native-svg**: 15.12.1 (SVG rendering)
- **react-native-safe-area-context**: 5.6.0
- **react-native-screens**: 4.16.0

### Platform-Specific Modules
- **expo-apple-authentication**: 8.0.8 (Sign in with Apple)
- **expo-auth-session**: 7.0.10 (OAuth flow)
- **expo-web-browser**: 15.0.10 (web browser intent)
- **expo-image-picker**: 17.0.10 (camera/photo library)
- **expo-file-system**: 19.0.21 (file access)
- **expo-font**: 14.0.11 (custom fonts)
- **expo-crypto**: 15.0.8 (cryptographic functions)
- **expo-secure-store**: 15.0.8 (secure credential storage)
- **expo-local-authentication**: 17.0.8 (biometrics)
- **expo-device**: 8.0.10 (device info)
- **expo-constants**: 18.0.13 (app metadata)
- **expo-print**: 15.0.8 (print/PDF export)
- **expo-sharing**: 14.0.8 (native share)
- **expo-notifications**: 0.32.16 (push notifications)
- **expo-splash-screen**: 31.0.13 (splash screen)
- **expo-status-bar**: 3.0.9 (status bar styling)
- **expo-linking**: 8.0.11 (deep link handling)
- **expo-application**: 7.0.8 (app version)
- **expo-dev-client**: 6.0.20 (custom dev client)

### State Management
- **Zustand**: 4.5.0 (lightweight store with persist middleware)

### Storage & Persistence
- **@react-native-async-storage/async-storage**: 2.2.0 (key-value storage)

### Utilities
- **@react-native-community/datetimepicker**: 8.4.4 (date/time picker)

## Backend

### Backend-as-a-Service
- **Supabase** (PostgreSQL-based)
  - Auth (Email, OAuth, Magic Links)
  - Postgres Database
  - Realtime subscriptions (WebSocket)
  - Storage (S3-compatible object storage)
  - Edge Functions (Deno runtime)

### Backend Client
- **@supabase/supabase-js**: 2.45.0
  - Postgres queries (PostgREST API)
  - Real-time listeners (RealtimeClient)
  - Auth session management
  - Storage file operations

### Database
- **PostgreSQL**: 17.x (hosted by Supabase)
- **Migrations**: 15 SQL migration files in `supabase/migrations/`
  - Row-Level Security (RLS) policies
  - Soft-delete pattern (is_archived)
  - Foreign key constraints

### Edge Functions (Deployed on Supabase)
- **Deno 2.x runtime**
- 13 serverless functions:
  - `telegram-webhook` — Telegram Bot API webhook
  - `whatsapp-webhook` — WhatsApp Cloud API webhook
  - `whatsapp-send-code` — OTP sending via WhatsApp
  - `process-bot-message` — Claude API integration (AI chat logic)
  - `ai-insights` — Analytics & insights generation
  - `ai-draft-reminders` — Reminder composition
  - `ai-search` — Payment/tenant search
  - `auto-confirm-payments` — Scheduled payment confirmation
  - `mark-overdue` — Scheduled overdue detection
  - `send-reminders` — Scheduled reminder delivery
  - `send-push` — Push notification dispatch
  - `invite-redirect` — Deep link redirect handler
  - Deno dependencies: `std@0.177.0`, `@supabase/supabase-js@2`

## Analytics

- **PostHog**: 4.37.3
  - SDK: `posthog-react-native`
  - Custom events for activation, retention, engagement
  - Analytics endpoint: `https://us.i.posthog.com`

## AI Integration

- **Anthropic Claude API**
  - Model: `claude-sonnet-4-20250514`
  - Used by: `process-bot-message`, `ai-insights`, `ai-draft-reminders`, `ai-search` Edge Functions
  - Input: User context (properties, tenants, payments)
  - Output: Structured JSON (intent, action, confirmation needed)

## Authentication Providers

### OAuth/SSO
- **Google OAuth 2.0** (Supabase Auth)
  - `client_id`: Pre-configured in `supabase/config.toml`
  - Scope: Email + profile

- **Apple Sign-In** (Supabase Auth)
  - Team ID from Apple Developer Account
  - Native flow (skip_nonce_check = true)

### Session Management
- JWT tokens (issued by Supabase)
- Implicit OAuth flow (avoids PKCE code verifier issues in React Native)
- Auto-refresh token rotation enabled
- Token expiry: 3600 seconds (1 hour)

## Chat & Messaging Integrations

### Telegram
- **Telegram Bot API** (polling via webhook)
  - Endpoint: `https://api.telegram.org/bot{TOKEN}/sendMessage`
  - Webhook: `supabase.functions/telegram-webhook`
  - Token via environment variable: `TELEGRAM_BOT_TOKEN`

### WhatsApp
- **WhatsApp Cloud API** (Meta Business Platform)
  - Endpoint: `https://graph.facebook.com/v21.0/{PHONE_ID}/messages`
  - Webhook: `supabase.functions/whatsapp-webhook`
  - Auth: Bearer token (access token + phone number ID)
  - Verification: Challenge-response on webhook registration

## Build & Tooling

### Build System
- **Expo CLI**: Managed workflow (no native code checkout)
- **Babel**: 7.24.0 (preset-expo)
- **Metro Bundler** (via Expo)

### Development
- **TypeScript Compiler**: `npx tsc --noEmit`
- **EAS Build** (Expo Application Services)
  - Project ID: `3bc7de51-47e7-4c4e-92e3-e6e1a40ae71b`

### Image Processing (Dev/Build)
- **Puppeteer**: 24.39.1 (HTML → PDF/images)
- **Sharp**: 0.34.5 (image manipulation)

## Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | npm dependencies, scripts |
| `app.json` | Expo config (platforms, splash, icons, plugins) |
| `tsconfig.json` | TypeScript strict mode, path aliases (@/*) |
| `babel.config.js` | Babel preset-expo |
| `supabase/config.toml` | Local Supabase emulator + auth settings |
| `.env.example` | Environment variable template |

## Environment Variables

| Variable | Purpose | Source |
|----------|---------|--------|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase API endpoint | Supabase project settings |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Public anon key (client) | Supabase project settings |
| `EXPO_PUBLIC_POSTHOG_API_KEY` | PostHog project API key | PostHog dashboard |
| `EXPO_PUBLIC_POSTHOG_HOST` | PostHog ingestion endpoint | PostHog dashboard |
| `EXPO_PUBLIC_WHATSAPP_BOT_PHONE` | Display phone in UI | Meta Business Platform |
| `EXPO_PUBLIC_TELEGRAM_BOT_USERNAME` | Bot username for link generation | Telegram BotFather |
| `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` | OAuth client ID | Google Cloud Console |
| `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` | OAuth client secret | Google Cloud Console (env var) |
| `SUPABASE_AUTH_EXTERNAL_APPLE_CLIENT_ID` | Bundle ID / Service ID | Apple Developer |
| `SUPABASE_AUTH_EXTERNAL_APPLE_SECRET` | Private key from Apple | Apple Developer (env var) |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token (Edge Functions) | Telegram BotFather |
| `WHATSAPP_ACCESS_TOKEN` | WhatsApp Cloud API token | Meta Business Platform |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp business phone ID | Meta Business Platform |
| `WHATSAPP_VERIFY_TOKEN` | Webhook verification token | Custom (set in Meta) |
| `ANTHROPIC_API_KEY` | Claude API key (Edge Functions) | Anthropic Console |

## Platform Targets

### Mobile
- **iOS**:
  - Bundle ID: `com.dwella.app`
  - Supports iPad (supportsTablet: true)
  - Non-exempt encryption flag set

- **Android**:
  - Package: `com.dwella.app`
  - Adaptive icon + background color
  - Deep linking intent filters for `dwella://`

### Web
- Bundler: Metro
- Output: Static HTML + JS
- Auth: localStorage for session persistence

## Deployment

### App Distribution
- iOS App Store (via EAS Build)
- Google Play Store (via EAS Build)

### Backend Services
- **Supabase Edge Functions**: Deploy via `supabase functions deploy <name>`
- **Database Migrations**: Applied via `supabase db push` or dashboard
- **Storage**: S3-compatible buckets (payment-proofs, avatars)

## Notable Patterns

- **Path Alias**: `@/*` maps to project root
- **Typed Routes**: Expo Router with `typedRoutes: true` for compile-time route checking
- **Deep Linking**: `dwella://invite/{token}`, `dwella://auth/callback`
- **Schema Exclusion**: `supabase/functions` excluded from TypeScript compilation
- **Implicit OAuth Flow**: Avoids PKCE storage issues in React Native

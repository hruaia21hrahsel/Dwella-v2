# Dwella v2 Directory Structure

## Project Root Layout

```
Dwella v2/
├── app/                          # Expo Router screens (file-based routing)
├── components/                   # Reusable React Native components
├── constants/                    # Theme, colors, typography, config
├── hooks/                        # Custom React hooks for data fetching
├── lib/                          # Business logic, utilities, state management
├── supabase/                     # Database migrations and Edge Functions
├── assets/                       # Images, fonts, icons
├── .planning/                    # Planning and documentation
├── .env                          # Local environment variables (git-ignored)
├── .env.example                  # Template for required env vars
├── .gitignore                    # Git ignore rules
├── app.json                      # Expo configuration
├── babel.config.js               # Babel setup for Expo Router
├── tsconfig.json                 # TypeScript configuration
├── package.json                  # Dependencies and scripts
├── CLAUDE.md                     # Project-specific Claude Code instructions
├── eas.json                      # Expo Application Services config (build/submit)
└── expo-env.d.ts                 # Expo environment variable types
```

## app/ — Screens & Routing

File-based routing with Expo Router v3. Parentheses denote route groups (not URL segments).

```
app/
├── _layout.tsx                   # Root layout (auth guard, theme provider, PostHog)
├── index.tsx                     # Splash / redirect (checks auth & onboarding)
├── +not-found.tsx                # 404 fallback
│
├── (auth)/                       # Authentication route group (not in URL)
│   ├── _layout.tsx               # Auth layout
│   ├── login.tsx                 # Email/password login
│   ├── signup.tsx                # Registration
│   ├── phone-verify.tsx          # Phone verification (OTP)
│   ├── forgot-password.tsx       # Password reset
│   └── lock.tsx                  # PIN/biometric lock screen
│
├── (tabs)/                       # Main tab navigation route group
│   ├── _layout.tsx               # Tab navigator (5 bottom tabs)
│   ├── dashboard/index.tsx       # Home: summary, AI nudge, quick actions
│   ├── properties/               # Property list & detail
│   │   ├── index.tsx             # List owned + tenant properties
│   │   ├── [id].tsx              # Property detail screen
│   │   └── _layout.tsx           # Properties stack layout
│   ├── bot/index.tsx             # Chat with AI bot
│   ├── tools/                    # AI & utility tools
│   │   ├── index.tsx             # Tools hub
│   │   ├── ai-insights.tsx       # AI-powered insights on properties/payments
│   │   ├── ai-search.tsx         # AI property/tenant search
│   │   ├── smart-reminders.tsx   # AI-generated reminder drafts
│   │   └── _layout.tsx           # Tools stack layout
│   └── profile/index.tsx         # User profile, settings, theme toggle
│
├── property/[id]/                # Property detail routes
│   ├── create.tsx                # Create new property (modal)
│   ├── [id]/tenant/              # Tenant management
│   │   ├── create.tsx            # Add tenant to property
│   │   └── [tenantId]/           # Tenant detail
│   │       ├── index.tsx         # Tenant overview + payment ledger
│   │       ├── edit.tsx          # Edit tenant
│   │       └── payment/          # Payment detail & actions
│   │           ├── [paymentId].tsx      # Payment detail + confirm
│   │           └── mark-paid.tsx        # Mark as paid + upload proof
│   └── expenses/                 # Expense tracking per property
│       ├── index.tsx             # Expense list
│       ├── add.tsx               # Create expense
│       └── [expenseId].tsx       # Edit expense
│
├── invite/[token].tsx            # Deep link invite acceptance (dwella://invite/{token})
├── onboarding/index.tsx          # First-time user onboarding flow
├── pin-setup.tsx                 # PIN setup screen
├── log-payment.tsx               # Quick log payment modal
├── payments/index.tsx            # Aggregated payment ledger (landlord + tenant view)
├── expenses/index.tsx            # Global expense overview
├── notifications/index.tsx       # Notification center (modal)
├── reminders/index.tsx           # Reminder management (modal)
└── auth/callback.tsx             # OAuth redirect callback (Google, Apple)
```

### Routing Conventions

- **`(group)/`** — Route groups; not included in URL (parentheses)
- **`[param]`** — Dynamic route segment (e.g., `[id]` → `/property/123`)
- **`_layout.tsx`** — Layout for directory (creates stack/tab navigator)
- **`index.tsx`** — Default route for directory (e.g., `app/` → `/`)
- **Modals** — Certain screens set `presentation: 'modal'` in `_layout.tsx` (e.g., property/create, log-payment, notifications)

## components/ — Reusable UI Components

```
components/
├── Layout & Structure
│   ├── DwellaHeader.tsx          # App header with optional buttons
│   ├── DwellaHeaderTitle.tsx     # Header title variant
│   ├── TabHeader.tsx             # Tab-specific header
│   ├── CustomTabBar.tsx          # Bottom tab bar with custom styling
│   └── ToastProvider.tsx         # Toast notification provider
│
├── Cards & Containers
│   ├── PropertyCard.tsx          # Property display with gradient header, tenant list
│   ├── TenantCard.tsx            # Tenant card (flat, rent, invite status)
│   ├── GlassCard.tsx             # Glassmorphism effect card
│   ├── AnimatedCard.tsx          # Card with animation
│   ├── AiInsightCard.tsx         # AI-generated insight (on dashboard)
│   └── PaymentLedger.tsx         # Payment table/list (tenant detail)
│
├── Payments
│   ├── PaymentStatusBadge.tsx    # Status badge (pending, partial, paid, confirmed, overdue)
│   └── ProofUploader.tsx         # Image/proof upload component
│
├── Forms & Input
│   └── ConfirmDialog.tsx         # Confirmation dialog overlay
│
├── Navigation & Buttons
│   ├── AssistantHeaderButton.tsx # Header button to open bot chat
│   ├── LogPaymentTabButton.tsx   # Tab bar button to quick-log payment
│   ├── NotificationsHeaderButton.tsx # Header button (notification icon + badge)
│   └── ProfileHeaderButton.tsx   # Header button to open profile
│
├── Loading States
│   ├── Skeleton.tsx              # Generic skeleton loader
│   ├── ListSkeleton.tsx          # List skeleton (multiple rows)
│   └── DashboardSkeleton.tsx     # Dashboard skeleton layout
│
├── Empty States & Feedback
│   ├── EmptyState.tsx            # No data placeholder
│   └── ErrorBanner.tsx           # Error message banner
│
├── Branding & UI
│   ├── DwellaLogo.tsx            # Logo component
│   ├── GradientButton.tsx        # Button with gradient fill
│   └── ChatBubble.tsx            # Chat message bubble (bot chat)
│
├── Tours & Guides
│   └── TourGuideCard.tsx         # Onboarding tour overlay
│
└── Auth
    └── SocialAuthButtons.tsx     # Google, Apple OAuth buttons
```

## lib/ — Business Logic & Utilities

```
lib/
├── State Management
│   ├── store.ts                  # Zustand store (auth, theme, onboarding, UI lock)
│   └── theme-context.tsx         # React Context for theme (light/dark/system)
│
├── Backend Client
│   └── supabase.ts               # Supabase JS client initialization
│
├── Data Types
│   └── types.ts                  # TypeScript interfaces (User, Property, Tenant, Payment, Notification, Expense, etc.)
│
├── Business Logic
│   ├── payments.ts               # Payment status colors, labels, due date calc, storage paths
│   ├── expenses.ts               # Expense categories, labels, validation
│   ├── invite.ts                 # Invite link generation, token validation, acceptance
│   ├── bot.ts                    # Bot message sending, Telegram/WhatsApp linking
│   ├── notifications.ts          # Push token registration (Expo Notifications)
│   ├── pdf.ts                    # PDF generation (receipts, summaries)
│   └── tour.ts                   # Tour guide step definitions
│
├── Authentication
│   ├── biometric-auth.ts         # PIN/biometric setup and verification
│   └── social-auth.ts            # Google, Apple OAuth flows
│
├── Analytics & Logging
│   ├── analytics.ts              # Analytics helper functions
│   ├── posthog.ts                # PostHog SDK setup, identify/event tracking
│   └── toast.ts                  # Toast notification display
│
└── Utilities
    └── utils.ts                  # Format currency, parse dates, adjust colors for dark mode
```

## hooks/ — Custom React Hooks

```
hooks/
├── useProperties.ts              # Fetch owned + tenant-linked properties, realtime subscription
├── useTenants.ts                 # Fetch user's own tenants (landlord view)
├── usePayments.ts                # Fetch + auto-generate payment rows, realtime updates
├── useNotifications.ts           # Fetch + subscribe to notifications
├── useExpenses.ts                # Fetch property expenses, filtering & sorting
├── useAllExpenses.ts             # Fetch all user expenses (owned properties)
├── useBotConversations.ts        # Fetch bot message history per user
├── useAiNudge.ts                 # Fetch AI nudge (6-hour cache)
└── useDashboard.ts               # Orchestrate dashboard data (combines multiple hooks)
```

### Hook Pattern

All hooks follow this pattern:
```typescript
interface UseXxxResult {
  data: Type[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useXxx(): UseXxxResult {
  const { user } = useAuthStore();
  const [data, setData] = useState<Type[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => { ... }, [user]);

  useEffect(() => { fetch(); }, [fetch]);

  // Realtime fallback
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel(...).on(...).subscribe();
    return () => supabase.removeChannel(channel);
  }, [user, fetch]);

  return { data, isLoading, error, refresh: fetch };
}
```

## constants/ — Configuration & Design Tokens

```
constants/
├── theme.ts                      # Light & Dark theme objects (colors, gradients, shadows)
├── colors.ts                     # Re-exports from LightTheme (backward compatibility)
├── typography.ts                 # Font sizes, weights, line heights
├── spacing.ts                    # Margin, padding, gap values
└── config.ts                     # App configuration (Supabase URLs, keys from env)
```

### Theme Structure

Each theme exports:
```typescript
interface Theme {
  colors: ThemeColors;       // 40+ color values (primary, status, text, etc.)
  gradients: ThemeGradients; // Hero, button, glass gradients
  shadows: ThemeShadows;     // sm, md, hero shadow definitions
}
```

## supabase/ — Database & Backend

```
supabase/
├── migrations/                   # SQL migration files (numbered 001–015)
│   ├── 001_initial_schema.sql    # users, properties, tenants, payments, notifications, bot_conversations
│   ├── 002_storage.sql           # payment-proofs bucket + RLS
│   ├── 003_phase_c.sql           # Expenses, bot metadata JSONB
│   ├── 004_expenses.sql          # Expense table refinements
│   ├── 005_fix_rls_recursion.sql # RLS policy fixes
│   ├── 006_storage_update_policy.sql
│   ├── 007_fix_storage_policies.sql
│   ├── 008_auto_confirm_email.sql
│   ├── 009_nullable_lease_start.sql
│   ├── 010_push_tokens.sql       # Push token column
│   ├── 011_bot_metadata.sql      # Bot metadata JSONB
│   ├── 012_tenant_photo_notes.sql # Tenant photo_url, notes
│   ├── 013_property_color.sql    # Property color for gradient
│   ├── 014_avatars_storage.sql   # User avatars bucket
│   └── 015_whatsapp.sql          # WhatsApp integration columns
│
└── functions/                    # Edge Functions (Deno + TypeScript)
    ├── process-bot-message/      # Claude API + action execution
    │   └── index.ts
    ├── telegram-webhook/         # Telegram bot webhook
    │   └── index.ts
    ├── whatsapp-webhook/         # WhatsApp incoming messages
    │   └── index.ts
    ├── whatsapp-send-code/       # WhatsApp verification code sender
    │   └── index.ts
    ├── auto-confirm-payments/    # Hourly cron: auto-confirm >48h payments
    │   └── index.ts
    ├── mark-overdue/             # Daily cron: mark pending as overdue
    │   └── index.ts
    ├── send-reminders/           # Daily cron: send payment reminders
    │   └── index.ts
    ├── send-push/                # Generic push notification sender
    │   └── index.ts
    ├── ai-insights/              # AI-generated property insights
    │   └── index.ts
    ├── ai-search/                # AI-powered property/tenant search
    │   └── index.ts
    ├── ai-draft-reminders/       # AI draft reminder messages
    │   └── index.ts
    └── invite-redirect/          # Smart link redirect (app or store)
        └── index.ts
```

## Database Schema

### Tables

```
users
├── id (UUID, PK, FK→auth.users)
├── email (TEXT, UNIQUE)
├── full_name (TEXT)
├── phone (TEXT)
├── avatar_url (TEXT)
├── telegram_chat_id (INT)
├── telegram_link_token (UUID)
├── whatsapp_phone (TEXT)
├── whatsapp_verify_code (TEXT)
├── push_token (TEXT)
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)

properties
├── id (UUID, PK)
├── owner_id (UUID, FK→users)
├── name (TEXT)
├── address (TEXT)
├── city (TEXT)
├── total_units (INT)
├── color (TEXT) — hex color for gradient
├── notes (TEXT)
├── is_archived (BOOLEAN)
├── archived_at (TIMESTAMPTZ)
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)

tenants
├── id (UUID, PK)
├── property_id (UUID, FK→properties)
├── user_id (UUID, FK→users, nullable)
├── flat_no (TEXT)
├── tenant_name (TEXT)
├── monthly_rent (NUMERIC)
├── security_deposit (NUMERIC)
├── due_day (INT, 1–28)
├── lease_start (DATE)
├── lease_end (DATE, nullable)
├── invite_token (UUID, UNIQUE)
├── invite_status ('pending'|'accepted'|'expired')
├── photo_url (TEXT) — tenant photo
├── notes (TEXT)
├── is_archived (BOOLEAN)
├── archived_at (TIMESTAMPTZ)
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)

payments
├── id (UUID, PK)
├── tenant_id (UUID, FK→tenants, RESTRICT)
├── property_id (UUID, FK→properties, RESTRICT)
├── amount_due (NUMERIC)
├── amount_paid (NUMERIC)
├── status ('pending'|'partial'|'paid'|'confirmed'|'overdue')
├── month (INT, 1–12)
├── year (INT)
├── due_date (DATE)
├── paid_at (TIMESTAMPTZ)
├── confirmed_at (TIMESTAMPTZ)
├── auto_confirmed (BOOLEAN)
├── proof_url (TEXT) — signed URL to payment proof
├── notes (TEXT)
├── created_at (TIMESTAMPTZ)
├── updated_at (TIMESTAMPTZ)
└── UNIQUE (tenant_id, month, year)

notifications
├── id (UUID, PK)
├── user_id (UUID, FK→users)
├── tenant_id (UUID, FK→tenants, nullable)
├── payment_id (UUID, FK→payments, nullable)
├── type (TEXT)
├── title (TEXT)
├── body (TEXT)
├── is_read (BOOLEAN)
└── created_at (TIMESTAMPTZ)

expenses
├── id (UUID, PK)
├── property_id (UUID, FK→properties)
├── user_id (UUID, FK→users)
├── amount (NUMERIC)
├── category ('repairs'|'insurance'|'rates'|'utilities'|'maintenance'|'cleaning'|'management'|'other')
├── description (TEXT)
├── expense_date (DATE)
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)

bot_conversations
├── id (UUID, PK)
├── user_id (UUID, FK→users)
├── message_type ('user'|'bot')
├── content (TEXT)
├── metadata (JSONB) — intent, entities, action_description, etc.
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)
```

### Storage Buckets

- **`payment-proofs`** — Payment proof images at `{property_id}/{tenant_id}/{year}-{month}.jpg`
- **`avatars`** — User avatar images at `{user_id}/{filename}`

## assets/ — Images, Fonts, Icons

```
assets/
├── [project-specific images and fonts]
└── [Icons are loaded via @expo/vector-icons (MaterialCommunityIcons)]
```

## Naming Conventions

### Files
- **Screens**: PascalCase (e.g., `Dashboard.tsx`) or kebab-case (e.g., `dashboard/index.tsx`)
- **Components**: PascalCase (e.g., `PropertyCard.tsx`)
- **Hooks**: camelCase with `use` prefix (e.g., `useProperties.ts`)
- **Lib files**: camelCase (e.g., `payments.ts`, `bot.ts`)
- **Constants**: camelCase (e.g., `colors.ts`, `theme.ts`)
- **Migrations**: Numbered with snake_case (e.g., `001_initial_schema.sql`, `010_push_tokens.sql`)
- **Edge Functions**: kebab-case directories (e.g., `process-bot-message/`, `auto-confirm-payments/`)

### Variables & Functions
- **React Components**: PascalCase (e.g., `PropertyCard`, `useTheme()`)
- **Hooks**: camelCase with `use` prefix (e.g., `useAuthStore()`, `useProperties()`)
- **Functions**: camelCase (e.g., `getStatusColor()`, `formatCurrency()`)
- **Constants**: UPPER_SNAKE_CASE or camelCase depending on scope
- **Database**: snake_case columns; PascalCase interfaces (e.g., `Property`, `Tenant`)
- **Status/Enum values**: lowercase strings (e.g., `'pending'`, `'confirmed'`)

### Database
- **Tables**: snake_case, plural (e.g., `users`, `properties`, `payments`)
- **Columns**: snake_case (e.g., `created_at`, `is_archived`, `owner_id`)
- **Foreign Keys**: `{table}_id` (e.g., `property_id`, `user_id`)
- **Status columns**: lowercase strings with CHECK constraints

### CSS/Styling
- **Theme values**: dot-notation (e.g., `colors.primary`, `spacing.lg`, `shadows.md`)
- **StyleSheet objects**: camelCase (e.g., `styles.container`, `styles.headerGradient`)

## Key File Locations

| Feature | Files |
|---------|-------|
| Auth flow | `app/(auth)/*.tsx`, `lib/store.ts`, `lib/supabase.ts`, `lib/biometric-auth.ts`, `lib/social-auth.ts` |
| Properties CRUD | `app/(tabs)/properties/*.tsx`, `hooks/useProperties.ts`, `components/PropertyCard.tsx` |
| Payment tracking | `app/payments/`, `app/property/[id]/tenant/[tenantId]/payment/`, `hooks/usePayments.ts`, `lib/payments.ts` |
| Bot chat | `app/(tabs)/bot/`, `supabase/functions/process-bot-message/`, `lib/bot.ts` |
| AI tools | `app/tools/`, `supabase/functions/ai-*/` |
| Notifications | `app/notifications/`, `hooks/useNotifications.ts`, `lib/notifications.ts` |
| Expenses | `app/property/[id]/expenses/`, `hooks/useExpenses.ts`, `lib/expenses.ts` |
| Invites | `app/invite/[token].tsx`, `lib/invite.ts` |
| Theme/UI | `lib/theme-context.tsx`, `constants/theme.ts`, `constants/colors.ts`, `components/` |
| Analytics | `lib/posthog.ts`, `lib/analytics.ts` |
| Database | `supabase/migrations/`, `supabase/functions/` |

## Import Path Aliases

Configured in `tsconfig.json`:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

Usage examples:
- `import { PropertyCard } from '@/components/PropertyCard';`
- `import { supabase } from '@/lib/supabase';`
- `import { useProperties } from '@/hooks/useProperties';`

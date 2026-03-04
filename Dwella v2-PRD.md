# Dwella — Product Requirements Document (PRD)

## Overview

Dwella is a cross-platform mobile app for property owners and tenants to manage rental properties, track monthly payments, and communicate via an AI-powered Telegram bot. Both user types (landlord and tenant) use the same app with the same features — role is contextual based on whether you own a property or are a tenant in one.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React Native (Expo SDK 51+, managed workflow) |
| Navigation | Expo Router (file-based routing) |
| Backend | Supabase (Auth, Postgres, Realtime, Storage, Edge Functions) |
| AI Bot | Telegram Bot API + Claude API (claude-sonnet-4-20250514) |
| PDF Generation | react-native-html-to-pdf or server-side via Edge Function |
| Deep Links | Expo Linking + Supabase dynamic invite tokens |
| State Management | Zustand (lightweight, works well with Supabase) |
| UI Library | React Native Paper or Tamagui (choose one) |

---

## Database Schema (Supabase Postgres)

### Tables

```sql
-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  telegram_chat_id BIGINT UNIQUE,        -- set when user links Telegram
  telegram_link_token TEXT UNIQUE,        -- one-time token to link Telegram
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PROPERTIES
-- ============================================
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                     -- e.g., "Sunrise Apartments"
  address TEXT,
  city TEXT,
  total_units INTEGER DEFAULT 1,
  notes TEXT,
  is_archived BOOLEAN DEFAULT FALSE,       -- soft-delete: archived properties stay in DB
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_properties_owner ON properties(owner_id);
CREATE INDEX idx_properties_active ON properties(owner_id) WHERE is_archived = FALSE;

-- ============================================
-- TENANTS
-- ============================================
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,  -- prevent hard delete
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,  -- NULL until invite accepted
  flat_no TEXT NOT NULL,
  tenant_name TEXT,                        -- landlord enters this initially
  monthly_rent NUMERIC(10,2) NOT NULL,
  security_deposit NUMERIC(10,2),
  due_day INTEGER NOT NULL CHECK (due_day BETWEEN 1 AND 28),
  lease_start DATE,
  lease_end DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'vacated')),
  is_archived BOOLEAN DEFAULT FALSE,       -- soft-delete: archived tenants stay in DB
  archived_at TIMESTAMPTZ,
  invite_token UUID DEFAULT uuid_generate_v4(),
  invite_status TEXT DEFAULT 'pending' CHECK (invite_status IN ('pending', 'accepted', 'expired')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tenants_property ON tenants(property_id);
CREATE INDEX idx_tenants_user ON tenants(user_id);
CREATE INDEX idx_tenants_active ON tenants(property_id) WHERE is_archived = FALSE;
CREATE UNIQUE INDEX idx_tenants_invite ON tenants(invite_token);

-- ============================================
-- PAYMENTS
-- ============================================
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,  -- prevent hard delete
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL,
  amount_due NUMERIC(10,2) NOT NULL,
  amount_paid NUMERIC(10,2) DEFAULT 0,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'partial', 'paid', 'confirmed', 'overdue')),
  marked_by UUID REFERENCES users(id),
  marked_at TIMESTAMPTZ,
  confirmed_by UUID REFERENCES users(id),
  confirmed_at TIMESTAMPTZ,
  auto_confirmed BOOLEAN DEFAULT FALSE,
  proof_url TEXT,                          -- Supabase Storage path for UPI screenshot
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, month, year)
);

CREATE INDEX idx_payments_tenant ON payments(tenant_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_month_year ON payments(year, month);

-- ============================================
-- NOTIFICATIONS
-- ============================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('reminder', 'overdue', 'payment_marked', 'payment_confirmed', 'invite', 'custom')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  sent_via TEXT DEFAULT 'in_app' CHECK (sent_via IN ('in_app', 'telegram', 'both')),
  read BOOLEAN DEFAULT FALSE,
  related_tenant_id UUID REFERENCES tenants(id),
  related_payment_id UUID REFERENCES payments(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);

-- ============================================
-- BOT CONVERSATION LOG (for context in AI queries)
-- ============================================
CREATE TABLE bot_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  message TEXT NOT NULL,
  source TEXT DEFAULT 'telegram' CHECK (source IN ('telegram', 'in_app')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bot_conversations_user ON bot_conversations(user_id, created_at);
```

### Row Level Security (RLS) Policies

```sql
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- USERS: can read/update own profile
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);

-- PROPERTIES: owner has full access (including archived for viewing history)
CREATE POLICY "Owner can CRUD properties" ON properties FOR ALL USING (auth.uid() = owner_id);
-- Tenants can view non-archived properties they belong to
CREATE POLICY "Tenants can view their property" ON properties FOR SELECT
  USING (is_archived = FALSE AND id IN (SELECT property_id FROM tenants WHERE user_id = auth.uid() AND is_archived = FALSE));

-- TENANTS: property owner has full access, tenant can view own non-archived record
CREATE POLICY "Owner can CRUD tenants" ON tenants FOR ALL
  USING (property_id IN (SELECT id FROM properties WHERE owner_id = auth.uid()));
CREATE POLICY "Tenant can view own record" ON tenants FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "Tenant can update own record" ON tenants FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- PAYMENTS: owner and tenant can view; both can insert/update
CREATE POLICY "Owner can manage payments" ON payments FOR ALL
  USING (tenant_id IN (
    SELECT t.id FROM tenants t
    JOIN properties p ON t.property_id = p.id
    WHERE p.owner_id = auth.uid()
  ));
CREATE POLICY "Tenant can view/update own payments" ON payments FOR ALL
  USING (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()));

-- NOTIFICATIONS: users see their own
CREATE POLICY "Users see own notifications" ON notifications FOR ALL
  USING (auth.uid() = user_id);
```

---

## Project Structure (Expo Router)

```
dwella/
├── app/
│   ├── _layout.tsx                 # Root layout (auth check, providers)
│   ├── index.tsx                   # Redirect to (tabs) or (auth)
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   ├── login.tsx               # Phone/email login
│   │   └── signup.tsx              # Registration
│   ├── (tabs)/
│   │   ├── _layout.tsx             # Tab navigator (Properties, Payments, Bot, Profile)
│   │   ├── properties/
│   │   │   ├── index.tsx           # Property cards list (owned + tenant-of)
│   │   │   └── [id].tsx            # Property detail → tenant cards
│   │   ├── payments/
│   │   │   └── index.tsx           # Aggregated payment overview across all
│   │   ├── bot/
│   │   │   └── index.tsx           # In-app AI chat interface
│   │   └── profile/
│   │       └── index.tsx           # User profile, Telegram linking, settings
│   ├── property/
│   │   ├── create.tsx              # Add/edit property form
│   │   └── [id]/
│   │       ├── edit.tsx            # Edit property
│   │       └── tenant/
│   │           ├── create.tsx      # Add tenant form → generates invite link
│   │           ├── [tenantId]/
│   │           │   ├── index.tsx   # Tenant detail + payment ledger
│   │           │   ├── edit.tsx    # Edit tenant details
│   │           │   └── payment/
│   │           │       └── [paymentId].tsx  # Payment detail (proof, confirm)
│   ├── invite/
│   │   └── [token].tsx             # Invite acceptance screen (deep link target)
│   └── +not-found.tsx
├── components/
│   ├── PropertyCard.tsx            # Property card component
│   ├── TenantCard.tsx              # Tenant card with status badge
│   ├── PaymentLedger.tsx           # Month-by-month payment grid
│   ├── PaymentStatusBadge.tsx      # Colored badge (Pending/Paid/Overdue/Confirmed)
│   ├── ProofUploader.tsx           # UPI screenshot capture/upload
│   ├── ChatBubble.tsx              # Bot conversation bubble
│   ├── EmptyState.tsx              # Empty states with illustrations
│   └── ConfirmDialog.tsx           # Reusable confirmation modal
├── lib/
│   ├── supabase.ts                 # Supabase client initialization
│   ├── types.ts                    # TypeScript interfaces for all tables
│   ├── store.ts                    # Zustand store (auth state, cached data)
│   ├── utils.ts                    # Date formatting, currency, helpers
│   ├── payments.ts                 # Payment logic (status transitions, auto-confirm)
│   ├── invite.ts                   # Invite link generation and handling
│   └── pdf.ts                      # PDF receipt and annual summary generation
├── hooks/
│   ├── useProperties.ts            # Fetch/subscribe to properties
│   ├── useTenants.ts               # Fetch/subscribe to tenants for a property
│   ├── usePayments.ts              # Fetch/subscribe to payments for a tenant
│   └── useNotifications.ts         # Notification polling/subscription
├── constants/
│   ├── colors.ts                   # App color palette
│   └── config.ts                   # API URLs, storage buckets, etc.
├── supabase/
│   ├── migrations/                 # SQL migration files (schema above)
│   └── functions/
│       ├── telegram-webhook/       # Telegram bot webhook handler
│       │   └── index.ts
│       ├── process-bot-message/    # Claude API call to parse intent
│       │   └── index.ts
│       ├── auto-confirm-payments/  # Scheduled: auto-confirm after 48hrs
│       │   └── index.ts
│       ├── mark-overdue/           # Scheduled: mark overdue payments daily
│       │   └── index.ts
│       ├── send-reminders/         # Scheduled: send due date reminders
│       │   └── index.ts
│       └── generate-pdf/           # PDF receipt/summary generation
│           └── index.ts
├── assets/
│   └── images/                     # App icons, empty state illustrations
├── app.json                        # Expo config
├── tsconfig.json
└── package.json
```

---

## Screen-by-Screen Specification

### 1. Auth Screens

**Login (login.tsx)**
- Email + password login via Supabase Auth
- "Don't have an account? Sign up" link
- Optional: Phone OTP login (Supabase supports this)

**Signup (signup.tsx)**
- Full name, email, phone (optional), password
- On signup, create entry in `users` table via trigger or client-side insert
- Redirect to Properties tab

### 2. Properties Tab (Main Screen)

**Properties List (properties/index.tsx)**

Layout: Two sections with a section header.

**Section 1: "My Properties" (where user is owner)**
- Cards showing: property name, address, unit count
- Summary line: "4/6 tenants paid this month" with a mini progress bar
- Tap → Property Detail
- FAB button: "+ Add Property"

**Section 2: "I'm a Tenant At" (where user is linked as tenant)**
- Cards showing: property name, flat number, this month's status
- Tap → Tenant's own payment ledger

**Empty state:** Friendly illustration + "Add your first property or join one via invite link"

### 3. Property Detail (properties/[id].tsx)

**Header:** Property name, address, edit/delete icons in top-right

**Stats Row:** Total units | Occupied | Vacant | This month's collection (₹X / ₹Y)

**Tenant Cards (scrollable list):**
Each card shows:
- Flat number (prominent)
- Tenant name (or "Invite Pending" in muted text)
- Monthly rent: ₹XX,XXX
- This month's status badge (color-coded)
- If invite pending: "Share Invite" button
- Tap → Tenant Detail

**Action:** "+ Add Tenant" button at bottom

**Edit Property:** Pencil icon → navigate to property/create.tsx with prefilled data

**Delete Property:** Trash icon → confirmation dialog warning that all tenant data will be archived → sets `is_archived = TRUE` and `archived_at = NOW()` on the property and all its tenants. Archived properties disappear from the main list but data is preserved. Optionally, add an "Archived" section in the properties list accessible via a toggle or filter.

**Delete Tenant:** Swipe-to-delete or trash icon → confirmation dialog → sets `is_archived = TRUE` and `archived_at = NOW()` on the tenant. Payment history is fully preserved. Archived tenants disappear from the active list but landlord can view them via an "Archived Tenants" toggle on the property detail screen.

### 4. Add/Edit Tenant (property/[id]/tenant/create.tsx)

**Form Fields:**
- Flat No. (text, required)
- Tenant Name (text, required)
- Monthly Rent (number, required, formatted as ₹)
- Security Deposit (number, optional)
- Due Day (number picker 1-28, required)
- Lease Start Date (date picker, optional)
- Lease End Date (date picker, optional)

**On Save (new tenant):**
1. Insert into `tenants` table (invite_token auto-generated)
2. Show success modal with invite link
3. "Share Invite" button opens native share sheet with link:
   `https://yourapp.com/invite/{invite_token}`
4. Also show a "Copy Link" button

**On Save (edit):**
- Update tenant record
- If rent changed, note it but don't retroactively change past payment records

### 5. Tenant Detail / Payment Ledger (property/[id]/tenant/[tenantId]/index.tsx)

**Header:** Flat number, tenant name, monthly rent, due day

**Info Card:** Lease period, security deposit, invite status

**Payment Ledger (the core feature):**
A scrollable grid/list, one row per month, most recent first.

Each row:
| Month-Year | Amount Due | Amount Paid | Status Badge | Action |
|------------|-----------|-------------|-------------|--------|
| Mar 2026   | ₹15,000   | ₹15,000     | ✅ Confirmed | View   |
| Feb 2026   | ₹15,000   | ₹10,000     | 🟡 Partial   | Pay/Confirm |
| Jan 2026   | ₹15,000   | ₹0          | 🔴 Overdue   | Pay    |

**Status Badge Colors:**
- Pending: Gray
- Partial: Yellow/Amber
- Paid (unconfirmed): Blue
- Confirmed: Green
- Overdue: Red

**Actions per row:**
- **If user is tenant:** "Mark as Paid" button → opens payment modal
- **If user is landlord and status is 'paid':** "Confirm" button → sets confirmed_by and confirmed_at
- **View:** Opens payment detail (proof image, timestamps, notes)

**Payment Modal (Mark as Paid):**
- Amount field (prefilled with remaining due, editable for partial)
- Upload proof (camera or gallery → uploads to Supabase Storage)
- Notes field (optional)
- Submit → updates payment record, sets marked_by and marked_at
- Starts 48-hour auto-confirm countdown

**PDF Actions (bottom of ledger):**
- "Download Receipt" → generates PDF for selected month
- "Annual Summary" → generates PDF summary for selected year

### 6. Payment Detail (property/[id]/tenant/[tenantId]/payment/[paymentId].tsx)

Shows full detail for a single month's payment:
- Month/Year, Amount Due, Amount Paid
- Status with timestamp trail:
  - "Marked as paid by [name] on [date] at [time]"
  - "Confirmed by [name] on [date]" OR "Auto-confirmed on [date]"
- Proof image (tappable to view full-screen)
- Notes
- If landlord and unconfirmed: "Confirm Payment" button
- If disputed: "Mark as Unpaid" (resets to pending, clears proof)

### 7. Invite Acceptance (invite/[token].tsx)

**When a user opens the invite link:**
1. If not logged in → redirect to signup/login, then back to invite
2. If logged in → show property name, flat number, rent amount, due day
3. "Accept Invite" button → sets user_id on tenant record, invite_status = 'accepted'
4. Redirects to their tenant view of that property

### 8. Payments Overview Tab (payments/index.tsx)

**Aggregated view across all properties and tenants:**

**If landlord:**
- Monthly summary cards: "March 2026: ₹1,20,000 collected / ₹1,80,000 expected"
- List of overdue/pending payments with tenant name, flat, property
- Quick "Send Reminder" button per overdue tenant

**If tenant:**
- Simple list of all months with status for their tenancies
- Quick "Pay" action on pending months

### 9. AI Bot Chat (bot/index.tsx)

**In-app chat interface mimicking the Telegram bot.**

- Chat bubble UI (user messages right, bot messages left)
- Text input at bottom with send button
- Messages stored in `bot_conversations` table
- Each message sent to the `process-bot-message` Edge Function
- Bot responds with structured action + confirmation

**Telegram Linking:**
- In Profile screen, show "Link Telegram" button
- Generates a one-time token, shows: "Open Telegram and send /start {token} to @DwellaBot"
- Bot webhook receives this, links telegram_chat_id to user

### 10. Profile Tab (profile/index.tsx)

- Edit name, email, phone
- Link/unlink Telegram account
- Notification preferences (in-app, Telegram, or both)
- App version, help/support link
- Logout

---

## AI Bot — Detailed Specification

### Architecture

```
User Message (Telegram or In-App)
  → Supabase Edge Function: telegram-webhook / in-app endpoint
    → Edge Function: process-bot-message
      → Claude API (with system prompt + user's data context)
        → Parse intent + entities
      → Execute database action via Supabase client
      → Return confirmation message
    → Send reply (Telegram API / store in bot_conversations)
```

### System Prompt for Claude API

```
You are Dwella Bot, an AI assistant for managing rental properties.
You help landlords and tenants manage payments, send reminders, and query data.

Given the user's message and their data context, respond with a JSON object:

{
  "intent": "mark_paid" | "confirm_payment" | "send_reminder" | "query_overdue" |
            "query_summary" | "add_tenant" | "unknown",
  "entities": {
    "flat_no": "3B",
    "property_name": "Sunrise Apartments",
    "tenant_name": "Mark",
    "month": 6,
    "year": 2026,
    "amount": 15000
  },
  "action_description": "Mark June 2026 as paid for tenant Mark in Flat 3B at Sunrise Apartments",
  "needs_confirmation": true,
  "reply_if_no_action": "I couldn't understand that. Try: 'Mark June as paid for Flat 3B'"
}

User's properties and tenants context will be provided. Match fuzzy names
(e.g., "Mark" matches "Mark Johnson"). If ambiguous, ask for clarification.
```

### Supported Bot Commands

| Command Example | Intent | Action |
|----------------|--------|--------|
| "Mark June as paid for Flat 3B" | mark_paid | Update payment status |
| "Confirm payment for Mark this month" | confirm_payment | Set confirmed_by |
| "Who hasn't paid this month?" | query_overdue | Query pending/overdue |
| "Send reminder to all overdue tenants" | send_reminder | Trigger notification to each |
| "Send reminder to Flat 2A" | send_reminder | Trigger notification to specific |
| "What's my total pending for March?" | query_summary | Aggregate and return |
| "Show me Sunrise Apartments summary" | query_summary | Property-level summary |
| "Add tenant in Flat 4C, rent 12000, due 5th" | add_tenant | Insert tenant record |

### Telegram Bot Setup

1. Create bot via @BotFather → get bot token
2. Set webhook URL to Supabase Edge Function URL
3. Edge Function receives updates, identifies user by telegram_chat_id
4. Processes message through Claude API
5. Executes action and replies

---

## Scheduled Edge Functions (Cron Jobs)

### 1. auto-confirm-payments (runs every hour)

```sql
-- Find payments marked as 'paid' more than 48 hours ago, not yet confirmed
UPDATE payments
SET status = 'confirmed',
    auto_confirmed = TRUE,
    confirmed_at = NOW()
WHERE status = 'paid'
  AND marked_at < NOW() - INTERVAL '48 hours'
  AND confirmed_by IS NULL;
```

### 2. mark-overdue (runs daily at midnight)

```sql
-- For each active tenant, check if current month's payment exists and is still pending
-- If today > due_day and status is 'pending', mark as 'overdue'
UPDATE payments p
SET status = 'overdue'
FROM tenants t
WHERE p.tenant_id = t.id
  AND p.status = 'pending'
  AND p.month = EXTRACT(MONTH FROM CURRENT_DATE)
  AND p.year = EXTRACT(YEAR FROM CURRENT_DATE)
  AND EXTRACT(DAY FROM CURRENT_DATE) > t.due_day;
```

### 3. send-reminders (runs daily at 9 AM)

Logic:
- 3 days before due_day: send "Rent reminder: ₹X due on [date]"
- On due_day: send "Rent is due today"
- 3 days after due_day (if still unpaid): send "Rent is overdue"
- Send via Telegram (if linked) and/or in-app notification

---

## PDF Generation

### Monthly Receipt

Contents:
- Header: "Rent Receipt — [Month] [Year]"
- Property name and address
- Tenant name, flat number
- Rent amount, amount paid, payment date
- Status (Confirmed / Auto-confirmed)
- Proof screenshot thumbnail (if available)
- Footer: "Generated by Dwella on [date]"

### Annual Summary

Contents:
- Header: "Annual Rent Summary — [Year]"
- Property and tenant info
- 12-month table: Month | Due | Paid | Status | Payment Date
- Totals row: Total Due | Total Paid | Balance
- Generated date

Implementation: Use `react-native-html-to-pdf` on client, or generate server-side in an Edge Function using HTML → PDF conversion.

---

## Invite Link Deep Linking

### Setup (app.json / Expo config)

```json
{
  "expo": {
    "scheme": "dwella",
    "plugins": [
      ["expo-linking"]
    ]
  }
}
```

### Link Format

- Universal link: `https://dwella.app/invite/{token}`
- App scheme fallback: `dwella://invite/{token}`

### Flow

1. Landlord shares link via share sheet (WhatsApp, SMS, etc.)
2. Tenant clicks link
3. If app installed → opens directly to invite/[token].tsx
4. If app not installed → opens web page with "Download App" + stores token
5. After install/login → automatically navigates to invite screen with token
6. Tenant reviews details → accepts → linked to property

---

## Real-time Subscriptions

Use Supabase Realtime to keep data fresh without manual refresh:

```typescript
// Subscribe to payment changes for a tenant
supabase
  .channel('payments')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'payments',
    filter: `tenant_id=eq.${tenantId}`
  }, (payload) => {
    // Update local state
  })
  .subscribe();

// Subscribe to notifications for current user
supabase
  .channel('notifications')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'notifications',
    filter: `user_id=eq.${userId}`
  }, (payload) => {
    // Show in-app notification toast
  })
  .subscribe();
```

---

## Color Palette & Status Colors

```typescript
const colors = {
  primary: '#4F46E5',       // Indigo — main brand
  primaryLight: '#818CF8',
  background: '#F8FAFC',    // Slate 50
  card: '#FFFFFF',
  text: '#1E293B',          // Slate 800
  textSecondary: '#64748B', // Slate 500
  border: '#E2E8F0',        // Slate 200

  // Status colors
  statusPending: '#94A3B8',   // Gray
  statusPartial: '#F59E0B',   // Amber
  statusPaid: '#3B82F6',      // Blue (unconfirmed)
  statusConfirmed: '#10B981', // Green
  statusOverdue: '#EF4444',   // Red
};
```

---

## Implementation Order

### Phase A — Core Foundation (Week 1-2)
1. Expo project setup with Router
2. Supabase project setup (schema, RLS, storage bucket)
3. Auth flow (signup, login, session management)
4. Properties CRUD (list, create, edit, delete)
5. Tenants CRUD (add, edit, delete under a property)
6. Basic navigation between all screens

### Phase B — Payments & Invites (Week 2-3)
1. Payment ledger UI with month-by-month grid
2. Mark as paid flow (with amount input)
3. Partial payment support
4. Proof upload (camera/gallery → Supabase Storage)
5. Payment confirmation flow (landlord manual + auto-confirm Edge Function)
6. Overdue detection (scheduled Edge Function)
7. Invite link generation and acceptance flow
8. Deep linking setup

### Phase C — AI Bot & Polish (Week 3-4)
1. Telegram bot setup (@BotFather, webhook)
2. Bot webhook Edge Function
3. Claude API integration for intent parsing
4. Bot action execution (mark paid, query, remind)
5. In-app bot chat UI
6. Telegram account linking flow
7. Scheduled reminders Edge Function
8. PDF receipt generation
9. Annual summary PDF
10. Notification system (in-app + Telegram)

### Phase D — Testing & Launch (Week 4-5)
1. End-to-end testing of all flows
2. Edge cases (partial payments, multiple properties, invite edge cases)
3. UI polish, loading states, error handling
4. App Store / Play Store submission prep
5. Landing page with app download links

---

## Key Technical Notes

1. **Soft-delete pattern:** Properties and tenants are never hard-deleted. Deleting sets `is_archived = TRUE` and `archived_at = NOW()`. All queries in the app should filter with `WHERE is_archived = FALSE` by default. Archiving a property also archives all its tenants. Payment records are never archived — they remain permanently linked to the (archived) tenant for historical reference. Foreign keys use `ON DELETE RESTRICT` to prevent accidental hard deletes at the DB level. If a landlord needs to permanently purge data (e.g., GDPR request), that should be a separate admin action that explicitly removes all related records.

2. **Auto-generate payment rows:** When a new month begins (or when a tenant is first added), automatically insert a payment row with status 'pending' and amount_due = monthly_rent. Use a scheduled function or do it on first access.

3. **Timezone handling:** Store all dates in UTC. Display in user's local timezone. Due day comparison should use the property's timezone (or user's timezone).

4. **Proof images:** Upload to Supabase Storage bucket `payment-proofs` with path: `{property_id}/{tenant_id}/{year}-{month}.jpg`. Generate signed URLs for viewing.

5. **Bot rate limiting:** Limit Claude API calls to prevent abuse. Cache user context (properties + tenants list) for 5 minutes to reduce DB queries per bot message.

6. **Offline support:** Use Zustand persist middleware to cache critical data locally. Show cached data with a "Last synced" indicator when offline.

7. **Currency:** Default to INR (₹). Store amounts as numbers, format on display. Could add currency preference later.

---

## Claude Code CLI Usage Tip

When starting development in Cursor with Claude Code CLI, paste this entire document as context or save it as `DWELLA-PRD.md` in your project root. Reference specific sections when asking Claude Code to implement features:

```bash
# Example Claude Code commands:
claude "Read PRD.md and set up the Expo project with the folder structure defined in the Project Structure section"
claude "Implement the database schema from PRD.md in Supabase migrations"
claude "Build the PropertyCard component and Properties list screen as described in Screen 2 of the PRD"
claude "Implement the payment ledger as described in Screen 5 with all status badges"
```

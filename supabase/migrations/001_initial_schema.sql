-- ============================================================
-- Dwella v2 — Initial Schema
-- ============================================================

-- UUID generation is built-in via gen_random_uuid() in Postgres 13+

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL UNIQUE,
  full_name   TEXT,
  phone       TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PROPERTIES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.properties (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  address      TEXT NOT NULL,
  city         TEXT NOT NULL,
  total_units  INTEGER NOT NULL DEFAULT 1,
  notes        TEXT,
  is_archived  BOOLEAN NOT NULL DEFAULT FALSE,
  archived_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TENANTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tenants (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id       UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id           UUID REFERENCES public.users(id) ON DELETE SET NULL,
  flat_no           TEXT NOT NULL,
  tenant_name       TEXT NOT NULL,
  monthly_rent      NUMERIC(12,2) NOT NULL,
  security_deposit  NUMERIC(12,2) NOT NULL DEFAULT 0,
  due_day           INTEGER NOT NULL DEFAULT 1 CHECK (due_day BETWEEN 1 AND 28),
  lease_start       DATE NOT NULL,
  lease_end         DATE,
  invite_token      UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  invite_status     TEXT NOT NULL DEFAULT 'pending' CHECK (invite_status IN ('pending', 'accepted', 'expired')),
  is_archived       BOOLEAN NOT NULL DEFAULT FALSE,
  archived_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PAYMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  property_id     UUID NOT NULL REFERENCES public.properties(id) ON DELETE RESTRICT,
  amount_due      NUMERIC(12,2) NOT NULL,
  amount_paid     NUMERIC(12,2) NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid', 'confirmed', 'overdue')),
  month           INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year            INTEGER NOT NULL,
  due_date        DATE NOT NULL,
  paid_at         TIMESTAMPTZ,
  confirmed_at    TIMESTAMPTZ,
  auto_confirmed  BOOLEAN NOT NULL DEFAULT FALSE,
  proof_url       TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, month, year)
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tenant_id   UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  payment_id  UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- BOT CONVERSATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bot_conversations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_properties_owner_id ON public.properties(owner_id);
CREATE INDEX IF NOT EXISTS idx_properties_is_archived ON public.properties(is_archived);
CREATE INDEX IF NOT EXISTS idx_tenants_property_id ON public.tenants(property_id);
CREATE INDEX IF NOT EXISTS idx_tenants_user_id ON public.tenants(user_id);
CREATE INDEX IF NOT EXISTS idx_tenants_invite_token ON public.tenants(invite_token);
CREATE INDEX IF NOT EXISTS idx_tenants_is_archived ON public.tenants(is_archived);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_id ON public.payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_property_id ON public.payments(property_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_month_year ON public.payments(month, year);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_bot_conversations_user_id ON public.bot_conversations(user_id);

-- ============================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER properties_updated_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_conversations ENABLE ROW LEVEL SECURITY;

-- Users: can only read/write own record
CREATE POLICY "users_self" ON public.users
  FOR ALL USING (auth.uid() = id);

-- Properties: owner can do everything; tenants can read their property
CREATE POLICY "properties_owner_all" ON public.properties
  FOR ALL USING (auth.uid() = owner_id);

CREATE POLICY "properties_tenant_read" ON public.properties
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.property_id = id
        AND t.user_id = auth.uid()
        AND t.is_archived = FALSE
    )
  );

-- Tenants: property owner can do everything; linked tenant can read own row
CREATE POLICY "tenants_owner_all" ON public.tenants
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_id
        AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "tenants_self_read" ON public.tenants
  FOR SELECT USING (auth.uid() = user_id);

-- Payments: property owner can do everything; tenant can read own payments
CREATE POLICY "payments_owner_all" ON public.payments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_id
        AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "payments_tenant_read" ON public.payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.id = tenant_id
        AND t.user_id = auth.uid()
    )
  );

-- Notifications: own only
CREATE POLICY "notifications_self" ON public.notifications
  FOR ALL USING (auth.uid() = user_id);

-- Bot conversations: own only
CREATE POLICY "bot_conversations_self" ON public.bot_conversations
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- AUTO-INSERT USER ON SIGNUP
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, phone)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'phone'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

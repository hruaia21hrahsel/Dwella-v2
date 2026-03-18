-- Migration 016: Split FOR ALL RLS policies into per-operation policies with explicit WITH CHECK (SEC-03)
--
-- Replaces all FOR ALL policies (which only have USING, not WITH CHECK) with
-- explicit per-operation policies. This ensures INSERT and UPDATE operations
-- are subject to WITH CHECK constraints, preventing a user from writing rows
-- they do not own even if they somehow bypass the USING check.
--
-- Tables affected: users, properties, tenants, payments, notifications, bot_conversations, expenses
-- SELECT-only policies (properties_tenant_read, tenants_self_read, payments_tenant_read) are
-- already per-operation and do NOT need changes.

BEGIN;

-- ============================================================
-- users (was: users_self FOR ALL)
-- ============================================================
DROP POLICY IF EXISTS "users_self" ON public.users;

CREATE POLICY "users_select" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_insert" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "users_update" ON public.users
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "users_delete" ON public.users
  FOR DELETE USING (auth.uid() = id);

-- ============================================================
-- properties (was: properties_owner_all FOR ALL)
-- ============================================================
DROP POLICY IF EXISTS "properties_owner_all" ON public.properties;

CREATE POLICY "properties_owner_select" ON public.properties
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "properties_owner_insert" ON public.properties
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "properties_owner_update" ON public.properties
  FOR UPDATE USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "properties_owner_delete" ON public.properties
  FOR DELETE USING (auth.uid() = owner_id);

-- ============================================================
-- tenants (was: tenants_owner_all FOR ALL)
-- Uses public.is_property_owner() SECURITY DEFINER function from migration 005
-- to avoid RLS infinite recursion between properties and tenants.
-- ============================================================
DROP POLICY IF EXISTS "tenants_owner_all" ON public.tenants;

CREATE POLICY "tenants_owner_select" ON public.tenants
  FOR SELECT USING (public.is_property_owner(property_id));

CREATE POLICY "tenants_owner_insert" ON public.tenants
  FOR INSERT WITH CHECK (public.is_property_owner(property_id));

CREATE POLICY "tenants_owner_update" ON public.tenants
  FOR UPDATE USING (public.is_property_owner(property_id)) WITH CHECK (public.is_property_owner(property_id));

CREATE POLICY "tenants_owner_delete" ON public.tenants
  FOR DELETE USING (public.is_property_owner(property_id));

-- ============================================================
-- payments (was: payments_owner_all FOR ALL)
-- ============================================================
DROP POLICY IF EXISTS "payments_owner_all" ON public.payments;

CREATE POLICY "payments_owner_select" ON public.payments
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid()));

CREATE POLICY "payments_owner_insert" ON public.payments
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid()));

CREATE POLICY "payments_owner_update" ON public.payments
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid()));

CREATE POLICY "payments_owner_delete" ON public.payments
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid()));

-- ============================================================
-- notifications (was: notifications_self FOR ALL)
-- ============================================================
DROP POLICY IF EXISTS "notifications_self" ON public.notifications;

CREATE POLICY "notifications_select" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notifications_insert" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notifications_update" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notifications_delete" ON public.notifications
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- bot_conversations (was: bot_conversations_self FOR ALL)
-- ============================================================
DROP POLICY IF EXISTS "bot_conversations_self" ON public.bot_conversations;

CREATE POLICY "bot_conversations_select" ON public.bot_conversations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "bot_conversations_insert" ON public.bot_conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "bot_conversations_update" ON public.bot_conversations
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "bot_conversations_delete" ON public.bot_conversations
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- expenses (was: owner_all FOR ALL)
-- ============================================================
DROP POLICY IF EXISTS "owner_all" ON public.expenses;

CREATE POLICY "expenses_select" ON public.expenses
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "expenses_insert" ON public.expenses
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "expenses_update" ON public.expenses
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "expenses_delete" ON public.expenses
  FOR DELETE USING (user_id = auth.uid());

COMMIT;

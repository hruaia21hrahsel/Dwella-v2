-- ============================================================
-- Fix RLS infinite recursion between properties and tenants
-- ============================================================
--
-- Cycle:
--   SELECT/INSERT on properties
--     → properties_tenant_read checks tenants
--       → tenants_owner_all checks properties   ← loops forever
--
-- Fix: replace the direct properties lookup in tenants_owner_all
-- with a SECURITY DEFINER function. SECURITY DEFINER runs as the
-- function owner (postgres) and bypasses RLS, breaking the cycle.

CREATE OR REPLACE FUNCTION public.is_property_owner(prop_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM properties
    WHERE id = prop_id AND owner_id = auth.uid()
  );
$$;

-- Rebuild the tenants policy to use the helper instead of a direct join
DROP POLICY IF EXISTS "tenants_owner_all" ON public.tenants;
CREATE POLICY "tenants_owner_all" ON public.tenants
  FOR ALL USING (public.is_property_owner(property_id));

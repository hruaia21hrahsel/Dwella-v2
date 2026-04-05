-- Fix properties_tenant_read RLS policy.
--
-- The original policy (migration 001) had a typo in the EXISTS join:
--   WHERE t.property_id = t.id
-- which compares two columns on the same tenants row and is always false,
-- so tenants linked to a property could never SELECT that property row via
-- the policy. The Linked Properties section on the Properties tab fetches
-- `tenants?select=*,properties(*)` and the embedded `properties` value
-- silently came back empty for every tenant user as a result.
--
-- The correct join is between the tenants row's property_id and the
-- properties row's id — i.e. the outer properties table in the parent
-- query. qualify it explicitly so the planner can't confuse it with the
-- inner alias.

DROP POLICY IF EXISTS "properties_tenant_read" ON public.properties;

CREATE POLICY "properties_tenant_read" ON public.properties
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.tenants t
      WHERE t.property_id = public.properties.id
        AND t.user_id = auth.uid()
        AND t.is_archived = false
    )
  );

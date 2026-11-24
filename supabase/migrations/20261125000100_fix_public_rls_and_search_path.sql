-- ============================================================================
-- Modül SaaS Security Hardening — Enable RLS on all exposed public tables
-- Resolves Supabase Security Advisor:
--   - rls_disabled_in_public (ERROR) on configurator_projects, saved_quotations,
--     configurator_production_blueprints
--   - rls_enabled_no_policy (INFO) on modul_organizations, modul_plans
--   - function_search_path_mutable (WARN) on app_public.modul_prevent_locked_project_version_mutation
-- ============================================================================

BEGIN;

-- 1. Enable & Force RLS on Store/ERP tables + add organization_id indexes
ALTER TABLE public.configurator_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configurator_projects FORCE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_configurator_projects_org_id
  ON public.configurator_projects (organization_id);

ALTER TABLE public.saved_quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_quotations FORCE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_saved_quotations_org_id
  ON public.saved_quotations (organization_id);

ALTER TABLE public.configurator_production_blueprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configurator_production_blueprints FORCE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_configurator_production_blueprints_org_id
  ON public.configurator_production_blueprints (organization_id);

-- 2. Idempotent tenant isolation & read policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'configurator_projects' AND policyname = 'tenant_isolation_policy'
  ) THEN
    CREATE POLICY tenant_isolation_policy ON public.configurator_projects
      FOR ALL TO authenticated
      USING (organization_id = (SELECT app_public.current_tenant_id()))
      WITH CHECK (organization_id = (SELECT app_public.current_tenant_id()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'saved_quotations' AND policyname = 'tenant_isolation_policy'
  ) THEN
    CREATE POLICY tenant_isolation_policy ON public.saved_quotations
      FOR ALL TO authenticated
      USING (organization_id = (SELECT app_public.current_tenant_id()))
      WITH CHECK (organization_id = (SELECT app_public.current_tenant_id()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'configurator_production_blueprints' AND policyname = 'tenant_isolation_policy'
  ) THEN
    CREATE POLICY tenant_isolation_policy ON public.configurator_production_blueprints
      FOR ALL TO authenticated
      USING (organization_id = (SELECT app_public.current_tenant_id()))
      WITH CHECK (organization_id = (SELECT app_public.current_tenant_id()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'modul_organizations' AND policyname = 'tenant_self_read_policy'
  ) THEN
    CREATE POLICY tenant_self_read_policy ON public.modul_organizations
      FOR SELECT TO authenticated
      USING (id = (SELECT app_public.current_tenant_id()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'modul_plans' AND policyname = 'authenticated_read_plans_policy'
  ) THEN
    CREATE POLICY authenticated_read_plans_policy ON public.modul_plans
      FOR SELECT TO authenticated
      USING (true);
  END IF;
END $$;

-- 3. Lock search_path on trigger function (resolves function_search_path_mutable warning)
ALTER FUNCTION app_public.modul_prevent_locked_project_version_mutation()
  SET search_path = public, pg_temp;

COMMIT;

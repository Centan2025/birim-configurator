-- ============================================================================
-- MODÜL — MULTI-TENANT B2B/B2B2C SAAS PLATFORM BACKBONE MIGRATION
-- File: supabase/migrations/20261115000100_modul_saas_multitenant_backbone.sql
-- Strategy: Additive-only (zero destructive changes to existing Birim Portal tables)
-- Security: Composite (tenant_id, id) FKs + ENABLE & FORCE ROW LEVEL SECURITY
-- ============================================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS app_public;

-- 1. Subscription Plans Catalog (Platform-level lookup)
CREATE TABLE IF NOT EXISTS public.modul_plans (
  id text PRIMARY KEY CHECK (id IN ('starter', 'professional', 'business', 'enterprise')),
  name_tr text NOT NULL,
  max_users integer NOT NULL DEFAULT 3,
  max_active_projects integer NOT NULL DEFAULT 25,
  monthly_render_credits integer NOT NULL DEFAULT 30,
  monthly_cam_exports integer NOT NULL DEFAULT 0,
  storage_quota_gb integer NOT NULL DEFAULT 5,
  allow_custom_templates boolean NOT NULL DEFAULT false,
  allow_bom_export boolean NOT NULL DEFAULT true,
  allow_cnc_export boolean NOT NULL DEFAULT false,
  allow_erp_integration boolean NOT NULL DEFAULT false,
  allow_custom_domain boolean NOT NULL DEFAULT false,
  allow_whitelabel_embed boolean NOT NULL DEFAULT false,
  allow_dealer_hierarchy boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Tenant Organizations (Customer Companies; Birim = Tenant #1)
CREATE TABLE IF NOT EXISTS public.modul_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  display_name text NOT NULL,
  legal_name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trialing', 'past_due', 'suspended')),
  plan_id text NOT NULL REFERENCES public.modul_plans(id) DEFAULT 'starter',
  custom_domain text UNIQUE,
  quote_code_prefix text NOT NULL DEFAULT 'MDL',
  integration_mode text NOT NULL DEFAULT 'standalone_cloud_inbox'
    CHECK (integration_mode IN ('birim_store_portal_rpc', 'webhook_rest_erp', 'standalone_cloud_inbox')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Session helper functions (SECURITY DEFINER + strict search_path)
CREATE OR REPLACE FUNCTION app_public.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT NULLIF(
    COALESCE(
      current_setting('request.jwt.claim.tenant_id', true),
      (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'tenant_id')
    ),
    ''
  )::uuid;
$$;

-- 3. Branches (Dealer / Store / Factory Locations)
CREATE TABLE IF NOT EXISTS public.modul_branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.modul_organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  is_dealer_branch boolean NOT NULL DEFAULT false,
  dealer_discount_pct numeric(5,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code)
);

-- 4. Teams
CREATE TABLE IF NOT EXISTS public.modul_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.modul_organizations(id) ON DELETE CASCADE,
  branch_id uuid,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, branch_id) REFERENCES public.modul_branches(tenant_id, id) ON DELETE SET NULL
);

-- 5. Organization Members (Multi-Org Membership + RBAC Role)
CREATE TABLE IF NOT EXISTS public.modul_organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.modul_organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  branch_id uuid,
  role text NOT NULL CHECK (role IN (
    'platform_admin', 'org_owner', 'org_admin', 'production_lead',
    'architect', 'designer', 'sales_rep', 'dealer_admin',
    'dealer_staff', 'external_guest', 'readonly_viewer'
  )),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, user_id),
  FOREIGN KEY (tenant_id, branch_id) REFERENCES public.modul_branches(tenant_id, id) ON DELETE SET NULL
);

CREATE OR REPLACE FUNCTION app_public.has_tenant_role(target_tenant uuid, allowed_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.modul_organization_members m
    WHERE m.tenant_id = target_tenant
      AND m.user_id = auth.uid()
      AND m.is_active = true
      AND m.role = ANY(allowed_roles)
  );
$$;

-- 6. Subscriptions
CREATE TABLE IF NOT EXISTS public.modul_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.modul_organizations(id) ON DELETE CASCADE,
  plan_id text NOT NULL REFERENCES public.modul_plans(id),
  billing_status text NOT NULL DEFAULT 'active' CHECK (billing_status IN ('trialing', 'active', 'past_due', 'canceled')),
  billing_cycle text NOT NULL DEFAULT 'annual' CHECK (billing_cycle IN ('monthly', 'annual')),
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz NOT NULL DEFAULT (now() + interval '1 year'),
  UNIQUE (tenant_id, id)
);

-- 7. Entitlement Overrides (Enterprise contract add-ons)
CREATE TABLE IF NOT EXISTS public.modul_entitlement_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.modul_organizations(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  bool_value boolean,
  limit_value integer,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, feature_key)
);

-- 8. Metered Usage Events (Render / CAM / Storage / API Metering)
CREATE TABLE IF NOT EXISTS public.modul_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.modul_organizations(id) ON DELETE CASCADE,
  actor_user_id uuid,
  metric_key text NOT NULL CHECK (metric_key IN ('cloud_render', 'cam_export', 'erp_publish', 'r2_upload_mb', 'quote_created')),
  quantity numeric(12,3) NOT NULL DEFAULT 1,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key)
);

-- 9. Tenant Brand & White-Label Settings
CREATE TABLE IF NOT EXISTS public.modul_tenant_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.modul_organizations(id) ON DELETE CASCADE,
  logo_variant text NOT NULL DEFAULT 'custom_wordmark' CHECK (logo_variant IN ('birim_authentic', 'custom_wordmark')),
  badge_subtitle text NOT NULL DEFAULT 'STUDIO',
  primary_color_hex text NOT NULL DEFAULT '#141413',
  accent_color_hex text NOT NULL DEFAULT '#8C7A6B',
  default_currency text NOT NULL DEFAULT 'TRY' CHECK (default_currency IN ('EUR', 'TRY', 'USD')),
  default_display_unit text NOT NULL DEFAULT 'cm' CHECK (default_display_unit IN ('mm', 'cm')),
  support_email text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 10. Construction Rules & Machine Profiles
CREATE TABLE IF NOT EXISTS public.modul_construction_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.modul_organizations(id) ON DELETE CASCADE,
  profile_code text NOT NULL,
  name text NOT NULL,
  carcass_thickness_mm numeric(5,2) NOT NULL DEFAULT 18,
  back_thickness_mm numeric(5,2) NOT NULL DEFAULT 8,
  back_mounting_mode text NOT NULL DEFAULT 'grooved_8mm',
  connector_system text NOT NULL DEFAULT 'minifix_dowel',
  primary_cnc_format text NOT NULL DEFAULT 'homag_mpr',
  sheet_length_mm integer NOT NULL DEFAULT 2800,
  sheet_width_mm integer NOT NULL DEFAULT 2070,
  saw_kerf_mm numeric(4,2) NOT NULL DEFAULT 4.0,
  rule_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, profile_code)
);

-- 11. Pricing Rules & Dealer Policies
CREATE TABLE IF NOT EXISTS public.modul_pricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.modul_organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  currency text NOT NULL DEFAULT 'TRY' CHECK (currency IN ('EUR', 'TRY')),
  eur_try_rate numeric(10,4) NOT NULL DEFAULT 41.8000,
  waste_factor_pct numeric(5,2) NOT NULL DEFAULT 12.00,
  target_margin_pct numeric(5,2) NOT NULL DEFAULT 35.00,
  dealer_discount_pct numeric(5,2) NOT NULL DEFAULT 0.00,
  vat_rate_pct numeric(5,2) NOT NULL DEFAULT 20.00,
  pricing_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id)
);

-- 12. Tenant Product Families
CREATE TABLE IF NOT EXISTS public.modul_product_families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.modul_organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  is_published boolean NOT NULL DEFAULT true,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code)
);

-- 13. Tenant Product Templates
CREATE TABLE IF NOT EXISTS public.modul_product_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.modul_organizations(id) ON DELETE CASCADE,
  family_id uuid,
  template_code text NOT NULL,
  name text NOT NULL,
  lifecycle_status text NOT NULL DEFAULT 'published' CHECK (lifecycle_status IN ('draft', 'published', 'deprecated', 'archived')),
  current_version integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, template_code),
  FOREIGN KEY (tenant_id, family_id) REFERENCES public.modul_product_families(tenant_id, id) ON DELETE SET NULL
);

-- 14. Immutable Product Template Versions
CREATE TABLE IF NOT EXISTS public.modul_product_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.modul_organizations(id) ON DELETE CASCADE,
  template_id uuid NOT NULL,
  version_no integer NOT NULL,
  parametric_payload jsonb NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, template_id, version_no),
  FOREIGN KEY (tenant_id, template_id) REFERENCES public.modul_product_templates(tenant_id, id) ON DELETE CASCADE
);

-- 15. Tenant Material Libraries
CREATE TABLE IF NOT EXISTS public.modul_material_libraries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.modul_organizations(id) ON DELETE CASCADE,
  material_code text NOT NULL,
  name text NOT NULL,
  brand text,
  thickness_mm numeric(5,2) NOT NULL DEFAULT 18,
  cost_per_m2_eur numeric(10,2) NOT NULL DEFAULT 18.00,
  edge_band_cost_per_m_eur numeric(10,2) NOT NULL DEFAULT 1.20,
  is_stocked boolean NOT NULL DEFAULT true,
  pbr_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, material_code)
);

-- 16. Tenant Hardware Libraries
CREATE TABLE IF NOT EXISTS public.modul_hardware_libraries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.modul_organizations(id) ON DELETE CASCADE,
  sku_code text NOT NULL,
  brand text NOT NULL,
  name text NOT NULL,
  unit_cost_eur numeric(10,2) NOT NULL DEFAULT 0,
  drilling_template_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_enabled boolean NOT NULL DEFAULT true,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, sku_code)
);

-- 17. Customer Design Projects
CREATE TABLE IF NOT EXISTS public.modul_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.modul_organizations(id) ON DELETE CASCADE,
  branch_id uuid,
  owner_user_id uuid,
  title text NOT NULL,
  customer_name text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'technically_validated', 'quoted', 'production_approved', 'exported_to_erp')),
  latest_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, branch_id) REFERENCES public.modul_branches(tenant_id, id) ON DELETE SET NULL
);

-- 18. Project Versions & Order-Locked Snapshots
CREATE TABLE IF NOT EXISTS public.modul_project_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.modul_organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL,
  version_no integer NOT NULL,
  is_order_locked boolean NOT NULL DEFAULT false,
  design_document jsonb NOT NULL,
  pricing_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  engineering_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, project_id, version_no),
  FOREIGN KEY (tenant_id, project_id) REFERENCES public.modul_projects(tenant_id, id) ON DELETE CASCADE
);

-- Trigger: Prevent mutation or deletion of order-locked project snapshots!
CREATE OR REPLACE FUNCTION app_public.modul_prevent_locked_project_version_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.is_order_locked = true THEN
    RAISE EXCEPTION 'ORDER_SNAPSHOT_IMMUTABLE: Siparişe dönüşmüş proje versiyonu değiştirilemez veya silinemez.'
      USING ERRCODE = '55000';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_modul_lock_project_version ON public.modul_project_versions;
CREATE TRIGGER trg_modul_lock_project_version
BEFORE UPDATE OR DELETE ON public.modul_project_versions
FOR EACH ROW EXECUTE FUNCTION app_public.modul_prevent_locked_project_version_mutation();

-- 19. Generated Cloud Assets (R2 Objects: GLB, Renders, PDFs, CAM Zips)
CREATE TABLE IF NOT EXISTS public.modul_generated_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.modul_organizations(id) ON DELETE CASCADE,
  project_id uuid,
  asset_kind text NOT NULL CHECK (asset_kind IN ('glb', 'render_png', 'quote_pdf', 'cam_zip', 'dxf', 'label_zpl')),
  r2_object_key text NOT NULL,
  byte_size bigint NOT NULL DEFAULT 0,
  sha256_hex text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (r2_object_key),
  CHECK (position(tenant_id::text || '/configurator/' in r2_object_key) = 1),
  FOREIGN KEY (tenant_id, project_id) REFERENCES public.modul_projects(tenant_id, id) ON DELETE SET NULL
);

-- 20. Manufacturing Outputs (BOM, Cutlist, Nesting & CNC Jobs)
CREATE TABLE IF NOT EXISTS public.modul_manufacturing_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.modul_organizations(id) ON DELETE CASCADE,
  project_version_id uuid NOT NULL,
  cnc_format text NOT NULL,
  total_sheets integer NOT NULL DEFAULT 0,
  total_holes integer NOT NULL DEFAULT 0,
  bom_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, project_version_id) REFERENCES public.modul_project_versions(tenant_id, id) ON DELETE CASCADE
);

-- 21. Outbound ERP / Webhook Connections & Events
CREATE TABLE IF NOT EXISTS public.modul_integration_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.modul_organizations(id) ON DELETE CASCADE,
  adapter_type text NOT NULL CHECK (adapter_type IN ('birim_supabase_rpc', 'webhook_hmac_v1', 'rest_erp_v1')),
  endpoint_url text,
  signing_secret_ref text,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS public.modul_integration_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.modul_organizations(id) ON DELETE CASCADE,
  connection_id uuid,
  event_type text NOT NULL,
  idempotency_key text NOT NULL,
  delivery_status text NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'delivered', 'failed_dlq')),
  attempt_count integer NOT NULL DEFAULT 0,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key),
  FOREIGN KEY (tenant_id, connection_id) REFERENCES public.modul_integration_connections(tenant_id, id) ON DELETE SET NULL
);

-- 22. Immutable Tenant Audit Logs
CREATE TABLE IF NOT EXISTS public.modul_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.modul_organizations(id) ON DELETE CASCADE,
  actor_user_id uuid,
  actor_role text,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- ENABLE & FORCE ROW LEVEL SECURITY ACROSS ALL TENANT TABLES
-- ============================================================================
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'modul_branches',
    'modul_teams',
    'modul_organization_members',
    'modul_subscriptions',
    'modul_entitlement_overrides',
    'modul_usage_events',
    'modul_tenant_settings',
    'modul_construction_rules',
    'modul_pricing_rules',
    'modul_product_families',
    'modul_product_templates',
    'modul_product_versions',
    'modul_material_libraries',
    'modul_hardware_libraries',
    'modul_projects',
    'modul_project_versions',
    'modul_generated_assets',
    'modul_manufacturing_outputs',
    'modul_integration_connections',
    'modul_integration_events',
    'modul_audit_logs'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON public.%I;', tbl);
    EXECUTE format(
      'CREATE POLICY tenant_isolation_policy ON public.%I FOR ALL USING (tenant_id = app_public.current_tenant_id()) WITH CHECK (tenant_id = app_public.current_tenant_id());',
      tbl
    );
  END LOOP;
END $$;

-- ============================================================================
-- SEED PLANS & TENANT #1: BİRİM MOBİLYA SANAYİ VE TİCARET A.Ş.
-- ============================================================================
INSERT INTO public.modul_plans (
  id, name_tr, max_users, max_active_projects, monthly_render_credits, monthly_cam_exports,
  storage_quota_gb, allow_custom_templates, allow_bom_export, allow_cnc_export,
  allow_erp_integration, allow_custom_domain, allow_whitelabel_embed, allow_dealer_hierarchy
) VALUES
  ('starter', 'Starter (Tasarım Başlangıç)', 2, 25, 30, 0, 5, false, true, false, false, false, false, false),
  ('professional', 'Professional (İç Mimarlık & Stüdyo)', 10, 250, 200, 0, 50, true, true, false, false, false, true, false),
  ('business', 'Business (Üretici & Atölye)', 35, 2000, 800, 500, 250, true, true, true, true, true, true, true),
  ('enterprise', 'Enterprise (Kurumsal Fabrika & Çok Şube)', 9999, 999999, 10000, 999999, 2048, true, true, true, true, true, true, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.modul_organizations (
  id, slug, display_name, legal_name, status, plan_id, custom_domain, quote_code_prefix, integration_mode
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'birim',
  'BİRİM',
  'Birim Mobilya Sanayi ve Ticaret A.Ş.',
  'active',
  'enterprise',
  'modul.birim.com',
  'BRM',
  'birim_store_portal_rpc'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.modul_tenant_settings (
  tenant_id, logo_variant, badge_subtitle, primary_color_hex, accent_color_hex, default_currency, default_display_unit, support_email
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'birim_authentic',
  'MODÜL',
  '#141413',
  '#8C7A6B',
  'EUR',
  'mm',
  'info@birim.com'
) ON CONFLICT (tenant_id) DO NOTHING;

COMMIT;
